const Room = require('../models/Room');

const generateRoomId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'INK-';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

exports.createRoom = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Room name is required' });
    }

    const room = await Room.create({
      roomId: generateRoomId(),
      name,
      owner: req.user._id,
      participants: [{ userId: req.user._id, role: 'owner' }],
    });

    res.status(201).json({ success: true, message: 'Room created successfully', data: room });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'Server error creating room' });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [
        { owner: req.user._id },
        { 'participants.userId': req.user._id }, // new subdocument format
      ],
    })
      .populate('owner', 'name email')
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, count: rooms.length, data: rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching rooms' });
  }
};

exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId })
      .populate('owner', 'name email avatar');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching room' });
  }
};

// IMPORTANT: no longer auto-adds the user as participant.
// Access is granted ONLY through the approval flow (accessController).
exports.joinRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ success: false, message: 'Server error joining room' });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this room' });
    }

    await room.deleteOne();
    res.status(200).json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting room' });
  }
};