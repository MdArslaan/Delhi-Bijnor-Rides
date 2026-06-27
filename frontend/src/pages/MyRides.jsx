import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, User, KeyRound, Navigation, XCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import ActiveRideMap from '../components/ActiveRideMap';
import RideChat from '../components/RideChat';

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;
const ACTIVE_STATUSES = ['Accepted', 'Arrived', 'Ongoing'];

const sameId = (a, b) => a?.toString() === b?.toString();

// ─── Confirmation Modal ──────────────────────────────────────────────────────
const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
  >
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      className="w-full max-w-sm bg-[#13131a] border border-brand-secondary/40 rounded-2xl p-6 shadow-[0_0_40px_rgba(255,0,60,0.2)]"
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-secondary/15 border border-brand-secondary/40 flex items-center justify-center">
          <AlertTriangle size={28} className="text-brand-secondary" />
        </div>
        <p className="text-white font-semibold text-base leading-snug">{message}</p>
        <div className="flex gap-3 w-full mt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-xl border border-white/15 text-gray-300 font-semibold text-sm active:bg-white/10 transition-colors"
          >
            Keep Ride
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-xl bg-brand-secondary text-white font-bold text-sm active:opacity-80 transition-opacity shadow-[0_0_20px_rgba(255,0,60,0.4)]"
          >
            Yes, Cancel
          </button>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

// ─── Main Component ──────────────────────────────────────────────────────────
const MyRides = () => {
  const [rides, setRides] = useState([]);
  const [driverLocations, setDriverLocations] = useState({});
  const [otpInputs, setOtpInputs] = useState({});
  const [cancelModal, setCancelModal] = useState(null);
  const [otpErrors, setOtpErrors] = useState({});
  const otpFetchedRef = useRef(new Set());
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const locationWatchRef = useRef(null);
  const lastLocationSentRef = useRef(0);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchMyRides = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/rides/my-rides`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setRides(res.data);
      setOtpErrors({});
    } catch (error) {
      console.error('Error fetching my rides', error);
    }
  }, [user.token]);

  const fetchRideOtp = useCallback(async (rideId) => {
    const rideKey = rideId?.toString();
    if (!rideKey) return;

    setOtpErrors((prev) => {
      const next = { ...prev };
      delete next[rideKey];
      return next;
    });

    try {
      const res = await axios.get(`${API}/rides/${rideId}/otp`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setRides((prev) =>
        prev.map((r) =>
          sameId(r._id, rideId) ? { ...r, startOtp: res.data.startOtp, status: res.data.status } : r
        )
      );
    } catch (err) {
      console.error('Failed to fetch ride OTP', err);
      otpFetchedRef.current.delete(rideKey);
      setOtpErrors((prev) => ({
        ...prev,
        [rideKey]: err.response?.data?.message || 'Could not load OTP. Tap to retry.',
      }));
    }
  }, [user.token]);

  useEffect(() => { fetchMyRides(); }, [fetchMyRides]);

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onRideUpdated = (updatedRide) => {
      const ride = { ...updatedRide };
      if (ride.status === 'Requested') {
        otpFetchedRef.current.delete(ride._id?.toString());
      }
      if (user.role === 'Driver') delete ride.startOtp;
      setRides((prev) => prev.map((r) => (sameId(r._id, ride._id) ? { ...r, ...ride } : r)));
    };
    const onLocationUpdate = (payload) => {
      setDriverLocations((prev) => ({ ...prev, [payload.rideId]: payload.driverLocation }));
      setRides((prev) =>
        prev.map((r) =>
          sameId(r._id, payload.rideId)
            ? { ...r, driverLocation: payload.driverLocation, etaMinutes: payload.etaMinutes }
            : r
        )
      );
    };
    const onOtpReady = (payload) => {
      if (user.role !== 'Passenger') return;
      setRides((prev) =>
        prev.map((r) =>
          sameId(r._id, payload.rideId)
            ? { ...r, startOtp: payload.startOtp, status: payload.status || r.status }
            : r
        )
      );
    };
    socket.on('ride_updated', onRideUpdated);
    socket.on('driver_location_update', onLocationUpdate);
    socket.on('otp_ready', onOtpReady);
    return () => {
      socket.off('ride_updated', onRideUpdated);
      socket.off('driver_location_update', onLocationUpdate);
      socket.off('otp_ready', onOtpReady);
    };
  }, [socket, user.role]);

  useEffect(() => {
    if (!socket) return;
    rides.forEach((ride) => {
      if (ACTIVE_STATUSES.includes(ride.status)) socket.emit('join_ride', ride._id);
    });
    return () => {
      rides.forEach((ride) => {
        if (ACTIVE_STATUSES.includes(ride.status)) socket.emit('leave_ride', ride._id);
      });
    };
  }, [socket, rides]);

  // Fetch OTP if still missing after my-rides load (fallback)
  useEffect(() => {
    if (user.role !== 'Passenger') return;

    rides.forEach((ride) => {
      if (!['Accepted', 'Arrived'].includes(ride.status) || ride.startOtp) return;
      const rideKey = ride._id?.toString();
      if (!rideKey || otpFetchedRef.current.has(rideKey)) return;
      otpFetchedRef.current.add(rideKey);
      fetchRideOtp(ride._id);
    });
  }, [rides, user.role, fetchRideOtp]);

  // ── Driver GPS ────────────────────────────────────────────────────────────
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
    const activeRide = rides.find((r) => ['Accepted', 'Arrived'].includes(r.status));
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
        if (now - lastLocationSentRef.current < 5000) return;
        lastLocationSentRef.current = now;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDriverLocations((prev) => ({ ...prev, [activeRide._id]: { lat, lng } }));
        sendDriverLocation(activeRide._id, lat, lng, activeRide.etaMinutes);
      },
      (err) => console.error('Geolocation error', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => {
      if (locationWatchRef.current) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [rides, user.role, sendDriverLocation]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStatusUpdate = async (rideId, newStatus) => {
    try {
      await axios.put(
        `${API}/rides/${rideId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      await fetchMyRides();
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
    if (!otp?.trim()) { alert('Please enter the OTP from the passenger'); return; }
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

  // Opens confirmation modal before cancelling
  const requestCancel = (rideId, role) => {
    const msg =
      role === 'Driver'
        ? 'Cancel this ride? It will be sent back to other drivers for the passenger.'
        : 'Are you sure you want to cancel your ride?';
    setCancelModal({ rideId, message: msg });
  };

  const confirmCancel = async () => {
    if (!cancelModal) return;
    await handleStatusUpdate(cancelModal.rideId, 'Cancelled');
    setCancelModal(null);
  };

  const handleEtaFromMap = (rideId, etaMinutes) => {
    if (user.role !== 'Driver') return;
    const ride = rides.find((r) => r._id === rideId);
    const loc = driverLocations[rideId] || ride?.driverLocation;
    if (loc && ['Accepted', 'Arrived'].includes(ride?.status)) {
      sendDriverLocation(rideId, loc.lat, loc.lng, etaMinutes);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getStatusColor = (status) => {
    switch (status) {
      case 'Requested': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'Accepted':  return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'Arrived':   return 'text-purple-400 bg-purple-400/10 border-purple-400/30';
      case 'Ongoing':   return 'text-brand-accent bg-brand-accent/10 border-brand-accent/30';
      case 'Completed': return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'Cancelled': return 'text-brand-secondary bg-brand-secondary/10 border-brand-secondary/30';
      default:          return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getContact = (ride) => {
    if (user.role === 'Passenger') {
      return { name: ride.driverId?.fullName, phone: ride.driverId?.phone, label: 'Driver' };
    }
    return { name: ride.passengerId?.fullName, phone: ride.passengerId?.phone, label: 'Passenger' };
  };

  const canPassengerCancel = (ride) =>
    ['Requested', 'Accepted', 'Arrived'].includes(ride.status) && !ride.otpVerified;

  const canDriverCancel = (ride) =>
    ['Accepted', 'Arrived'].includes(ride.status) && ride.driverId && !ride.otpVerified;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-64px)] bg-brand-dark px-3 py-5 sm:px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-20%] left-[20%] w-[60vw] h-[60vw] bg-brand-accent/8 rounded-full blur-[120px] pointer-events-none" />

      <h2 className="text-2xl sm:text-4xl font-extrabold mb-5 sm:mb-8 text-center text-white">
        My <span className="text-glow text-brand-accent">Rides</span>
      </h2>

      {/* Cancel confirmation modal */}
      <AnimatePresence>
        {cancelModal && (
          <ConfirmModal
            message={cancelModal.message}
            onConfirm={confirmCancel}
            onCancel={() => setCancelModal(null)}
          />
        )}
      </AnimatePresence>

      {rides.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20 gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-3xl">🚕</div>
          <p className="text-gray-400 text-base">No rides yet. Book your first ride!</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto flex flex-col gap-4 z-10 relative">
          {rides.map((ride, index) => {
            const contact = getContact(ride);
            const showActivePanel = ACTIVE_STATUSES.includes(ride.status);
            const driverLoc = driverLocations[ride._id] || ride.driverLocation;

            return (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 }}
                key={ride._id}
                className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.03] shadow-lg"
              >
                {/* ── Card Header ─────────────────────────────────────── */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-white/[0.02]">
                  <span className={`px-3 py-1 rounded-lg text-[11px] font-bold border tracking-wider uppercase ${getStatusColor(ride.status)}`}>
                    {ride.status}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {new Date(ride.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">

                  {/* ── OTP card — shown immediately after driver accepts ── */}
                  {user.role === 'Passenger' && ['Accepted', 'Arrived'].includes(ride.status) && (
                    <div className="rounded-2xl overflow-hidden border border-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.25)]">
                      <div className="bg-purple-500/20 px-3 sm:px-4 py-2 flex items-center gap-2 border-b border-purple-400/20">
                        <KeyRound size={14} className="text-purple-300 shrink-0" />
                        <p className="text-[11px] sm:text-xs text-purple-200 uppercase tracking-widest font-bold">
                          Your Ride OTP — Share with Driver
                        </p>
                      </div>
                      <div className="bg-purple-900/20 px-3 sm:px-4 py-4 text-center">
                        {ride.startOtp ? (
                          <>
                            <div className="flex justify-center gap-1.5 sm:gap-2 mb-2">
                              {ride.startOtp.split('').map((digit, i) => (
                                <div
                                  key={i}
                                  className="w-11 h-14 sm:w-14 sm:h-16 rounded-xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-2xl sm:text-4xl font-extrabold text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                                >
                                  {digit}
                                </div>
                              ))}
                            </div>
                            <p className="text-[11px] text-purple-300/80 mt-1 px-2">
                              {ride.status === 'Arrived'
                                ? '🟢 Driver arrived — share this OTP to start the ride'
                                : '✅ Ride confirmed — keep this OTP ready for your driver'}
                            </p>
                          </>
                        ) : otpErrors[ride._id?.toString()] ? (
                          <div className="py-4 px-2">
                            <p className="text-sm text-red-300 mb-3">{otpErrors[ride._id?.toString()]}</p>
                            <button
                              type="button"
                              onClick={() => {
                                otpFetchedRef.current.delete(ride._id?.toString());
                                fetchRideOtp(ride._id);
                              }}
                              className="text-sm font-bold text-brand-accent underline"
                            >
                              Tap to retry
                            </button>
                          </div>
                        ) : (
                          <div className="py-4">
                            <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-sm text-purple-300">Loading your OTP...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Route ─────────────────────────────────────────── */}
                  <div className="bg-white/[0.04] rounded-xl border border-white/8 p-3 relative">
                    <div className="absolute left-[22px] top-[30px] bottom-[30px] w-0.5 bg-gray-700" />
                    <div className="flex items-start gap-3 mb-3 relative">
                      <div className="w-3 h-3 rounded-full bg-brand-accent mt-0.5 shrink-0 z-10 shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Pickup</p>
                        <p className="text-sm font-medium text-gray-200 leading-tight">{ride.pickup}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 relative">
                      <div className="w-3 h-3 rounded-full bg-brand-secondary mt-0.5 shrink-0 z-10 shadow-[0_0_8px_rgba(255,0,60,0.8)]" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Drop</p>
                        <p className="text-sm font-medium text-gray-200 leading-tight">{ride.drop}</p>
                      </div>
                    </div>
                  </div>

                  {/* ── Fare / Distance / Persons ────────────────────── */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Fare', value: `₹${ride.fare}`, accent: true },
                      { label: 'Dist.', value: `${ride.distanceKm || '?'} km` },
                      { label: 'Persons', value: ride.seats },
                    ].map(({ label, value, accent }) => (
                      <div key={label} className="bg-white/[0.04] rounded-xl border border-white/8 p-3 text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                        <p className={`font-bold text-sm ${accent ? 'text-brand-accent text-base' : 'text-white'}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Driver/Passenger contact card ─────────────────── */}
                  {showActivePanel && contact.name && (
                    <div className="bg-gradient-to-br from-brand-accent/5 to-transparent border border-brand-accent/20 rounded-2xl p-3 sm:p-4">
                      <p className="text-brand-accent text-xs uppercase tracking-wider font-bold mb-3">Your {contact.label}</p>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        {/* Name */}
                        <div className="flex-1 flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center shrink-0">
                            <User size={18} className="text-brand-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 uppercase">Name</p>
                            <p className="text-white font-bold text-sm truncate">{contact.name}</p>
                          </div>
                        </div>
                        {/* Phone — tappable */}
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex-1 flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3 min-w-0 active:bg-white/10 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center shrink-0">
                            <Phone size={18} className="text-green-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 uppercase">Call</p>
                            <p className="text-green-400 font-bold text-sm truncate">{contact.phone}</p>
                          </div>
                        </a>
                      </div>

                      {/* Chat */}
                      <div className="mt-3">
                        <RideChat rideId={ride._id} isActive={showActivePanel} defaultOpen={false} />
                      </div>
                    </div>
                  )}

                  {/* ── Map ───────────────────────────────────────────── */}
                  {showActivePanel && (
                    <ActiveRideMap
                      ride={ride}
                      driverLocation={driverLoc}
                      onEtaCalculated={(eta) => handleEtaFromMap(ride._id, eta)}
                    />
                  )}

                  {/* ── ACTION BUTTONS ─────────────────────────────────── */}
                  <div className="flex flex-col gap-2.5">

                    {/* PASSENGER: Cancel (Requested or Accepted, before OTP) */}
                    {user.role === 'Passenger' && canPassengerCancel(ride) && (
                      <button
                        onClick={() => requestCancel(ride._id, 'Passenger')}
                        className="w-full flex items-center justify-center gap-2 bg-brand-secondary/10 hover:bg-brand-secondary/20 active:bg-brand-secondary/30 text-brand-secondary border border-brand-secondary/40 py-3.5 rounded-xl transition-colors text-sm font-bold"
                      >
                        <XCircle size={16} />
                        Cancel Ride
                      </button>
                    )}

                    {/* DRIVER: Mark I've Reached */}
                    {user.role === 'Driver' && ride.status === 'Accepted' && (
                      <button
                        onClick={() => handleMarkArrived(ride._id)}
                        className="w-full flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 active:bg-purple-500/40 text-purple-300 border border-purple-400/40 font-bold py-3.5 rounded-xl transition-colors"
                      >
                        <Navigation size={16} />
                        I've Reached Pickup
                      </button>
                    )}

                    {/* DRIVER: OTP Entry (Accepted or Arrived, before verified) */}
                    {user.role === 'Driver' && ['Accepted', 'Arrived'].includes(ride.status) && !ride.otpVerified && (
                      <div className="rounded-xl border border-brand-accent/30 overflow-hidden">
                        <div className="bg-brand-accent/10 px-3 py-2 border-b border-brand-accent/20 flex items-center gap-2">
                          <KeyRound size={13} className="text-brand-accent" />
                          <p className="text-xs text-brand-accent uppercase tracking-wider font-semibold">Enter Passenger OTP</p>
                        </div>
                        <div className="p-3 flex gap-2">
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={4}
                            value={otpInputs[ride._id] || ''}
                            onChange={(e) =>
                              setOtpInputs((prev) => ({
                                ...prev,
                                [ride._id]: e.target.value.replace(/\D/g, ''),
                              }))
                            }
                            placeholder="4-digit OTP"
                            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-brand-accent min-w-0"
                          />
                          <button
                            onClick={() => handleVerifyOtp(ride._id)}
                            className="shrink-0 bg-brand-accent hover:bg-brand-accentHover active:opacity-80 text-brand-dark font-bold px-5 py-3 rounded-lg transition"
                          >
                            Verify
                          </button>
                        </div>
                      </div>
                    )}

                    {/* DRIVER: OTP Verified → Start Ride */}
                    {user.role === 'Driver' && ['Accepted', 'Arrived'].includes(ride.status) && ride.otpVerified && (
                      <>
                        <div className="flex items-center justify-center gap-2 py-1">
                          <CheckCircle size={16} className="text-green-400" />
                          <p className="text-green-400 text-sm font-semibold">OTP Verified — Ready to start</p>
                        </div>
                        <button
                          onClick={() => handleStatusUpdate(ride._id, 'Ongoing')}
                          className="w-full bg-brand-accent hover:bg-brand-accentHover active:opacity-80 text-brand-dark font-bold py-4 rounded-xl transition shadow-[0_0_20px_rgba(0,240,255,0.35)] text-base"
                        >
                          Start Ride 🚀
                        </button>
                      </>
                    )}

                    {/* DRIVER: Cancel (Accepted or Arrived, before OTP verified) */}
                    {user.role === 'Driver' && canDriverCancel(ride) && (
                      <button
                        onClick={() => requestCancel(ride._id, 'Driver')}
                        className="w-full flex items-center justify-center gap-2 bg-brand-secondary/10 hover:bg-brand-secondary/20 active:bg-brand-secondary/30 text-brand-secondary border border-brand-secondary/40 py-3 rounded-xl transition-colors text-sm font-semibold mt-1"
                      >
                        <XCircle size={15} />
                        Cancel Ride
                      </button>
                    )}

                    {/* DRIVER: Mark Completed */}
                    {user.role === 'Driver' && ride.status === 'Ongoing' && (
                      <button
                        onClick={() => handleStatusUpdate(ride._id, 'Completed')}
                        className="w-full bg-green-500 hover:bg-green-400 active:opacity-80 text-brand-dark font-bold py-4 rounded-xl transition shadow-[0_0_20px_rgba(74,222,128,0.35)] text-base"
                      >
                        Mark Completed ✅
                      </button>
                    )}

                    {/* Completed summary */}
                    {ride.status === 'Completed' && contact.name && (
                      <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
                        <CheckCircle size={20} className="text-green-400 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-400 uppercase">{contact.label}</p>
                          <p className="text-white font-semibold text-sm">{contact.name}</p>
                          <p className="text-gray-500 text-xs">{contact.phone}</p>
                        </div>
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
