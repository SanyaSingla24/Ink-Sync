import { useState, useEffect } from 'react';
import { exportBoard } from '../../utils/canvasUtils';
import Toolbar from './Toolbar';
import CanvasControls from './CanvasControls';
import ContextMenu from './ContextMenu';

const Whiteboard = ({ canvas, roomName, cursors = {}, userId, isReadOnly = false, isCreator = false }) => {
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(null);

  const {
    containerRef,
    canvasRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    tool, setTool,
    color, setColor,
    lineWidth, setLineWidth,
    fill, setFill,
    zoomPct, zoomIn, zoomOut, resetView, fitContent,
    gridMode, cycleGrid,
    selection, setSelection,
    textDraft, commitText, cancelText,
    undo, redo, clear, deleteSelected,
    copySelection, pasteClipboard, duplicateSelection, selectAll,
    bringToFront, sendToBack, toggleLock,
    hitTestAt, getOperations,
    setRemoteCursors,
    initCanvas,
    setSpaceHeldState, spaceHeld,
    resizeCursor,
  } = canvas;

  // Initialize canvas 2D context and resize observer on mount
  useEffect(() => {
    const cleanup = initCanvas?.();
    return () => cleanup?.();
  }, [initCanvas]);

  // Keep remote cursors inside canvas render engine
  useEffect(() => {
    setRemoteCursors?.(cursors);
  }, [cursors, setRemoteCursors]);

  const showNotice = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2200);
  };

  const handleExport = (format) => {
    const ok = exportBoard(getOperations(), { roomName, format });
    showNotice(ok ? `Exported as ${format.toUpperCase()}` : 'Board is empty — nothing to export');
  };

  // ---------- KEYBOARD SHORTCUTS ----------
  useEffect(() => {
    const onKey = (e) => {
      if (textDraft || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (ctrl && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (ctrl && key === 'y') { e.preventDefault(); redo(); }
      else if (ctrl && key === 'c') { e.preventDefault(); copySelection(); showNotice('Copied'); }
      else if (ctrl && key === 'v') { e.preventDefault(); pasteClipboard(); }
      else if (ctrl && key === 'd') { e.preventDefault(); duplicateSelection(); }
      else if (ctrl && key === 'a') { e.preventDefault(); selectAll(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) { e.preventDefault(); deleteSelected(); }
      else if (e.key === 'Escape') { setMenu(null); setTool('select'); }
      else if (!ctrl) {
        const toolShortcuts = { v: 'select', h: 'hand', p: 'pen', e: 'eraser', t: 'text', s: 'sticky' };
        if (toolShortcuts[key]) setTool(toolShortcuts[key]);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, textDraft, undo, redo, copySelection, pasteClipboard, duplicateSelection, selectAll, deleteSelected, setTool]);

  // ---------- SPACEBAR-TO-PAN + ZOOM SHORTCUTS ----------
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !textDraft &&
          e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (!spaceHeld) setSpaceHeldState(true);
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        if (e.key === '0') { e.preventDefault(); resetView(); }
        else if (e.key === '1') { e.preventDefault(); fitContent(); }
        else if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn(); }
        else if (e.key === '-') { e.preventDefault(); zoomOut(); }
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') setSpaceHeldState(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [spaceHeld, textDraft, setSpaceHeldState, resetView, fitContent, zoomIn, zoomOut]);

  // ---------- CONTEXT MENU ----------
  const openContextMenu = (e) => {
    e.preventDefault();
    const containerRect = containerRef.current.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const cam = canvas.getCamera();

    const world = {
      x: (e.clientX - canvasRect.left - cam.x) / cam.zoom,
      y: (e.clientY - canvasRect.top - cam.y) / cam.zoom,
    };

    const hit = hitTestAt(world);
    if (hit && !selection.includes(hit)) setSelection([hit]);

    setMenu({
      x: Math.min(e.clientX - containerRect.left, containerRect.width - 200),
      y: Math.min(e.clientY - containerRect.top, containerRect.height - 280),
      target: hit ? 'object' : 'canvas',
    });
  };

  const anyLocked = selection.some((op) => op.locked);

  const menuItems = menu?.target === 'object'
    ? [
        { label: 'Copy', shortcut: 'Ctrl+C', action: copySelection },
        { label: 'Duplicate', shortcut: 'Ctrl+D', action: duplicateSelection },
        { divider: true },
        { label: 'Bring to front', action: bringToFront },
        { label: 'Send to back', action: sendToBack },
        { divider: true },
        { label: anyLocked ? 'Unlock' : 'Lock', action: toggleLock },
        { label: 'Delete', shortcut: 'Del', action: deleteSelected, disabled: anyLocked },
      ]
    : [
        { label: 'Paste', shortcut: 'Ctrl+V', action: pasteClipboard },
        { label: 'Select all', shortcut: 'Ctrl+A', action: selectAll },
      ];

  const cursorClass =
    spaceHeld || tool === 'hand' ? 'cursor-grab' :
    tool === 'text' ? 'cursor-text' :
    tool === 'select' ? (resizeCursor && resizeCursor !== 'default' ? `cursor-${resizeCursor}` : 'cursor-default') :
    'cursor-crosshair';

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 touch-none ${cursorClass}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={openContextMenu}
      />

      <Toolbar
        tool={tool} setTool={setTool}
        color={color} setColor={setColor}
        lineWidth={lineWidth} setLineWidth={setLineWidth}
        fill={fill} setFill={setFill}
        onUndo={undo} onRedo={redo} onClear={clear}
        onDeleteSelected={deleteSelected}
        hasSelection={selection.length > 0}
        isReadOnly={isReadOnly}
        isCreator={isCreator}
      />

      <CanvasControls
        zoomPct={zoomPct}
        onZoomIn={zoomIn} onZoomOut={zoomOut}
        onResetView={resetView} onFitContent={fitContent}
        gridMode={gridMode} onCycleGrid={cycleGrid}
        onExport={handleExport}
      />

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}

      {/* Sticky note editor */}
      {textDraft && textDraft.targetType === 'sticky' && (
        <textarea
          autoFocus
          defaultValue={textDraft.initial || ''}
          placeholder="Type your note…"
          className="absolute z-20 border-2 border-primary-500 rounded-md p-2 bg-white shadow-md outline-none text-sm w-44 h-32 resize-none"
          style={{ left: textDraft.screen.x, top: textDraft.screen.y }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancelText();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.currentTarget.dataset.done = '1';
              commitText(e.currentTarget.value);
            }
          }}
          onBlur={(e) => { if (!e.currentTarget.dataset.done) commitText(e.currentTarget.value); }}
        />
      )}

      {/* Single-line text editor */}
      {textDraft && textDraft.targetType === 'text' && (
        <input
          autoFocus
          defaultValue={textDraft.initial || ''}
          placeholder="Type and press Enter"
          className="absolute z-20 border-2 border-primary-500 rounded-md px-2 py-1 bg-white shadow-md outline-none text-sm min-w-[180px]"
          style={{ left: textDraft.screen.x, top: textDraft.screen.y, color }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.currentTarget.dataset.done = '1'; commitText(e.currentTarget.value); }
            if (e.key === 'Escape') cancelText();
          }}
          onBlur={(e) => { if (!e.currentTarget.dataset.done) commitText(e.currentTarget.value); }}
        />
      )}

      {notice && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-20">
          {notice}
        </div>
      )}
    </div>
  );
};

export default Whiteboard;