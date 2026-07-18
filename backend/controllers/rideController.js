const Ride = require('../models/Ride');

const generateOtp = () => String(Math.floor(1000 + Math.random() * 9000));

const populateRide = (id) =>
  Ride.findById(id).populate('passengerId', 'fullName phone').populate('driverId', 'fullName phone');

const emitRideUpdate = (io, ride) => {
  const plain = ride.toObject ? ride.toObject() : ride;
  io.emit('ride_updated', plain);
  io.to(`ride_${ride._id}`).emit('ride_updated', plain);
};

const sanitizeRideForRole = (ride, role) => {
  const obj = ride.toObject ? ride.toObject() : { ...ride };
  if (role === 'Driver') {
    delete obj.startOtp;
  }
  return obj;
};

const isSameId = (a, b) => a?.toString() === b?.toString();

const ensureRideOtp = async (ride) => {
  if (!['Accepted', 'Arrived'].includes(ride.status)) return ride;
  if (ride.startOtp) return ride;
  ride.startOtp = generateOtp();
  ride.otpVerified = ride.otpVerified || false;
  await ride.save();
  return ride;
};

exports.createRide = async (req, res) => {
  try {
    const { pickup, drop, seats, pickupCoords, dropCoords, distanceKm } = req.body;
    
    // Secure Fare Calculation
    const dist = Number(distanceKm) || 0;
    const s = Number(seats) || 1;
    const fareForOne = Math.round((dist / 195.5) * 700);
    const calculatedFare = fareForOne * s;

    const ride = await Ride.create({
      passengerId: req.user.id,
      pickup,
      pickupCoords,
      drop,
      dropCoords,
      distanceKm: dist,
      seats: s,
      fare: calculatedFare,
      status: 'Requested',
    });

    const populatedRide = await populateRide(ride._id);
    req.io.emit('new_ride', populatedRide);

    res.status(201).json(populatedRide);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getDriverRides = async (req, res) => {
  try {
    const rides = await Ride.find({ status: 'Requested' })
      .populate('passengerId', 'fullName phone')
      .sort('-createdAt');
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getMyRides = async (req, res) => {
  try {
    let rides;
    if (req.user.role === 'Passenger') {
      rides = await Ride.find({ passengerId: req.user.id })
        .populate('driverId', 'fullName phone')
        .sort('-createdAt');

      // Backfill OTP for accepted rides (fixes rides accepted before OTP was added)
      await Promise.all(
        rides
          .filter((r) => ['Accepted', 'Arrived'].includes(r.status) && !r.startOtp)
          .map((r) => ensureRideOtp(r))
      );
    } else {
      rides = await Ride.find({ driverId: req.user.id })
        .populate('passengerId', 'fullName phone')
        .sort('-createdAt');
    }

    const sanitized = rides.map((r) => sanitizeRideForRole(r, req.user.role));
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateDriverLocation = async (req, res) => {
  try {
    const { lat, lng, etaMinutes } = req.body;
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (req.user.role !== 'Driver' || ride.driverId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the assigned driver can update location' });
    }

    if (!['Accepted', 'Arrived'].includes(ride.status)) {
      return res.status(400).json({ message: 'Location updates only allowed while en route or arrived' });
    }

    ride.driverLocation = { lat, lng };
    if (etaMinutes != null) ride.etaMinutes = Math.round(etaMinutes);
    await ride.save();

    const updatedRide = await populateRide(ride._id);
    const payload = {
      rideId: ride._id,
      driverLocation: ride.driverLocation,
      etaMinutes: ride.etaMinutes,
    };

    req.io.to(`ride_${ride._id}`).emit('driver_location_update', payload);
    emitRideUpdate(req.io, updatedRide);

    res.json(sanitizeRideForRole(updatedRide, 'Driver'));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.markDriverArrived = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (req.user.role !== 'Driver' || ride.driverId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the assigned driver can mark arrival' });
    }

    if (ride.status !== 'Accepted') {
      return res.status(400).json({ message: 'Can only mark arrival when ride is accepted' });
    }

    ride.status = 'Arrived';
    // OTP was already generated at acceptance, keep it
    await ride.save();

    const updatedRide = await populateRide(ride._id);
    emitRideUpdate(req.io, updatedRide);

    res.json(sanitizeRideForRole(updatedRide, 'Driver'));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (req.user.role !== 'Driver' || ride.driverId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the assigned driver can verify OTP' });
    }

    if (!['Accepted', 'Arrived'].includes(ride.status)) {
      return res.status(400).json({ message: 'OTP can only be verified when driver has accepted the ride' });
    }

    if (!otp || ride.startOtp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP. Ask the passenger for the correct code.' });
    }

    ride.otpVerified = true;
    await ride.save();

    const updatedRide = await populateRide(ride._id);
    emitRideUpdate(req.io, updatedRide);

    res.json(sanitizeRideForRole(updatedRide, 'Driver'));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateRideStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const ride = await Ride.findById(id);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (status === 'Cancelled') {
      if (ride.otpVerified) {
        return res.status(400).json({ message: 'Cannot cancel after OTP is verified' });
      }
      if (['Ongoing', 'Completed', 'Cancelled'].includes(ride.status)) {
        return res.status(400).json({ message: 'Cannot cancel this ride' });
      }

      if (req.user.role === 'Passenger') {
        if (!isSameId(ride.passengerId, req.user.id)) {
          return res.status(403).json({ message: 'Not authorized to cancel this ride' });
        }
        if (!['Requested', 'Accepted', 'Arrived'].includes(ride.status)) {
          return res.status(400).json({ message: 'Cannot cancel this ride' });
        }
        ride.status = 'Cancelled';
      } else if (req.user.role === 'Driver') {
        if (!['Accepted', 'Arrived'].includes(ride.status)) {
          return res.status(400).json({ message: 'You can only cancel rides you have accepted' });
        }
        if (!isSameId(ride.driverId, req.user.id)) {
          return res.status(403).json({ message: 'Not authorized to cancel this ride' });
        }
        ride.status = 'Requested';
        ride.driverId = null;
        ride.startOtp = null;
        ride.otpVerified = false;
        ride.driverLocation = undefined;
        ride.etaMinutes = undefined;
      } else {
        return res.status(403).json({ message: 'Not authorized for this action' });
      }
    } else if (req.user.role === 'Driver') {
      if (status === 'Accepted' && ride.status === 'Requested') {
        if (ride.driverId) {
          return res.status(400).json({ message: 'Ride already accepted by another driver' });
        }
        ride.driverId = req.user.id;
        ride.status = 'Accepted';
        ride.startOtp = generateOtp();
        ride.otpVerified = false;
        ride.driverLocation = undefined;
        ride.etaMinutes = undefined;
      } else if (status === 'Ongoing' && ['Arrived', 'Accepted'].includes(ride.status)) {
        if (!ride.otpVerified) {
          return res.status(400).json({ message: 'Please verify OTP with passenger before starting the ride' });
        }
        ride.status = 'Ongoing';
      } else if (status === 'Completed' && ride.status === 'Ongoing') {
        ride.status = 'Completed';
      } else {
        return res.status(400).json({ message: 'Invalid status transition' });
      }
    } else {
      return res.status(403).json({ message: 'Not authorized for this action' });
    }

    await ride.save();

    const updatedRide = await populateRide(ride._id);
    emitRideUpdate(req.io, updatedRide);

    if (status === 'Accepted' && updatedRide.startOtp) {
      const otpPayload = {
        rideId: ride._id,
        startOtp: updatedRide.startOtp,
        status: updatedRide.status,
      };
      req.io.emit('otp_ready', otpPayload);
      req.io.to(`ride_${ride._id}`).emit('otp_ready', otpPayload);
    }

    res.json(sanitizeRideForRole(updatedRide, req.user.role));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getRideOtp = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (req.user.role !== 'Passenger' || !isSameId(ride.passengerId, req.user.id)) {
      return res.status(403).json({ message: 'Only the passenger can view ride OTP' });
    }

    if (!['Accepted', 'Arrived'].includes(ride.status)) {
      return res.status(400).json({ message: 'OTP is only available after a driver accepts your ride' });
    }

    await ensureRideOtp(ride);

    res.json({
      rideId: ride._id,
      startOtp: ride.startOtp,
      status: ride.status,
      otpVerified: ride.otpVerified,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
