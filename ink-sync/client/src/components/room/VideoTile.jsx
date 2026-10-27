import { useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, Crown } from 'lucide-react';

const VideoTile = ({
  stream,
  userName,
  isLocal = false,
  isMuted = false,
  isCameraOff = false,
  isCreator = false,
  isHardMuted = false,
  isRoomCreator = false,
  userId,
  onHardMute,
  onUnmuteAllow,
}) => {
  const videoRef = useRef(null);

  const showVideo = Boolean(stream && !isCameraOff && stream.getVideoTracks().length > 0);

  // Attach stream and play whenever stream or showVideo changes
  const attachStream = useCallback(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    if (showVideo) {
      video.play().catch(() => { });
    }
  }, [stream, showVideo]);

  useEffect(() => {
    attachStream();
  }, [attachStream]);

  // Callback ref so that whenever the video DOM node mounts, stream is attached immediately
  const setVideoRef = useCallback((el) => {
    videoRef.current = el;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      if (showVideo) {
        el.play().catch(() => { });
      }
    }
  }, [stream, showVideo]);

  const initials = userName?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="relative group rounded-xl overflow-hidden bg-slate-800 aspect-video flex items-center justify-center shadow-lg border border-slate-700/50">
      {/* Video — always kept in DOM to preserve srcObject across camera toggles */}
      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${showVideo ? 'block' : 'hidden'}`}
      />

      {/* Avatar placeholder shown when camera is off */}
      {!showVideo && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
            {initials}
          </div>
        </div>
      )}

      {/* Name & status overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-white text-xs font-medium truncate max-w-[100px]">
              {isLocal ? 'You' : userName}
            </span>
            {isCreator && <Crown className="w-3 h-3 text-amber-400" />}
          </div>
          <div className="flex items-center gap-1">
            {isMuted || isHardMuted ? (
              <div className="p-0.5 bg-red-500/80 rounded-full" title={isHardMuted ? 'Muted by host' : 'Muted'}>
                <MicOff className="w-3 h-3 text-white" />
              </div>
            ) : (
              <div className="p-0.5 bg-green-500/80 rounded-full">
                <Mic className="w-3 h-3 text-white" />
              </div>
            )}
            {isCameraOff ? (
              <div className="p-0.5 bg-red-500/80 rounded-full">
                <VideoOff className="w-3 h-3 text-white" />
              </div>
            ) : (
              <div className="p-0.5 bg-green-500/80 rounded-full">
                <Video className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hard-mute indicator */}
      {isHardMuted && !isLocal && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-red-500/90 text-white text-[10px] font-semibold rounded-full flex items-center gap-1">
          <MicOff className="w-2.5 h-2.5" /> Muted by host
        </div>
      )}

      {/* Creator controls over participants (not self) */}
      {isRoomCreator && !isLocal && !isCreator && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          {isHardMuted ? (
            <button
              onClick={() => onUnmuteAllow?.(userId)}
              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold rounded-lg shadow-lg transition"
              title="Allow to unmute"
            >
              Allow unmute
            </button>
          ) : (
            <button
              onClick={() => onHardMute?.(userId)}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold rounded-lg shadow-lg transition"
              title="Mute participant"
            >
              Mute
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoTile;
