import { useState } from 'react';
import { X, Crown, UserMinus, Loader2 } from 'lucide-react';
import { removeParticipant } from '../../services/accessService';

const ParticipantsPanel = ({ roomId, participants, isCreator, currentUserId, sendRef, onClose }) => {
  const [removing, setRemoving] = useState(null);

  const handleRemove = async (participant) => {
    if (!window.confirm(`Remove ${participant.userName} from this room?`)) return;
    setRemoving(participant.userId);
    try {
      await removeParticipant(roomId, participant.userId);
      sendRef.current.removeUser?.(participant.userId);
    } catch (err) {
      console.error(err);
      window.alert('Could not remove participant. Please try again.');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="fixed top-16 right-6 z-40 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className="font-semibold text-sm text-slate-900">
          Participants ({participants.length})
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto p-2">
        {participants.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500">No one else is here</div>
        ) : (
          participants.map((p) => {
            const isMe = p.userId === currentUserId;
            return (
              <div key={p.userId} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center text-sm">
                    {p.userName?.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate flex items-center gap-1.5">
                    {p.userName}
                    {isMe && <span className="text-xs text-slate-400">(you)</span>}
                    {p.isCreator && <Crown className="w-3.5 h-3.5 text-amber-500" title="Room creator" />}
                  </p>
                  <p className="text-xs text-green-600">Online</p>
                </div>
                {isCreator && !isMe && !p.isCreator && (
                  <button
                    onClick={() => handleRemove(p)}
                    disabled={removing === p.userId}
                    title="Remove from room"
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                  >
                    {removing === p.userId
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <UserMinus className="w-4 h-4" />}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ParticipantsPanel;