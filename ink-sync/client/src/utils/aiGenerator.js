import { generateId } from './drawingUtils';

// The "AI" Engine: Parses prompts and generates operations
export const generateDiagram = (prompt, centerX, centerY, userId, roomId) => {
  const lowerPrompt = prompt.toLowerCase();
  let operations = [];

  // 1. Flowchart Generator
  if (lowerPrompt.includes('flowchart') || lowerPrompt.includes('flow chart') || lowerPrompt.includes('process')) {
    const steps = extractNumber(lowerPrompt) || 3;
    const startX = centerX - (steps * 150) / 2;
    
    for (let i = 0; i < steps; i++) {
      const x = startX + i * 150;
      // Box
      operations.push({
        type: 'shape', tool: 'roundrect', 
        points: [{ x: x, y: centerY - 40 }, { x: x + 100, y: centerY + 40 }], 
        color: '#3b82f6', lineWidth: 2, fill: true,
        operationId: generateId(), userId, roomId, timestamp: Date.now()
      });
      // Text
      operations.push({
        type: 'text', tool: 'text', 
        points: [{ x: x + 10, y: centerY - 10 }], 
        color: '#ffffff', lineWidth: 4, fontSize: 16, text: `Step ${i + 1}`,
        operationId: generateId(), userId, roomId, timestamp: Date.now()
      });
      // Arrow (if not last)
      if (i < steps - 1) {
        operations.push({
          type: 'shape', tool: 'arrow', 
          points: [{ x: x + 100, y: centerY }, { x: x + 150, y: centerY }], 
          color: '#64748b', lineWidth: 2,
          operationId: generateId(), userId, roomId, timestamp: Date.now()
        });
      }
    }
  } 
  // 2. Mindmap Generator
  else if (lowerPrompt.includes('mindmap') || lowerPrompt.includes('mind map') || lowerPrompt.includes('brainstorm')) {
    const topics = extractTopics(lowerPrompt) || ['Idea 1', 'Idea 2', 'Idea 3', 'Idea 4'];
    
    // Center Node
    operations.push({
      type: 'shape', tool: 'circle', 
      points: [{ x: centerX - 60, y: centerY - 60 }, { x: centerX + 60, y: centerY + 60 }], 
      color: '#8b5cf6', lineWidth: 2, fill: true,
      operationId: generateId(), userId, roomId, timestamp: Date.now()
    });
    operations.push({
      type: 'text', tool: 'text', 
      points: [{ x: centerX - 30, y: centerY - 10 }], 
      color: '#ffffff', lineWidth: 4, fontSize: 16, text: 'Core Idea',
      operationId: generateId(), userId, roomId, timestamp: Date.now()
    });

    // Branches
    const radius = 200;
    topics.forEach((topic, i) => {
      const angle = (i / topics.length) * Math.PI * 2;
      const tx = centerX + Math.cos(angle) * radius;
      const ty = centerY + Math.sin(angle) * radius;
      
      // Line
      operations.push({
        type: 'shape', tool: 'line', 
        points: [{ x: centerX, y: centerY }, { x: tx, y: ty }], 
        color: '#94a3b8', lineWidth: 2,
        operationId: generateId(), userId, roomId, timestamp: Date.now()
      });
      // Node
      operations.push({
        type: 'shape', tool: 'roundrect', 
        points: [{ x: tx - 50, y: ty - 30 }, { x: tx + 50, y: ty + 30 }], 
        color: '#f59e0b', lineWidth: 2, fill: true,
        operationId: generateId(), userId, roomId, timestamp: Date.now()
      });
      // Text
      operations.push({
        type: 'text', tool: 'text', 
        points: [{ x: tx - 30, y: ty - 10 }], 
        color: '#ffffff', lineWidth: 4, fontSize: 14, text: topic,
        operationId: generateId(), userId, roomId, timestamp: Date.now()
      });
    });
  }
  // 3. Default / Fallback Generator
  else {
    // Generate a random cluster of shapes
    for (let i = 0; i < 5; i++) {
      const x = centerX + (Math.random() - 0.5) * 400;
      const y = centerY + (Math.random() - 0.5) * 400;
      operations.push({
        type: 'sticky', tool: 'sticky', 
        points: [{ x, y }], 
        color: '#1e293b', lineWidth: 2, text: prompt.slice(0, 20), bg: '#fef08a', width: 160, height: 160, fontSize: 16,
        operationId: generateId(), userId, roomId, timestamp: Date.now()
      });
    }
  }

  return operations;
};

// Helper to extract numbers from prompt (e.g., "4 steps" -> 4)
const extractNumber = (text) => {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
};

// Helper to extract topics (simple comma separation)
const extractTopics = (text) => {
  const match = text.match(/about\s+(.+)/i);
  if (match) return match[1].split(',').map(t => t.trim()).filter(t => t);
  return null;
};