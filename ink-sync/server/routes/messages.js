const express = require('express');
const router = express.Router();
const { getMessages } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/:roomId', getMessages);

module.exports = router;