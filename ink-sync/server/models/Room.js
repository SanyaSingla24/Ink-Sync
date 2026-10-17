const mongoose = require('mongoose');

// Handles new subdocs ({userId}), legacy raw ObjectIds, or {_id}
const entryId = (entry) => {
  if (!entry) return null;
  if (entry.userId) return entry.userId.toString();
  if (entry._id) return entry._id.toString();
  return entry.toString();
};

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['owner', 'editor'], default: 'editor' },
    joinedAt: { type: Date, default: Date.now },
  }],
  pendingRequests: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

roomSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

roomSchema.methods.isOwner = function (userId) {
  return this.owner.toString() === userId.toString();
};

roomSchema.methods.isParticipant = function (userId) {
  const target = userId.toString();
  return this.participants.some((p) => entryId(p) === target);
};

roomSchema.methods.isPending = function (userId) {
  const target = userId.toString();
  return this.pendingRequests.some((p) => entryId(p) === target);
};

module.exports = mongoose.model('Room', roomSchema);