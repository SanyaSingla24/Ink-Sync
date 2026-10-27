import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../services/socket';

const useRoomSocket = ({ roomId, user, canvas, canvasRef: externalCanvasRef, sendRef }) => {
  const [connection, setConnection] = useState('connecting');
  const [accessStatus, setAccessStatus] = useState('pending'); // pending | approved | denied | revoked
  const [participants, setParticipants] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isCreator, setIsCreator] = useState(false);
  const [isBoardLocked, setIsBoardLocked] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [cursors, setCursors] = useState({}); // userId -> { x, y, userName }
  const [messages, setMessages] = useState([]);

  // Video call state
  const [videoUsers, setVideoUsers] = useState([]); // userIds currently in video call
  const [hardMutedUserIds, setHardMutedUserIds] = useState([]); // userIds hard-muted by creator
  const [screenShareInfo, setScreenShareInfo] = useState(null); // { userId, userName } or null
  const [incomingCallPrompt, setIncomingCallPrompt] = useState(null); // { initiatorId, initiatorName, timestamp } or null

  const internalCanvasRef = useRef(canvas);
  internalCanvasRef.current = canvas;

  const getCanvas = () => externalCanvasRef?.current || internalCanvasRef.current;

  useEffect(() => {
    const socket = getSocket();
    const onChatMessage = (msg) => setMessages((prev) => [...prev, msg]);
    const onChatDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    };
    socket.on('chat:deleted', onChatDeleted);
    sendRef.current = {
      operation: (op) => socket.emit('board:operation', { ...op, roomId }),
      live: (op) => socket.emit('board:live', { ...op, roomId }),
      update: (op) => socket.emit('board:update', { ...op, roomId }),
      remove: (ids) => socket.emit('board:delete', { roomId, ids }),
      undo: (operationId) => socket.emit('board:undo', { roomId, operationId }),
      reorder: (ids) => socket.emit('board:reorder', { roomId, ids }),
      cursorMove: (data) => socket.emit('cursor:move', { ...data, roomId }),
      toggleBoardLock: (locked) => socket.emit('board:lock-toggle', { roomId, isLocked: locked }),
      approveAccess: (targetUserId, targetUserName) => 
        socket.emit('approve-access', { roomId, targetUserId, targetUserName }),
      removeUser: (targetUserId) => socket.emit('remove-user', { roomId, targetUserId }),
      sendMessage: (message, recipientId) => socket.emit('chat:send', { roomId, userId: user.id, message, recipientId }),
      deleteMessage: (messageId) => socket.emit('chat:delete', { roomId, messageId }),
      // Video call actions
      startVideoCall: () => socket.emit('video:start-call', { roomId, initiatorId: user.id, initiatorName: user.name }),
      hardMuteUser: (targetUserId) => socket.emit('video:hard-mute', { roomId, targetUserId }),
      unmuteAllowUser: (targetUserId) => socket.emit('video:unmute-allow', { roomId, targetUserId }),
    };

    const joinAndSync = () => {
      socket.emit('join-room', {
        roomId,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar || '',
        token: localStorage.getItem('token'),
      });
    };

    const onConnect = () => { 
      setConnection('connected'); 
      setAccessStatus('pending');
      joinAndSync(); 
    };
    const onDisconnect = () => setConnection('disconnected');
    const onJoinError = ({ message, status }) => {
      setJoinError(message);
      setAccessStatus(status || 'denied');
    };
    const onRoomJoined = ({ participants: pList, isCreator: isC, isLocked, videoUsers: vUsers, hardMuted, screenShare }) => {
      setParticipants(pList || []);
      if (isC !== undefined) setIsCreator(isC);
      if (isLocked !== undefined) setIsBoardLocked(isLocked);
      if (vUsers) setVideoUsers(vUsers);
      if (hardMuted) setHardMutedUserIds(hardMuted);
      if (screenShare) setScreenShareInfo(screenShare);
      setAccessStatus('approved');
      socket.emit('board:sync-request', { roomId });
    };
    const onUserJoined = ({ participants: pList }) => {
      setParticipants(pList || []);
    };
    const onPendingRequests = (requests) => setPendingRequests(requests);
    const onAccessApproved = ({ roomId: rid, targetUserId }) => {
      if (rid === roomId && targetUserId === user.id) {
        setAccessStatus('approved');
        joinAndSync(); // Re-join now that we're approved
      }
    };
    const onAccessRevoked = ({ roomId: rid }) => {
      if (rid === roomId) {
        setAccessStatus('revoked');
        socket.disconnect();
      }
    };
    const onLockStatus = ({ isLocked }) => {
      setIsBoardLocked(!!isLocked);
    };

    const onSync = ({ operations }) => {
      getCanvas()?.loadOperations(operations || []);
      setAccessStatus('approved');
    };
    const onOperation = (op) => {
      getCanvas()?.clearLiveOperation(op.userId);
      getCanvas()?.applyRemoteOperation(op);
    };
    const onLive = (op) => getCanvas()?.applyLiveOperation(op);
    const onUpdate = (op) => getCanvas()?.applyRemoteUpdate(op);
    const onDelete = ({ ids }) => getCanvas()?.applyRemoteDelete(ids);
    const onUndo = ({ operationId }) => getCanvas()?.applyRemoteUndo(operationId);
    const onReorder = ({ ids }) => getCanvas()?.applyRemoteReorder(ids);
    
    const onCursorMove = ({ userId, userName, x, y }) => {
      setCursors(prev => ({ ...prev, [userId]: { userName, x, y, lastUpdate: Date.now() } }));
    };

    // Video call events
    const onVideoUserJoined = ({ videoUsers: vUsers }) => {
      if (vUsers) setVideoUsers(vUsers);
    };
    const onVideoUserLeft = ({ videoUsers: vUsers }) => {
      if (vUsers) setVideoUsers(vUsers);
    };
    const onParticipantHardMuted = ({ targetUserId }) => {
      setHardMutedUserIds(prev => prev.includes(targetUserId) ? prev : [...prev, targetUserId]);
    };
    const onParticipantUnmuteAllowed = ({ targetUserId }) => {
      setHardMutedUserIds(prev => prev.filter(id => id !== targetUserId));
    };
    const onScreenShareStarted = ({ userId: uid, userName: uname }) => {
      setScreenShareInfo({ userId: uid, userName: uname });
    };
    const onScreenShareStopped = () => {
      setScreenShareInfo(null);
    };
    const onCallStartedPrompt = (data) => {
      if (data?.initiatorId !== user.id) {
        setIncomingCallPrompt(data);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-join-error', onJoinError);
    socket.on('room-joined', onRoomJoined);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserJoined);
    socket.on('pending-requests', onPendingRequests);
    socket.on('access-approved', onAccessApproved);
    socket.on('access-revoked', onAccessRevoked);
    socket.on('board:lock-status', onLockStatus);
    socket.on('user-approved', ({ userId, userName }) => {
      setParticipants(prev => [...prev.filter(p => p.userId !== userId), { userId, userName }]);
    });
    socket.on('user-removed', ({ participants: newParticipants }) => setParticipants(newParticipants));
    socket.on('board:sync-response', onSync);
    socket.on('board:operation', onOperation);
    socket.on('board:live', onLive);
    socket.on('board:update', onUpdate);
    socket.on('board:delete', onDelete);
    socket.on('board:undo', onUndo);
    socket.on('board:reorder', onReorder);
    socket.on('cursor:move', onCursorMove);
    socket.on('chat:message', onChatMessage);

    // Video call event listeners
    socket.on('video:call-started-prompt', onCallStartedPrompt);
    socket.on('video:user-joined', onVideoUserJoined);
    socket.on('video:user-left', onVideoUserLeft);
    socket.on('video:participant-hard-muted', onParticipantHardMuted);
    socket.on('video:participant-unmute-allowed', onParticipantUnmuteAllowed);
    socket.on('video:screen-share-started', onScreenShareStarted);
    socket.on('video:screen-share-stopped', onScreenShareStopped);

    if (socket.connected) onConnect();
    else socket.connect();

    // Cursor cleanup timeout
    const cursorCleanup = setInterval(() => {
      setCursors(prev => {
        const now = Date.now();
        const next = { ...prev };
        for (const [userId, cursor] of Object.entries(next)) {
          if (now - cursor.lastUpdate > 10000) delete next[userId];
        }
        return next;
      });
    }, 5000);

    return () => {
      clearInterval(cursorCleanup);
      socket.emit('leave-room', { roomId, userId: user.id });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-join-error', onJoinError);
      socket.off('room-joined', onRoomJoined);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserJoined);
      socket.off('pending-requests', onPendingRequests);
      socket.off('access-approved', onAccessApproved);
      socket.off('access-revoked', onAccessRevoked);
      socket.off('board:lock-status', onLockStatus);
      socket.off('user-approved');
      socket.off('user-removed');
      socket.off('board:sync-response', onSync);
      socket.off('board:operation', onOperation);
      socket.off('board:live', onLive);
      socket.off('board:update', onUpdate);
      socket.off('board:delete', onDelete);
      socket.off('board:undo', onUndo);
      socket.off('board:reorder', onReorder);
      socket.off('cursor:move', onCursorMove);
      socket.off('chat:message', onChatMessage);
       socket.off('chat:deleted', onChatDeleted);
      // Video call cleanup
      socket.off('video:call-started-prompt', onCallStartedPrompt);
      socket.off('video:user-joined', onVideoUserJoined);
      socket.off('video:user-left', onVideoUserLeft);
      socket.off('video:participant-hard-muted', onParticipantHardMuted);
      socket.off('video:participant-unmute-allowed', onParticipantUnmuteAllowed);
      socket.off('video:screen-share-started', onScreenShareStarted);
      socket.off('video:screen-share-stopped', onScreenShareStopped);
    };
  }, [roomId, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { 
    connection, 
    accessStatus,
    participants, 
    pendingRequests,
    isCreator,
    isBoardLocked,
    joinError,
    cursors,
    messages,
    // Video call state
    videoUsers,
    hardMutedUserIds,
    screenShareInfo,
    incomingCallPrompt,
    dismissIncomingCall: () => setIncomingCallPrompt(null),
  };
};

export default useRoomSocket;