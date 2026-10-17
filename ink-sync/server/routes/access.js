const express = require('express');
const router = express.Router();
const {
  requestAccess,
  approveAccess,
  rejectAccess,
  removeParticipant,
  getPendingRequests
} = require('../controllers/accessController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/rooms/:roomId/request', requestAccess);
router.post('/rooms/:roomId/approve/:targetUserId', approveAccess);
router.post('/rooms/:roomId/reject/:targetUserId', rejectAccess);
router.post('/rooms/:roomId/remove/:targetUserId', removeParticipant);
router.get('/rooms/:roomId/pending', getPendingRequests);

module.exports = router;