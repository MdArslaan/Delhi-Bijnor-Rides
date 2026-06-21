import { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import MapPriceEstimator from '../components/MapPriceEstimator';
import { motion } from 'framer-motion';

const BookRide = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [seats, setSeats] = useState(1);
  const [rideDetails, setRideDetails] = useState(location.state?.rideDetails || null);

  // If no ride details from Home, user will use the Map Estimator here.

  const handleFinalBook = async (e) => {
    e.preventDefault();
    if (!rideDetails) return;
    
    setLoading(true);
    try {
      const finalFare = rideDetails.fare * seats; // Fare scales by seats? Wait, fare in estimator is for 1 seat. Let's assume standard fare. 
      // Actually Ola/Uber price is per vehicle. If they want seats, maybe it's a shared pool. Let's multiply fare by seats for simplicity or keep base fare. Let's multiply.
      
      await axios.post('http://localhost:5000/api/rides', {
        pickup: rideDetails.pickupText,
        pickupCoords: rideDetails.pickup,
        drop: rideDetails.dropText,
        dropCoords: rideDetails.drop,
        distanceKm: rideDetails.distance,
        seats,
        fare: rideDetails.fare * seats,
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      setSuccess('Ride has been requested successfully! Waiting for a driver.');
      setTimeout(() => navigate('/my-rides'), 2000);
    } catch (err) {
      alert(err.response?.data?.message || 'Error booking ride');
    } finally {
      setLoading(false);
    }
  };

  const handleBookReady = (details) => {
    setRideDetails(details);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-brand-dark flex flex-col items-center p-6 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-brand-accent/20 rounded-full blur-[150px] pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-5xl z-10"
      >
        <h2 className="text-4xl font-extrabold mb-8 text-center tracking-tight text-white">
          <span className="text-glow text-brand-accent">Book</span> Your Ride
        </h2>
        
        {success && <div className="bg-brand-secondary/20 border border-brand-secondary text-brand-secondary p-4 rounded-xl mb-6 text-center animate-fade-in">{success}</div>}

        {!rideDetails ? (
          <div className="rounded-2xl shadow-[0_0_40px_rgba(0,240,255,0.15)] relative overflow-hidden border border-white/10">
            <MapPriceEstimator onBookReady={handleBookReady} />
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 md:p-8 rounded-2xl w-[95%] max-w-lg mx-auto border border-brand-accent/30"
          >
            <div className="mb-6 flex flex-col gap-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <p className="text-gray-400 text-xs uppercase mb-1">Pickup</p>
                <p className="text-white font-medium">{rideDetails.pickupText}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <p className="text-gray-400 text-xs uppercase mb-1">Drop</p>
                <p className="text-white font-medium">{rideDetails.dropText}</p>
              </div>
            </div>

            <form onSubmit={handleFinalBook} className="flex flex-col gap-5">
              <div>
                <label className="block text-gray-400 text-xs uppercase mb-2">Number of Seats / Vehicles</label>
                <select 
                  value={seats} 
                  onChange={(e) => setSeats(Number(e.target.value))} 
                  className="w-full p-4 bg-white/5 border border-white/20 rounded-xl text-white focus:border-brand-accent focus:outline-none transition-colors appearance-none"
                >
                  {[1, 2, 3, 4, 5, 6].map(num => <option key={num} value={num} className="bg-brand-dark">{num} Seat{num > 1 ? 's' : ''}</option>)}
                </select>
              </div>

              <div className="bg-brand-dark/50 p-5 rounded-xl border border-brand-accent/20 flex justify-between items-center mt-2">
                <div className="flex flex-col">
                  <span className="text-gray-400 text-xs uppercase">Total Distance</span>
                  <span className="text-white font-medium">{rideDetails.distance} km</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-gray-400 text-xs uppercase">Total Fare</span>
                  <span className="text-3xl font-bold text-glow text-brand-accent">₹{rideDetails.fare * seats}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setRideDetails(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-4 rounded-xl transition"
                >
                  Edit Route
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-[2] bg-brand-accent hover:bg-brand-accentHover text-white font-bold py-4 rounded-xl transition shadow-[0_0_20px_rgba(255,42,95,0.4)] disabled:opacity-50"
                >
                  {loading ? 'Confirming...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default BookRide;
