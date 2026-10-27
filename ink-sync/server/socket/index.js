const jwt = require('jsonwebtoken');
const Board = require('../models/Board');
const Message = require('../models/Message');
const Room = require('../models/Room');

// roomId -> Map(userId -> participant info)
const activeUsers = new Map();
// roomId -> Set of authorized user IDs (in-memory cache for fast auth)
const authorizedUsers = new Map();
// roomId -> boolean (is whiteboard locked for non-creators)
const lockedRooms = new Map();
// roomId -> Set of userId that are hard-muted by creator
const hardMutedUsers = new Map();
// roomId -> Set of userIds currently in the video call
const videoCallUsers = new Map();
// roomId -> { userId, userName } of current screen sharer (only one at a time)
const activeScreenShares = new Map();

const getParticipants = (roomId) => Array.from(activeUsers.get(roomId)?.values() || []);

// Authorization middleware for socket events
const requireAuth = (socket, roomId) => {
  const { userId } = socket.data;
  if (!userId || !roomId) return false;
  
  const roomUsers = authorizedUsers.get(roomId);
  if (!roomUsers) return false;
  
  return roomUsers.has(userId);
};

const canDraw = (socket, roomId) => {
  if (!requireAuth(socket, roomId)) return false;
  const isLocked = !!lockedRooms.get(roomId);
  if (!isLocked) return true;
  // If locked, only creator can draw/modify
  const info = activeUsers.get(roomId)?.get(socket.data.userId);
  return !!info?.isCreator;
};

// Helper: find socket by userId in a room
const findSocketByUserId = (io, roomId, targetUserId) => {
  const roomActive = activeUsers.get(roomId);
  if (!roomActive) return null;
  const target = roomActive.get(targetUserId);
  if (!target) return null;
  return io.sockets.sockets.get(target.socketId);
};

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('✅ Socket connected:', socket.id);

    // ---------- JOIN ROOM (request access, not auto-join) ----------
    socket.on('join-room', async ({ roomId, userId, userName, userAvatar, token }) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.id !== userId) throw new Error('user mismatch');
      } catch {
        return socket.emit('room-join-error', { message: 'Your session is invalid. Please log in again.' });
      }

      const room = await Room.findOne({ roomId });
      if (!room) {
        return socket.emit('room-join-error', { message: 'Room not found' });
      }

      const isCreator = room.isOwner(userId);
      const isParticipant = room.isParticipant(userId);

      if (!isCreator && !isParticipant) {
        if (!room.isPending(userId)) {
          room.pendingRequests.push({ userId });
          await room.save();
        }
        await room.populate('pendingRequests.userId', 'name email avatar');
        io.to(roomId).emit('pending-requests', room.pendingRequests);

        return socket.emit('room-join-error', {
          message: 'You need approval to access this room',
          status: 'pending',
        });
      }

      // Authorized - join the socket room
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;
      socket.data.userName = userName; // Store userName for cursor broadcasts

      // Add to authorized set
      if (!authorizedUsers.has(roomId)) authorizedUsers.set(roomId, new Set());
      authorizedUsers.get(roomId).add(userId);

      // Add to active users
      if (!activeUsers.has(roomId)) activeUsers.set(roomId, new Map());
      activeUsers.get(roomId).set(userId, { 
        userId, 
        userName, 
        userAvatar, 
        socketId: socket.id,
        isCreator
      });

      const participants = getParticipants(roomId);
      const isLocked = !!lockedRooms.get(roomId);

      // Include video call state in join response
      const videoUsers = Array.from(videoCallUsers.get(roomId) || []);
      const hardMuted = Array.from(hardMutedUsers.get(roomId) || []);
      const screenShare = activeScreenShares.get(roomId) || null;

      socket.emit('room-joined', { participants, userId, isCreator, isLocked, videoUsers, hardMuted, screenShare });
      socket.to(roomId).emit('user-joined', { userId, userName, participants });
      
      // If creator joined, also send any pending requests
      if (isCreator) {
        await room.populate('pendingRequests.userId', 'name email avatar');
        socket.emit('pending-requests', room.pendingRequests);
      }

      console.log(`👤 ${userName} joined ${roomId} (${participants.length} online)`);
    });

    // Creator toggles whiteboard lock (View-only for others)
    socket.on('board:lock-toggle', async ({ roomId, isLocked }) => {
      if (!requireAuth(socket, roomId)) return;
      const room = await Room.findOne({ roomId });
      if (!room || !room.isOwner(socket.data.userId)) return;

      lockedRooms.set(roomId, !!isLocked);
      io.to(roomId).emit('board:lock-status', { roomId, isLocked: !!isLocked });
    });

    // Creator approves a pending user
    socket.on('approve-access', async ({ roomId, targetUserId, targetUserName }) => {
      if (!requireAuth(socket, roomId)) return;
      
      const room = await Room.findOne({ roomId });
      if (!room || !room.isOwner(socket.data.userId)) return;

      // Add to authorized set
      if (!authorizedUsers.has(roomId)) authorizedUsers.set(roomId, new Set());
      authorizedUsers.get(roomId).add(targetUserId);

      // Remove from pending and ensure participant is saved
      room.pendingRequests = room.pendingRequests.filter(
        p => (p.userId?._id?.toString() || p.userId?.toString()) !== targetUserId.toString()
      );
      if (!room.isParticipant(targetUserId)) {
        room.participants.push({ userId: targetUserId, role: 'editor' });
      }
      await room.save();
      await room.populate('pendingRequests.userId', 'name email avatar');

      // Update creator with fresh pending requests list
      io.to(roomId).emit('pending-requests', room.pendingRequests);

      // Notify the approved user if they're connected (waiting for approval)
      io.emit('access-approved', { roomId, targetUserId });
      
      // Notify all room participants
      socket.to(roomId).emit('user-approved', { userId: targetUserId, userName: targetUserName });
    });

    // Creator rejects or removes a user
    socket.on('remove-user', ({ roomId, targetUserId }) => {
      if (!requireAuth(socket, roomId)) return;
      
      // Remove from authorized set
      const roomUsers = authorizedUsers.get(roomId);
      if (roomUsers) roomUsers.delete(targetUserId);

      // Also clean up video call state
      const roomVideoUsers = videoCallUsers.get(roomId);
      if (roomVideoUsers) roomVideoUsers.delete(targetUserId);
      const roomHardMuted = hardMutedUsers.get(roomId);
      if (roomHardMuted) roomHardMuted.delete(targetUserId);
      const screenShare = activeScreenShares.get(roomId);
      if (screenShare?.userId === targetUserId) activeScreenShares.delete(roomId);

      // Find and disconnect the target user's socket
      const roomActive = activeUsers.get(roomId);
      if (roomActive) {
        const target = Array.from(roomActive.values()).find(u => u.userId === targetUserId);
        if (target) {
          const targetSocket = io.sockets.sockets.get(target.socketId);
          if (targetSocket) {
            targetSocket.leave(roomId);
            targetSocket.emit('access-revoked', { roomId });
          }
          roomActive.delete(targetUserId);
        }
      }

      // Notify remaining participants
      socket.to(roomId).emit('user-removed', { userId: targetUserId, participants: getParticipants(roomId) });
    });

    socket.on('leave-room', ({ roomId, userId }) => handleLeave(socket, io, roomId, userId));

    // ---------- BOARD SYNC (late joiners) ----------
    socket.on('board:sync-request', async ({ roomId }) => {
      if (!requireAuth(socket, roomId)) {
        return socket.emit('board:sync-response', { roomId, operations: [], error: 'Unauthorized' });
      }
      
      try {
        const board = await Board.findOne({ roomId }).lean();
        socket.emit('board:sync-response', { roomId, operations: board?.operations || [] });
      } catch (err) {
        console.error('sync error:', err.message);
        socket.emit('board:sync-response', { roomId, operations: [] });
      }
    });

    // ---------- BOARD EVENTS: authorize + relay + persist ----------
    socket.on('board:operation', async (op) => {
      if (!op?.roomId || !canDraw(socket, op.roomId)) return;
      
      // Add server-side sequence number
      try {
        const board = await Board.findOne({ roomId: op.roomId });
        if (!board) {
          await Board.create({ roomId: op.roomId, operations: [{ ...op, sequence: 1 }], nextSequence: 2 });
        } else {
          const seq = board.nextSequence;
          op.sequence = seq;
          board.operations.push(op);
          board.nextSequence = seq + 1;
          await board.save();
        }
      } catch (err) { 
        console.error('persist operation:', err.message); 
      }
      
      // Broadcast to room (including sender for consistency)
      io.to(op.roomId).emit('board:operation', op);
    });

    socket.on('board:live', (op) => {
      if (!op?.roomId || !canDraw(socket, op.roomId)) return;
      socket.to(op.roomId).emit('board:live', op); // Never persisted
    });

    socket.on('board:update', async (op) => {
      if (!op?.roomId || !canDraw(socket, op.roomId)) return;
      
      try {
        const board = await Board.findOne({ roomId: op.roomId });
        if (!board) return;
        const i = board.operations.findIndex((o) => o.operationId === op.operationId);
        if (i >= 0) { 
          board.operations[i] = { ...board.operations[i].toObject(), ...op }; 
          await board.save(); 
        }
      } catch (err) { 
        console.error('persist update:', err.message); 
      }
      
      io.to(op.roomId).emit('board:update', op);
    });

    socket.on('board:delete', async ({ roomId, ids }) => {
      if (!roomId || !canDraw(socket, roomId)) return;
      
      try {
        const board = await Board.findOne({ roomId });
        if (!board) return;
        board.operations = board.operations.filter((o) => !ids.includes(o.operationId));
        await board.save();
      } catch (err) { 
        console.error('persist delete:', err.message); 
      }
      
      io.to(roomId).emit('board:delete', { roomId, ids });
    });

    socket.on('board:undo', async ({ roomId, operationId }) => {
      if (!roomId || !canDraw(socket, roomId)) return;
      
      try {
        const board = await Board.findOne({ roomId });
        if (!board) return;
        board.operations = board.operations.filter((o) => o.operationId !== operationId);
        await board.save();
      } catch (err) { 
        console.error('persist undo:', err.message); 
      }
      
      io.to(roomId).emit('board:undo', { roomId, operationId });
    });

    socket.on('board:reorder', async ({ roomId, ids }) => {
      if (!roomId || !canDraw(socket, roomId)) return;
      
      try {
        const board = await Board.findOne({ roomId });
        if (!board) return;
        const byId = new Map(board.operations.map((o) => [o.operationId, o]));
        const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
        for (const op of byId.values()) if (!ids.includes(op.operationId)) ordered.push(op);
        board.operations = ordered;
        await board.save();
      } catch (err) { 
        console.error('persist reorder:', err.message); 
      }
      
      io.to(roomId).emit('board:reorder', { roomId, ids });
    });

    // ---------- CURSORS (relay only, never persisted, require auth) ----------
    socket.on('cursor:move', (data) => {
      if (!data?.roomId || !requireAuth(socket, data.roomId)) return;
      socket.to(data.roomId).emit('cursor:move', {
        ...data,
        userId: socket.data.userId,
        userName: socket.data.userName // Now properly set from join-room
      });
    });

    // ---------- CHAT (persisted, require auth) ----------
    socket.on('chat:send', async (data) => {
      if (!data?.roomId || !requireAuth(socket, data.roomId)) return;
      
      try {
        const message = await Message.create({
          roomId: data.roomId,
          sender: data.userId,
          recipient: data.recipientId || null,
          message: data.message,
        });
        await message.populate('sender', 'name email avatar');
        
        const payload = { 
          ...message.toObject(), 
          isPrivate: !!data.recipientId 
        };

        if (data.recipientId) {
          // Private message: send only to sender and recipient
          socket.emit('chat:message', payload);
          
          const recipientInfo = activeUsers.get(data.roomId)?.get(data.recipientId);
          if (recipientInfo) {
            const recipientSocket = io.sockets.sockets.get(recipientInfo.socketId);
            if (recipientSocket) {
              recipientSocket.emit('chat:message', payload);
            }
          }
        } else {
          // Public message: broadcast to room
          io.to(data.roomId).emit('chat:message', payload);
        }
      } catch (err) { 
        console.error('chat error:', err.message); 
      }
    });

    // Admin: Delete a message (Creator only)
    socket.on('chat:delete', async ({ roomId, messageId }) => {
      if (!roomId || !requireAuth(socket, roomId)) return;
      
      const room = await Room.findOne({ roomId });
      if (!room || !room.isOwner(socket.data.userId)) return; // Only creator can delete

      await Message.findByIdAndDelete(messageId);
      io.to(roomId).emit('chat:deleted', { messageId });
    });

    // ---------- PRESENCE: mic/camera status ----------
    socket.on('participant:update', (data) => {
      if (!data?.roomId || !requireAuth(socket, data.roomId)) return;
      const info = activeUsers.get(data.roomId)?.get(data.userId);
      if (info) { info.isMuted = data.isMuted; info.isCameraOff = data.isCameraOff; }
      socket.to(data.roomId).emit('participant:update', data);
    });

    // ---------- WEBRTC SIGNALING (targeted to specific peer) ----------
    socket.on('webrtc:offer', (data) => {
      if (!data?.roomId || !requireAuth(socket, data.roomId)) return;
      const targetSocket = findSocketByUserId(io, data.roomId, data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc:offer', { ...data, fromUserId: socket.data.userId });
      }
    });

    socket.on('webrtc:answer', (data) => {
      if (!data?.roomId || !requireAuth(socket, data.roomId)) return;
      const targetSocket = findSocketByUserId(io, data.roomId, data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc:answer', { ...data, fromUserId: socket.data.userId });
      }
    });

    socket.on('webrtc:ice-candidate', (data) => {
      if (!data?.roomId || !requireAuth(socket, data.roomId)) return;
      const targetSocket = findSocketByUserId(io, data.roomId, data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc:ice-candidate', { ...data, fromUserId: socket.data.userId });
      }
    });

    // ---------- VIDEO CALL EVENTS ----------

    // Start video call prompt — broadcasts to all other users in the room
    socket.on('video:start-call', ({ roomId, initiatorId, initiatorName }) => {
      if (!requireAuth(socket, roomId)) return;
      socket.to(roomId).emit('video:call-started-prompt', {
        initiatorId: initiatorId || socket.data.userId,
        initiatorName: initiatorName || socket.data.userName,
        timestamp: Date.now(),
      });
      console.log(`🎥 ${initiatorName || socket.data.userName} prompted video call start in ${roomId}`);
    });

    // User joins the video call
    socket.on('video:join', ({ roomId, userId, userName, micOn, camOn }) => {
      if (!requireAuth(socket, roomId)) return;
      if (!videoCallUsers.has(roomId)) videoCallUsers.set(roomId, new Set());
      videoCallUsers.get(roomId).add(userId);

      // Send the current hard-muted state to the joining user
      const isHardMuted = hardMutedUsers.get(roomId)?.has(userId) || false;
      socket.emit('video:hard-mute-status', { isHardMuted });

      // Notify everyone in the room
      io.to(roomId).emit('video:user-joined', {
        userId,
        userName,
        micOn,
        camOn,
        videoUsers: Array.from(videoCallUsers.get(roomId)),
      });
      console.log(`🎥 ${userName} joined video in ${roomId}`);
    });

    // User leaves the video call
    socket.on('video:leave', ({ roomId, userId, userName }) => {
      if (!requireAuth(socket, roomId)) return;
      const roomVideoUsers = videoCallUsers.get(roomId);
      if (roomVideoUsers) {
        roomVideoUsers.delete(userId);
        if (roomVideoUsers.size === 0) videoCallUsers.delete(roomId);
      }
      // Clean up hard-mute if they leave
      const roomHardMuted = hardMutedUsers.get(roomId);
      if (roomHardMuted) roomHardMuted.delete(userId);
      // Clean up screen share if they were sharing
      const screenShare = activeScreenShares.get(roomId);
      if (screenShare?.userId === userId) {
        activeScreenShares.delete(roomId);
        io.to(roomId).emit('video:screen-share-stopped', { userId });
      }

      io.to(roomId).emit('video:user-left', {
        userId,
        userName,
        videoUsers: Array.from(videoCallUsers.get(roomId) || []),
      });
      console.log(`🎥 ${userName} left video in ${roomId}`);
    });

    // Creator hard-mutes a participant (they cannot unmute themselves)
    socket.on('video:hard-mute', async ({ roomId, targetUserId }) => {
      if (!requireAuth(socket, roomId)) return;
      const room = await Room.findOne({ roomId });
      if (!room || !room.isOwner(socket.data.userId)) return;

      if (!hardMutedUsers.has(roomId)) hardMutedUsers.set(roomId, new Set());
      hardMutedUsers.get(roomId).add(targetUserId);

      // Notify the target user
      const targetSocket = findSocketByUserId(io, roomId, targetUserId);
      if (targetSocket) {
        targetSocket.emit('video:hard-muted', { by: socket.data.userName });
      }
      // Notify everyone so UI updates
      io.to(roomId).emit('video:participant-hard-muted', { targetUserId });
      console.log(`🔇 Creator hard-muted ${targetUserId} in ${roomId}`);
    });

    // Creator allows participant to unmute
    socket.on('video:unmute-allow', async ({ roomId, targetUserId }) => {
      if (!requireAuth(socket, roomId)) return;
      const room = await Room.findOne({ roomId });
      if (!room || !room.isOwner(socket.data.userId)) return;

      const roomHardMuted = hardMutedUsers.get(roomId);
      if (roomHardMuted) roomHardMuted.delete(targetUserId);

      // Notify the target user
      const targetSocket = findSocketByUserId(io, roomId, targetUserId);
      if (targetSocket) {
        targetSocket.emit('video:unmute-allowed', { by: socket.data.userName });
      }
      // Notify everyone
      io.to(roomId).emit('video:participant-unmute-allowed', { targetUserId });
      console.log(`🔊 Creator allowed ${targetUserId} to unmute in ${roomId}`);
    });

    // Screen share start
    socket.on('video:screen-share-start', ({ roomId, userId, userName }) => {
      if (!requireAuth(socket, roomId)) return;
      // Only one screen share at a time
      const existing = activeScreenShares.get(roomId);
      if (existing && existing.userId !== userId) {
        return socket.emit('video:screen-share-error', { message: 'Someone is already sharing their screen' });
      }
      activeScreenShares.set(roomId, { userId, userName });
      io.to(roomId).emit('video:screen-share-started', { userId, userName });
      console.log(`🖥️ ${userName} started screen share in ${roomId}`);
    });

    // Screen share stop
    socket.on('video:screen-share-stop', ({ roomId, userId }) => {
      if (!requireAuth(socket, roomId)) return;
      const existing = activeScreenShares.get(roomId);
      if (existing?.userId === userId) {
        activeScreenShares.delete(roomId);
      }
      io.to(roomId).emit('video:screen-share-stopped', { userId });
      console.log(`🖥️ ${userId} stopped screen share in ${roomId}`);
    });

    // Video call mic/camera toggle (relay to all)
    socket.on('video:media-toggle', ({ roomId, userId, micOn, camOn }) => {
      if (!requireAuth(socket, roomId)) return;
      socket.to(roomId).emit('video:media-toggled', { userId, micOn, camOn });
    });

    socket.on('disconnect', () => {
      const { roomId, userId } = socket.data || {};
      if (roomId && userId) handleLeave(socket, io, roomId, userId);
      console.log('❌ Socket disconnected:', socket.id);
    });
  });
};

function handleLeave(socket, io, roomId, userId) {
  socket.leave(roomId);
  
  const roomUsers = activeUsers.get(roomId);
  if (roomUsers) {
    roomUsers.delete(userId);
    io.to(roomId).emit('user-left', { userId, participants: Array.from(roomUsers.values()) });
    if (roomUsers.size === 0) activeUsers.delete(roomId);
  }

  // Clean up video call state when user disconnects
  const roomVideoUsers = videoCallUsers.get(roomId);
  if (roomVideoUsers && roomVideoUsers.has(userId)) {
    roomVideoUsers.delete(userId);
    if (roomVideoUsers.size === 0) videoCallUsers.delete(roomId);
    io.to(roomId).emit('video:user-left', {
      userId,
      videoUsers: Array.from(videoCallUsers.get(roomId) || []),
    });
  }
  const roomHardMuted = hardMutedUsers.get(roomId);
  if (roomHardMuted) roomHardMuted.delete(userId);
  const screenShare = activeScreenShares.get(roomId);
  if (screenShare?.userId === userId) {
    activeScreenShares.delete(roomId);
    io.to(roomId).emit('video:screen-share-stopped', { userId });
  }
  
  // Don't remove from authorizedUsers - they remain authorized even when offline
}