import { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

import { AUTH_URL } from '../config/api';
import { getApiErrorMessage } from '../lib/apiClient';

// ── Client-side validators ────────────────────────────────────────────────────
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[6-9]\d{9}$/;

const validateForm = ({ fullName, phone, email, password }) => {
  if (!fullName.trim() || fullName.trim().length < 2)
    return 'Please enter your full name (at least 2 characters).';
  if (!phoneRegex.test(phone.trim()))
    return 'Please enter a valid 10-digit Indian mobile number (starts with 6-9).';
  if (!emailRegex.test(email.trim()))
    return 'Please enter a valid email address.';
  if (password.length < 6)
    return 'Password must be at least 6 characters.';
  return null;
};

// ── Toast component (inline) ──────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    error: 'bg-red-500/20 border-red-500/50 text-red-300',
    success: 'bg-green-500/20 border-green-500/50 text-green-300',
    info: 'bg-brand-accent/20 border-brand-accent/50 text-brand-accent',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl text-sm font-medium backdrop-blur-md max-w-sm w-[90vw] ${colors[type] || colors.info}`}
    >
      <span className="text-lg">
        {type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}
      </span>
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="text-current opacity-60 hover:opacity-100 text-lg leading-none">×</button>
    </motion.div>
  );
};

// ── OTP Input (6 boxes) ───────────────────────────────────────────────────────
const OtpInput = ({ value, onChange, disabled }) => {
  const refs = useRef([]);

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handleChange = (i, e) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = char;
    const next = arr.join('').padEnd(6, '').slice(0, 6);
    onChange(next.trimEnd());
    if (char && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className="w-11 h-12 text-center text-xl font-bold bg-white/10 border-2 border-white/20 rounded-xl text-white focus:border-brand-accent focus:outline-none focus:bg-white/15 transition-all disabled:opacity-50"
        />
      ))}
    </div>
  );
};

// ── Main Register Component ───────────────────────────────────────────────────
const Register = () => {
  const [formData, setFormData] = useState({ fullName: '', phone: '', email: '', password: '', role: 'Passenger' });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // OTP step state
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [pendingUserId, setPendingUserId] = useState(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const showToast = (message, type = 'error') => setToast({ message, type });

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Step 1: Submit registration form ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateForm(formData);
    if (err) { showToast(err, 'error'); return; }

    setLoading(true);
    try {
      const res = await axios.post(`${AUTH_URL}/register`, formData);
      if (res.data.requiresOtp) {
        setPendingUserId(res.data.userId);
        setPendingEmail(res.data.email);
        setStep('otp');
        setResendCooldown(60);
        showToast(`OTP sent to ${res.data.email}`, 'success');
      } else {
        // Fallback: if somehow no OTP required (shouldn't happen)
        login(res.data);
        navigate(res.data.role === 'Passenger' ? '/book' : '/dashboard');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ──
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { showToast('Please enter the complete 6-digit OTP.', 'error'); return; }
    setOtpLoading(true);
    try {
      const res = await axios.post(`${AUTH_URL}/verify-otp`, { userId: pendingUserId, otp, purpose: 'register' });
      login(res.data);
      showToast('Account verified! Welcome aboard 🎉', 'success');
      setTimeout(() => navigate(res.data.role === 'Passenger' ? '/book' : '/dashboard'), 800);
    } catch (err) {
      showToast(err.response?.data?.message || 'Invalid OTP. Please try again.', 'error');
      setOtp('');
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Resend OTP ──
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await axios.post(`${AUTH_URL}/resend-otp`, { userId: pendingUserId, purpose: 'register' });
      setResendCooldown(60);
      setOtp('');
      showToast('A new OTP has been sent to your email.', 'info');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to resend OTP.', 'error');
    }
  };

  const inputClass = 'w-full p-3.5 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition-colors';

  return (
    <div className="min-h-[calc(100vh-72px)] bg-brand-dark flex items-center justify-center p-4 relative">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[40vw] bg-brand-accent/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast key="toast" message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {step === 'form' ? (
          /* ── Registration Form ── */
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass p-7 md:p-9 rounded-2xl shadow-2xl w-full max-w-md border border-white/10 z-10"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Create Account</h1>
              <p className="text-gray-400 text-sm mt-2">Join Delhi-Bijnor Rides today</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Full Name</label>
                <input
                  type="text" name="fullName" placeholder="Enter your full name"
                  value={formData.fullName} onChange={handleChange}
                  className={inputClass} required
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Phone Number</label>
                <input
                  type="tel" name="phone" placeholder="10-digit mobile number"
                  value={formData.phone} onChange={handleChange}
                  className={inputClass} maxLength={10} required
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Email Address</label>
                <input
                  type="email" name="email" placeholder="your@email.com"
                  value={formData.email} onChange={handleChange}
                  className={inputClass} required
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Password</label>
                <input
                  type="password" name="password" placeholder="Minimum 6 characters"
                  value={formData.password} onChange={handleChange}
                  className={inputClass} required
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">I am a</label>
                <select
                  name="role" value={formData.role} onChange={handleChange}
                  className={`${inputClass} appearance-none cursor-pointer`}
                >
                  <option value="Passenger" className="bg-[#0d0d14]">🧑 Passenger</option>
                  <option value="Driver" className="bg-[#0d0d14]">🚗 Driver</option>
                </select>
              </div>

              <button
                type="submit" disabled={loading}
                className="mt-2 w-full bg-brand-accent hover:bg-brand-accentHover disabled:opacity-60 text-brand-dark font-extrabold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] text-base"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Sending OTP…
                  </span>
                ) : 'Register & Verify Email'}
              </button>
            </form>

            <p className="mt-6 text-center text-gray-400 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-accent hover:underline font-bold">Login</Link>
            </p>
          </motion.div>

        ) : (
          /* ── OTP Verification Step ── */
          <motion.div
            key="otp"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass p-7 md:p-9 rounded-2xl shadow-2xl w-full max-w-md border border-white/10 z-10"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-accent/15 border border-brand-accent/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📧</span>
              </div>
              <h1 className="text-2xl font-extrabold text-white">Check Your Email</h1>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                We sent a 6-digit OTP to<br />
                <span className="text-brand-accent font-semibold">{pendingEmail}</span>
              </p>
            </div>

            <div className="mb-6">
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-4 block text-center">Enter OTP</label>
              <OtpInput value={otp} onChange={setOtp} disabled={otpLoading} />
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={otpLoading || otp.length < 6}
              className="w-full bg-brand-accent hover:bg-brand-accentHover disabled:opacity-50 text-brand-dark font-extrabold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] mb-4 text-base"
            >
              {otpLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Verifying…
                </span>
              ) : 'Verify & Create Account'}
            </button>

            <div className="text-center">
              <p className="text-gray-500 text-sm">
                Didn't receive it?{' '}
                {resendCooldown > 0 ? (
                  <span className="text-gray-400">Resend in <span className="text-brand-accent font-bold">{resendCooldown}s</span></span>
                ) : (
                  <button onClick={handleResend} className="text-brand-accent hover:underline font-semibold">
                    Resend OTP
                  </button>
                )}
              </p>
              <button
                onClick={() => { setStep('form'); setOtp(''); }}
                className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ← Back to registration form
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Register;
