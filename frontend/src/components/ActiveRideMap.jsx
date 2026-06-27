import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { Clock, MapPin, Navigation } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Animated pulsing car icon for driver
const createDriverIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:44px;height:44px;">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:rgba(0,240,255,0.25);
          animation:pulse-ring 1.6s ease-out infinite;
        "></div>
        <div style="
          position:absolute;inset:6px;border-radius:50%;
          background:#00f0ff;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 16px rgba(0,240,255,0.9);
          font-size:18px;
        ">🚗</div>
      </div>
      <style>
        @keyframes pulse-ring {
          0%   { transform:scale(0.6); opacity:1; }
          100% { transform:scale(1.8); opacity:0; }
        }
      </style>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const dropIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Auto-pans map to driver position
const MapPanner = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.8 });
    }
  }, [position, map]);
  return null;
};

// Draws the routing line between two points
const RouteLine = ({ from, to, color = '#00f0ff', onEtaCalculated }) => {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!from || !to) return;
    if (routingRef.current) {
      try { map.removeControl(routingRef.current); } catch (_) {}
    }

    const control = L.Routing.control({
      waypoints: [L.latLng(from.lat, from.lng), L.latLng(to.lat, to.lng)],
      routeWhileDragging: false,
      showAlternatives: false,
      fitSelectedRoutes: false,
      lineOptions: { styles: [{ color, weight: 5, opacity: 0.85 }] },
      createMarker: () => null,
      addWaypoints: false,
      draggableWaypoints: false,
      show: false,
    }).addTo(map);

    if (onEtaCalculated) {
      control.on('routesfound', (e) => {
        const seconds = e.routes[0].summary.totalTime;
        onEtaCalculated(Math.max(1, Math.round(seconds / 60)));
      });
    }

    routingRef.current = control;
    return () => {
      try { if (routingRef.current && map) map.removeControl(routingRef.current); } catch (_) {}
    };
  }, [from, to, map, color, onEtaCalculated]);

  return null;
};

const ActiveRideMap = ({ ride, driverLocation, onEtaCalculated }) => {
  const [localEta, setLocalEta] = useState(ride.etaMinutes || null);

  const pickup = ride.pickupCoords;
  const drop = ride.dropCoords;
  const driver = driverLocation || ride.driverLocation;

  const center = driver
    ? [driver.lat, driver.lng]
    : pickup
    ? [pickup.lat, pickup.lng]
    : [28.6139, 77.209];

  const handleEta = (minutes) => {
    setLocalEta(minutes);
    if (onEtaCalculated) onEtaCalculated(minutes);
  };

  useEffect(() => {
    if (ride.etaMinutes != null) setLocalEta(ride.etaMinutes);
  }, [ride.etaMinutes]);

  if (!pickup) {
    return (
      <div className="h-56 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 text-sm">
        Pickup location not available for map
      </div>
    );
  }

  const statusConfig = {
    Accepted: { text: 'Driver En Route', color: 'text-blue-400', border: 'border-blue-400/30', dot: 'bg-blue-400' },
    Arrived:  { text: 'Driver Arrived!', color: 'text-purple-400', border: 'border-purple-400/30', dot: 'bg-purple-400' },
    Ongoing:  { text: 'Ride In Progress', color: 'text-brand-accent', border: 'border-brand-accent/30', dot: 'bg-brand-accent' },
  };
  const statusLabel = statusConfig[ride.status] || { text: ride.status, color: 'text-gray-400', border: 'border-gray-400/30', dot: 'bg-gray-400' };

  const showDriverRoute = driver && ['Accepted', 'Arrived'].includes(ride.status);
  const showRideRoute   = drop && ride.status === 'Ongoing';

  return (
    <div className="relative h-52 sm:h-64 md:h-72 rounded-xl overflow-hidden border border-brand-accent/20 shadow-[0_0_30px_rgba(0,240,255,0.1)]">
      <MapContainer center={center} zoom={13} className="w-full h-full" scrollWheelZoom={false}>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Pickup marker */}
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
          <Popup>📍 Pickup — {ride.pickup}</Popup>
        </Marker>

        {/* Drop marker */}
        {drop && (
          <Marker position={[drop.lat, drop.lng]} icon={dropIcon}>
            <Popup>🏁 Drop — {ride.drop}</Popup>
          </Marker>
        )}

        {/* Animated driver marker */}
        {driver && (
          <Marker position={[driver.lat, driver.lng]} icon={createDriverIcon()}>
            <Popup>🚗 Your Driver</Popup>
          </Marker>
        )}

        {/* Auto-pan map to follow driver */}
        {driver && <MapPanner position={driver} />}

        {/* Route: driver → pickup (en route or arrived) */}
        {showDriverRoute && (
          <RouteLine
            from={driver}
            to={pickup}
            color="#00f0ff"
            onEtaCalculated={handleEta}
          />
        )}

        {/* Route: pickup → drop (once ride started) */}
        {showRideRoute && (
          <RouteLine from={pickup} to={drop} color="#a78bfa" />
        )}
      </MapContainer>

      {/* Status badge */}
      <div className={`absolute top-2 right-2 sm:top-3 sm:right-3 z-[1000] glass px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border ${statusLabel.border} flex items-center gap-1 sm:gap-1.5`}>
        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse ${statusLabel.dot}`} />
        <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${statusLabel.color}`}>{statusLabel.text}</span>
      </div>

      {/* ETA overlay — show when driver is en route OR arrived */}
      {['Accepted', 'Arrived'].includes(ride.status) && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-[1000] glass px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-brand-accent/30 flex items-center gap-2 sm:gap-3 max-w-[55%] sm:max-w-none">
          <Clock size={16} className="text-brand-accent shrink-0 sm:w-[18px] sm:h-[18px]" />
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider truncate">
              {ride.status === 'Arrived' ? 'At pickup' : 'ETA'}
            </p>
            <p className="text-sm sm:text-lg font-bold text-white truncate">
              {ride.status === 'Arrived'
                ? '🟢 Here!'
                : localEta
                ? `${localEta} min`
                : driver
                ? 'Calculating...'
                : 'Waiting...'}
            </p>
          </div>
        </div>
      )}

      {/* "Waiting for driver location" hint */}
      {!driver && ride.status === 'Accepted' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] glass px-3 py-1.5 rounded-lg text-xs text-gray-300 flex items-center gap-1.5 whitespace-nowrap">
          <Navigation size={13} className="text-brand-accent animate-bounce" />
          Driver is on the way — location updating soon
        </div>
      )}
    </div>
  );
};

export default ActiveRideMap;
