import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { MapPin, Navigation, Search, Info } from 'lucide-react';
import { motion } from 'framer-motion';

// Fix Leaflet's default icon path issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const FULL_DISTANCE_KM = 195.5;
const FLAT_FARE_FULL_TRIP = 700;

// Component to handle routing within React-Leaflet
const RoutingMachine = ({ pickup, drop, onRouteCalculated }) => {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (!pickup || !drop) return;

    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
    }

    const control = L.Routing.control({
      waypoints: [
        L.latLng(pickup.lat, pickup.lng),
        L.latLng(drop.lat, drop.lng)
      ],
      routeWhileDragging: true,
      showAlternatives: false,
      fitSelectedRoutes: true,
      lineOptions: {
        styles: [{ color: '#00f0ff', weight: 6, opacity: 0.8 }]
      },
      createMarker: () => null, // We handle our own markers
      addWaypoints: false,
      draggableWaypoints: false,
      show: false // Hide text instructions
    }).addTo(map);

    control.on('routesfound', function (e) {
      const routes = e.routes;
      const summary = routes[0].summary;
      // summary.totalDistance is in meters
      const distanceKm = summary.totalDistance / 1000;
      onRouteCalculated(distanceKm);
    });

    routingControlRef.current = control;

    return () => {
      if (routingControlRef.current && map) {
        map.removeControl(routingControlRef.current);
      }
    };
  }, [pickup, drop, map, onRouteCalculated]);

  return null;
};

const MapPriceEstimator = ({ onBookReady, initialPickup, initialDrop }) => {
  const [pickup, setPickup] = useState(initialPickup || null);
  const [drop, setDrop] = useState(initialDrop || null);
  const [distance, setDistance] = useState(0);
  const [fare, setFare] = useState(0);
  const [persons, setPersons] = useState('');
  
  const [pickupText, setPickupText] = useState('');
  const [dropText, setDropText] = useState('');

  const mapCenter = [28.6139, 77.2090]; // Default to Delhi

  useEffect(() => {
    // Reset persons when pickup or drop coordinates change
    setPersons('');
  }, [pickup, drop]);

  const geocodeAddress = async (address, type) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        if (type === 'pickup') setPickup(coords);
        else setDrop(coords);
      } else {
        alert('Location not found!');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPickup({ lat: position.coords.latitude, lng: position.coords.longitude });
          setPickupText('Current Location');
        },
        (error) => {
          alert('Error getting location. Please check permissions.');
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  const handleRouteCalculated = (distKm) => {
    setDistance(distKm.toFixed(1));
    // Calculate proportional price for one person based on a 700 INR flat rate for 195.5 km
    const fareForOne = Math.round((distKm / FULL_DISTANCE_KM) * FLAT_FARE_FULL_TRIP);
    setFare(fareForOne);
  };

  return (
    <div className="w-full relative h-[min(70vh,520px)] sm:h-[500px] md:h-[600px] rounded-2xl overflow-hidden shadow-2xl border border-white/10">
      {/* Map Layer */}
      <MapContainer center={mapCenter} zoom={11} className="w-full h-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" // Dark theme map tiles
        />
        
        {pickup && <Marker position={pickup}><Popup>Pickup Location</Popup></Marker>}
        {drop && <Marker position={drop}><Popup>Drop Location</Popup></Marker>}
        
        <RoutingMachine pickup={pickup} drop={drop} onRouteCalculated={handleRouteCalculated} />
      </MapContainer>

      {/* Floating UI Overlays */}
      <div className="absolute top-3 sm:top-4 left-0 right-0 mx-auto w-[94%] sm:w-[90%] md:w-80 md:mx-0 md:left-4 md:right-auto z-[1000] flex flex-col gap-2 sm:gap-3">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-3 sm:p-4 rounded-xl flex flex-col gap-2.5 sm:gap-4 shadow-xl backdrop-blur-xl"
        >
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <div className="w-3 h-3 rounded-full bg-brand-accent"></div>
            </div>
            <input 
              type="text" 
              placeholder="Enter Pickup Location" 
              value={pickupText}
              onChange={(e) => setPickupText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && geocodeAddress(pickupText, 'pickup')}
              className="w-full bg-white/10 border border-white/20 text-white pl-10 pr-10 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base focus:outline-none focus:border-brand-accent transition-colors"
            />
            <button onClick={useCurrentLocation} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-brand-accent transition-colors">
              <Navigation size={18} />
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <div className="w-3 h-3 rounded-sm bg-brand-secondary"></div>
            </div>
            <input 
              type="text" 
              placeholder="Enter Drop Location" 
              value={dropText}
              onChange={(e) => setDropText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && geocodeAddress(dropText, 'drop')}
              className="w-full bg-white/10 border border-white/20 text-white pl-10 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base focus:outline-none focus:border-brand-secondary transition-colors"
            />
          </div>

          <button 
            onClick={() => {
              if (pickupText && !pickup) geocodeAddress(pickupText, 'pickup');
              if (dropText && !drop) geocodeAddress(dropText, 'drop');
            }}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 py-2 rounded text-sm text-gray-300 transition-colors"
          >
            Search Locations
          </button>
        </motion.div>
      </div>

      {/* Floating Fare Estimator */}
      {distance > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[94%] sm:w-11/12 max-w-md glass-card p-4 sm:p-5 rounded-2xl flex flex-col items-center border border-brand-accent/30"
        >
          <div className="w-full flex justify-between items-center mb-4 px-2">
            <div className="text-left">
              <span className="block text-gray-400 text-xs uppercase tracking-wider mb-1">Distance</span>
              <span className="text-xl font-bold text-white">{distance} <span className="text-sm font-normal">km</span></span>
            </div>
            <div className="w-px bg-white/10 h-10 mx-4"></div>
            <div className="flex-1 max-w-[180px] text-right">
              <span className="block text-gray-400 text-xs uppercase tracking-wider mb-1.5">No. of Persons</span>
              <select
                value={persons}
                onChange={(e) => setPersons(e.target.value ? Number(e.target.value) : '')}
                className="w-full p-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm focus:border-brand-accent focus:outline-none transition-colors"
              >
                <option value="" className="bg-brand-dark text-gray-400">Select...</option>
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <option key={num} value={num} className="bg-brand-dark">
                    {num} Person{num > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {persons !== '' ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full flex flex-col items-center animate-fade-in"
            >
              <div className="w-full h-px bg-white/10 my-3"></div>
              
              <div className="text-center mb-4">
                <span className="block text-gray-400 text-xs uppercase tracking-wider mb-1">Total Est. Fare</span>
                <span className="text-3xl font-bold text-glow text-brand-accent">₹{fare * persons}</span>
                <span className="block text-gray-500 text-[10px] mt-1">
                  (₹{fare} per person)
                </span>
              </div>

              {onBookReady && (
                <button 
                  onClick={() => onBookReady({ 
                    pickup, 
                    drop, 
                    distance, 
                    fare, 
                    seats: persons, 
                    pickupText: pickupText || 'Map Location', 
                    dropText: dropText || 'Map Location' 
                  })}
                  className="w-full bg-brand-accent hover:bg-brand-accentHover text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(255,42,95,0.4)]"
                >
                  Request Ride Now
                </button>
              )}
              {!onBookReady && (
                <div className="text-xs text-gray-400 flex items-center gap-1 mt-2">
                  <Info size={12} /> Log in to book this ride
                </div>
              )}
            </motion.div>
          ) : (
            <div className="text-[11px] text-brand-accent/90 flex items-center gap-1.5 mt-1 font-medium bg-brand-accent/10 px-3 py-2 rounded-lg border border-brand-accent/20 w-full justify-center">
              <Info size={14} className="shrink-0" /> Please select the number of persons to calculate the fare.
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default MapPriceEstimator;
