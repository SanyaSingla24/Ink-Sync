import { useRef, useState, useCallback, useEffect } from 'react';
import { getSocket } from '../services/socket';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

/**
 * useWebRTC — manages WebRTC peer connections for video calling.
 * Mesh topology: each user connects to every other user.
 */
const useWebRTC = ({ roomId, userId, userName }) => {
  // Local media streams
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isHardMuted, setIsHardMuted] = useState(false);
  const [hardMuteMessage, setHardMuteMessage] = useState('');
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Remote streams: Map<userId, { stream, micOn, camOn, userName }>
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  // Remote screen share stream
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [screenShareUser, setScreenShareUser] = useState(null);

  // Refs for peer connections and state
  const peerConnections = useRef(new Map()); // userId -> RTCPeerConnection
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pendingCandidates = useRef(new Map()); // userId -> ICECandidate[]
  const isInCallRef = useRef(false);

  const socket = getSocket();

  // Helper: creates a synthetic animated video stream for testing when the physical webcam
  // is already locked by another browser tab or process on the same machine.
  const createVirtualCameraStream = useCallback((name = 'User') => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    let frame = 0;

    const intervalId = setInterval(() => {
      frame++;
      const hue = (frame * 3) % 360;
      const grad = ctx.createLinearGradient(0, 0, 320, 240);
      grad.addColorStop(0, `hsl(${hue}, 60%, 25%)`);
      grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 60%, 15%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 320, 240);

      // Avatar Circle
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(160, 100, 42, 0, Math.PI * 2);
      ctx.fill();

      // Initial
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.charAt(0).toUpperCase() || 'U', 160, 100);

      // Name & Live indicator
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(name, 160, 165);
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('● TEST VIDEO STREAM', 160, 185);
    }, 1000 / 15);

    const stream = canvas.captureStream(15);
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      clearInterval(intervalId);
    });
    return stream;
  }, []);

  // --- MEDIA ACQUISITION ---

  const acquireMedia = useCallback(async (wantMic, wantCam) => {
    try {
      // 1. Acquire audio
      let audioTrack = null;
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioTrack = audioStream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = Boolean(wantMic);
      } catch (err) {
        console.warn('Could not acquire audio:', err);
      }

      // 2. Acquire video (physical webcam or virtual fallback if locked by another tab on same PC)
      let videoTrack = null;
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } },
        });
        videoTrack = videoStream.getVideoTracks()[0];
      } catch (camErr) {
        console.warn('Physical camera locked or unavailable, using virtual test stream fallback:', camErr);
        const virtualStream = createVirtualCameraStream(userName);
        videoTrack = virtualStream.getVideoTracks()[0];
      }

      if (videoTrack) {
        videoTrack.enabled = Boolean(wantCam);
      }

      const tracks = [];
      if (audioTrack) tracks.push(audioTrack);
      if (videoTrack) tracks.push(videoTrack);

      const stream = new MediaStream(tracks);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicOn(Boolean(wantMic && audioTrack));
      setCamOn(Boolean(wantCam && videoTrack));
      return stream;
    } catch (err) {
      console.error('Failed to acquire media:', err);
      const stream = new MediaStream();
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    }
  }, [userName, createVirtualCameraStream]);

  // --- PEER CONNECTION MANAGEMENT ---

  const createPeerConnection = useCallback((targetUserId) => {
    if (peerConnections.current.has(targetUserId)) {
      return peerConnections.current.get(targetUserId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks to peer connection
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    // Add screen share tracks if sharing
    const screenStr = screenStreamRef.current;
    if (screenStr) {
      screenStr.getTracks().forEach(track => {
        pc.addTrack(track, screenStr);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:ice-candidate', {
          roomId,
          targetUserId,
          candidate: event.candidate,
        });
      }
    };

    // Ensure video transceiver exists with sendrecv if no video track present yet
    const hasVideo = stream && stream.getVideoTracks().length > 0;
    if (!hasVideo) {
      try {
        pc.addTransceiver('video', { direction: 'sendrecv' });
      } catch (_) {}
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams?.[0] || new MediaStream([event.track]);
      if (!remoteStream) return;

      // Check if this is a screen share stream (has only video and is large resolution)
      const videoTrack = remoteStream.getVideoTracks()[0];
      const isScreen = videoTrack?.label?.toLowerCase().includes('screen') ||
                       videoTrack?.label?.toLowerCase().includes('window') ||
                       videoTrack?.label?.toLowerCase().includes('monitor') ||
                       videoTrack?.label?.toLowerCase().includes('display') ||
                       videoTrack?.label?.toLowerCase().includes('tab');

      if (isScreen) {
        setRemoteScreenStream(remoteStream);
        setScreenShareUser(targetUserId);
      } else {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          const existing = next.get(targetUserId) || {};
          next.set(targetUserId, { ...existing, stream: remoteStream });
          return next;
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePeerConnection(targetUserId);
      }
    };

    peerConnections.current.set(targetUserId, pc);

    // Apply any pending ICE candidates
    const pending = pendingCandidates.current.get(targetUserId);
    if (pending) {
      pending.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
      pendingCandidates.current.delete(targetUserId);
    }

    return pc;
  }, [roomId, socket]);

  const closePeerConnection = useCallback((targetUserId) => {
    const pc = peerConnections.current.get(targetUserId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(targetUserId);
    }
    setRemoteStreams(prev => {
      const next = new Map(prev);
      next.delete(targetUserId);
      return next;
    });
  }, []);

  // --- SIGNALING HANDLERS ---

  const handleOffer = useCallback(async (data) => {
    if (!isInCallRef.current) return;
    const { fromUserId, offer } = data;

    const pc = createPeerConnection(fromUserId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc:answer', {
        roomId,
        targetUserId: fromUserId,
        answer,
      });
    } catch (err) {
      console.error('Error handling offer from', fromUserId, err);
    }
  }, [roomId, socket, createPeerConnection]);

  const handleAnswer = useCallback(async (data) => {
    const { fromUserId, answer } = data;
    const pc = peerConnections.current.get(fromUserId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('Error handling answer from', fromUserId, err);
      }
    }
  }, []);

  const handleIceCandidate = useCallback(async (data) => {
    const { fromUserId, candidate } = data;
    const pc = peerConnections.current.get(fromUserId);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    } else {
      // Queue the candidate
      if (!pendingCandidates.current.has(fromUserId)) {
        pendingCandidates.current.set(fromUserId, []);
      }
      pendingCandidates.current.get(fromUserId).push(candidate);
    }
  }, []);

  // --- JOIN / LEAVE VIDEO CALL ---

  const joinCall = useCallback(async (wantMic, wantCam) => {
    const stream = await acquireMedia(wantMic, wantCam);
    setIsInCall(true);
    isInCallRef.current = true;

    // Tell server we joined
    socket.emit('video:join', { roomId, userId, userName, micOn: wantMic, camOn: wantCam });

    return stream;
  }, [acquireMedia, roomId, userId, userName, socket]);

  const leaveCall = useCallback(() => {
    // Stop all local tracks
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;

    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    pendingCandidates.current.clear();

    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams(new Map());
    setRemoteScreenStream(null);
    setScreenShareUser(null);
    setMicOn(false);
    setCamOn(false);
    setIsInCall(false);
    setIsScreenSharing(false);
    setIsHardMuted(false);
    setHardMuteMessage('');
    isInCallRef.current = false;

    socket.emit('video:leave', { roomId, userId, userName });
  }, [roomId, userId, userName, socket]);

  // --- TOGGLE MIC / CAM ---

  const toggleMic = useCallback(async () => {
    if (isHardMuted) return; // Can't unmute when hard-muted

    const stream = localStreamRef.current;
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      // Toggle existing audio track
      const newState = !audioTracks[0].enabled;
      audioTracks[0].enabled = newState;
      setMicOn(newState);
      setLocalStream(new MediaStream(stream.getTracks()));
      socket.emit('video:media-toggle', { roomId, userId, micOn: newState, camOn });
    } else if (!micOn) {
      // No audio track yet, acquire one and renegotiate
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];
        stream.addTrack(audioTrack);

        setMicOn(true);
        const updatedStream = new MediaStream(stream.getTracks());
        localStreamRef.current = updatedStream;
        setLocalStream(updatedStream);
        socket.emit('video:media-toggle', { roomId, userId, micOn: true, camOn });

        // Add track and renegotiate with all connected peers
        for (const [peerId, pc] of peerConnections.current.entries()) {
          try {
            pc.addTrack(audioTrack, updatedStream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc:offer', { roomId, targetUserId: peerId, offer });
          } catch (pcErr) {
            console.error('Renegotiation failed for', peerId, pcErr);
          }
        }
      } catch (err) {
        console.error('Failed to acquire mic:', err);
      }
    }
  }, [isHardMuted, micOn, camOn, roomId, userId, socket]);

  const toggleCam = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const videoTracks = stream.getVideoTracks();
    if (camOn && videoTracks.length > 0) {
      // User is turning video OFF:
      // Stop the hardware track so Windows releases the camera hardware for other tabs/apps!
      videoTracks.forEach(t => {
        t.enabled = false;
        t.stop();
        stream.removeTrack(t);
      });
      // Replace with null on peer connections
      peerConnections.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track === null || s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(null).catch(() => {});
        }
      });
      setCamOn(false);
      const updatedStream = new MediaStream(stream.getTracks());
      localStreamRef.current = updatedStream;
      setLocalStream(updatedStream);
      socket.emit('video:media-toggle', { roomId, userId, micOn, camOn: false });
    } else {
      // User is turning video ON:
      try {
        let videoStream;
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } }
          });
        } catch (camErr) {
          console.warn('Physical camera unavailable (in use by another tab or blocked), using virtual stream fallback:', camErr);
          videoStream = createVirtualCameraStream(userName);
        }

        const videoTrack = videoStream.getVideoTracks()[0];
        stream.addTrack(videoTrack);

        setCamOn(true);
        const updatedStream = new MediaStream(stream.getTracks());
        localStreamRef.current = updatedStream;
        setLocalStream(updatedStream);
        socket.emit('video:media-toggle', { roomId, userId, micOn, camOn: true });

        // Update peer connections: use replaceTrack if sender exists, or addTrack + renegotiate
        for (const [peerId, pc] of peerConnections.current.entries()) {
          try {
            const senders = pc.getSenders();
            const videoSender = senders.find(s => s.track === null || s.track?.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(videoTrack);
            } else {
              pc.addTrack(videoTrack, updatedStream);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit('webrtc:offer', { roomId, targetUserId: peerId, offer });
            }
          } catch (pcErr) {
            console.error('Updating video track failed for', peerId, pcErr);
          }
        }
      } catch (err) {
        console.error('Failed to acquire camera:', err);
      }
    }
  }, [camOn, micOn, roomId, userId, userName, socket, createVirtualCameraStream]);

  // --- SCREEN SHARE ---

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      // Add screen track to all peer connections
      const screenTrack = stream.getVideoTracks()[0];
      peerConnections.current.forEach((pc) => {
        pc.addTrack(screenTrack, stream);
      });

      // Notify server
      socket.emit('video:screen-share-start', { roomId, userId, userName });

      // Handle browser's native "Stop sharing" button
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error('Screen share failed:', err);
    }
  }, [roomId, userId, userName, socket]);

  const stopScreenShare = useCallback(() => {
    const stream = screenStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());

      // Remove screen tracks from peer connections
      peerConnections.current.forEach((pc) => {
        const senders = pc.getSenders();
        senders.forEach(sender => {
          if (sender.track && stream.getTracks().includes(sender.track)) {
            pc.removeTrack(sender);
          }
        });
      });
    }

    screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);
    socket.emit('video:screen-share-stop', { roomId, userId });
  }, [roomId, userId, socket]);

  // --- CONNECT TO A NEW PEER (create offer) ---

  const connectToPeer = useCallback(async (targetUserId) => {
    if (!isInCallRef.current) return;
    if (targetUserId === userId) return;

    const pc = createPeerConnection(targetUserId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('webrtc:offer', {
        roomId,
        targetUserId,
        offer,
      });
    } catch (err) {
      console.error('Error creating offer for', targetUserId, err);
    }
  }, [userId, roomId, socket, createPeerConnection]);

  // --- HARD MUTE HANDLING ---

  const applyHardMute = useCallback(() => {
    setIsHardMuted(true);
    // Force-disable mic
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach(t => { t.enabled = false; });
    }
    setMicOn(false);
    socket.emit('video:media-toggle', { roomId, userId, micOn: false, camOn });
  }, [roomId, userId, camOn, socket]);

  const removeHardMute = useCallback(() => {
    setIsHardMuted(false);
    setHardMuteMessage('');
  }, []);

  // --- SOCKET EVENT LISTENERS ---

  useEffect(() => {
    const onOffer = (data) => handleOffer(data);
    const onAnswer = (data) => handleAnswer(data);
    const onIce = (data) => handleIceCandidate(data);

    const onVideoUserJoined = ({ userId: joinedUserId, userName: joinedUserName, micOn: jMic, camOn: jCam }) => {
      if (joinedUserId === userId) return;
      // Update remote streams metadata
      setRemoteStreams(prev => {
        const next = new Map(prev);
        const existing = next.get(joinedUserId) || {};
        next.set(joinedUserId, { ...existing, userName: joinedUserName, micOn: jMic, camOn: jCam });
        return next;
      });
      // If we're in the call, create a peer connection
      if (isInCallRef.current) {
        connectToPeer(joinedUserId);
      }
    };

    const onVideoUserLeft = ({ userId: leftUserId }) => {
      if (leftUserId === userId) return;
      closePeerConnection(leftUserId);
      // If they were screen sharing, clean up
      setScreenShareUser(prev => {
        if (prev === leftUserId) {
          setRemoteScreenStream(null);
          return null;
        }
        return prev;
      });
    };

    const onMediaToggled = ({ userId: uid, micOn: m, camOn: c }) => {
      setRemoteStreams(prev => {
        const next = new Map(prev);
        const existing = next.get(uid) || {};
        next.set(uid, { ...existing, micOn: m, camOn: c });
        return next;
      });
    };

    const onHardMuted = ({ by }) => {
      setHardMuteMessage(`You have been muted by ${by}`);
      applyHardMute();
    };

    const onUnmuteAllowed = ({ by }) => {
      setHardMuteMessage(`${by} has allowed you to unmute`);
      removeHardMute();
      setTimeout(() => setHardMuteMessage(''), 5000);
    };

    const onHardMuteStatus = ({ isHardMuted: hm }) => {
      if (hm) applyHardMute();
    };

    const onScreenShareStarted = ({ userId: sharerUserId, userName: sharerName }) => {
      setScreenShareUser({ userId: sharerUserId, userName: sharerName });
      if (sharerUserId === userId) return; // We already have our own stream
      // The screen stream will arrive via ontrack
    };

    const onScreenShareStopped = ({ userId: sharerUserId }) => {
      if (screenShareUser?.userId === sharerUserId || screenShareUser === sharerUserId) {
        setRemoteScreenStream(null);
        setScreenShareUser(null);
      }
      if (sharerUserId === userId) {
        setIsScreenSharing(false);
      }
    };

    const onScreenShareError = ({ message }) => {
      alert(message);
    };

    socket.on('webrtc:offer', onOffer);
    socket.on('webrtc:answer', onAnswer);
    socket.on('webrtc:ice-candidate', onIce);
    socket.on('video:user-joined', onVideoUserJoined);
    socket.on('video:user-left', onVideoUserLeft);
    socket.on('video:media-toggled', onMediaToggled);
    socket.on('video:hard-muted', onHardMuted);
    socket.on('video:unmute-allowed', onUnmuteAllowed);
    socket.on('video:hard-mute-status', onHardMuteStatus);
    socket.on('video:screen-share-started', onScreenShareStarted);
    socket.on('video:screen-share-stopped', onScreenShareStopped);
    socket.on('video:screen-share-error', onScreenShareError);

    return () => {
      socket.off('webrtc:offer', onOffer);
      socket.off('webrtc:answer', onAnswer);
      socket.off('webrtc:ice-candidate', onIce);
      socket.off('video:user-joined', onVideoUserJoined);
      socket.off('video:user-left', onVideoUserLeft);
      socket.off('video:media-toggled', onMediaToggled);
      socket.off('video:hard-muted', onHardMuted);
      socket.off('video:unmute-allowed', onUnmuteAllowed);
      socket.off('video:hard-mute-status', onHardMuteStatus);
      socket.off('video:screen-share-started', onScreenShareStarted);
      socket.off('video:screen-share-stopped', onScreenShareStopped);
      socket.off('video:screen-share-error', onScreenShareError);
    };
  }, [userId, socket, handleOffer, handleAnswer, handleIceCandidate, connectToPeer, closePeerConnection, applyHardMute, removeHardMute, screenShareUser]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInCallRef.current) {
        leaveCall();
      }
    };
  }, []);

  return {
    // State
    localStream,
    screenStream,
    remoteStreams,
    remoteScreenStream,
    screenShareUser,
    micOn,
    camOn,
    isInCall,
    isHardMuted,
    hardMuteMessage,
    isScreenSharing,
    // Actions
    joinCall,
    leaveCall,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    connectToPeer,
  };
};

export default useWebRTC;
