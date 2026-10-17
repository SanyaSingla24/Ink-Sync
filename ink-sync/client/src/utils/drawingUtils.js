export const generateId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const screenToWorld = (point, camera) => ({
  x: (point.x - camera.x) / camera.zoom,
  y: (point.y - camera.y) / camera.zoom,
});

export const worldToScreen = (point, camera) => ({
  x: point.x * camera.zoom + camera.x,
  y: point.y * camera.zoom + camera.y,
});

export const createOperation = ({
  type = 'draw', tool, points, color, lineWidth,
  userId, roomId, text, fontSize, fill, bg, width, height,
}) => ({
  operationId: generateId(),
  userId, roomId, type, tool, points, color, lineWidth,
  text, fontSize, fill, bg, width, height,
  rotation: 0,
  timestamp: Date.now(),
});

export const translateOp = (op, dx, dy) => {
  for (const p of op.points) { p.x += dx; p.y += dy; }
};

export const cloneOp = (op, userId, offset = 24) => ({
  ...op,
  operationId: generateId(),
  userId,
  timestamp: Date.now(),
  locked: false,
  points: op.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
});

// ---------- ROTATION HELPERS ----------
export const getCenter = (op) => {
  const b = getOpBounds(op);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
};

const inverseRotatePoint = (px, py, cx, cy, rotation) => {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos + dy * sin,
    y: cy - dx * sin + dy * cos,
  };
};

// Wrap a draw call in the shape's rotation transform
const withRotation = (ctx, op, fn) => {
  const rotation = op.rotation || 0;
  if (!rotation) { fn(); return; }
  const c = getCenter(op);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(rotation);
  ctx.translate(-c.x, -c.y);
  fn();
  ctx.restore();
};

// ---------- DRAWING ----------
const drawFreehand = (ctx, op) => {
  if (!op.points || op.points.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = op.color; ctx.lineWidth = op.lineWidth;
  if (op.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  }
  if (op.points.length === 1) {
    const p = op.points[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, op.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(op.points[0].x, op.points[0].y);
  for (let i = 1; i < op.points.length - 1; i++) {
    const midX = (op.points[i].x + op.points[i + 1].x) / 2;
    const midY = (op.points[i].y + op.points[i + 1].y) / 2;
    ctx.quadraticCurveTo(op.points[i].x, op.points[i].y, midX, midY);
  }
  const last = op.points[op.points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
};

const CLOSED_SHAPES = ['rect', 'roundrect', 'circle', 'triangle', 'diamond', 'star'];

const roundedRectPath = (ctx, x, y, w, h, r) => {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawShape = (ctx, op) => {
  if (!op.points || op.points.length < 2) return;
  const [start, end] = op.points;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = op.color; ctx.lineWidth = op.lineWidth;

  ctx.beginPath();
  if (op.tool === 'line') {
    ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
  } else if (op.tool === 'rect') {
    ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (op.tool === 'roundrect') {
    const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);
    roundedRectPath(ctx, x, y, w, h, Math.min(16, w / 2, h / 2));
  } else if (op.tool === 'circle') {
    const rx = (end.x - start.x) / 2, ry = (end.y - start.y) / 2;
    ctx.ellipse(start.x + rx, start.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
  } else if (op.tool === 'triangle') {
    ctx.moveTo(start.x + (end.x - start.x) / 2, start.y);
    ctx.lineTo(end.x, end.y); ctx.lineTo(start.x, end.y); ctx.closePath();
  } else if (op.tool === 'diamond') {
    const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
    ctx.moveTo(cx, start.y); ctx.lineTo(end.x, cy);
    ctx.lineTo(cx, end.y); ctx.lineTo(start.x, cy); ctx.closePath();
  } else if (op.tool === 'star') {
    const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2, ry = Math.abs(end.y - start.y) / 2;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const f = i % 2 === 0 ? 1 : 0.45;
      const x = cx + Math.cos(ang) * rx * f, y = cy + Math.sin(ang) * ry * f;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (op.tool === 'arrow') {
    ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const head = Math.max(12, op.lineWidth * 3);
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
  }

  if (op.fill && CLOSED_SHAPES.includes(op.tool)) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = op.color;
    ctx.fill();
    ctx.restore();
  }
  ctx.stroke();
  ctx.restore();
};

export const wrapText = (ctx, text, maxWidth) => {
  const out = [];
  for (const raw of String(text).split('\n')) {
    let line = '';
    for (const word of raw.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
};

const drawTextOp = (ctx, op) => {
  if (!op.text || !op.points?.length) return;
  const p = op.points[0];
  ctx.save();
  ctx.font = `${op.fontSize || 20}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = op.color;
  ctx.textBaseline = 'top';
  ctx.fillText(op.text, p.x, p.y);
  ctx.restore();
};

const drawSticky = (ctx, op) => {
  const p = op.points[0];
  const w = op.width || 160, h = op.height || 160, fs = op.fontSize || 16;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillStyle = op.bg || '#fef08a';
  ctx.beginPath();
  roundedRectPath(ctx, p.x, p.y, w, h, 6);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#1e293b';
  ctx.font = `${fs}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  wrapText(ctx, op.text || '', w - 20).forEach((line, i) => {
    ctx.fillText(line, p.x + 10, p.y + 10 + i * fs * 1.3);
  });
  ctx.restore();
};

export const drawOperation = (ctx, op) => {
  withRotation(ctx, op, () => {
    if (op.type === 'text') return drawTextOp(ctx, op);
    if (op.type === 'sticky') return drawSticky(ctx, op);
    if (op.type === 'shape') return drawShape(ctx, op);
    return drawFreehand(ctx, op);
  });
};

// ---------- GRID ----------
export const drawGrid = (ctx, dpr, w, h, cam, mode) => {
  if (mode === 'blank') return;
  let spacing = 24 * cam.zoom;
  while (spacing < 14) spacing *= 2;
  while (spacing > 96) spacing /= 2;
  const offX = cam.x % spacing, offY = cam.y % spacing;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (mode === 'dots') {
    ctx.fillStyle = '#e2e8f0';
    for (let x = offX; x < w; x += spacing)
      for (let y = offY; y < h; y += spacing)
        ctx.fillRect(x, y, 1.5, 1.5);
  } else {
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
    ctx.beginPath();
    if (mode === 'grid') {
      for (let x = offX; x < w; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    }
    for (let y = offY; y < h; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }
  ctx.restore();
};

// ---------- BOUNDS (axis-aligned bounding box, respects rotation) ----------
export const getOpBounds = (op) => {
  let points = [];

  if (op.type === 'sticky') {
    const p = op.points[0];
    const w = op.width || 160, h = op.height || 160;
    points = [
      { x: p.x, y: p.y },
      { x: p.x + w, y: p.y },
      { x: p.x, y: p.y + h },
      { x: p.x + w, y: p.y + h },
    ];
  } else if (op.type === 'text') {
    const p = op.points[0], fs = op.fontSize || 20;
    const w = (op.text || '').length * fs * 0.62, h = fs * 1.2;
    points = [
      { x: p.x, y: p.y },
      { x: p.x + w, y: p.y },
      { x: p.x, y: p.y + h },
      { x: p.x + w, y: p.y + h },
    ];
  } else {
    points = op.points || [];
  }

  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  // If rotated, compute AABB of rotated points
  const rotation = op.rotation || 0;
  if (rotation) {
    let cx = 0, cy = 0;
    for (const p of points) { cx += p.x; cy += p.y; }
    cx /= points.length; cy /= points.length;
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    points = points.map((p) => {
      const dx = p.x - cx, dy = p.y - cy;
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    });
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
};

// ---------- HIT TESTING (inverse-rotate point to handle rotated shapes) ----------
const pointToSegmentDistance = (px, py, x1, y1, x2, y2) => {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = lenSq !== 0 ? dot / lenSq : -1;
  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }
  return Math.hypot(px - xx, py - yy);
};

const boundsHit = (b, point, t) =>
  point.x >= b.minX - t && point.x <= b.maxX + t &&
  point.y >= b.minY - t && point.y <= b.maxY + t;

export const hitTest = (op, point) => {
  if (!op.points || op.points.length === 0 || op.type === 'clear') return false;
  const threshold = Math.max(op.lineWidth || 4, 10) / 2 + 5;

  // Inverse-rotate the test point around the shape's center
  let testPoint = point;
  const rotation = op.rotation || 0;
  if (rotation) {
    const c = getCenter(op);
    testPoint = inverseRotatePoint(point.x, point.y, c.x, c.y, rotation);
  }

  if (op.type === 'sticky' || op.type === 'text') {
    return boundsHit(getOpBounds(op), testPoint, threshold);
  }

  if (op.type === 'shape') {
    const [start, end] = op.points;
    if (op.tool === 'circle') {
      const rx = Math.abs(end.x - start.x) / 2 || 1;
      const ry = Math.abs(end.y - start.y) / 2 || 1;
      const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
      const dx = (testPoint.x - cx) / rx, dy = (testPoint.y - cy) / ry;
      return Math.abs(Math.sqrt(dx * dx + dy * dy) - 1) * Math.max(rx, ry) < threshold;
    }
    if (op.tool === 'line' || op.tool === 'arrow') {
      return pointToSegmentDistance(testPoint.x, testPoint.y, start.x, start.y, end.x, end.y) < threshold;
    }
    return boundsHit(getOpBounds(op), testPoint, threshold);
  }

  for (let i = 0; i < op.points.length - 1; i++) {
    const p1 = op.points[i], p2 = op.points[i + 1];
    if (pointToSegmentDistance(testPoint.x, testPoint.y, p1.x, p1.y, p2.x, p2.y) < threshold) return true;
  }
  return op.points.length === 1 &&
    Math.hypot(testPoint.x - op.points[0].x, testPoint.y - op.points[0].y) < threshold;
};

export const findHitOperation = (operations, point) => {
  for (let i = operations.length - 1; i >= 0; i--) {
    if (hitTest(operations[i], point)) return operations[i];
  }
  return null;
};

// ---------- REMOTE CURSORS ----------
const CURSOR_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

const getCursorColor = (userId) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
};

export const drawRemoteCursor = (ctx, camera, cursor, dpr) => {
  const uid = String(cursor.userId || cursor.id || 'user');
  const sx = cursor.x * camera.zoom + camera.x;
  const sy = cursor.y * camera.zoom + camera.y;
  const color = getCursorColor(uid);

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx, sy + 16);
  ctx.lineTo(sx + 4.5, sy + 12.5);
  ctx.lineTo(sx + 9, sy + 20);
  ctx.lineTo(sx + 12, sy + 18.5);
  ctx.lineTo(sx + 7.5, sy + 10.5);
  ctx.lineTo(sx + 12.5, sy + 10.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.font = '11px Inter, system-ui, sans-serif';
  const name = cursor.userName || uid.slice(0, 6);
  const tw = ctx.measureText(name).width;
  ctx.fillStyle = color;
  ctx.beginPath();

  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(sx + 14, sy + 14, tw + 12, 20, 4);
    ctx.fill();
  } else {
    ctx.fillRect(sx + 14, sy + 14, tw + 12, 20);
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, sx + 20, sy + 28);
  ctx.restore();
};