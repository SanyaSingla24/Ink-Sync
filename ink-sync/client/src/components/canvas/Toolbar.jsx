import {
  PenTool, Eraser, Minus, Square, Circle, ArrowUpRight, Type, Hand,
  Undo2, Redo2, Trash2, MousePointer2, StickyNote, Triangle, Diamond,
  Star, RectangleHorizontal, PaintBucket, Lock,
} from 'lucide-react';

const COLORS = ['#1e293b', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];

const ToolButton = ({ active, danger, disabled, title, onClick, children }) => (
  <button
    onClick={onClick} title={title} aria-label={title} disabled={disabled}
    className={`p-2 rounded-lg transition-colors shrink-0 ${
      disabled ? 'opacity-40 cursor-not-allowed text-slate-400'
      : active ? 'bg-primary-600 text-white'
      : danger ? 'text-slate-500 hover:bg-red-50 hover:text-red-600'
      : 'text-slate-600 hover:bg-slate-100'
    }`}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-6 bg-slate-200 mx-1 shrink-0" />;

const Toolbar = ({
  tool, setTool, color, setColor, lineWidth, setLineWidth,
  fill, setFill, onUndo, onRedo, onClear, onDeleteSelected, hasSelection,
  isReadOnly = false, isCreator = false,
}) => {
  if (isReadOnly && !isCreator) {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white rounded-xl shadow-lg border border-slate-200 px-3 py-1.5 z-10">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
          <Lock className="w-3.5 h-3.5" /> View Only (Locked by Host)
        </div>
        <Divider />
        <ToolButton active={tool === 'hand'} onClick={() => setTool('hand')} title="Pan canvas (H)"><Hand className="w-4 h-4" /></ToolButton>
      </div>
    );
  }

  return (
  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white rounded-xl shadow-lg border border-slate-200 px-2 py-1.5 z-10 max-w-[96vw] overflow-x-auto">
    <ToolButton active={tool === 'select'} onClick={() => setTool('select')} title="Select / move / resize (V)"><MousePointer2 className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'hand'} onClick={() => setTool('hand')} title="Pan canvas (H)"><Hand className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'pen'} onClick={() => setTool('pen')} title="Pen (P)"><PenTool className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser (E)"><Eraser className="w-4 h-4" /></ToolButton>

    <Divider />

    <ToolButton active={tool === 'line'} onClick={() => setTool('line')} title="Line"><Minus className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'arrow'} onClick={() => setTool('arrow')} title="Arrow"><ArrowUpRight className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'rect'} onClick={() => setTool('rect')} title="Rectangle"><Square className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'roundrect'} onClick={() => setTool('roundrect')} title="Rounded rectangle"><RectangleHorizontal className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'circle'} onClick={() => setTool('circle')} title="Circle / ellipse"><Circle className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'triangle'} onClick={() => setTool('triangle')} title="Triangle"><Triangle className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'diamond'} onClick={() => setTool('diamond')} title="Diamond"><Diamond className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'star'} onClick={() => setTool('star')} title="Star"><Star className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'text'} onClick={() => setTool('text')} title="Text (T)"><Type className="w-4 h-4" /></ToolButton>
    <ToolButton active={tool === 'sticky'} onClick={() => setTool('sticky')} title="Sticky note (S)"><StickyNote className="w-4 h-4" /></ToolButton>
    <ToolButton active={fill} onClick={() => setFill(!fill)} title="Fill shapes with translucent color"><PaintBucket className="w-4 h-4" /></ToolButton>

    <Divider />

    {COLORS.map((c) => (
      <button key={c} onClick={() => setColor(c)} title={`Color ${c}`} aria-label={`Color ${c}`}
        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 shrink-0 ${color === c ? 'border-primary-600 scale-110' : 'border-transparent'}`}
        style={{ backgroundColor: c }} />
    ))}
    <label className="relative w-5 h-5 rounded-full border border-slate-300 cursor-pointer overflow-hidden shrink-0" title="Custom color">
      <span className="absolute inset-0 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Custom color" />
    </label>

    <Divider />

    <input type="range" min="2" max="24" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))}
      className="w-20 accent-primary-600 shrink-0" title={`Stroke width: ${lineWidth}`} aria-label="Stroke width" />

    <Divider />

    <ToolButton onClick={onUndo} title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></ToolButton>
    <ToolButton onClick={onRedo} title="Redo (Ctrl+Shift+Z)"><Redo2 className="w-4 h-4" /></ToolButton>
    {hasSelection && (
      <ToolButton onClick={onDeleteSelected} title="Delete selected (Del)" danger><Trash2 className="w-4 h-4" /></ToolButton>
    )}
    <ToolButton onClick={onClear} title="Clear entire board" danger><Trash2 className="w-4 h-4" /></ToolButton>
  </div>
  );
};

export default Toolbar;