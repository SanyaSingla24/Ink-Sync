const Room = require('../models/Room');

// Request access to a room
exports.requestAccess = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Already a participant?
    if (room.isParticipant(userId)) {
      return res.json({ success: true, status: 'approved', data: room });
    }

    // Already pending?
    if (room.isPending(userId)) {
      return res.json({ success: true, status: 'pending' });
    }

    // Add to pending
    room.pendingRequests.push({ userId });
    await room.save();

    res.json({ success: true, status: 'pending' });
  } catch (error) {
    console.error('Request access error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Approve access request (creator only)
exports.approveAccess = async (req, res) => {
  try {
    const { roomId, targetUserId } = req.params;
    const creatorId = req.user._id;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (!room.isOwner(creatorId)) {
      return res.status(403).json({ success: false, message: 'Only the creator can approve access' });
    }

    // Remove from pending
    room.pendingRequests = room.pendingRequests.filter(
      p => p.userId.toString() !== targetUserId
    );

    // Add as participant
    if (!room.isParticipant(targetUserId)) {
      room.participants.push({ userId: targetUserId, role: 'editor' });
    }

    await room.save();
    res.json({ success: true, data: room });
  } catch (error) {
    console.error('Approve access error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reject access request (creator only)
exports.rejectAccess = async (req, res) => {
  try {
    const { roomId, targetUserId } = req.params;
    const creatorId = req.user._id;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (!room.isOwner(creatorId)) {
      return res.status(403).json({ success: false, message: 'Only the creator can reject access' });
    }

    room.pendingRequests = room.pendingRequests.filter(
      p => p.userId.toString() !== targetUserId
    );

    await room.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Reject access error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Remove participant (creator only)
exports.removeParticipant = async (req, res) => {
  try {
    const { roomId, targetUserId } = req.params;
    const creatorId = req.user._id;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (!room.isOwner(creatorId)) {
      return res.status(403).json({ success: false, message: 'Only the creator can remove participants' });
    }

    room.participants = room.participants.filter(
      p => p.userId.toString() !== targetUserId
    );

    await room.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get pending requests (creator only)
exports.getPendingRequests = async (req, res) => {
  try {
    const { roomId } = req.params;
    const creatorId = req.user._id;

    const room = await Room.findOne({ roomId })
      .populate('pendingRequests.userId', 'name email avatar');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (!room.isOwner(creatorId)) {
      return res.status(403).json({ success: false, message: 'Only the creator can view pending requests' });
    }

    res.json({ success: true, data: room.pendingRequests });
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};