import { useState, useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { MessageCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';

const API = 'http://localhost:5000/api';

const RideChat = ({ rideId, isActive, defaultOpen = false }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const bottomRef = useRef(null);
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    if (!isActive || !rideId) return;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API}/rides/${rideId}/messages`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setMessages(res.data);
      } catch (err) {
        console.error('Failed to load messages', err);
      }
    };

    fetchMessages();
  }, [rideId, isActive, user.token]);

  useEffect(() => {
    if (!socket || !rideId) return;

    const handler = (msg) => {
      const msgRideId = msg.rideId?._id || msg.rideId;
      if (msgRideId?.toString() === rideId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on('ride_message', handler);
    return () => socket.off('ride_message', handler);
  }, [socket, rideId]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/rides/${rideId}/messages`,
        { text },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setMessages((prev) => {
        if (prev.some((m) => m._id === res.data._id)) return prev;
        return [...prev, res.data];
      });
      setText('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  if (!isActive) return null;

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      {/* Chat header / toggle */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-brand-accent" />
          <span className="text-sm font-bold text-brand-accent">In-Ride Chat</span>
          {messages.length > 0 && (
            <span className="bg-brand-accent text-brand-dark text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp size={16} className="text-gray-400 group-hover:text-white transition-colors" />
          : <ChevronDown size={16} className="text-gray-400 group-hover:text-white transition-colors" />
        }
      </button>

      {open && (
        <div className="mt-3 flex flex-col rounded-xl border border-white/10 bg-brand-dark/90 overflow-hidden">
          {/* Messages area */}
          <div className="h-56 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
                <MessageCircle size={32} className="opacity-30" />
                <p className="text-xs">No messages yet. Say hello! 👋</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderId?._id === user.id || msg.senderId === user.id;
                const timeStr = msg.createdAt
                  ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div
                    key={msg._id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    {!isMine && (
                      <p className="text-[10px] text-brand-accent mb-0.5 ml-1 font-semibold">
                        {msg.senderId?.fullName || 'User'}
                      </p>
                    )}
                    <div
                      className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMine
                          ? 'bg-brand-accent/25 text-white border border-brand-accent/40 rounded-br-sm'
                          : 'bg-white/10 text-gray-100 border border-white/10 rounded-bl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                    {timeStr && (
                      <p className="text-[9px] text-gray-600 mt-0.5 mx-1">{timeStr}</p>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="flex gap-2 p-3 border-t border-white/10">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="px-4 py-2.5 bg-brand-accent hover:bg-brand-accentHover text-brand-dark rounded-xl font-bold disabled:opacity-40 transition-all"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default RideChat;
