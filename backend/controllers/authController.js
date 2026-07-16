const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../utils/mailer');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });

const generateOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000)); // 6-digit OTP

const getOtpExpiry = () => {
  const mins = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
  return new Date(Date.now() + mins * 60 * 1000);
};

// Shared validator
const validateInputs = ({ fullName, phone, email, password, isLogin }) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[6-9]\d{9}$/; // Indian 10-digit mobile

  if (!email || !emailRegex.test(email.trim())) {
    return 'Please enter a valid email address.';
  }
  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters.';
  }
  if (!isLogin) {
    if (!fullName || fullName.trim().length < 2) {
      return 'Please enter your full name (at least 2 characters).';
    }
    if (!phone || !phoneRegex.test(phone.trim())) {
      return 'Please enter a valid 10-digit Indian phone number.';
    }
  }
  return null;
};

// ─── Controllers ──────────────────────────────────────────────────────────────

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { fullName, phone, email, password, role } = req.body;

    const validationError = validateInputs({ fullName, phone, email, password, isLogin: false });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists && userExists.isVerified) {
      return res.status(400).json({ message: 'An account with this email already exists. Please log in.' });
    }

    const otp = generateOtp();
    const otpExpiry = getOtpExpiry();

    let user;
    if (userExists && !userExists.isVerified) {
      // Resend OTP to an unverified pending account
      userExists.fullName = fullName.trim();
      userExists.phone = phone.trim();
      userExists.password = password; // will be hashed by pre-save
      userExists.role = role || 'Passenger';
      userExists.emailOtp = otp;
      userExists.emailOtpExpiry = otpExpiry;
      user = await userExists.save();
    } else {
      user = await User.create({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.toLowerCase().trim(),
        password,
        role: role || 'Passenger',
        isVerified: false,
        emailOtp: otp,
        emailOtpExpiry: otpExpiry,
      });
    }

    const isDevMode = process.env.NODE_ENV !== 'production';

    // Send OTP email
    try {
      await sendOtpEmail(user.email, otp, 'verify');
    } catch (mailErr) {
      console.error('❌ Failed to send registration OTP email:', mailErr.message);
      if (!isDevMode) {
        return res.status(500).json({
          message: 'Account created but failed to send OTP email. Please check your SMTP configuration. Error: ' + mailErr.message,
        });
      }
      // In development: log OTP to console so you can still test
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🔐 DEV MODE — OTP for ${user.email}: ${otp}`);
      console.log(`${'='.repeat(50)}\n`);
    }

    res.status(201).json({
      requiresOtp: true,
      userId: user._id,
      email: user.email,
      message: `OTP sent to ${user.email}. Please verify to complete registration.`,
      // Expose OTP in dev mode so registration works without SMTP
      ...(isDevMode && { devOtp: otp, devNote: 'SMTP unavailable in dev — use this OTP directly.' }),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const validationError = validateInputs({ email, password, isLogin: true });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'The information entered is incorrect. Please check and try again.' });
    }

    const otp = generateOtp();
    const otpExpiry = getOtpExpiry();

    user.emailOtp = otp;
    user.emailOtpExpiry = otpExpiry;
    await user.save();

    const isDevMode = process.env.NODE_ENV !== 'production';

    try {
      await sendOtpEmail(user.email, otp, 'login');
    } catch (mailErr) {
      console.error('❌ Failed to send login OTP email:', mailErr.message);
      if (!isDevMode) {
        return res.status(500).json({
          message: 'Could not send OTP email. Please check your SMTP configuration. Error: ' + mailErr.message,
        });
      }
      // In development: log OTP to console so you can still test
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🔐 DEV MODE — OTP for ${user.email}: ${otp}`);
      console.log(`${'='.repeat(50)}\n`);
    }

    res.json({
      requiresOtp: true,
      userId: user._id,
      email: user.email,
      message: `OTP sent to ${user.email}. Please verify to log in.`,
      // Expose OTP in dev mode so login works without SMTP
      ...(isDevMode && { devOtp: otp, devNote: 'SMTP unavailable in dev — use this OTP directly.' }),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  try {
    const { userId, otp, purpose } = req.body; // purpose: 'register' | 'login'

    if (!userId || !otp) {
      return res.status(400).json({ message: 'User ID and OTP are required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.emailOtp || user.emailOtp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP. Please check and try again.' });
    }

    if (!user.emailOtpExpiry || new Date() > user.emailOtpExpiry) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Mark verified and clear OTP
    user.isVerified = true;
    user.emailOtp = null;
    user.emailOtpExpiry = null;
    await user.save();

    const token = generateToken(user._id, user.role);

    res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token,
      message: purpose === 'register' ? 'Account verified successfully!' : 'Login successful!',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/auth/resend-otp
exports.resendOtp = async (req, res) => {
  try {
    const { userId, purpose } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const otp = generateOtp();
    user.emailOtp = otp;
    user.emailOtpExpiry = getOtpExpiry();
    await user.save();

    try {
      await sendOtpEmail(user.email, otp, purpose === 'login' ? 'login' : 'verify');
    } catch (mailErr) {
      console.error('Failed to resend OTP:', mailErr.message);
      return res.status(500).json({ message: 'Failed to send OTP email. Please try again.' });
    }

    res.json({ message: `A new OTP has been sent to ${user.email}.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
