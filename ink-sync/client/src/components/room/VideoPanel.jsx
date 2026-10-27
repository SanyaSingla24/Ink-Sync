import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Maximize2, Minimize2, Mic, MicOff, Video, VideoOff,
  MonitorUp, PhoneOff, Phone, GripVertical, ChevronLeft, ChevronRight,
  AlertTriangle
} from 'lucide-react';
import VideoTile from './VideoTile';

/**
 * VideoPanel — resizable side panel for the video call.
 * Shows "Join Video" → pre-join dialog → video grid → controls.
 */
const VideoPanel = ({
  webrtc,
  participants,
  currentUserId,
  isCreator,
  hardMutedUserIds = [],
  videoUsers = [],
  onClose,
  onHardMute,
  onUnmuteAllow,
  onStartCall,
  initialOpenPreJoin = false,
}) => {
  const {
    localStream, remoteStreams = new Map(), micOn, camOn,
    isInCall, isHardMuted, hardMuteMessage,
    isScreenSharing,
    joinCall, leaveCall, toggleMic, toggleCam,
    startScreenShare, stopScreenShare,
  } = webrtc || {};

  // Check if call is already in progress by other users in the room
  const otherUsersInCall = (videoUsers || []).filter(id => id !== currentUserId);
  const isCallActive = otherUsersInCall.length > 0 || (remoteStreams?.size || 0) > 0;

  // Pre-join dialog state
  const [showPreJoin, setShowPreJoin] = useState(initialOpenPreJoin);

  useEffect(() => {
    if (initialOpenPreJoin) {
      setShowPreJoin(true);
    }
  }, [initialOpenPreJoin]);
  const [preJoinMic, setPreJoinMic] = useState(true);
  const [preJoinCam, setPreJoinCam] = useState(true);

  // Panel resize state
  const [panelWidth, setPanelWidth] = useState(340);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);
  const resizeRef = useRef(null);

  const MIN_WIDTH = 280;
  const MAX_WIDTH_RATIO = 0.5;

  // Resize handler
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (moveEvent) => {
      const delta = startX - moveEvent.clientX;
      const maxWidth = window.innerWidth * MAX_WIDTH_RATIO;
      const newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  // Join with pre-selected settings
  const handleJoin = async () => {
    await joinCall(preJoinMic, preJoinCam);
    setShowPreJoin(false);
    if (onStartCall && !isCallActive) {
      onStartCall();
    }
  };

  // Build video participants list
  const videoParticipants = [];
  if (isInCall && localStream) {
    videoParticipants.push({
      id: currentUserId,
      stream: localStream,
      userName: 'You',
      isLocal: true,
      isMuted: !micOn,
      isCameraOff: !camOn,
      isCreator,
      isHardMuted: false,
    });
  }

  // Add remote peers
  remoteStreams.forEach((data, peerId) => {
    const participant = participants.find(p => p.userId === peerId);
    videoParticipants.push({
      id: peerId,
      stream: data.stream || null,
      userName: data.userName || participant?.userName || 'User',
      isLocal: false,
      isMuted: data.micOn === false,
      isCameraOff: data.camOn === false,
      isCreator: participant?.isCreator || false,
      isHardMuted: hardMutedUserIds.includes(peerId),
    });
  });

  return (
    <div
      ref={panelRef}
      className={`flex flex-col h-full bg-slate-900 border-l border-slate-700 shadow-2xl z-20 relative transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 border-none' : ''
      }`}
      style={isFullscreen ? {} : { width: panelWidth }}
    >
      {/* Resize handle */}
      {!isFullscreen && (
        <div
          ref={resizeRef}
          onMouseDown={handleResizeStart}
          className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-30 group hover:bg-indigo-500/50 transition ${
            isResizing ? 'bg-indigo-500/70' : 'bg-transparent'
          }`}
        >
          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition">
            <GripVertical className="w-3 h-3 text-indigo-400" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="font-semibold text-sm text-white">Video Call</h3>
          {isInCall && (
            <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded-full font-medium">
              {videoParticipants.length} in call
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hard-mute notification banner */}
      {hardMuteMessage && (
        <div className="px-4 py-2 bg-amber-900/50 border-b border-amber-700/50 flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-200">{hardMuteMessage}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {!isInCall && !showPreJoin ? (
          /* Not in call — show start or join prompt */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
              <Video className="w-8 h-8 text-white" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-base mb-1">
                {isCallActive ? 'Video Call in Progress' : 'Start Video Call'}
              </h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                {isCallActive
                  ? `${otherUsersInCall.length || 1} participant${(otherUsersInCall.length || 1) > 1 ? 's are' : ' is'} in this call. Join to collaborate with audio and video.`
                  : 'Start a call to invite everyone in this room to collaborate live.'}
              </p>
            </div>
            <button
              onClick={() => setShowPreJoin(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:scale-105"
            >
              <Phone className="w-4 h-4" /> {isCallActive ? 'Join Video Call' : 'Start Video Call'}
            </button>
          </div>
        ) : showPreJoin ? (
          /* Pre-join dialog — choose mic/cam */
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center">
              <span className="text-2xl font-bold text-indigo-400">
                {participants.find(p => p.userId === currentUserId)?.userName?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>

            <h4 className="text-white font-semibold text-sm">Choose your settings</h4>

            <div className="flex gap-4">
              {/* Mic toggle */}
              <button
                onClick={() => setPreJoinMic(!preJoinMic)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  preJoinMic
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                    : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                }`}
              >
                {preJoinMic ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                <span className="text-xs font-medium">{preJoinMic ? 'Mic On' : 'Mic Off'}</span>
              </button>

              {/* Cam toggle */}
              <button
                onClick={() => setPreJoinCam(!preJoinCam)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  preJoinCam
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                    : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                }`}
              >
                {preJoinCam ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                <span className="text-xs font-medium">{preJoinCam ? 'Cam On' : 'Cam Off'}</span>
              </button>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setShowPreJoin(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold text-sm rounded-lg shadow-lg transition-all"
              >
                <Phone className="w-4 h-4" /> Join Now
              </button>
            </div>
          </div>
        ) : (
          /* In call — show video grid */
          <div className={`grid gap-2 ${
            isFullscreen
              ? (videoParticipants.length <= 2 ? 'grid-cols-2' : videoParticipants.length <= 4 ? 'grid-cols-2' : 'grid-cols-3')
              : (videoParticipants.length <= 1 ? 'grid-cols-1' : 'grid-cols-2')
          }`}>
            {videoParticipants.map((vp) => (
              <VideoTile
                key={vp.id}
                stream={vp.stream}
                userName={vp.userName}
                isLocal={vp.isLocal}
                isMuted={vp.isMuted}
                isCameraOff={vp.isCameraOff}
                isCreator={vp.isCreator}
                isHardMuted={vp.isHardMuted}
                isRoomCreator={isCreator}
                userId={vp.id}
                onHardMute={onHardMute}
                onUnmuteAllow={onUnmuteAllow}
              />
            ))}

            {videoParticipants.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <Video className="w-10 h-10 text-slate-600 mb-3" />
                <p className="text-slate-500 text-sm">No one else is in the video call yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls bar — only show when in call */}
      {isInCall && (
        <div className="px-3 py-3 border-t border-slate-700 bg-slate-800/80 shrink-0">
          <div className="flex items-center justify-center gap-2">
            {/* Mic toggle */}
            <button
              onClick={toggleMic}
              disabled={isHardMuted}
              className={`relative p-2.5 rounded-xl transition-all ${
                isHardMuted
                  ? 'bg-red-900/50 text-red-400 cursor-not-allowed opacity-60'
                  : micOn
                    ? 'bg-slate-700 text-white hover:bg-slate-600'
                    : 'bg-red-600 text-white hover:bg-red-500'
              }`}
              title={isHardMuted ? 'Muted by host — waiting for permission' : micOn ? 'Mute mic' : 'Unmute mic'}
            >
              {micOn && !isHardMuted ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              {isHardMuted && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-slate-900" />
              )}
            </button>

            {/* Camera toggle */}
            <button
              onClick={toggleCam}
              className={`p-2.5 rounded-xl transition-all ${
                camOn
                  ? 'bg-slate-700 text-white hover:bg-slate-600'
                  : 'bg-red-600 text-white hover:bg-red-500'
              }`}
              title={camOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            {/* Screen share */}
            <button
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              className={`p-2.5 rounded-xl transition-all ${
                isScreenSharing
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500 ring-2 ring-indigo-400/50'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              <MonitorUp className="w-4 h-4" />
            </button>

            {/* Leave call */}
            <button
              onClick={leaveCall}
              className="p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all ml-2 shadow-lg shadow-red-600/30"
              title="Leave video call"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPanel;
