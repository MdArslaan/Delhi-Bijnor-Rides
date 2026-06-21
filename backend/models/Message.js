const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
