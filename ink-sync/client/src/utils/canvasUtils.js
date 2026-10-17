import { drawOperation } from './drawingUtils';

// Find the bounding box of everything drawn
export const computeBounds = (operations) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const consider = (x, y) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };

  for (const op of operations) {
    if (op.type === 'clear' || !op.points) continue;
    const pad = (op.lineWidth || 4) + 2;

    for (const p of op.points) {
      consider(p.x - pad, p.y - pad);
      consider(p.x + pad, p.y + pad);
    }

    if (op.type === 'text') {
      const fs = op.fontSize || 20;
      // FIX: Guard against empty/undefined text so export never crashes
      const textLength = (op.text || '').length;
      consider(
        op.points[0].x + (textLength * fs * 0.62) + pad,
        op.points[0].y + fs + pad
      );
    }
  }

  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
};

// Replay ops onto an offscreen canvas and trigger a download
export const exportBoard = (operations, { roomName = 'Board', format = 'png' }) => {
  const bounds = computeBounds(operations);
  if (!bounds) return false; // empty board

  const pad = 48;
  const width = Math.ceil(bounds.maxX - bounds.minX + pad * 2);
  const height = Math.ceil(bounds.maxY - bounds.minY + pad * 2);

  // 1) Transparent work canvas: replay operations in world space
  const work = document.createElement('canvas');
  work.width = width;
  work.height = height;
  const wctx = work.getContext('2d');
  const setWorld = () => wctx.setTransform(1, 0, 0, 1, pad - bounds.minX, pad - bounds.minY);
  setWorld();

  for (const op of operations) {
    if (op.type === 'clear') {
      wctx.setTransform(1, 0, 0, 1, 0, 0);
      wctx.clearRect(0, 0, width, height);
      setWorld();
    } else {
      drawOperation(wctx, op);
    }
  }

  // 2) Composite over white (otherwise JPG exports would be black)
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const octx = out.getContext('2d');
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, width, height);
  octx.drawImage(work, 0, 0);

  const safeName = roomName.replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'Board';
  const date = new Date().toISOString().slice(0, 10);

  const link = document.createElement('a');
  link.href = out.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
  link.download = `InkSync-${safeName}-${date}.${format}`;
  link.click();
  return true;
};
