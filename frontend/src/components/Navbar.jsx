import { Link, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsOpen(false);
  };

  return (
    <nav className="glass sticky top-0 z-[2000] p-4 flex justify-between items-center px-4 md:px-6 border-b border-white/5">
      <Link to="/" className="text-xl md:text-2xl font-bold text-white tracking-wide flex items-center gap-2 z-50">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-accent to-brand-secondary flex items-center justify-center shadow-[0_0_15px_rgba(255,42,95,0.5)] flex-shrink-0">
          <span className="text-white text-xs md:text-sm">DB</span>
        </div>
        <span className="hidden sm:inline">Delhi–Bijnor</span> <span className="text-glow text-brand-accent font-extrabold">Rides</span>
      </Link>
      
      {/* Mobile Menu Button */}
      <button 
        className="md:hidden z-50 text-white p-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Desktop Menu */}
      <div className="hidden md:flex gap-6 items-center">
        {!user ? (
          <>
            <Link to="/login" className="text-gray-300 hover:text-white hover:text-glow transition-all">Login</Link>
            <Link to="/register" className="bg-brand-accent hover:bg-brand-accentHover text-white px-5 py-2 rounded-lg font-medium transition-all shadow-[0_0_15px_rgba(255,42,95,0.4)]">
              Register
            </Link>
          </>
        ) : (
          <>
            {user.role === 'Passenger' ? (
              <Link to="/book" className="text-gray-300 hover:text-white transition">Book Ride</Link>
            ) : (
              <Link to="/dashboard" className="text-gray-300 hover:text-white transition">Dashboard</Link>
            )}
            <Link to="/my-rides" className="text-gray-300 hover:text-white transition">My Rides</Link>
            <div className="flex items-center gap-4 border-l border-white/10 pl-4">
              <span className="text-sm text-gray-400">Hi, <span className="text-white font-medium">{(user.fullName || 'User').split(' ')[0]}</span></span>
              <button 
                onClick={handleLogout}
                className="text-gray-400 hover:text-brand-secondary transition border border-gray-600/50 hover:border-brand-secondary px-3 py-1.5 rounded-md text-sm"
              >
                Logout
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 w-full bg-brand-dark border-b border-white/10 flex flex-col p-6 gap-6 md:hidden shadow-2xl backdrop-blur-xl bg-opacity-95"
          >
            {!user ? (
              <>
                <Link to="/login" onClick={() => setIsOpen(false)} className="text-lg text-gray-300 hover:text-white transition-all">Login</Link>
                <Link to="/register" onClick={() => setIsOpen(false)} className="text-lg text-brand-accent font-bold transition-all">Register</Link>
              </>
            ) : (
              <>
                <div className="pb-4 border-b border-white/10">
                  <span className="text-gray-400">Logged in as</span>
                  <p className="text-xl font-bold text-white">{user.fullName || 'User'}</p>
                  <span className="text-sm text-brand-accent">{user.role || ''}</span>
                </div>
                {user.role === 'Passenger' ? (
                  <Link to="/book" onClick={() => setIsOpen(false)} className="text-lg text-gray-300 hover:text-white transition">Book Ride</Link>
                ) : (
                  <Link to="/dashboard" onClick={() => setIsOpen(false)} className="text-lg text-gray-300 hover:text-white transition">Dashboard</Link>
                )}
                <Link to="/my-rides" onClick={() => setIsOpen(false)} className="text-lg text-gray-300 hover:text-white transition">My Rides</Link>
                <button 
                  onClick={handleLogout}
                  className="mt-4 bg-white/5 border border-white/10 text-brand-secondary py-3 rounded-lg text-center font-bold"
                >
                  Logout
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
