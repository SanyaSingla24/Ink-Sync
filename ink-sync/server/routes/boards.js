const express = require('express');
const router = express.Router();
const { getBoard, saveOperation } = require('../controllers/boardController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/:roomId', getBoard);
router.post('/:roomId', saveOperation);

module.exports = router;