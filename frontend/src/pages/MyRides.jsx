import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { motion } from 'framer-motion';
import { Phone, User, KeyRound, Navigation } from 'lucide-react';
import ActiveRideMap from '../components/ActiveRideMap';
import RideChat from '../components/RideChat';

const API = 'http://localhost:5000/api';

const ACTIVE_STATUSES = ['Accepted', 'Arrived', 'Ongoing'];

const MyRides = () => {
  const [rides, setRides] = useState([]);
  const [driverLocations, setDriverLocations] = useState({});
  const [otpInputs, setOtpInputs] = useState({});
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const locationWatchRef = useRef(null);
  const lastLocationSentRef = useRef(0);

  const fetchMyRides = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/rides/my-rides`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setRides(res.data);
    } catch (error) {
      console.error('Error fetching my rides', error);
    }
  }, [user.token]);

  useEffect(() => {
    fetchMyRides();
  }, [fetchMyRides]);

  useEffect(() => {
    if (!socket) return;

    const onRideUpdated = (updatedRide) => {
      const ride = { ...updatedRide };
      if (user.role === 'Driver') delete ride.startOtp;
      setRides((prev) => prev.map((r) => (r._id === ride._id ? ride : r)));
    };

    const onLocationUpdate = (payload) => {
      setDriverLocations((prev) => ({
        ...prev,
        [payload.rideId]: payload.driverLocation,
      }));
      setRides((prev) =>
        prev.map((r) =>
          r._id === payload.rideId
            ? { ...r, driverLocation: payload.driverLocation, etaMinutes: payload.etaMinutes }
            : r
        )
      );
    };

    socket.on('ride_updated', onRideUpdated);
    socket.on('driver_location_update', onLocationUpdate);

    return () => {
      socket.off('ride_updated', onRideUpdated);
      socket.off('driver_location_update', onLocationUpdate);
    };
  }, [socket, user.role]);

  useEffect(() => {
    if (!socket) return;

    rides.forEach((ride) => {
      if (ACTIVE_STATUSES.includes(ride.status)) {
        socket.emit('join_ride', ride._id);
      }
    });

    return () => {
      rides.forEach((ride) => {
        if (ACTIVE_STATUSES.includes(ride.status)) {
          socket.emit('leave_ride', ride._id);
        }
      });
    };
  }, [socket, rides]);

  const sendDriverLocation = useCallback(
    async (rideId, lat, lng, etaMinutes) => {
      try {
        await axios.put(
          `${API}/rides/${rideId}/location`,
          { lat, lng, etaMinutes },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
      } catch (err) {
        console.error('Location update failed', err);
      }
    },
    [user.token]
  );

  useEffect(() => {
    if (user.role !== 'Driver' || !navigator.geolocation) return;

    const activeRide = rides.find((r) => r.status === 'Accepted');
    if (!activeRide) {
      if (locationWatchRef.current) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      return;
    }

    if (locationWatchRef.current) return;

    locationWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastLocationSentRef.current < 12000) return;
        lastLocationSentRef.current = now;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDriverLocations((prev) => ({
          ...prev,
          [activeRide._id]: { lat, lng },
        }));
        sendDriverLocation(activeRide._id, lat, lng, activeRide.etaMinutes);
      },
      (err) => console.error('Geolocation error', err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      if (locationWatchRef.current) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [rides, user.role, sendDriverLocation]);

  const handleStatusUpdate = async (rideId, newStatus) => {
    try {
      await axios.put(
        `${API}/rides/${rideId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      fetchMyRides();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating ride');
    }
  };

  const handleMarkArrived = async (rideId) => {
    try {
      await axios.post(`${API}/rides/${rideId}/arrived`, null, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      fetchMyRides();
    } catch (error) {
      alert(error.response?.data?.message || 'Error marking arrival');
    }
  };

  const handleVerifyOtp = async (rideId) => {
    const otp = otpInputs[rideId];
    if (!otp?.trim()) {
      alert('Please enter the OTP from the passenger');
      return;
    }
    try {
      await axios.post(
        `${API}/rides/${rideId}/verify-otp`,
        { otp: otp.trim() },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setOtpInputs((prev) => ({ ...prev, [rideId]: '' }));
      fetchMyRides();
    } catch (error) {
      alert(error.response?.data?.message || 'Invalid OTP');
    }
  };

  const handleEtaFromMap = (rideId, etaMinutes) => {
    if (user.role !== 'Driver') return;
    const ride = rides.find((r) => r._id === rideId);
    const loc = driverLocations[rideId] || ride?.driverLocation;
    if (loc && ride?.status === 'Accepted') {
      sendDriverLocation(rideId, loc.lat, loc.lng, etaMinutes);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Requested':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30 shadow-[0_0_10px_rgba(250,204,21,0.2)]';
      case 'Accepted':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/30 shadow-[0_0_10px_rgba(96,165,250,0.2)]';
      case 'Arrived':
        return 'text-purple-400 bg-purple-400/10 border-purple-400/30 shadow-[0_0_10px_rgba(192,132,252,0.2)]';
      case 'Ongoing':
        return 'text-brand-accent bg-brand-accent/10 border-brand-accent/30 shadow-[0_0_10px_rgba(0,240,255,0.2)]';
      case 'Completed':
        return 'text-green-400 bg-green-400/10 border-green-400/30 shadow-[0_0_10px_rgba(74,222,128,0.2)]';
      case 'Cancelled':
        return 'text-brand-secondary bg-brand-secondary/10 border-brand-secondary/30 shadow-[0_0_10px_rgba(255,0,60,0.2)]';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getContact = (ride) => {
    if (user.role === 'Passenger') {
      return { name: ride.driverId?.fullName, phone: ride.driverId?.phone, label: 'Driver' };
    }
    return { name: ride.passengerId?.fullName, phone: ride.passengerId?.phone, label: 'Passenger' };
  };

  const isActiveRide = (status) => ACTIVE_STATUSES.includes(status);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-brand-dark p-6 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[20%] w-[40vw] h-[40vw] bg-brand-accent/10 rounded-full blur-[120px] pointer-events-none" />

      <h2 className="text-4xl font-extrabold mb-8 text-center text-white">
        My <span className="text-glow text-brand-accent">Rides</span>
      </h2>

      {rides.length === 0 ? (
        <p className="text-center text-gray-400 mt-10">You have no ride history.</p>
      ) : (
        <div className="max-w-4xl mx-auto flex flex-col gap-6 z-10 relative">
          {rides.map((ride, index) => {
            const contact = getContact(ride);
            const showActivePanel = isActiveRide(ride.status);
            const driverLoc = driverLocations[ride._id] || ride.driverLocation;

            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                key={ride._id}
                className="glass p-6 rounded-2xl border border-white/10 shadow-lg flex flex-col gap-6"
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <span
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border tracking-wider uppercase ${getStatusColor(ride.status)}`}
                  >
                    {ride.status}
                  </span>
                  <span className="text-sm text-gray-400 font-medium">
                    {new Date(ride.createdAt).toLocaleString()}
                  </span>
                </div>

                {showActivePanel && contact.name && (
                  <div className="bg-gradient-to-br from-brand-accent/5 to-transparent border border-brand-accent/20 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1.5 h-5 bg-brand-accent rounded-full" />
                      <p className="text-brand-accent text-sm uppercase tracking-wider font-bold">
                        Your {contact.label}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 mb-5">
                      {/* Name card */}
                      <div className="flex-1 flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4 hover:border-brand-accent/30 transition-colors">
                        <div className="w-11 h-11 rounded-full bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center shrink-0">
                          <User size={22} className="text-brand-accent" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Name</p>
                          <p className="text-white font-bold text-base leading-tight">{contact.name}</p>
                        </div>
                      </div>

                      {/* Phone card */}
                      <div className="flex-1 flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4 hover:border-brand-accent/30 transition-colors">
                        <div className="w-11 h-11 rounded-full bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center shrink-0">
                          <Phone size={22} className="text-brand-accent" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Phone</p>
                          <a
                            href={`tel:${contact.phone}`}
                            className="text-white font-bold text-base hover:text-brand-accent transition-colors"
                          >
                            {contact.phone}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Chat — always open for active rides */}
                    <RideChat rideId={ride._id} isActive={showActivePanel} defaultOpen={true} />
                  </div>
                )}

                {showActivePanel && (
                  <ActiveRideMap
                    ride={ride}
                    driverLocation={driverLoc}
                    onEtaCalculated={(eta) => handleEtaFromMap(ride._id, eta)}
                  />
                )}

                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex flex-col gap-3 bg-white/5 p-4 rounded-xl border border-white/5 relative overflow-hidden">
                      <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-700" />
                      <div className="flex items-start gap-4 relative">
                        <div className="w-3 h-3 rounded-full bg-brand-accent mt-1 z-10 shadow-[0_0_10px_rgba(0,240,255,0.8)]" />
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Pickup</p>
                          <p className="font-medium text-gray-200">{ride.pickup}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 relative">
                        <div className="w-3 h-3 rounded-full bg-brand-secondary mt-1 z-10 shadow-[0_0_10px_rgba(255,0,60,0.8)]" />
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Drop</p>
                          <p className="font-medium text-gray-200">{ride.drop}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-auto bg-brand-dark/50 p-5 rounded-xl border border-brand-accent/20 min-w-[240px]">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-400 text-sm">Fare</span>
                      <span className="text-2xl font-bold text-glow text-brand-accent">₹{ride.fare}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Distance</span>
                      <span className="text-white">{ride.distanceKm || '?'} km</span>
                    </div>
                    <div className="flex justify-between text-sm mb-5 pb-4 border-b border-white/10">
                      <span className="text-gray-400">Seats</span>
                      <span className="text-white">{ride.seats}</span>
                    </div>

                    {user.role === 'Passenger' && ride.status === 'Requested' && (
                      <button
                        onClick={() => handleStatusUpdate(ride._id, 'Cancelled')}
                        className="w-full bg-brand-secondary/20 hover:bg-brand-secondary text-brand-secondary hover:text-white border border-brand-secondary/50 py-2.5 rounded-lg transition-all text-sm font-bold"
                      >
                        Cancel Ride
                      </button>
                    )}

                    {user.role === 'Passenger' && ride.status === 'Arrived' && ride.startOtp && (
                      <div className="mb-4 p-4 rounded-xl bg-purple-500/10 border border-purple-400/30 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <KeyRound size={18} className="text-purple-400" />
                          <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold">
                            Share this OTP with your driver
                          </p>
                        </div>
                        <p className="text-4xl font-extrabold tracking-[0.3em] text-white">{ride.startOtp}</p>
                        <p className="text-xs text-gray-400 mt-2">Driver must verify before ride starts</p>
                      </div>
                    )}

                    {user.role === 'Driver' && ride.status === 'Accepted' && (
                      <button
                        onClick={() => handleMarkArrived(ride._id)}
                        className="w-full mb-3 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border border-purple-400/40 font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Navigation size={16} />
                        I&apos;ve Reached Pickup
                      </button>
                    )}

                    {user.role === 'Driver' && ride.status === 'Arrived' && !ride.otpVerified && (
                      <div className="mb-3">
                        <label className="text-xs text-gray-400 uppercase mb-1 block">Enter passenger OTP</label>
                        <input
                          type="text"
                          maxLength={4}
                          value={otpInputs[ride._id] || ''}
                          onChange={(e) =>
                            setOtpInputs((prev) => ({
                              ...prev,
                              [ride._id]: e.target.value.replace(/\D/g, ''),
                            }))
                          }
                          placeholder="4-digit OTP"
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-center text-xl tracking-widest mb-2 focus:outline-none focus:border-brand-accent"
                        />
                        <button
                          onClick={() => handleVerifyOtp(ride._id)}
                          className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold py-2.5 rounded-lg transition-all"
                        >
                          Verify OTP
                        </button>
                      </div>
                    )}

                    {user.role === 'Driver' && ride.status === 'Arrived' && ride.otpVerified && (
                      <p className="text-green-400 text-xs text-center mb-2 font-semibold">OTP verified ✓</p>
                    )}

                    {user.role === 'Driver' && ride.status === 'Arrived' && ride.otpVerified && (
                      <button
                        onClick={() => handleStatusUpdate(ride._id, 'Ongoing')}
                        className="w-full bg-brand-accent hover:bg-brand-accentHover text-brand-dark font-bold py-2.5 rounded-lg transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                      >
                        Start Ride
                      </button>
                    )}

                    {user.role === 'Driver' && ride.status === 'Ongoing' && (
                      <button
                        onClick={() => handleStatusUpdate(ride._id, 'Completed')}
                        className="w-full bg-green-500 hover:bg-green-400 text-brand-dark font-bold py-2.5 rounded-lg transition-all shadow-[0_0_20px_rgba(74,222,128,0.4)]"
                      >
                        Mark Completed
                      </button>
                    )}

                    {ride.status === 'Completed' && contact.name && (
                      <div className="mt-2 pt-3 text-sm border-t border-white/10">
                        <p className="text-gray-400 text-xs uppercase mb-1">{contact.label}</p>
                        <p className="text-white">{contact.name}</p>
                        <p className="text-gray-500">{contact.phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyRides;
