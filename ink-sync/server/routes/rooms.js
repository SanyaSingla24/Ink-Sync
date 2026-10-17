const express = require('express');
const router = express.Router();
const { 
  createRoom, 
  getRooms, 
  getRoom, 
  joinRoom, 
  deleteRoom 
} = require('../controllers/roomController');
const { protect } = require('../middleware/auth');

router.use(protect); // Protect all room routes

router.post('/', createRoom);
router.get('/', getRooms);
router.get('/:roomId', getRoom);
router.post('/:roomId/join', joinRoom);
router.delete('/:roomId', deleteRoom);

module.exports = router;