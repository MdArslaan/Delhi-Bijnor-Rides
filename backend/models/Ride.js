const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pickup: { type: String, required: true },
  pickupCoords: { lat: Number, lng: Number },
  drop: { type: String, required: true },
  dropCoords: { lat: Number, lng: Number },
  distanceKm: { type: Number, default: 0 },
  seats: { type: Number, required: true },
  fare: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Requested', 'Accepted', 'Arrived', 'Ongoing', 'Completed', 'Cancelled'],
    default: 'Requested',
  },
  driverLocation: { lat: Number, lng: Number },
  etaMinutes: { type: Number },
  startOtp: { type: String },
  otpVerified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);
