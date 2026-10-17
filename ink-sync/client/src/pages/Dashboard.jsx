import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PenTool, Plus, DoorOpen, LogOut, AlertCircle, LayoutGrid
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRooms, createRoom, joinRoom, deleteRoom } from '../services/roomService';
import Button from '../components/common/Button';
import RoomCard from '../components/room/RoomCard';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Rooms list state
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState('');

  // Create room form state
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Join room form state
  const [joinId, setJoinId] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const fetchRooms = useCallback(async () => {
    try {
      setLoadingRooms(true);
      const data = await getRooms();
      setRooms(data);
    } catch {
      setRoomsError('Could not load your rooms. Please refresh the page.');
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) {
      setCreateError('Please give your room a name.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const room = await createRoom(createName.trim());
      navigate(`/room/${room.roomId}`);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create room.');
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const id = joinId.trim().toUpperCase();
    if (!id) {
      setJoinError('Enter a room ID, e.g. INK-7X29P');
      return;
    }
    setJoining(true);
    setJoinError('');
    try {
      const room = await joinRoom(id);
      navigate(`/room/${room.roomId}`);
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Room not found. Double-check the ID.');
      setJoining(false);
    }
  };

  const handleDelete = async (roomId) => {
    if (!window.confirm('Delete this room? Board and chat history will be removed.')) return;
    try {
      await deleteRoom(roomId);
      setRooms((prev) => prev.filter((r) => r.roomId !== roomId));
    } catch (err) {
      window.alert(err.response?.data?.message || 'Failed to delete room.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-primary-600 p-2 rounded-lg">
              <PenTool className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">InkSync</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => { logout(); navigate('/'); }}>
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-slate-600 mt-1">Ready to collaborate? Create a room or join your team.</p>
        </div>

        {/* Create / Join */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary-50 p-2.5 rounded-lg">
                <Plus className="w-5 h-5 text-primary-600" />
              </div>
              <h2 className="font-semibold text-lg">Create a Room</h2>
            </div>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Sprint Planning Board"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            />
            {createError && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {createError}
              </p>
            )}
            <Button type="submit" loading={creating} className="w-full mt-4">
              Create Room
            </Button>
          </form>

          <form onSubmit={handleJoin} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary-50 p-2.5 rounded-lg">
                <DoorOpen className="w-5 h-5 text-primary-600" />
              </div>
              <h2 className="font-semibold text-lg">Join a Room</h2>
            </div>
            <input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              placeholder="INK-7X29P"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg font-mono uppercase focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            />
            {joinError && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {joinError}
              </p>
            )}
            <Button type="submit" variant="secondary" loading={joining} className="w-full mt-4">
              Join Room
            </Button>
          </form>
        </div>

        {/* Recent rooms */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent Rooms</h2>

          {loadingRooms ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 bg-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : roomsError ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> {roomsError}
            </div>
          ) : rooms.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
              <LayoutGrid className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-700">No rooms yet</p>
              <p className="text-sm text-slate-500">Create your first room to start collaborating.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <RoomCard
                  key={room._id}
                  room={room}
                  isOwner={room.owner?._id === user?.id || room.owner === user?.id}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;