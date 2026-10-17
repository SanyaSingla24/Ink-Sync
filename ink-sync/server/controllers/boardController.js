const Board = require('../models/Board');

// @desc    Get board operations
// @route   GET /api/boards/:roomId
exports.getBoard = async (req, res) => {
  try {
    let board = await Board.findOne({ roomId: req.params.roomId });

    if (!board) {
      // Create empty board if doesn't exist
      board = await Board.create({
        roomId: req.params.roomId,
        operations: []
      });
    }

    res.status(200).json({
      success: true,
      data: board
    });
  } catch (error) {
    console.error('Get board error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching board' 
    });
  }
};

// @desc    Save board operation
// @route   POST /api/boards/:roomId
exports.saveOperation = async (req, res) => {
  try {
    const { operation } = req.body;

    let board = await Board.findOne({ roomId: req.params.roomId });

    if (!board) {
      board = await Board.create({
        roomId: req.params.roomId,
        operations: []
      });
    }

    // Add operation to board
    board.operations.push(operation);
    await board.save();

    res.status(200).json({
      success: true,
      message: 'Operation saved'
    });
  } catch (error) {
    console.error('Save operation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error saving operation' 
    });
  }
};