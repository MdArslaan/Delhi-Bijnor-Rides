const express = require('express');
const router = express.Router();
const {
  createRide,
  getDriverRides,
  getMyRides,
  updateRideStatus,
  updateDriverLocation,
  markDriverArrived,
  verifyOtp,
} = require('../controllers/rideController');
const { getMessages, sendMessage } = require('../controllers/messageController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('Passenger'), createRide);
router.get('/available', protect, authorize('Driver'), getDriverRides);
router.get('/my-rides', protect, getMyRides);
router.put('/:id/status', protect, updateRideStatus);
router.put('/:id/location', protect, authorize('Driver'), updateDriverLocation);
router.post('/:id/arrived', protect, authorize('Driver'), markDriverArrived);
router.post('/:id/verify-otp', protect, authorize('Driver'), verifyOtp);
router.get('/:id/messages', protect, getMessages);
router.post('/:id/messages', protect, sendMessage);

module.exports = router;
