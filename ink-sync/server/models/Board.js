const mongoose = require('mongoose');

const operationSchema = new mongoose.Schema({
  operationId: String,
  userId: String,
  roomId: String,
  type: String,
  tool: String,
  points: [mongoose.Schema.Types.Mixed],
  color: String,
  lineWidth: Number,
  text: String,
  fontSize: Number,
  fill: Boolean,
  bg: String,
  width: Number,
  height: Number,
  locked: Boolean,
  timestamp: Date,
  sequence: Number, // Server-assigned order
}, { _id: false });

const boardSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  operations: [operationSchema],
  nextSequence: { type: Number, default: 1 }, // Auto-increment counter
  updatedAt: { type: Date, default: Date.now },
});

boardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Board', boardSchema);