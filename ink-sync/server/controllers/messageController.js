const Message = require('../models/Message');

// @desc    Get messages for room
// @route   GET /api/messages/:roomId
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ roomId: req.params.roomId })
      .populate('sender', 'name email avatar')
      .sort({ timestamp: 1 })
      .limit(100); // Last 100 messages

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching messages' 
    });
  }
};