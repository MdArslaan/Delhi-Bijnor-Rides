const User = require('../models/User');

exports.payPremium = async (req, res) => {
  try {
    if (req.user.role !== 'Driver') {
      return res.status(403).json({ message: 'Only drivers can pay premium' });
    }

    // Mock payment successful, extend by 30 days
    const premiumValidUntil = new Date();
    premiumValidUntil.setDate(premiumValidUntil.getDate() + 30);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { premiumValidUntil },
      { new: true }
    ).select('-password');

    res.json({ message: 'Premium activated successfully!', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
