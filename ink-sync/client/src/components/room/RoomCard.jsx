import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Copy, Check, Users, Clock, Trash2, DoorOpen } from 'lucide-react';
import Button from '../common/Button';

const RoomCard = ({ room, isOwner, onDelete }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can fail without permission; ignore silently
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900">{room.name}</h3>
          <button
            onClick={copyId}
            title="Copy room ID"
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-mono bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-md transition"
          >
            {room.roomId}
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        {isOwner && (
          <button
            onClick={() => onDelete(room.roomId)}
            className="text-slate-400 hover:text-red-600 p-1 rounded"
            title="Delete room"
            aria-label="Delete room"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
        <span className="inline-flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> {room.participants.length}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatDistanceToNow(new Date(room.updatedAt), { addSuffix: true })}
        </span>
      </div>

      <Button className="w-full" onClick={() => navigate(`/room/${room.roomId}`)}>
        <DoorOpen className="w-4 h-4" /> Join Room
      </Button>
    </div>
  );
};

export default RoomCard;