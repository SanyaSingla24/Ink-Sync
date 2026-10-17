import { useRef } from 'react';
import { Download, Upload, Image, FileJson, X } from 'lucide-react';

const ExportMenu = ({ onClose, onExportPNG, onExportJSON, onImportJSON }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onImportJSON(e.target.files[0]);
      // Reset input so the same file can be selected again if needed
      e.target.value = ''; 
    }
    onClose();
  };

  return (
    <div className="absolute right-4 top-14 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <h3 className="font-semibold text-sm text-slate-900">Save & Export</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2 space-y-1">
        <button
          onClick={() => { onExportPNG(); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition text-left"
        >
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
            <Image className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium">Export as PNG</p>
            <p className="text-xs text-slate-500">Save board as an image</p>
          </div>
        </button>

        <button
          onClick={() => { onExportJSON(); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition text-left"
        >
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium">Export as JSON</p>
            <p className="text-xs text-slate-500">Save data to restore later</p>
          </div>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition text-left"
        >
          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium">Import from JSON</p>
            <p className="text-xs text-slate-500">Restore a saved board</p>
          </div>
        </button>
      </div>

      {/* Hidden file input for JSON import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default ExportMenu;