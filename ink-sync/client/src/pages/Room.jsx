import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  PenTool, LogOut, Copy, Check, Users, Wifi, WifiOff, Loader2,
  AlertCircle, Hourglass, ShieldX, UserPlus, Crown, Lock, Unlock,
  MessageSquare, LayoutTemplate, Save, Sparkles, Video
} from 'lucide-react';
import { joinRoom } from '../services/roomService';
import { requestAccess } from '../services/accessService';
import { useAuth } from '../context/AuthContext';
import useCanvas from '../hooks/useCanvas';
import useRoomSocket from '../hooks/useRoomSocket';
import useWebRTC from '../hooks/useWebRTC';
import Whiteboard from '../components/canvas/Whiteboard';
import PendingRequestsPanel from '../components/room/PendingRequestsPanel';
import ParticipantsPanel from '../components/room/ParticipantsPanel';
import ChatPanel from '../components/room/ChatPanel';
import VideoPanel from '../components/room/VideoPanel';
import ScreenShareOverlay from '../components/room/ScreenShareOverlay';
import IncomingCallPrompt from '../components/room/IncomingCallPrompt';
import TemplatesModal from '../components/room/TemplatesModal';
import ExportMenu from '../components/room/ExportMenu';
import AIPromptBox from '../components/canvas/AIPromptBox';
import { TEMPLATES } from '../utils/templates';
import { generateId } from '../utils/drawingUtils';
import { exportBoard } from '../utils/canvasUtils';
import { generateAIDiagram } from '../services/aiService'; // <-- Real AI import

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [autoOpenPreJoin, setAutoOpenPreJoin] = useState(false);

  const sendRef = useRef({});
  const canvasRef = useRef(null);
  const currentUserId = user?.id || user?._id;

  const {
    connection, accessStatus, participants, pendingRequests,
    isCreator, isBoardLocked, joinError, cursors, messages,
    videoUsers, hardMutedUserIds, screenShareInfo,
    incomingCallPrompt, dismissIncomingCall,
  } = useRoomSocket({ roomId, user: { ...user, id: currentUserId }, canvasRef, sendRef });

  const webrtc = useWebRTC({
    roomId,
    userId: currentUserId,
    userName: user?.name || 'Anonymous',
  });

  const isReadOnly = isBoardLocked && !isCreator;

  const canvasHook = useCanvas({
    userId: currentUserId,
    roomId,
    isReadOnly,
    isCreator,
    onOperationComplete: (op) => sendRef.current.operation?.(op),
    onOperationUpdate: (op) => sendRef.current.update?.(op),
    onLiveOperation: (op) => sendRef.current.live?.(op),
    onDelete: (ids) => sendRef.current.remove?.(ids),
    onUndo: (id) => sendRef.current.undo?.(id),
    onReorder: (ids) => sendRef.current.reorder?.(ids),
    onCursorMove: (data) => sendRef.current.cursorMove?.(data),
  });

  canvasRef.current = canvasHook;

  useEffect(() => {
    const enter = async () => {
      try {
        const data = await joinRoom(roomId);
        setRoom(data);
      } catch (err) {
        if (err.response?.status === 404) {
          setError('This room does not exist. Check the room ID.');
        } else {
          setError('Could not load this room. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };
    enter();
  }, [roomId]);

  useEffect(() => {
    if (accessStatus === 'pending' && room && !isCreator) {
      requestAccess(roomId).catch((err) => console.error(err));
    }
  }, [accessStatus, room, roomId, isCreator]);

  useEffect(() => {
    if (isCreator && pendingRequests.length > 0) setShowRequests(true);
  }, [pendingRequests.length, isCreator]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const applyTemplate = (templateKey) => {
    const template = TEMPLATES[templateKey];
    if (!template) return;

    const cam = canvasHook.getCamera();
    const centerX = (window.innerWidth / 2 - cam.x) / cam.zoom;
    const centerY = ((window.innerHeight - 56) / 2 - cam.y) / cam.zoom;

    const newOperations = template.operations.map((op) => ({
      ...op,
      operationId: generateId(),
      userId: currentUserId,
      roomId: roomId,
      timestamp: Date.now(),
      points: op.points.map((p) => ({
        x: p.x + centerX,
        y: p.y + centerY,
      })),
    }));

    newOperations.forEach((op) => {
      sendRef.current.operation?.(op);
    });

    setShowTemplates(false);
  };

  // ---------- EXPORT & IMPORT FUNCTIONS ----------
  const handleExportPNG = () => {
    const ops = canvasHook.getOperations();
    const ok = exportBoard(ops, { roomName: room?.name || 'Board', format: 'png' });
    if (!ok) alert('Board is empty!');
  };

  const handleExportJSON = () => {
    const ops = canvasHook.getOperations();
    if (ops.length === 0) {
      alert('Board is empty!');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ops));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `inksync-${roomId}-${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportJSON = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const ops = JSON.parse(e.target.result);
        if (Array.isArray(ops)) {
          ops.forEach((op) => {
            sendRef.current.operation?.({
              ...op,
              operationId: generateId(),
              userId: currentUserId,
              roomId: roomId,
              timestamp: Date.now(),
            });
          });
          alert(`Successfully imported ${ops.length} items!`);
        } else {
          alert('Invalid file format.');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // ---------- REAL AI GENERATION FUNCTION ----------
  const handleAIGenerate = async (prompt) => {
    if (isBoardLocked && !isCreator) {
      alert('The whiteboard is currently locked by the room creator.');
      return;
    }

    setIsAIGenerating(true);
    try {
      // 1. Get operations from the Gemini AI backend
      const aiOperations = await generateAIDiagram(prompt);

      if (!Array.isArray(aiOperations) || aiOperations.length === 0) {
        throw new Error('AI did not return any diagram elements. Please try a different prompt.');
      }

      // 2. Calculate center of screen
      const cam = canvasHook.getCamera();
      const centerX = (window.innerWidth / 2 - cam.x) / (cam.zoom || 1);
      const centerY = ((window.innerHeight - 56) / 2 - cam.y) / (cam.zoom || 1);

      // 3. Offset and emit each operation to the room
      aiOperations.forEach((op) => {
        const offsetPoints = (op.points || []).map((p) => ({
          x: (Number(p.x) || 0) + centerX,
          y: (Number(p.y) || 0) + centerY,
        }));

        sendRef.current.operation?.({
          lineWidth: 2,
          fontSize: 14,
          ...op,
          points: offsetPoints,
          operationId: generateId(),
          userId: currentUserId,
          roomId: roomId,
          timestamp: Date.now(),
        });
      });

      setShowAIPrompt(false);
    } catch (err) {
      console.error('AI Generation Error:', err);
      const message = err.response?.data?.message || err.message || 'AI generation failed. Please check your prompt and try again.';
      alert(message);
    } finally {
      setIsAIGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-100 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        <p className="text-slate-600 text-sm">Joining room…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-100 gap-4 px-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-slate-700 font-medium">{error}</p>
        <Link to="/dashboard" className="text-primary-600 font-medium hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (accessStatus === 'pending' && !isCreator) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-100 gap-4 px-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Hourglass className="w-8 h-8 text-amber-600 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Waiting for approval</h2>
          <p className="text-slate-600 mb-1">
            You requested access to <span className="font-semibold">{room?.name || 'this room'}</span>
          </p>
          <p className="text-xs font-mono text-slate-500 mb-6">{roomId}</p>
          <p className="text-sm text-slate-500 mb-6">
            The room creator has been notified. You'll be added automatically once approved.
          </p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => navigate('/dashboard')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (accessStatus === 'revoked') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-100 gap-4 px-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access revoked</h2>
          <p className="text-slate-600 mb-6">
            The creator has removed your access to this room.
          </p>
          <button onClick={() => navigate('/dashboard')}
            className="px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (accessStatus === 'denied') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-100 gap-4 px-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access denied</h2>
          <p className="text-slate-600 mb-6">{joinError || 'You are not authorized for this room.'}</p>
          <button onClick={() => navigate('/dashboard')}
            className="px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const pill = {
    connected: { cls: 'bg-green-50 text-green-700 border-green-200', label: 'Connected', Icon: Wifi, spin: false },
    connecting: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Connecting…', Icon: Loader2, spin: true },
    disconnected: { cls: 'bg-red-50 text-red-600 border-red-200', label: 'Reconnecting…', Icon: WifiOff, spin: false },
  }[connection] || { cls: 'bg-green-50 text-green-700 border-green-200', label: 'Connected', Icon: Wifi, spin: false };

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary-600 p-1.5 rounded-lg"><PenTool className="w-4 h-4 text-white" /></div>
          <h1 className="font-semibold text-slate-900 flex items-center gap-1.5">
            {room?.name || 'Whiteboard'}
            {isCreator && <Crown className="w-3.5 h-3.5 text-amber-500" title="You are the creator" />}
          </h1>
          <button onClick={copyId} title="Copy room ID"
            className="inline-flex items-center gap-1.5 text-xs font-mono bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-md transition">
            {roomId}
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1 rounded-full ${pill.cls}`}>
            <pill.Icon className={`w-3.5 h-3.5 ${pill.spin ? 'animate-spin' : ''}`} /> {pill.label}
          </span>

          {isCreator ? (
            <button
              onClick={() => sendRef.current.toggleBoardLock?.(!isBoardLocked)}
              title={isBoardLocked ? 'Unlock canvas for participants' : 'Lock canvas (View-only for participants)'}
              className={`inline-flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1 rounded-full transition ${isBoardLocked
                ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
            >
              {isBoardLocked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-slate-500" />}
              {isBoardLocked ? 'Canvas Locked' : 'Lock Canvas'}
            </button>
          ) : isBoardLocked ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
              <Lock className="w-3.5 h-3.5 text-amber-600" /> View Only
            </span>
          ) : null}

          {isCreator && pendingRequests.length > 0 && (
            <button onClick={() => setShowRequests(!showRequests)}
              className="relative inline-flex items-center gap-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full hover:bg-amber-100 transition">
              <UserPlus className="w-3.5 h-3.5" />
              Requests
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingRequests.length}
              </span>
            </button>
          )}

          {/* AI Generate Button */}
          <button
            onClick={() => setShowAIPrompt(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full hover:from-purple-200 hover:to-blue-200 transition shadow-sm"
            title="AI Generate"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI
          </button>

          <button
            onClick={() => setShowTemplates(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full hover:bg-slate-200 transition"
            title="Templates"
          >
            <LayoutTemplate className="w-3.5 h-3.5" /> Templates
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1 rounded-full transition ${showChat
              ? 'bg-primary-100 text-primary-700 border-primary-200'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Chat
          </button>

          {/* Video Call Button — Adapts between Start Call, Join Call, and In Call */}
          {webrtc.isInCall ? (
            <button
              onClick={() => setShowVideo(!showVideo)}
              className="inline-flex items-center gap-1.5 text-xs font-medium border px-3 py-1 rounded-full transition bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200"
              title="Toggle Video Panel"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <Video className="w-3.5 h-3.5" /> In Call
            </button>
          ) : ((videoUsers || []).filter(id => id !== currentUserId).length > 0 || (videoUsers && videoUsers.length > 0)) ? (
            <button
              onClick={() => {
                setShowVideo(true);
                setAutoOpenPreJoin(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold border px-3 py-1 rounded-full transition bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 shadow-sm animate-pulse"
              title="Join Active Video Call"
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Video className="w-3.5 h-3.5" /> Join Call
              <span className="bg-emerald-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2">
                {(videoUsers || []).filter(id => id !== currentUserId).length || videoUsers.length}
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                setShowVideo(true);
                setAutoOpenPreJoin(true);
              }}
              className={`inline-flex items-center gap-1.5 text-xs font-medium border px-3 py-1 rounded-full transition ${showVideo
                ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                }`}
              title="Start Video Call"
            >
              <Video className="w-3.5 h-3.5 text-indigo-500" /> Start Call
            </button>
          )}

          <button onClick={() => setShowParticipants(!showParticipants)}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full hover:bg-slate-200 transition"
            title="Participants">
            <Users className="w-3.5 h-3.5" /> {participants.length}
          </button>

          {/* Save & Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full hover:bg-slate-200 transition"
              title="Save & Export"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>

            {showExportMenu && (
              <ExportMenu
                onClose={() => setShowExportMenu(false)}
                onExportPNG={handleExportPNG}
                onExportJSON={handleExportJSON}
                onImportJSON={handleImportJSON}
              />
            )}
          </div>

          <button onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
            <LogOut className="w-4 h-4" /> Leave
          </button>
        </div>
      </header>

      {/* WORKSPACE */}
      <main className="flex-1 overflow-hidden relative flex bg-slate-100">
        <div className="flex-1 relative h-full">
          <Whiteboard
            canvas={canvasHook}
            roomName={room?.name || 'Board'}
            cursors={cursors}
            userId={currentUserId}
            isReadOnly={isReadOnly}
            isCreator={isCreator}
          />
        </div>

        {showChat && (
          <ChatPanel
            messages={messages || []}
            currentUserId={currentUserId}
            participants={participants}
            isCreator={isCreator}
            onSendMessage={(text, recipientId) => sendRef.current.sendMessage?.(text, recipientId)}
            onDeleteMessage={(messageId) => sendRef.current.deleteMessage?.(messageId)}
            onClose={() => setShowChat(false)}
          />
        )}

        {showVideo && (
          <VideoPanel
            webrtc={webrtc}
            participants={participants}
            currentUserId={currentUserId}
            isCreator={isCreator}
            hardMutedUserIds={hardMutedUserIds}
            videoUsers={videoUsers}
            initialOpenPreJoin={autoOpenPreJoin}
            onClose={() => {
              setShowVideo(false);
              setAutoOpenPreJoin(false);
            }}
            onStartCall={() => sendRef.current.startVideoCall?.()}
            onHardMute={(targetUserId) => sendRef.current.hardMuteUser?.(targetUserId)}
            onUnmuteAllow={(targetUserId) => sendRef.current.unmuteAllowUser?.(targetUserId)}
          />
        )}
      </main>

      {/* Floating Incoming Video Call Invitation Prompt */}
      {incomingCallPrompt && !webrtc.isInCall && (
        <IncomingCallPrompt
          initiatorName={incomingCallPrompt.initiatorName}
          onJoin={() => {
            dismissIncomingCall();
            setShowVideo(true);
            setAutoOpenPreJoin(true);
          }}
          onDismiss={dismissIncomingCall}
        />
      )}

      {/* Screen Share Floating Window (Draggable & Resizable) */}
      {(webrtc.isScreenSharing || webrtc.remoteScreenStream) && (
        <ScreenShareOverlay
          stream={webrtc.isScreenSharing ? webrtc.screenStream : webrtc.remoteScreenStream}
          sharerName={webrtc.isScreenSharing ? 'You' : (screenShareInfo?.userName || webrtc.screenShareUser?.userName || 'Participant')}
          isLocal={webrtc.isScreenSharing}
          onStop={webrtc.stopScreenShare}
          onClose={() => {
            if (webrtc.isScreenSharing) {
              webrtc.stopScreenShare();
            }
          }}
        />
      )}

      {/* OVERLAYS */}
      {isCreator && showRequests && (
        <PendingRequestsPanel
          roomId={roomId}
          pendingRequests={pendingRequests}
          sendRef={sendRef}
          onDismiss={() => setShowRequests(false)}
        />
      )}
      {showParticipants && (
        <ParticipantsPanel
          roomId={roomId}
          participants={participants}
          isCreator={isCreator}
          currentUserId={currentUserId}
          sendRef={sendRef}
          onClose={() => setShowParticipants(false)}
        />
      )}
      {showTemplates && (
        <TemplatesModal
          onSelect={applyTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
      {showAIPrompt && (
        <AIPromptBox
          onGenerate={handleAIGenerate}
          onClose={() => setShowAIPrompt(false)}
          isLoading={isAIGenerating}
        />
      )}
    </div>
  );
};

export default Room;