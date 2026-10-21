import { useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';

const SUGGESTIONS = [
  'User login & authentication flowchart',
  'E-commerce order checkout flow',
  'Sprint planning mind map',
  'Software architecture overview',
];

const AIPromptBox = ({ onGenerate, onClose, isLoading = false }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onGenerate(prompt.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/10 flex items-center justify-center text-purple-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-none">AI Diagram Generator</h2>
              <p className="text-xs text-slate-500 mt-0.5">Powered by Google Gemini</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 hover:bg-slate-200/60 rounded-full transition text-slate-500 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            What do you want to create?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            placeholder="e.g., Create a 4-step flowchart for user login with decision branches..."
            className="w-full px-4 py-3 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-28 text-slate-800 disabled:bg-slate-50 disabled:text-slate-400"
            autoFocus
          />

          {/* Quick suggestion chips */}
          <div className="mt-3">
            <span className="text-xs font-medium text-slate-500">Try an idea:</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setPrompt(item)}
                  className="text-xs px-2.5 py-1 rounded-full bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-600 border border-slate-200/80 transition disabled:opacity-40"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!prompt.trim() || isLoading}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl transition shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating diagram...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Diagram
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AIPromptBox;