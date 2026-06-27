import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { motion } from 'framer-motion';

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

const Dashboard = () => {
  const [rides, setRides] = useState([]);
  const [isPremium, setIsPremium] = useState(false);
  const [paying, setPaying] = useState(false);
  const { user, login } = useContext(AuthContext); // We need a way to update user in context, assume user object can be replaced or we just refetch
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    if (user) {
      const isSubscribed = user.premiumValidUntil && new Date(user.premiumValidUntil) > new Date();
      setIsPremium(isSubscribed);
      if (isSubscribed) {
        fetchRides();
      }
    }
  }, [user]);

  useEffect(() => {
    if (socket && isPremium) {
      socket.on('new_ride', (ride) => {
        setRides(prev => [ride, ...prev]);
      });
      
      socket.on('ride_updated', (updatedRide) => {
        if (updatedRide.status === 'Requested') {
          setRides((prev) => {
            if (prev.some((r) => r._id === updatedRide._id)) return prev;
            return [updatedRide, ...prev];
          });
        } else {
          setRides((prev) => prev.filter((r) => r._id !== updatedRide._id));
        }
      });
    }
    return () => {
      if (socket) {
        socket.off('new_ride');
        socket.off('ride_updated');
      }
    };
  }, [socket, isPremium]);

  const fetchRides = async () => {
    try {
      const res = await axios.get(`${API}/rides/available`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setRides(res.data);
    } catch (error) {
      console.error("Error fetching rides", error);
    }
  };

  const handleAccept = async (rideId) => {
    try {
      await axios.put(`${API}/rides/${rideId}/status`, { status: 'Accepted' }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      // The socket event will trigger the removal from this list
    } catch (error) {
      alert(error.response?.data?.message || 'Error accepting ride');
    }
  };

  const handlePayPremium = async () => {
    setPaying(true);
    try {
      const res = await axios.post(`${API}/payments/premium`, {}, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      alert(res.data.message);
      // We need to update the user object in local storage and state
      const updatedUser = { ...user, premiumValidUntil: res.data.user.premiumValidUntil };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      // Force reload to update context
      window.location.reload();
    } catch (error) {
      alert(error.response?.data?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  if (!isPremium) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-brand-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-brand-secondary/20 rounded-full blur-[150px] pointer-events-none"></div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 md:p-10 rounded-2xl border border-brand-secondary/30 text-center w-[95%] max-w-md z-10 shadow-[0_0_50px_rgba(255,0,60,0.15)] mx-auto"
        >
          <div className="w-20 h-20 bg-brand-secondary/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-secondary">
            <span className="text-3xl text-brand-secondary">₹</span>
          </div>
          <h2 className="text-3xl font-bold mb-4 text-white">Premium Required</h2>
          <p className="text-gray-400 mb-8">
            To view and accept rides, you need an active driver premium subscription. Pay ₹500 for 30 days of unlimited access.
          </p>
          <button 
            onClick={handlePayPremium}
            disabled={paying}
            className="w-full bg-brand-secondary hover:bg-red-600 text-white font-bold py-4 rounded-xl transition shadow-[0_0_20px_rgba(255,0,60,0.4)] disabled:opacity-50"
          >
            {paying ? 'Processing...' : 'Pay ₹500 Now'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-brand-dark px-3 py-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5 sm:mb-6 max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Available Rides</h2>
        <div className="self-start bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-xs sm:text-sm text-brand-accent">
          Premium Active
        </div>
      </div>
      
      {rides.length === 0 ? (
        <p className="text-center text-gray-400 mt-16 px-4 text-sm sm:text-base">No rides currently requested. Waiting for passengers...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {rides.map((ride, index) => (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              key={ride._id} 
              className="glass p-4 sm:p-6 rounded-xl border border-white/10 shadow-lg flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-accent"></div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-lg text-white">{ride.passengerId?.fullName || 'Passenger'}</p>
                  <p className="text-sm text-gray-400">{ride.passengerId?.phone || 'No phone'}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-glow text-brand-accent">₹{ride.fare}</p>
                  <p className="text-sm text-gray-400">{ride.seats} Person{ride.seats > 1 ? 's' : ''}</p>
                </div>
              </div>
              
              <div className="mb-6 flex flex-col gap-3">
                <div className="flex items-start gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                  <div className="w-3 h-3 rounded-full bg-brand-accent mt-1"></div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase">Pickup</p>
                    <p className="text-sm text-gray-200">{ride.pickup}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                  <div className="w-3 h-3 rounded-full bg-brand-secondary mt-1"></div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase">Drop</p>
                    <p className="text-sm text-gray-200">{ride.drop}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400 mt-2 px-1">
                  <span>Distance:</span>
                  <span className="text-white font-medium">{ride.distanceKm || '?'} km</span>
                </div>
              </div>
              
              <button 
                onClick={() => handleAccept(ride._id)}
                className="mt-auto bg-brand-accent hover:bg-brand-accentHover active:opacity-80 text-white font-bold py-3.5 rounded-lg transition w-full shadow-[0_0_15px_rgba(255,42,95,0.3)] text-sm sm:text-base"
              >
                Accept Ride
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
