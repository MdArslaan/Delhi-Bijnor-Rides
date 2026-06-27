import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import MapPriceEstimator from '../components/MapPriceEstimator';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const Home = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleBookReady = (rideDetails) => {
    if (user) {
      // Pass the state to BookRide page
      navigate('/book', { state: { rideDetails } });
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-brand-dark flex flex-col items-center px-3 py-8 sm:p-6 sm:pt-12 overflow-hidden relative">
      {/* Background glowing orb */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-brand-accent/20 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-brand-secondary/20 rounded-full blur-[150px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center z-10 w-full max-w-6xl"
      >
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold mb-3 md:mb-6 tracking-tight">
          Delhi–Bijnor <span className="text-glow text-brand-accent">Rides</span>
        </h1>
        <p className="text-base md:text-xl text-gray-300 mb-6 md:mb-10 max-w-2xl mx-auto px-2">
          Real-time ride platform. Enter your location to calculate your fare instantly.
        </p>

        {/* Map Estimator Section */}
        <div className="mb-10 sm:mb-16 w-full max-w-5xl mx-auto rounded-2xl shadow-[0_0_40px_rgba(0,240,255,0.15)] animate-fade-in relative z-20">
          <MapPriceEstimator onBookReady={handleBookReady} />
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 mb-10 sm:mb-12 w-full max-w-5xl mx-auto px-1">
          <motion.div whileHover={{ y: -5 }} className="glass p-5 sm:p-8 rounded-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 text-brand-accent">Dynamic Pricing</h3>
            <p className="text-gray-400 text-sm sm:text-base">Fair pricing based on distance. Calculated accurately in real-time from your route.</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="glass p-5 sm:p-8 rounded-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 text-brand-secondary">Zero Commission</h3>
            <p className="text-gray-400 text-sm sm:text-base">Drivers keep 100% of the fare. A simple ₹500/month subscription gives unlimited access.</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="glass p-5 sm:p-8 rounded-2xl border border-white/10 relative overflow-hidden group sm:col-span-2 md:col-span-1">
             <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 text-white">Live Tracking</h3>
            <p className="text-gray-400 text-sm sm:text-base">Watch your driver's approach and ride status change instantly.</p>
          </motion.div>
        </div>

        {!user && (
          <div className="flex gap-4 justify-center pb-20 relative z-20">
            <Link to="/register" className="glass bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all border border-white/20">
              Join as Driver
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Home;
