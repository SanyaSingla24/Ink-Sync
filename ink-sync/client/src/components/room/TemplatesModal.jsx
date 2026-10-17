import { X } from 'lucide-react';
import { TEMPLATES } from '../../utils/templates';

const TemplatesModal = ({ onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Choose a Template</h2>
            <p className="text-xs text-slate-500">Instantly add a layout to your board</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grid */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(TEMPLATES).map(([key, template]) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className="group flex flex-col items-start p-4 rounded-xl border border-slate-200 hover:border-primary-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 bg-white text-left"
            >
              <div className="text-3xl mb-3 bg-slate-50 p-2 rounded-lg group-hover:bg-primary-50 transition-colors">
                {template.icon}
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">{template.name}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{template.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TemplatesModal;