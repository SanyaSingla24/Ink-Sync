import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createOperation, drawOperation, drawGrid, screenToWorld, generateId,
  findHitOperation, getOpBounds, translateOp, cloneOp, drawRemoteCursor, getCenter,
} from '../utils/drawingUtils';
import {
  drawSelection, drawMarquee, getHandleAtPoint, snapshotOp, applyResize,
  opsBounds, boundsIntersect,
} from '../utils/selectionUtils';

const SHAPE_TOOLS = ['line', 'rect', 'roundrect', 'circle', 'triangle', 'diamond', 'star', 'arrow'];
const GRID_MODES = ['dots', 'grid', 'lines', 'blank'];
const CONTINUOUS_TOOLS = ['pen', 'eraser', 'hand'];

const useCanvas = ({
  userId, roomId, isReadOnly = false, isCreator = false,
  onOperationComplete, onOperationUpdate, onLiveOperation,
  onDelete, onUndo, onReorder, onCursorMove,
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const operationsRef = useRef([]);
  const liveOpsRef = useRef(new Map());
  const remoteCursorsRef = useRef({});

  const activeOpRef = useRef(null);
  const redoStackRef = useRef([]);
  const clipboardRef = useRef([]);
  const selectionRef = useRef([]);

  const marqueeRef = useRef(null);
  const resizeRef = useRef(null);
  const rotateRef = useRef(null);

  const isDrawingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef(null);
  const dragConfirmedRef = useRef(false);

  const isPanningRef = useRef(false);
  const panStartRef = useRef(null);

  const spaceHeldRef = useRef(false);
  const liveLastRef = useRef(0);
  const cursorLastRef = useRef(0);

  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const rafRef = useRef(null);

  const [resizeCursor, setResizeCursor] = useState('default');
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#1e293b');
  const [lineWidth, setLineWidth] = useState(4);
  const [fill, setFill] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [gridMode, setGridMode] = useState('dots');
  const [selection, setSelectionState] = useState([]);
  const [textDraft, setTextDraft] = useState(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const getResizeCursor = (handle, rotation) => {
    const baseAngles = {
      right: 0, br: 45, bottom: 90, bl: 135,
      left: 180, tl: 225, top: 270, tr: 315,
    };
    const angle = ((baseAngles[handle] || 0) + (rotation * 180 / Math.PI)) % 180;
    const n = (angle + 180) % 180;
    if (n < 22.5 || n >= 157.5) return 'ew-resize';
    if (n < 67.5) return 'nesw-resize';
    if (n < 112.5) return 'ns-resize';
    return 'nwse-resize';
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!ctxRef.current) ctxRef.current = canvas.getContext('2d');
    const ctx = ctxRef.current;
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const setWorld = () => {
      const { x, y, zoom } = cameraRef.current;
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * x, dpr * y);
    };
    const drawGridSafe = () => {
      try {
        drawGrid(ctx, dpr, canvas.clientWidth, canvas.clientHeight, cameraRef.current, gridMode);
      } catch (err) { console.warn('Grid error:', err.message); }
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGridSafe();

    setWorld();
    for (const op of operationsRef.current) {
      try {
        if (op.type === 'clear') {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawGridSafe();
          setWorld();
        } else drawOperation(ctx, op);
      } catch (err) { console.warn('Skip op:', err.message); }
    }
    for (const liveOp of liveOpsRef.current.values()) {
      try { drawOperation(ctx, liveOp); } catch (err) { /* ignore */ }
    }
    try { if (activeOpRef.current) drawOperation(ctx, activeOpRef.current); } catch (err) { /* ignore */ }
    try { drawSelection(ctx, selectionRef.current, cameraRef.current.zoom); } catch (err) { /* ignore */ }
    try {
      if (marqueeRef.current) {
        drawMarquee(ctx, marqueeRef.current.start, marqueeRef.current.current, cameraRef.current.zoom);
      }
    } catch (err) { /* ignore */ }
    try {
      for (const [uid, cursor] of Object.entries(remoteCursorsRef.current || {})) {
        if (uid === userId) continue;
        if (typeof drawRemoteCursor === 'function') {
          drawRemoteCursor(ctx, cameraRef.current, { ...cursor, userId: uid }, dpr);
        }
      }
    } catch (err) { console.warn('Cursor draw error:', err.message); }
  }, [gridMode, userId]);

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => { rafRef.current = null; redraw(); });
  }, [redraw]);

  const scheduleRef = useRef(scheduleRedraw);
  useEffect(() => { scheduleRef.current = scheduleRedraw; }, [scheduleRedraw]);

  const setSelection = useCallback((ops) => {
    selectionRef.current = ops;
    setSelectionState(ops.slice());
    scheduleRef.current?.();
  }, []);

  const zoomAt = useCallback((point, factor) => {
    const cam = cameraRef.current;
    const newZoom = Math.min(4, Math.max(0.1, cam.zoom * factor));
    const before = screenToWorld(point, cam);
    cam.x = point.x - before.x * newZoom;
    cam.y = point.y - before.y * newZoom;
    cam.zoom = newZoom;
    setZoomPct(Math.round(newZoom * 100));
    scheduleRedraw();
  }, [scheduleRedraw]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return () => {};
    ctxRef.current = canvas.getContext('2d');

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      scheduleRedraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt({ x: e.clientX - rect.left, y: e.clientY - rect.top }, e.deltaY < 0 ? 1.1 : 0.9);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => { observer.disconnect(); canvas.removeEventListener('wheel', onWheel); };
  }, [scheduleRedraw, zoomAt]);

  const centerPoint = () => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  };
  const zoomIn = () => zoomAt(centerPoint(), 1.2);
  const zoomOut = () => zoomAt(centerPoint(), 1 / 1.2);
  const resetView = () => {
    cameraRef.current = { x: 0, y: 0, zoom: 1 };
    setZoomPct(100);
    scheduleRedraw();
  };
  const fitContent = () => {
    const ops = operationsRef.current.filter((op) => op.type !== 'clear');
    if (ops.length) {
      const rect = containerRef.current.getBoundingClientRect();
      const b = opsBounds(ops);
      const bw = b.maxX - b.minX || 1, bh = b.maxY - b.minY || 1;
      const zoom = Math.min(2, Math.max(0.1, Math.min((rect.width - 100) / bw, (rect.height - 100) / bh)));
      cameraRef.current = {
        zoom,
        x: rect.width / 2 - ((b.minX + b.maxX) / 2) * zoom,
        y: rect.height / 2 - ((b.minY + b.maxY) / 2) * zoom,
      };
      setZoomPct(Math.round(zoom * 100));
    } else resetView();
    scheduleRedraw();
  };

  const cycleGrid = () => {
    setGridMode((c) => GRID_MODES[(GRID_MODES.indexOf(c) + 1) % GRID_MODES.length]);
  };

  const getWorldPoint = (e) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, cameraRef.current);
  };

  const broadcastCursor = (point) => {
    try {
      const now = Date.now();
      if (now - cursorLastRef.current > 50) {
        cursorLastRef.current = now;
        onCursorMove?.({ x: point.x, y: point.y });
      }
    } catch (err) { /* ignore */ }
  };

  const constrainShapePoint = (start, current, tool, shiftKey) => {
    if (!shiftKey) return current;
    const dx = current.x - start.x;
    const dy = current.y - start.y;

    if (tool === 'rect' || tool === 'roundrect') {
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      return {
        x: start.x + Math.sign(dx || 1) * size,
        y: start.y + Math.sign(dy || 1) * size,
      };
    }
    if (tool === 'circle') {
      const r = Math.max(Math.abs(dx), Math.abs(dy));
      return {
        x: start.x + Math.sign(dx || 1) * r,
        y: start.y + Math.sign(dy || 1) * r,
      };
    }
    if (tool === 'line' || tool === 'arrow') {
      const angle = Math.atan2(dy, dx);
      const snap = Math.PI / 12;
      const snapped = Math.round(angle / snap) * snap;
      const dist = Math.hypot(dx, dy);
      return {
        x: start.x + Math.cos(snapped) * dist,
        y: start.y + Math.sin(snapped) * dist,
      };
    }
    return current;
  };

  const setSpaceHeldState = (held) => {
    spaceHeldRef.current = held;
    setSpaceHeld(held);
    if (!held && isPanningRef.current) {
      isPanningRef.current = false;
    }
    scheduleRedraw();
  };

  const onPointerDown = (e) => {
    if (e.button === 1 || tool === 'hand' || spaceHeldRef.current) {
      e.preventDefault();
      canvasRef.current.setPointerCapture(e.pointerId);
      isPanningRef.current = true;
      panStartRef.current = {
        clientX: e.clientX, clientY: e.clientY,
        camX: cameraRef.current.x, camY: cameraRef.current.y,
      };
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();

    const point = getWorldPoint(e);
    broadcastCursor(point);
    if (isReadOnly && !isCreator) return;

    if (tool === 'select') {
      canvasRef.current.setPointerCapture(e.pointerId);

      // Check for handles FIRST (rotation, then resize)
      if (selectionRef.current.length === 1 && !selectionRef.current[0].locked) {
        const selOp = selectionRef.current[0];
        const handle = getHandleAtPoint(selOp, point, cameraRef.current.zoom);
        
        if (handle === 'rotate') {
          const c = getCenter(selOp);
          rotateRef.current = {
            op: selOp,
            startAngle: Math.atan2(point.y - c.y, point.x - c.x),
            startRotation: selOp.rotation || 0,
          };
          return;
        }
        
        if (handle) {
          resizeRef.current = {
            op: selOp,
            handle,
            startBounds: getOpBounds(selOp),
            snapshot: snapshotOp(selOp),
          };
          return;
        }
      }

      // No handle hit - check for object hit
      const hit = findHitOperation(operationsRef.current, point);
      if (hit) {
        if (e.shiftKey) {
          setSelection(
            selectionRef.current.includes(hit)
              ? selectionRef.current.filter((op) => op !== hit)
              : [...selectionRef.current, hit]
          );
          return;
        }
        if (!selectionRef.current.includes(hit)) setSelection([hit]);
        if (!hit.locked) {
          isDraggingRef.current = true;
          dragConfirmedRef.current = false;
          dragStartRef.current = point;
        }
      } else {
        if (!e.shiftKey) setSelection([]);
        marqueeRef.current = { start: point, current: point, additive: e.shiftKey };
      }
      scheduleRedraw();
      return;
    }

    setSelection([]);

    if (tool === 'text') {
      const rect = canvasRef.current.getBoundingClientRect();
      setTextDraft({
        world: point,
        screen: { x: e.clientX - rect.left, y: e.clientY - rect.top },
        targetType: 'text',
      });
      return;
    }

    if (tool === 'sticky') {
      const op = createOperation({
        type: 'sticky', tool: 'sticky', points: [point], color: '#1e293b', lineWidth: 2,
        userId, roomId, text: '', bg: color, width: 160, height: 160, fontSize: 16,
      });
      operationsRef.current.push(op);
      onOperationComplete?.(op);
      setSelection([op]);
      const rect = canvasRef.current.getBoundingClientRect();
      setTextDraft({
        world: point,
        screen: { x: e.clientX - rect.left, y: e.clientY - rect.top },
        targetType: 'sticky', editingOpId: op.operationId, initial: '',
      });
      return;
    }

    canvasRef.current.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    activeOpRef.current = SHAPE_TOOLS.includes(tool)
      ? createOperation({ type: 'shape', tool, points: [point, point], color, lineWidth, fill, userId, roomId })
      : createOperation({ type: 'draw', tool, points: [point], color, lineWidth, userId, roomId });
    scheduleRedraw();
  };

  const onPointerMove = (e) => {
    const point = getWorldPoint(e);
    broadcastCursor(point);

    if (isPanningRef.current) {
      const s = panStartRef.current;
      cameraRef.current.x = s.camX + (e.clientX - s.clientX);
      cameraRef.current.y = s.camY + (e.clientY - s.clientY);
      scheduleRedraw();
      return;
    }

    if (rotateRef.current) {
      const { op, startAngle, startRotation } = rotateRef.current;
      const c = getCenter(op);
      const currentAngle = Math.atan2(point.y - c.y, point.x - c.x);
      let newRotation = startRotation + (currentAngle - startAngle);
      if (e.shiftKey) {
        const snap = Math.PI / 12;
        newRotation = Math.round(newRotation / snap) * snap;
      }
      op.rotation = newRotation;
      scheduleRedraw();
      return;
    }

    if (resizeRef.current) {
      const { op, handle, startBounds, snapshot } = resizeRef.current;
      applyResize(op, snapshot, startBounds, handle, point, e.shiftKey, e.altKey);
      scheduleRedraw();
      return;
    }

    if (isDraggingRef.current && selectionRef.current.length) {
      const dx = point.x - dragStartRef.current.x;
      const dy = point.y - dragStartRef.current.y;
      if (!dragConfirmedRef.current) {
        const screenDist = Math.hypot(dx, dy) * cameraRef.current.zoom;
        if (screenDist < 3) return;
        dragConfirmedRef.current = true;
      }
      selectionRef.current.forEach((op) => { if (!op.locked) translateOp(op, dx, dy); });
      dragStartRef.current = point;
      scheduleRedraw();
      return;
    }

    if (marqueeRef.current) {
      marqueeRef.current.current = point;
      scheduleRedraw();
      return;
    }

    // Cursor tracking for hover states (only when not actively doing something)
    if (
      tool === 'select' &&
      !isDraggingRef.current &&
      !resizeRef.current &&
      !rotateRef.current &&
      !marqueeRef.current &&
      selectionRef.current.length === 1
    ) {
      const selOp = selectionRef.current[0];
      if (!selOp.locked) {
        const handle = getHandleAtPoint(selOp, point, cameraRef.current.zoom);
        let newCursor = 'default';
        if (handle === 'rotate') {
          newCursor = 'grab';
        } else if (handle) {
          newCursor = getResizeCursor(handle, selOp.rotation || 0);
        } else {
          const hit = findHitOperation(operationsRef.current, point);
          newCursor = hit ? 'move' : 'default';
        }
        if (newCursor !== resizeCursor) setResizeCursor(newCursor);
      }
    } else if (resizeCursor !== 'default' && (tool !== 'select' || resizeRef.current || rotateRef.current)) {
      setResizeCursor('default');
    }

    if (!isDrawingRef.current || !activeOpRef.current) return;

    const op = activeOpRef.current;
    if (op.type === 'shape') {
      op.points[1] = constrainShapePoint(op.points[0], point, op.tool, e.shiftKey);
    } else {
      const last = op.points[op.points.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) < 0.75) return;
      op.points.push(point);
    }

    const now = Date.now();
    if (now - liveLastRef.current > 40) {
      liveLastRef.current = now;
      onLiveOperation?.(op);
    }
    scheduleRedraw();
  };

  const onPointerUp = () => {
    if (isPanningRef.current) { isPanningRef.current = false; return; }

    if (rotateRef.current) {
      const { op } = rotateRef.current;
      rotateRef.current = null;
      onOperationUpdate?.(op);
      scheduleRedraw();
      return;
    }
    if (resizeRef.current) {
      const { op } = resizeRef.current;
      resizeRef.current = null;
      onOperationUpdate?.(op);
      scheduleRedraw();
      return;
    }
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      dragConfirmedRef.current = false;
      selectionRef.current.forEach((op) => { if (!op.locked) onOperationUpdate?.(op); });
      scheduleRedraw();
      return;
    }
    if (marqueeRef.current) {
      const { start, current, additive } = marqueeRef.current;
      const mb = {
        minX: Math.min(start.x, current.x), maxX: Math.max(start.x, current.x),
        minY: Math.min(start.y, current.y), maxY: Math.max(start.y, current.y),
      };
      const hits = operationsRef.current.filter((op) =>
        op.type !== 'clear' && !op.locked && boundsIntersect(getOpBounds(op), mb));
      setSelection(additive ? [...new Set([...selectionRef.current, ...hits])] : hits);
      marqueeRef.current = null;
      scheduleRedraw();
      return;
    }
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const op = activeOpRef.current;
    activeOpRef.current = null;
    if (!op) return;

    if (op.type === 'shape') {
      const [a, b] = op.points;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1) { scheduleRedraw(); return; }
    }

    operationsRef.current.push(op);
    redoStackRef.current = [];
    onOperationComplete?.(op);

    if (CONTINUOUS_TOOLS.includes(op.tool)) {
      if (op.tool === 'pen') setSelection([op]);
    } else {
      setSelection([op]);
      setTool('select');
    }
    scheduleRedraw();
  };

  const onDoubleClick = (e) => {
    if (tool !== 'select') return;
    const point = getWorldPoint(e);
    const hit = findHitOperation(operationsRef.current, point);
    if (hit && !hit.locked && (hit.type === 'text' || hit.type === 'sticky')) {
      const rect = canvasRef.current.getBoundingClientRect();
      setTextDraft({
        world: hit.points[0],
        screen: { x: e.clientX - rect.left, y: e.clientY - rect.top },
        targetType: hit.type, editingOpId: hit.operationId, initial: hit.text || '',
      });
    }
  };

  const commitText = (text) => {
    if (!textDraft) return;
    let createdOp = null;

    if (textDraft.editingOpId) {
      const op = operationsRef.current.find((o) => o.operationId === textDraft.editingOpId);
      if (op) { op.text = text; onOperationUpdate?.(op); createdOp = op; }
    } else if (textDraft.targetType === 'sticky') {
      const op = createOperation({
        type: 'sticky', tool: 'sticky', points: [textDraft.world], color: '#1e293b', lineWidth: 2,
        userId, roomId, text, bg: color, width: 160, height: 160, fontSize: 16,
      });
      operationsRef.current.push(op);
      redoStackRef.current = [];
      onOperationComplete?.(op);
      createdOp = op;
    } else if (text.trim()) {
      const op = createOperation({
        type: 'text', tool: 'text', points: [textDraft.world], color, lineWidth,
        fontSize: Math.max(14, lineWidth * 4), text: text.trim(), userId, roomId,
      });
      operationsRef.current.push(op);
      redoStackRef.current = [];
      onOperationComplete?.(op);
      createdOp = op;
    }
    setTextDraft(null);
    if (createdOp) { setSelection([createdOp]); setTool('select'); }
    scheduleRedraw();
  };
  const cancelText = () => setTextDraft(null);

  const undo = () => {
    if (isReadOnly && !isCreator) return null;
    const ops = operationsRef.current;
    for (let i = ops.length - 1; i >= 0; i--) {
      if ((isCreator || ops[i].userId === userId) && ops[i].type !== 'clear') {
        const [removed] = ops.splice(i, 1);
        redoStackRef.current.push(removed);
        if (selectionRef.current.includes(removed)) {
          setSelection(selectionRef.current.filter((op) => op !== removed));
        }
        onUndo?.(removed.operationId);
        scheduleRedraw();
        return removed;
      }
    }
    return null;
  };
  const redo = () => {
    if (isReadOnly && !isCreator) return null;
    const op = redoStackRef.current.pop();
    if (!op) return null;
    operationsRef.current.push(op);
    onOperationComplete?.(op);
    scheduleRedraw();
    return op;
  };
  const clear = () => {
    if (isReadOnly && !isCreator) return null;
    const op = { operationId: generateId(), userId, roomId, type: 'clear', timestamp: Date.now() };
    operationsRef.current.push(op);
    setSelection([]);
    onOperationComplete?.(op);
    scheduleRedraw();
    return op;
  };
  const deleteSelected = () => {
    if (isReadOnly && !isCreator) return [];
    const doomed = selectionRef.current.filter((op) => !op.locked);
    if (!doomed.length) return [];
    operationsRef.current = operationsRef.current.filter((op) => !doomed.includes(op));
    setSelection([]);
    onDelete?.(doomed.map((op) => op.operationId));
    scheduleRedraw();
    return doomed;
  };
  const insertClones = (source) => {
    const clones = source.map((op) => cloneOp(op, userId));
    operationsRef.current.push(...clones);
    redoStackRef.current = [];
    clones.forEach((c) => onOperationComplete?.(c));
    setSelection(clones);
    scheduleRedraw();
    return clones;
  };
  const copySelection = () => { clipboardRef.current = selectionRef.current.map((op) => cloneOp(op, op.userId, 0)); };
  const pasteClipboard = () => (clipboardRef.current.length ? insertClones(clipboardRef.current) : []);
  const duplicateSelection = () => (selectionRef.current.length ? insertClones(selectionRef.current) : []);
  const selectAll = () => setSelection(operationsRef.current.filter((op) => op.type !== 'clear'));
  const bringToFront = () => {
    const sel = selectionRef.current;
    operationsRef.current = [...operationsRef.current.filter((o) => !sel.includes(o)), ...sel];
    onReorder?.(operationsRef.current.map((o) => o.operationId));
    scheduleRedraw();
  };
  const sendToBack = () => {
    const sel = selectionRef.current;
    operationsRef.current = [...sel, ...operationsRef.current.filter((o) => !sel.includes(o))];
    onReorder?.(operationsRef.current.map((o) => o.operationId));
    scheduleRedraw();
  };
  const toggleLock = () => {
    const sel = selectionRef.current;
    if (!sel.length) return;
    const lock = !sel[0].locked;
    sel.forEach((o) => { o.locked = lock; onOperationUpdate?.(o); });
    scheduleRedraw();
  };

  const hasOperation = (id) => operationsRef.current.some((op) => op.operationId === id);
  const applyRemoteOperation = (op) => {
    if (!op?.operationId || hasOperation(op.operationId)) return;
    operationsRef.current.push(op);
    scheduleRedraw();
  };
  const applyRemoteUpdate = (op) => {
    if (!op?.operationId) return;
    const existing = operationsRef.current.find((o) => o.operationId === op.operationId);
    if (existing) Object.assign(existing, op); else operationsRef.current.push(op);
    scheduleRedraw();
  };
  const applyRemoteDelete = (ids = []) => {
    operationsRef.current = operationsRef.current.filter((op) => !ids.includes(op.operationId));
    if (selectionRef.current.some((op) => ids.includes(op.operationId))) {
      setSelection(selectionRef.current.filter((op) => !ids.includes(op.operationId)));
    }
    scheduleRedraw();
  };
  const applyRemoteUndo = (id) => {
    operationsRef.current = operationsRef.current.filter((op) => op.operationId !== id);
    scheduleRedraw();
  };
  const applyRemoteReorder = (ids = []) => {
    const byId = new Map(operationsRef.current.map((op) => [op.operationId, op]));
    const next = ids.map((id) => byId.get(id)).filter(Boolean);
    for (const op of operationsRef.current) if (!ids.includes(op.operationId)) next.push(op);
    operationsRef.current = next;
    scheduleRedraw();
  };
  const applyLiveOperation = (op) => {
    if (!op?.userId || op.userId === userId) return;
    liveOpsRef.current.set(op.userId, op);
    scheduleRedraw();
  };
  const clearLiveOperation = (uid) => { liveOpsRef.current.delete(uid); scheduleRedraw(); };
  const setRemoteCursors = (cursors = {}) => {
    remoteCursorsRef.current = cursors || {};
    scheduleRedraw();
  };
  const loadOperations = (ops = []) => {
    operationsRef.current = Array.isArray(ops) ? ops : [];
    liveOpsRef.current.clear();
    setSelection([]);
    scheduleRedraw();
  };

  const getOperations = () => operationsRef.current;
  const hitTestAt = (point) => findHitOperation(operationsRef.current, point);

  return {
    containerRef, canvasRef,
    onPointerDown, onPointerMove, onPointerUp, onDoubleClick,
    tool, setTool, color, setColor, lineWidth, setLineWidth, fill, setFill,
    zoomPct, zoomIn, zoomOut, resetView, fitContent,
    gridMode, cycleGrid,
    selection, setSelection, textDraft, commitText, cancelText,
    undo, redo, clear, deleteSelected,
    copySelection, pasteClipboard, duplicateSelection, selectAll,
    bringToFront, sendToBack, toggleLock,
    hitTestAt, getOperations,
    getCamera: () => cameraRef.current,
    scheduleRedraw,
    applyRemoteOperation, applyRemoteUpdate, applyRemoteDelete,
    applyRemoteUndo, applyRemoteReorder,
    applyLiveOperation, clearLiveOperation,
    setRemoteCursors, loadOperations,
    initCanvas,
    setSpaceHeldState, spaceHeld,
    resizeCursor,
  };
};

export default useCanvas;