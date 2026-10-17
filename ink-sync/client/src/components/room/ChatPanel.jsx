import { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, Lock, Trash2 } from 'lucide-react';

const ChatPanel = ({
  messages = [],
  currentUserId,
  participants = [],
  isCreator,
  onSendMessage,
  onDeleteMessage,
  onClose
}) => {
  const [input, setInput] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState(''); // '' = Everyone
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim(), selectedRecipient || null);
      setInput('');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getUserName = (userId) => {
    if (userId === currentUserId) return 'You';
    const user = participants.find((p) => p.userId === userId);
    return user?.userName || 'Unknown';
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-sm text-slate-900">Room Chat</h3>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 text-sm mt-10">
            No messages yet. Say hi! 👋
          </div>
        ) : (
          messages.map((msg) => {
            const senderId = msg.sender?.id || msg.sender?._id || msg.sender;
            const isMe = senderId === currentUserId;
            const isPrivate = msg.isPrivate;

            return (
              <div
                key={msg._id}
                className={`group relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Admin Delete Button (Creator only, not on own messages) */}
                {isCreator && !isMe && (
                  <button
                    onClick={() => onDeleteMessage(msg._id)}
                    className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition shadow-sm"
                    title="Delete message"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}

                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm shadow-sm ${isMe
                    ? (isPrivate ? 'bg-amber-100 text-amber-900 rounded-br-none' : 'bg-primary-600 text-white rounded-br-none')
                    : (isPrivate ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-bl-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none')
                  }`}>
                  {isPrivate && (
                    <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-70">
                      <Lock className="w-3 h-3" />
                      {isMe ? `To: ${getUserName(msg.recipient)}` : `From: ${getUserName(senderId)}`}
                    </div>
                  )}
                  {!isPrivate && !isMe && (
                    <p className="text-xs font-semibold text-primary-600 mb-1">
                      {msg.sender?.name || 'User'}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white space-y-2">
        {/* Recipient Selector */}
        <select
          value={selectedRecipient}
          onChange={(e) => setSelectedRecipient(e.target.value)}
          className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">📢 To: Everyone</option>
          {participants
            .filter((p) => p.userId !== currentUserId)
            .map((p) => (
              <option key={p.userId} value={p.userId}>
                🔒 To: {p.userName}
              </option>
            ))}
        </select>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={selectedRecipient ? `Message ${getUserName(selectedRecipient)}...` : "Type a message..."}
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;