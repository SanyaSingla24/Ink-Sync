const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { protect } = require('../middleware/auth');

const SYSTEM_PROMPT = `
You are an expert diagram and whiteboard generator for InkSync.
Given a user request, generate a clean, visually appealing whiteboard diagram layout.

You must respond ONLY with a JSON array of operations. Do not include markdown codeblocks or explanation.

Operation schema:
1. Shape operation:
   {
     "type": "shape",
     "tool": "roundrect" | "rect" | "circle" | "diamond" | "triangle" | "arrow" | "line",
     "points": [{"x": number, "y": number}, {"x": number, "y": number}],
     "color": "#3b82f6" | "#10b981" | "#f59e0b" | "#ef4444" | "#8b5cf6" | "#64748b",
     "lineWidth": 2,
     "fill": true
   }
   - First point is top-left, second point is bottom-right.
   - For arrows, first point is arrow start, second point is arrow tip.
   - Use 'roundrect' for process steps, 'diamond' for decisions, 'arrow' for directional flows.

2. Text operation:
   {
     "type": "text",
     "tool": "text",
     "points": [{"x": number, "y": number}],
     "text": "Label text",
     "fontSize": 14,
     "color": "#1e293b"
   }
   - Place text near the visual center of its corresponding shape.
   - Text color should be "#1e293b" (dark slate) for high contrast and readability.

3. Sticky note operation:
   {
     "type": "sticky",
     "tool": "sticky",
     "points": [{"x": number, "y": number}],
     "text": "Content",
     "bg": "#fef08a" | "#bfdbfe" | "#bbf7d0" | "#fed7aa",
     "width": 160,
     "height": 160
   }

Layout rules:
- Center the whole diagram around (x: 0, y: 0) so it appears in the center of the whiteboard.
- Standard box dimensions: width 150-200px, height 50-70px.
- Spacing between boxes: 60-100px.
- Keep diagram concise, modern, and easy to read.
`;

const getNormalizedApiKey = () => {
  const key = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
  const trimmed = key.trim();
  if (trimmed.startsWith('sk-AQ.')) {
    return trimmed.replace(/^sk-/, '');
  }
  return trimmed;
};

// Normalize operations to ensure frontend never breaks
const normalizeOperations = (rawOps) => {
  const normalized = [];

  for (const item of rawOps) {
    if (!item || typeof item !== 'object') continue;

    const type = item.type || (item.tool === 'sticky' ? 'sticky' : item.text && !item.tool ? 'text' : 'shape');
    const tool = item.tool || (type === 'sticky' ? 'sticky' : type === 'text' ? 'text' : 'roundrect');

    let points = Array.isArray(item.points) ? item.points : [];

    // If points are missing but x, y, width, height were provided
    if (points.length === 0 && (item.x !== undefined || item.y !== undefined)) {
      const x = Number(item.x) || 0;
      const y = Number(item.y) || 0;
      const w = Number(item.width) || 160;
      const h = Number(item.height) || 60;

      if (type === 'shape') {
        points = [{ x, y }, { x: x + w, y: y + h }];
      } else {
        points = [{ x, y }];
      }
    }

    // Default points if still empty
    if (points.length === 0) {
      if (type === 'shape') {
        points = [{ x: -75, y: -30 }, { x: 75, y: 30 }];
      } else {
        points = [{ x: -50, y: 0 }];
      }
    }

    // Make sure points have numbers
    points = points.map((p) => ({
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
    }));

    if (type === 'shape' && points.length < 2) {
      points.push({ x: points[0].x + 150, y: points[0].y + 60 });
    }

    const op = {
      type,
      tool,
      points,
      color: item.color || (type === 'text' ? '#1e293b' : '#3b82f6'),
      lineWidth: item.lineWidth || 2,
    };

    if (type === 'shape') {
      op.fill = item.fill !== false;
    }

    if (type === 'text') {
      op.text = String(item.text || 'Text');
      op.fontSize = item.fontSize || 14;
    }

    if (type === 'sticky') {
      op.text = String(item.text || '');
      op.bg = item.bg || '#fef08a';
      op.width = item.width || 160;
      op.height = item.height || 160;
      op.fontSize = item.fontSize || 16;
    }

    normalized.push(op);

    // If a shape has embedded text, also generate a centered text operation
    if (type === 'shape' && item.text && tool !== 'arrow' && tool !== 'line') {
      const [start, end] = points;
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const textLen = String(item.text).length;

      normalized.push({
        type: 'text',
        tool: 'text',
        points: [{ x: midX - (textLen * 4), y: midY - 8 }],
        text: String(item.text),
        color: '#1e293b',
        fontSize: 14,
        lineWidth: 2,
      });
    }
  }

  return normalized;
};

router.post('/generate', protect, async (req, res) => {
  try {
    const apiKey = getNormalizedApiKey();

    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY is missing in server/.env file!');
      return res.status(500).json({
        message: 'Server configuration error: Missing GEMINI_API_KEY in .env file',
      });
    }

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ message: 'A prompt is required' });
    }

    console.log('📝 Generating diagram for prompt:', prompt.trim());

    const genAI = new GoogleGenerativeAI(apiKey);

    // Supported modern models list in priority order
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-3.8-flash',
    ];

    let result = null;
    let usedModel = null;
    let lastError = null;

    const fullPrompt = `${SYSTEM_PROMPT}\n\nUser Request: ${prompt.trim()}`;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        result = await model.generateContent(fullPrompt);
        usedModel = modelName;
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Model ${modelName} failed:`, err.message);
      }
    }

    if (!result) {
      throw lastError || new Error('No candidate Gemini model succeeded');
    }

    const response = result.response;
    const text = response.text();
    console.log(`🤖 AI Response from ${usedModel}:`, text.slice(0, 200) + '...');

    // Parse JSON
    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        parsedData = JSON.parse(match[0]);
      } else {
        throw new Error('AI response did not contain valid JSON');
      }
    }

    // Extract operations array
    let rawOps = [];
    if (Array.isArray(parsedData)) {
      rawOps = parsedData;
    } else if (parsedData && Array.isArray(parsedData.operations)) {
      rawOps = parsedData.operations;
    } else if (parsedData && Array.isArray(parsedData.elements)) {
      rawOps = parsedData.elements;
    } else if (parsedData && typeof parsedData === 'object') {
      const firstArray = Object.values(parsedData).find((val) => Array.isArray(val));
      if (firstArray) rawOps = firstArray;
    }

    if (!rawOps.length) {
      return res.status(500).json({ message: 'AI did not return any diagram elements' });
    }

    const operations = normalizeOperations(rawOps);

    console.log('✅ Successfully normalized', operations.length, 'operations');
    return res.json({ operations });
  } catch (error) {
    console.error('💥 Gemini Generation Error:', error.message || error);
    return res.status(500).json({
      message: error.message || 'Failed to generate diagram with AI',
    });
  }
});

module.exports = router;