// Predefined template layouts (coordinates relative to 0,0)
export const TEMPLATES = {
  brainstorming: {
    name: 'Brainstorming',
    icon: '💡',
    description: 'Sticky notes for quick ideas',
    operations: [
      { type: 'sticky', tool: 'sticky', points: [{ x: -150, y: -100 }], color: '#1e293b', lineWidth: 2, text: 'Idea 1', bg: '#fef08a', width: 160, height: 160, fontSize: 16 },
      { type: 'sticky', tool: 'sticky', points: [{ x: 50, y: -100 }], color: '#1e293b', lineWidth: 2, text: 'Idea 2', bg: '#bbf7d0', width: 160, height: 160, fontSize: 16 },
      { type: 'sticky', tool: 'sticky', points: [{ x: -150, y: 100 }], color: '#1e293b', lineWidth: 2, text: 'Idea 3', bg: '#bfdbfe', width: 160, height: 160, fontSize: 16 },
      { type: 'sticky', tool: 'sticky', points: [{ x: 50, y: 100 }], color: '#1e293b', lineWidth: 2, text: 'Idea 4', bg: '#fbcfe8', width: 160, height: 160, fontSize: 16 },
    ],
  },
  kanban: {
    name: 'Kanban Board',
    icon: '📊',
    description: 'To Do, Doing, Done columns',
    operations: [
      { type: 'shape', tool: 'rect', points: [{ x: -300, y: -150 }, { x: -100, y: 250 }], color: '#3b82f6', lineWidth: 2, fill: true },
      { type: 'text', tool: 'text', points: [{ x: -260, y: -120 }], color: '#1e293b', lineWidth: 4, fontSize: 24, text: 'To Do' },
      
      { type: 'shape', tool: 'rect', points: [{ x: -50, y: -150 }, { x: 150, y: 250 }], color: '#f59e0b', lineWidth: 2, fill: true },
      { type: 'text', tool: 'text', points: [{ x: -10, y: -120 }], color: '#1e293b', lineWidth: 4, fontSize: 24, text: 'Doing' },
      
      { type: 'shape', tool: 'rect', points: [{ x: 200, y: -150 }, { x: 400, y: 250 }], color: '#10b981', lineWidth: 2, fill: true },
      { type: 'text', tool: 'text', points: [{ x: 240, y: -120 }], color: '#1e293b', lineWidth: 4, fontSize: 24, text: 'Done' },
    ],
  },
  flowchart: {
    name: 'Simple Flow',
    icon: '',
    description: 'Basic process steps',
    operations: [
      { type: 'shape', tool: 'roundrect', points: [{ x: -200, y: -50 }, { x: -100, y: 50 }], color: '#8b5cf6', lineWidth: 2, fill: true },
      { type: 'text', tool: 'text', points: [{ x: -180, y: -10 }], color: '#ffffff', lineWidth: 4, fontSize: 16, text: 'Start' },
      
      { type: 'shape', tool: 'arrow', points: [{ x: -100, y: 0 }, { x: -50, y: 0 }], color: '#64748b', lineWidth: 2 },
      
      { type: 'shape', tool: 'diamond', points: [{ x: -50, y: -50 }, { x: 50, y: 50 }], color: '#f59e0b', lineWidth: 2, fill: true },
      { type: 'text', tool: 'text', points: [{ x: -30, y: -10 }], color: '#1e293b', lineWidth: 4, fontSize: 14, text: 'Check?' },
      
      { type: 'shape', tool: 'arrow', points: [{ x: 50, y: 0 }, { x: 100, y: 0 }], color: '#64748b', lineWidth: 2 },
      
      { type: 'shape', tool: 'roundrect', points: [{ x: 100, y: -50 }, { x: 200, y: 50 }], color: '#10b981', lineWidth: 2, fill: true },
      { type: 'text', tool: 'text', points: [{ x: 120, y: -10 }], color: '#ffffff', lineWidth: 4, fontSize: 16, text: 'End' },
    ],
  },
};