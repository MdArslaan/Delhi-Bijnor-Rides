import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { Clock, MapPin } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DriverToPickupRoute = ({ driverLocation, pickupCoords, onEtaCalculated }) => {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!driverLocation || !pickupCoords) return;

    if (routingRef.current) {
      map.removeControl(routingRef.current);
    }

    const control = L.Routing.control({
      waypoints: [
        L.latLng(driverLocation.lat, driverLocation.lng),
        L.latLng(pickupCoords.lat, pickupCoords.lng),
      ],
      routeWhileDragging: false,
      showAlternatives: false,
      fitSelectedRoutes: true,
      lineOptions: {
        styles: [{ color: '#00f0ff', weight: 5, opacity: 0.85 }],
      },
      createMarker: () => null,
      addWaypoints: false,
      draggableWaypoints: false,
      show: false,
    }).addTo(map);

    control.on('routesfound', (e) => {
      const summary = e.routes[0].summary;
      // totalTime is in seconds (not ms), so divide by 60 for minutes
      const etaMinutes = Math.max(1, Math.round(summary.totalTime / 60));
      onEtaCalculated(etaMinutes);
    });

    routingRef.current = control;

    return () => {
      if (routingRef.current && map) {
        map.removeControl(routingRef.current);
      }
    };
  }, [driverLocation, pickupCoords, map, onEtaCalculated]);

  return null;
};

const ActiveRideMap = ({ ride, driverLocation, onEtaCalculated }) => {
  const [localEta, setLocalEta] = useState(ride.etaMinutes);

  const pickup = ride.pickupCoords;
  const drop = ride.dropCoords;
  const driver = driverLocation || ride.driverLocation;
  const center = driver
    ? [driver.lat, driver.lng]
    : pickup
      ? [pickup.lat, pickup.lng]
      : [28.6139, 77.2090];

  const handleEta = (minutes) => {
    setLocalEta(minutes);
    if (onEtaCalculated) onEtaCalculated(minutes);
  };

  useEffect(() => {
    if (ride.etaMinutes) setLocalEta(ride.etaMinutes);
  }, [ride.etaMinutes]);

  if (!pickup) {
    return (
      <div className="h-56 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 text-sm">
        Pickup location not available for map
      </div>
    );
  }

  // Status label for overlay
  const statusLabel = {
    Accepted: { text: 'Driver En Route', color: 'text-blue-400', border: 'border-blue-400/30' },
    Arrived: { text: 'Driver Arrived', color: 'text-purple-400', border: 'border-purple-400/30' },
    Ongoing: { text: 'Ride In Progress', color: 'text-brand-accent', border: 'border-brand-accent/30' },
  }[ride.status] || { text: ride.status, color: 'text-gray-400', border: 'border-gray-400/30' };

  return (
    <div className="relative h-64 md:h-80 rounded-xl overflow-hidden border border-brand-accent/20 shadow-[0_0_30px_rgba(0,240,255,0.1)]">
      <MapContainer center={center} zoom={13} className="w-full h-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
          <Popup>📍 Pickup — {ride.pickup}</Popup>
        </Marker>
        {drop && (
          <Marker position={[drop.lat, drop.lng]}>
            <Popup>🏁 Drop — {ride.drop}</Popup>
          </Marker>
        )}
        {driver && (
          <Marker position={[driver.lat, driver.lng]} icon={driverIcon}>
            <Popup>🚗 Driver location</Popup>
          </Marker>
        )}
        {driver && ride.status === 'Accepted' && (
          <DriverToPickupRoute
            driverLocation={driver}
            pickupCoords={pickup}
            onEtaCalculated={handleEta}
          />
        )}
      </MapContainer>

      {/* Status badge */}
      <div className={`absolute top-3 right-3 z-[1000] glass px-3 py-1.5 rounded-full border ${statusLabel.border} flex items-center gap-1.5`}>
        <span className={`w-2 h-2 rounded-full animate-pulse ${statusLabel.color.replace('text-', 'bg-')}`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${statusLabel.color}`}>{statusLabel.text}</span>
      </div>

      {/* ETA overlay — only show when en route */}
      {ride.status === 'Accepted' && (
        <div className="absolute top-3 left-3 z-[1000] glass px-4 py-2 rounded-lg border border-brand-accent/30 flex items-center gap-3">
          <Clock size={18} className="text-brand-accent" />
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">ETA to pickup</p>
            <p className="text-lg font-bold text-white">
              {localEta ? `${localEta} min` : driver ? 'Calculating...' : 'Waiting for driver'}
            </p>
          </div>
        </div>
      )}

      {!driver && ride.status === 'Accepted' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] glass px-3 py-1.5 rounded-lg text-xs text-gray-300 flex items-center gap-1">
          <MapPin size={14} className="text-brand-accent" />
          Driver is on the way — location updating soon
        </div>
      )}
    </div>
  );
};

export default ActiveRideMap;
