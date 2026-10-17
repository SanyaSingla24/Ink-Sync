import { ZoomIn, ZoomOut, Maximize, Maximize2, LayoutGrid } from 'lucide-react';

const CtrlButton = ({ title, onClick, children }) => (
  <button onClick={onClick} title={title} aria-label={title}
    className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
    {children}
  </button>
);

const CanvasControls = ({ zoomPct, onZoomIn, onZoomOut, onResetView, onFitContent, gridMode, onCycleGrid, onExport }) => (
  <div className="absolute bottom-4 right-4 flex items-center gap-0.5 bg-white rounded-xl shadow-lg border border-slate-200 px-2 py-1.5 z-10">
    <CtrlButton title={`Background: ${gridMode} (click to change)`} onClick={onCycleGrid}><LayoutGrid className="w-4 h-4" /></CtrlButton>
    <div className="w-px h-6 bg-slate-200 mx-1" />
    <CtrlButton title="Zoom out" onClick={onZoomOut}><ZoomOut className="w-4 h-4" /></CtrlButton>
    <button onClick={onResetView} title="Reset zoom to 100%"
      className="text-xs font-medium text-slate-600 w-12 text-center hover:bg-slate-100 rounded-lg py-1.5">
      {zoomPct}%
    </button>
    <CtrlButton title="Zoom in" onClick={onZoomIn}><ZoomIn className="w-4 h-4" /></CtrlButton>
    <CtrlButton title="Fit all content" onClick={onFitContent}><Maximize2 className="w-4 h-4" /></CtrlButton>
    <CtrlButton title="Reset view" onClick={onResetView}><Maximize className="w-4 h-4" /></CtrlButton>
    <div className="w-px h-6 bg-slate-200 mx-1" />
    <button onClick={() => onExport('png')} title="Export as PNG"
      className="text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg px-2.5 py-1.5">PNG</button>
    <button onClick={() => onExport('jpg')} title="Export as JPG"
      className="text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg px-2.5 py-1.5">JPG</button>
  </div>
);

export default CanvasControls;