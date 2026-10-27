import { useRef, useEffect, useState, useCallback } from 'react';
import { X, Maximize2, Minimize2, Move, Monitor } from 'lucide-react';

/**
 * ScreenShareOverlay — floating, draggable, resizable window showing a screen share.
 * Can be minimized to PiP, maximized to fill workspace, or freely positioned.
 * Overlays the whiteboard without blocking interaction with it.
 */
const ScreenShareOverlay = ({
  stream,
  sharerName,
  isLocal = false,
  onStop,
  onClose,
}) => {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);

  // Window state: 'normal' | 'minimized' | 'maximized'
  const [windowState, setWindowState] = useState('normal');

  // Position & size for the draggable/resizable floating window
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [size, setSize] = useState({ width: 480, height: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const resizeRef = useRef({ startX: 0, startY: 0, origW: 0, origH: 0 });

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // --- DRAG LOGIC ---
  const handleDragStart = useCallback((e) => {
    if (windowState === 'maximized') return;
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };

    const onMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - dragRef.current.startX;
      const dy = moveEvent.clientY - dragRef.current.startY;
      setPosition({
        x: Math.max(0, dragRef.current.origX + dx),
        y: Math.max(0, dragRef.current.origY + dy),
      });
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [windowState, position]);

  // --- RESIZE LOGIC ---
  const handleResizeStart = useCallback((e) => {
    if (windowState !== 'normal') return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: size.width,
      origH: size.height,
    };

    const onMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - resizeRef.current.startX;
      const dy = moveEvent.clientY - resizeRef.current.startY;
      setSize({
        width: Math.max(280, resizeRef.current.origW + dx),
        height: Math.max(180, resizeRef.current.origH + dy),
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [windowState, size]);

  // --- WINDOW STATE STYLES ---
  const getOverlayStyle = () => {
    if (windowState === 'maximized') {
      return {
        position: 'fixed',
        top: 56, // Below header
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 45,
        width: 'auto',
        height: 'auto',
      };
    }
    if (windowState === 'minimized') {
      return {
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 200,
        height: 130,
        zIndex: 45,
      };
    }
    return {
      position: 'fixed',
      left: position.x,
      top: position.y,
      width: size.width,
      height: size.height,
      zIndex: 45,
    };
  };

  if (!stream) return null;

  return (
    <div
      ref={overlayRef}
      style={getOverlayStyle()}
      className={`rounded-xl overflow-hidden shadow-2xl border border-slate-700/80 bg-slate-900 flex flex-col transition-shadow ${
        isDragging ? 'shadow-indigo-500/20' : ''
      } ${windowState === 'maximized' ? 'rounded-none' : ''} ${windowState === 'minimized' ? 'rounded-lg' : ''}`}
    >
      {/* Title bar — draggable */}
      <div
        onMouseDown={handleDragStart}
        className={`flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700 shrink-0 ${
          windowState !== 'maximized' ? 'cursor-move' : 'cursor-default'
        }`}
      >
        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs text-slate-300 font-medium truncate">
            {isLocal ? 'Your screen' : `${sharerName}'s screen`}
          </span>
          <span className="text-[10px] bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded-full font-medium animate-pulse">
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Minimize */}
          <button
            onClick={() => setWindowState(windowState === 'minimized' ? 'normal' : 'minimized')}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"
            title={windowState === 'minimized' ? 'Restore' : 'Minimize'}
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          {/* Maximize */}
          <button
            onClick={() => setWindowState(windowState === 'maximized' ? 'normal' : 'maximized')}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"
            title={windowState === 'maximized' ? 'Restore' : 'Maximize'}
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          {/* Close / Stop */}
          <button
            onClick={() => {
              if (isLocal && onStop) onStop();
              if (onClose) onClose();
            }}
            className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded transition"
            title={isLocal ? 'Stop sharing' : 'Close'}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Video content */}
      <div className="flex-1 bg-black relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
      </div>

      {/* Resize handle (bottom-right corner) — only in normal mode */}
      {windowState === 'normal' && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
        >
          <svg viewBox="0 0 16 16" className="w-full h-full text-slate-500 opacity-60 hover:opacity-100 transition">
            <path d="M14 14L8 14L14 8Z" fill="currentColor" />
            <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default ScreenShareOverlay;
