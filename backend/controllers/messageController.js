const Message = require('../models/Message');
const Ride = require('../models/Ride');

const populateMessage = (msg) =>
  Message.findById(msg._id).populate('senderId', 'fullName role');

const canAccessRide = async (rideId, userId, role) => {
  const ride = await Ride.findById(rideId);
  if (!ride) return null;
  if (role === 'Passenger' && ride.passengerId.toString() === userId) return ride;
  if (role === 'Driver' && ride.driverId?.toString() === userId) return ride;
  return null;
};

exports.getMessages = async (req, res) => {
  try {
    const ride = await canAccessRide(req.params.id, req.user.id, req.user.role);
    if (!ride) {
      return res.status(403).json({ message: 'Not authorized to view this ride chat' });
    }

    const messages = await Message.find({ rideId: ride._id })
      .populate('senderId', 'fullName role')
      .sort('createdAt');

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const ride = await canAccessRide(req.params.id, req.user.id, req.user.role);
    if (!ride) {
      return res.status(403).json({ message: 'Not authorized to chat on this ride' });
    }

    if (!['Accepted', 'Arrived', 'Ongoing'].includes(ride.status)) {
      return res.status(400).json({ message: 'Chat is only available for active rides' });
    }

    const message = await Message.create({
      rideId: ride._id,
      senderId: req.user.id,
      text: text.trim(),
    });

    const populated = await populateMessage(message);
    req.io.to(`ride_${ride._id}`).emit('ride_message', populated);

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
