import { useEffect, useState } from 'react';
import { Check, X, UserPlus, XCircle, Loader2 } from 'lucide-react';
import { approveAccess, rejectAccess, getPendingRequests } from '../../services/accessService';

const PendingRequestsPanel = ({ roomId, pendingRequests = [], sendRef, onDismiss }) => {
  const [requests, setRequests] = useState(pendingRequests);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState({});

  useEffect(() => {
    if (pendingRequests && pendingRequests.length >= 0) {
      setRequests(pendingRequests);
    }
  }, [pendingRequests]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await getPendingRequests(roomId);
        if (Array.isArray(data)) setRequests(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [roomId]);

  const handleApprove = async (req) => {
    const targetId = req.userId?._id || req.userId?.id || req.userId;
    const targetName = req.userId?.name || 'User';
    setBusy((b) => ({ ...b, [targetId]: 'approving' }));
    try {
      await approveAccess(roomId, targetId);
      sendRef.current.approveAccess?.(targetId, targetName);
      setRequests((prev) => prev.filter((r) => (r.userId?._id || r.userId?.id || r.userId) !== targetId));
    } catch (err) {
      console.error(err);
    } finally {
      setBusy((b) => ({ ...b, [targetId]: null }));
    }
  };

  const handleReject = async (req) => {
    const targetId = req.userId?._id || req.userId?.id || req.userId;
    setBusy((b) => ({ ...b, [targetId]: 'rejecting' }));
    try {
      await rejectAccess(roomId, targetId);
      setRequests((prev) => prev.filter((r) => (r.userId?._id || r.userId?.id || r.userId) !== targetId));
    } catch (err) {
      console.error(err);
    } finally {
      setBusy((b) => ({ ...b, [targetId]: null }));
    }
  };

  return (
    <div className="fixed top-20 right-6 z-50 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-primary-50 border-b border-primary-100">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary-600" />
          <span className="font-semibold text-sm text-primary-900">Access Requests</span>
          <span className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full">
            {requests.length}
          </span>
        </div>
        <button onClick={onDismiss} className="text-slate-500 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500">
            No pending requests
          </div>
        ) : (
          requests.map((req) => (
            <div key={req.userId._id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50">
              <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center shrink-0">
                {req.userId.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{req.userId.name}</p>
                <p className="text-xs text-slate-500 truncate">{req.userId.email}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleApprove(req)}
                  disabled={busy[req.userId._id]}
                  title="Accept"
                  className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition disabled:opacity-50"
                >
                  {busy[req.userId._id] === 'approving'
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleReject(req)}
                  disabled={busy[req.userId._id]}
                  title="Reject"
                  className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50"
                >
                  {busy[req.userId._id] === 'rejecting'
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <XCircle className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PendingRequestsPanel;