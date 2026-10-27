import { Video, Phone, X } from 'lucide-react';

/**
 * IncomingCallPrompt — sleek floating invitation card that alerts room participants
 * when someone starts a video call, offering an immediate "Join Call" or "Dismiss" action.
 */
const IncomingCallPrompt = ({ initiatorName, onJoin, onDismiss }) => {
  return (
    <div className="fixed top-20 right-6 z-50 max-w-sm w-full bg-slate-900/95 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-4 shadow-2xl shadow-indigo-500/20 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-start gap-3">
        {/* Pulsing camera icon */}
        <div className="relative shrink-0 mt-0.5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Video className="w-5 h-5" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500" />
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-sm font-semibold text-white truncate">
              Video Call Started
            </h4>
            <button
              onClick={onDismiss}
              className="text-slate-400 hover:text-white p-1 rounded-md transition"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            <span className="font-semibold text-indigo-400">{initiatorName || 'Someone'}</span> has started a video call in this room.
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onJoin}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-medium text-xs rounded-xl shadow-md shadow-emerald-600/30 transition hover:scale-[1.02]"
            >
              <Phone className="w-3.5 h-3.5" /> Join Call
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700/80 rounded-xl transition"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallPrompt;
