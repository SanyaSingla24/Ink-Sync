import { getOpBounds, getCenter } from './drawingUtils';

export const getRotateHandlePos = (op, zoom) => {
  const c = getCenter(op);
  const bounds = getOpBounds(op);
  const rotation = op.rotation || 0;
  const topHalfHeight = (bounds.maxY - bounds.minY) / 2;
  const handleOffset = topHalfHeight + 25 / zoom;

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: c.x + handleOffset * sin,
    y: c.y - handleOffset * cos,
  };
};

export const getRotateHandleAnchor = (op) => {
  const c = getCenter(op);
  const bounds = getOpBounds(op);
  const rotation = op.rotation || 0;
  const topHalfHeight = (bounds.maxY - bounds.minY) / 2;

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: c.x + topHalfHeight * sin,
    y: c.y - topHalfHeight * cos,
  };
};

export const getHandleAtPoint = (op, point, zoom) => {
  if (!op || op.type === 'clear' || op.locked) return null;

  const threshold = 8 / zoom;
  const bounds = getOpBounds(op);
  const rotation = op.rotation || 0;
  const c = getCenter(op);

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = point.x - c.x;
  const dy = point.y - c.y;
  const localPoint = {
    x: c.x + dx * cos + dy * sin,
    y: c.y - dx * sin + dy * cos,
  };

  const rot = getRotateHandlePos(op, zoom);
  if (Math.hypot(point.x - rot.x, point.y - rot.y) < threshold * 1.5) {
    return 'rotate';
  }

  const edgeHandles = [
    { key: 'top', x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY },
    { key: 'bottom', x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY },
    { key: 'left', x: bounds.minX, y: (bounds.minY + bounds.maxY) / 2 },
    { key: 'right', x: bounds.maxX, y: (bounds.minY + bounds.maxY) / 2 },
  ];

  for (const h of edgeHandles) {
    if (Math.hypot(localPoint.x - h.x, localPoint.y - h.y) < threshold) {
      return h.key;
    }
  }

  const corners = [
    { key: 'tl', x: bounds.minX, y: bounds.minY },
    { key: 'tr', x: bounds.maxX, y: bounds.minY },
    { key: 'bl', x: bounds.minX, y: bounds.maxY },
    { key: 'br', x: bounds.maxX, y: bounds.maxY },
  ];

  for (const corner of corners) {
    if (Math.hypot(localPoint.x - corner.x, localPoint.y - corner.y) < threshold) {
      return corner.key;
    }
  }

  return null;
};

export const snapshotOp = (op) => ({
  points: op.points.map((p) => ({ ...p })),
  rotation: op.rotation || 0,
  width: op.width,
  height: op.height,
  fontSize: op.fontSize,
});

export const applyResize = (op, snapshot, startBounds, handle, point, shiftKey = false, altKey = false) => {
  const rotation = op.rotation || 0;
  const startCenter = {
    x: (startBounds.minX + startBounds.maxX) / 2,
    y: (startBounds.minY + startBounds.maxY) / 2,
  };

  // FIXED: Determine anchor point correctly for each handle type
  // Corner handles anchor at opposite corner
  // Edge handles anchor at opposite edge center
  let anchorX, anchorY;
  
  if (altKey) {
    // Alt key: resize from center
    anchorX = startCenter.x;
    anchorY = startCenter.y;
  } else {
    if (handle === 'br') {
      // Bottom-right: anchor at top-left corner
      anchorX = startBounds.minX;
      anchorY = startBounds.minY;
    } else if (handle === 'bl') {
      // Bottom-left: anchor at top-right corner
      anchorX = startBounds.maxX;
      anchorY = startBounds.minY;
    } else if (handle === 'tr') {
      // Top-right: anchor at bottom-left corner
      anchorX = startBounds.minX;
      anchorY = startBounds.maxY;
    } else if (handle === 'tl') {
      // Top-left: anchor at bottom-right corner
      anchorX = startBounds.maxX;
      anchorY = startBounds.maxY;
    } else if (handle === 'right') {
      // Right edge: anchor at left edge center
      anchorX = startBounds.minX;
      anchorY = startCenter.y;
    } else if (handle === 'left') {
      // Left edge: anchor at right edge center
      anchorX = startBounds.maxX;
      anchorY = startCenter.y;
    } else if (handle === 'bottom') {
      // Bottom edge: anchor at top edge center
      anchorX = startCenter.x;
      anchorY = startBounds.minY;
    } else if (handle === 'top') {
      // Top edge: anchor at bottom edge center
      anchorX = startCenter.x;
      anchorY = startBounds.maxY;
    } else {
      anchorX = startCenter.x;
      anchorY = startCenter.y;
    }
  }

  // Inverse-rotate the drag point into shape's local space
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = point.x - anchorX;
  const dy = point.y - anchorY;
  const localPoint = {
    x: anchorX + dx * cos + dy * sin,
    y: anchorY - dx * sin + dy * cos,
  };

  const w = startBounds.maxX - startBounds.minX || 1;
  const h = startBounds.maxY - startBounds.minY || 1;

  let sx = 1, sy = 1;

  // Alt key = symmetric resize from center (use half-dimensions)
  const div = altKey ? 2 : 1;

  // Calculate scale factors based on handle type
  if (handle === 'br') {
    sx = (localPoint.x - anchorX) / (w / div);
    sy = (localPoint.y - anchorY) / (h / div);
  } else if (handle === 'bl') {
    sx = (anchorX - localPoint.x) / (w / div);
    sy = (localPoint.y - anchorY) / (h / div);
  } else if (handle === 'tr') {
    sx = (localPoint.x - anchorX) / (w / div);
    sy = (anchorY - localPoint.y) / (h / div);
  } else if (handle === 'tl') {
    sx = (anchorX - localPoint.x) / (w / div);
    sy = (anchorY - localPoint.y) / (h / div);
  } else if (handle === 'right') {
    // Right edge: scale X only
    sx = (localPoint.x - anchorX) / (w / div);
    sy = 1;
  } else if (handle === 'left') {
    // Left edge: scale X only (inverted)
    sx = (anchorX - localPoint.x) / (w / div);
    sy = 1;
  } else if (handle === 'bottom') {
    // Bottom edge: scale Y only
    sx = 1;
    sy = (localPoint.y - anchorY) / (h / div);
  } else if (handle === 'top') {
    // Top edge: scale Y only (inverted)
    sx = 1;
    sy = (anchorY - localPoint.y) / (h / div);
  }

  // Prevent zero/negative scaling
  sx = Math.max(0.1, Math.abs(sx));
  sy = Math.max(0.1, Math.abs(sy));

  // Shift key = constrain proportions (corners only, not edges)
  const isCorner = ['tl', 'tr', 'bl', 'br'].includes(handle);
  if (shiftKey && isCorner) {
    const uniform = Math.max(sx, sy);
    sx = uniform;
    sy = uniform;
  }

  // Apply scale to all points relative to the anchor
  op.points = snapshot.points.map((p) => {
    const pdx = p.x - anchorX;
    const pdy = p.y - anchorY;
    return { x: anchorX + pdx * sx, y: anchorY + pdy * sy };
  });

  // Update size properties (for sticky notes, text, etc.)
  if (op.width) op.width = snapshot.width * sx;
  if (op.height) op.height = snapshot.height * sy;
  if (op.fontSize) op.fontSize = Math.max(8, snapshot.fontSize * Math.min(sx, sy));

  // Preserve rotation
  op.rotation = snapshot.rotation;
};

export const drawSelection = (ctx, ops, zoom) => {
  if (!ops.length) return;
  ctx.save();

  for (const op of ops) {
    if (op.type === 'clear') continue;
    const bounds = getOpBounds(op);
    const rotation = op.rotation || 0;
    const c = getCenter(op);

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(rotation);
    ctx.translate(-c.x, -c.y);

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([]);
    ctx.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

    if (ops.length === 1 && !op.locked) {
      const hs = 4 / zoom;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5 / zoom;

      const corners = [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.minX, y: bounds.maxY },
        { x: bounds.maxX, y: bounds.maxY },
      ];
      for (const corner of corners) {
        ctx.fillRect(corner.x - hs, corner.y - hs, hs * 2, hs * 2);
        ctx.strokeRect(corner.x - hs, corner.y - hs, hs * 2, hs * 2);
      }

      const edges = [
        { x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY },
        { x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY },
        { x: bounds.minX, y: (bounds.minY + bounds.maxY) / 2 },
        { x: bounds.maxX, y: (bounds.minY + bounds.maxY) / 2 },
      ];
      for (const edge of edges) {
        ctx.beginPath();
        ctx.arc(edge.x, edge.y, hs * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();

    if (ops.length === 1 && !op.locked) {
      const anchor = getRotateHandleAnchor(op);
      const handle = getRotateHandlePos(op, zoom);

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(handle.x, handle.y);
      ctx.stroke();

      const r = 5 / zoom;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
};

export const drawMarquee = (ctx, start, current, zoom) => {
  ctx.save();
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const w = Math.abs(current.x - start.x);
  const h = Math.abs(current.y - start.y);
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.restore();
};

export const opsBounds = (ops) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const op of ops) {
    if (op.type === 'clear') continue;
    const b = getOpBounds(op);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
};

export const boundsIntersect = (a, b) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;