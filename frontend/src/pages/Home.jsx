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
      navigate('/book-ride', { state: { rideDetails } });
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-brand-dark flex flex-col items-center p-6 pt-12 overflow-hidden relative">
      {/* Background glowing orb */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-brand-accent/20 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-brand-secondary/20 rounded-full blur-[150px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center z-10 w-full max-w-6xl"
      >
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold mb-4 md:mb-6 tracking-tight">
          Delhi–Bijnor <span className="text-glow text-brand-accent">Rides</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-8 md:mb-10 max-w-2xl mx-auto px-4">
          The ultimate real-time ride platform. Enter your location below to instantly calculate your fare based on distance.
        </p>

        {/* Map Estimator Section */}
        <div className="mb-16 w-full max-w-5xl mx-auto rounded-2xl shadow-[0_0_40px_rgba(0,240,255,0.15)] animate-fade-in relative z-20">
          <MapPriceEstimator onBookReady={handleBookReady} />
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 w-full max-w-5xl mx-auto">
          <motion.div whileHover={{ y: -5 }} className="glass p-8 rounded-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-2xl font-bold mb-3 text-brand-accent">Dynamic Pricing</h3>
            <p className="text-gray-400">Fair pricing at ₹12/km. Calculated accurately in real-time based on your exact route.</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="glass p-8 rounded-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-2xl font-bold mb-3 text-brand-secondary">Zero Commission</h3>
            <p className="text-gray-400">Drivers keep 100% of the fare. A simple ₹500/month subscription gives unlimited access.</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="glass p-8 rounded-2xl border border-white/10 relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-2xl font-bold mb-3 text-white">Live Tracking</h3>
            <p className="text-gray-400">Watch your driver's approach and ride status change instantly.</p>
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
