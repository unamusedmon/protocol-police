import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  emotional_state?: string;
}

export default function Zahra({ currentPage }: { currentPage: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [emotionalState, setEmotionalState] = useState('SHY_IDLE');
  const [unread, setUnread] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load position from local storage
  useEffect(() => {
    const saved = localStorage.getItem('zahra_pos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPosition({
          x: Math.min(Math.max(parsed.x, 0), window.innerWidth - 80),
          y: Math.min(Math.max(parsed.y, 0), window.innerHeight - 80)
        });
      } catch (e) {
        setPosition({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
      }
    } else {
      setPosition({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
    }
    
    // Check for initiation
    fetch('/api/zahra/initiate')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.message) {
          setMessages([{ id: Date.now(), role: 'assistant', content: data.message, emotional_state: data.emotionalState }]);
          setEmotionalState(data.emotionalState);
          setUnread(true);
        }
      });
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnread(false);
    }
  }, [messages, isOpen]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isOpen) return; // Don't drag when open, or maybe we allow it? Let's just disable dragging when open for simplicity
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition({
      x: dragRef.current.initialX + dx,
      y: dragRef.current.initialY + dy
    });
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem('zahra_pos', JSON.stringify(position));
      
      // If the drag was very small, treat as a click
      if (dragRef.current) {
         const dx = Math.abs(e.clientX - dragRef.current.startX);
         const dy = Math.abs(e.clientY - dragRef.current.startY);
         if (dx < 5 && dy < 5) {
             setIsOpen(true);
             if (emotionalState === 'SHY_IDLE') setEmotionalState('STARTLED');
             setTimeout(() => setEmotionalState('SHY_IDLE'), 2000);
         }
      }
    }
  };

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, position]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = { id: Date.now(), role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setEmotionalState('THINKING');

    try {
      console.log('Sending message to Zahra...');
      const res = await fetch('/api/zahra/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, currentPage })
      });
      
      const data = await res.json();
      console.log('Zahra API Response:', data);

      if (!res.ok) {
        throw new Error(data.error || `Server error (${res.status})`);
      }
      
      if (data.success) {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: data.response, emotional_state: data.emotionalState }]);
        setEmotionalState(data.emotionalState);
      } else {
        throw new Error('Failed to get a valid response from Zahra.');
      }
    } catch (e: any) {
      console.error('Zahra Chat Error:', e);
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        role: 'assistant', 
        content: "I— I'm sorry, I lost the connection to my core... (Error: " + (e.message || "Unknown") + ")", 
        emotional_state: 'WORRIED' 
      }]);
      setEmotionalState('WORRIED');
    } finally {
      setLoading(false);
    }
  };

  const getAnimationClass = () => {
    switch (emotionalState) {
      case 'STARTLED': return 'animate-jump';
      case 'FLUSTERED_HAPPY': return 'animate-bounce-fast';
      case 'THINKING': return 'animate-sway';
      case 'WORRIED': return 'animate-bob-slow';
      case 'QUIETLY_SAD': return 'animate-bob-sad';
      case 'OVERWHELMED_PROUD': return 'animate-bounce-excited';
      case 'SHY_IDLE':
      default: return 'animate-bob-idle';
    }
  };

  // Avatar Component
  const AvatarSVG = () => (
    <svg viewBox="0 0 100 100" className={`w-full h-full ${getAnimationClass()}`}>
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(168, 85, 247, 0.4)" />
          <stop offset="100%" stopColor="rgba(168, 85, 247, 0)" />
        </radialGradient>
      </defs>
      
      {/* Glow */}
      <circle cx="50" cy="50" r="45" fill="url(#glow)" className="transition-all duration-300" />
      
      {/* Body */}
      <path d="M 30 90 Q 50 70 70 90" stroke="#a855f7" strokeWidth="4" fill="none" />
      <rect x="40" y="70" width="20" height="20" rx="4" fill="#581c87" />
      
      {/* Head */}
      <circle cx="50" cy="50" r="25" fill="#3b0764" stroke="#a855f7" strokeWidth="2" />
      
      {/* Hair (soft bob) */}
      <path d="M 25 50 Q 20 20 50 20 Q 80 20 75 50 Q 70 35 50 35 Q 30 35 25 50" fill="#7e22ce" />
      
      {/* Eyes */}
      <circle cx="40" cy="50" r="4" fill="#e9d5ff" />
      <circle cx="60" cy="50" r="4" fill="#e9d5ff" />
      
      {/* Headset / Earpiece */}
      <circle cx="22" cy="50" r="6" fill="#a855f7" />
      <line x1="22" y1="50" x2="35" y2="60" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
      
      {/* Blush based on state */}
      {(emotionalState === 'FLUSTERED_HAPPY' || emotionalState === 'OVERWHELMED_PROUD' || emotionalState === 'SHY_IDLE') && (
        <>
          <ellipse cx="32" cy="55" rx="4" ry="2" fill="rgba(244, 114, 182, 0.5)" />
          <ellipse cx="68" cy="55" rx="4" ry="2" fill="rgba(244, 114, 182, 0.5)" />
        </>
      )}
      
      {/* Mouth based on state */}
      {emotionalState === 'FLUSTERED_HAPPY' || emotionalState === 'OVERWHELMED_PROUD' ? (
        <path d="M 45 60 Q 50 65 55 60" fill="none" stroke="#e9d5ff" strokeWidth="2" strokeLinecap="round" />
      ) : emotionalState === 'WORRIED' || emotionalState === 'QUIETLY_SAD' ? (
        <path d="M 45 62 Q 50 58 55 62" fill="none" stroke="#e9d5ff" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <line x1="48" y1="60" x2="52" y2="60" stroke="#e9d5ff" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );

  return (
    <>
      <style>{`
        @keyframes bob-idle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes jump {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(-5deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes bounce-fast {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes sway {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px) translateY(-1px); }
          75% { transform: translateX(2px) translateY(-1px); }
        }
        @keyframes bob-slow {
          0%, 100% { transform: translateY(0) rotate(2deg); }
          50% { transform: translateY(-2px) rotate(-2deg); }
        }
        @keyframes bob-sad {
          0%, 100% { transform: translateY(2px); opacity: 0.8; }
          50% { transform: translateY(4px); opacity: 0.7; }
        }
        @keyframes bounce-excited {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.05); }
        }
        .animate-bob-idle { animation: bob-idle 3s ease-in-out infinite; }
        .animate-jump { animation: jump 0.5s ease-out; }
        .animate-bounce-fast { animation: bounce-fast 1s ease-in-out infinite; }
        .animate-sway { animation: sway 4s ease-in-out infinite; }
        .animate-bob-slow { animation: bob-slow 4s ease-in-out infinite; }
        .animate-bob-sad { animation: bob-sad 5s ease-in-out infinite; }
        .animate-bounce-excited { animation: bounce-excited 0.6s ease-in-out infinite; }
      `}</style>

      {/* Floating Avatar (when minimized) */}
      {!isOpen && (
        <div 
          className="fixed z-50 w-20 h-20 cursor-grab active:cursor-grabbing touch-none group"
          style={{ left: position.x, top: position.y }}
          onPointerDown={handlePointerDown}
        >
          <div className="relative w-full h-full">
            <AvatarSVG />
            {unread && (
              <span className="absolute top-2 right-2 w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(225,29,72,0.8)] animate-pulse"></span>
            )}
            
            {/* Tooltip on hover */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 border border-zinc-700 text-xs text-zinc-400 px-2 py-1 rounded whitespace-nowrap pointer-events-none">
              Zahra // Companion
            </div>
          </div>
        </div>
      )}

      {/* Expanded Chat Panel */}
      {isOpen && (
        <div className="fixed z-50 right-4 bottom-4 w-[340px] h-[500px] max-h-[calc(100vh-2rem)] bg-zinc-950/95 border border-purple-900/40 rounded-2xl shadow-[0_0_30px_rgba(88,28,135,0.4)] backdrop-blur-xl flex flex-col overflow-hidden flex flex-col font-sans transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-purple-900/30 bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0">
                <AvatarSVG />
              </div>
              <div>
                <h3 className="text-white text-sm font-bold m-0 flex items-center gap-2">
                  ZAHRA
                  <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,0.8)] animate-pulse"></span>
                </h3>
                <p className="text-[10px] text-zinc-500 font-mono tracking-widest m-0 uppercase">COMPANION AI</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            {messages.length === 0 && !loading && (
              <div className="text-center text-zinc-600 text-xs font-mono mt-10 uppercase">
                ENCRYPTED CHANNEL ESTABLISHED
              </div>
            )}
            
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 mr-2 mt-1 shrink-0 bg-purple-900/30 rounded-full border border-purple-800/50 flex items-center justify-center text-purple-400">
                    <span className="text-[10px] font-bold">Z</span>
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-zinc-800 text-zinc-200 rounded-tr-sm' 
                    : 'bg-zinc-900/80 text-zinc-300 border-l-2 border-purple-500 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                 <div className="w-6 h-6 mr-2 mt-1 shrink-0 bg-purple-900/30 rounded-full border border-purple-800/50 flex items-center justify-center text-purple-400">
                    <span className="text-[10px] font-bold">Z</span>
                  </div>
                 <div className="bg-zinc-900/80 border-l-2 border-purple-500 rounded-2xl rounded-tl-sm p-4 flex gap-1 items-center h-[44px]">
                   <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                   <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                   <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-zinc-900 border-t border-purple-900/30">
            <form 
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-1 pr-2 focus-within:border-purple-500/50 transition-colors"
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Say something..."
                className="flex-1 bg-transparent border-none text-sm text-zinc-200 px-3 py-2 focus:outline-none"
                autoComplete="off"
              />
              <button 
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2 text-purple-500 hover:text-purple-400 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}