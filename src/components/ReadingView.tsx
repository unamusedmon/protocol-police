import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Timer, Eye, Focus, ChevronLeft, List, Network, Lock, Handshake } from 'lucide-react';
import type { ContentChunk } from '../lib/chunker';

interface ReadingViewProps {
  rfcTitle: string;
  chunks: (ContentChunk & { html?: string })[];
}

export const ReadingView: React.FC<ReadingViewProps> = ({ rfcTitle, chunks }) => {
  const [progress, setProgress] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [activeHeader, setActiveActiveHeader] = useState<string>('');
  const [showIndex, setShowIndex] = useState(false);
  const recordedFragments = useRef<Set<string>>(new Set());

  const rfcId = rfcTitle.includes('791') ? '791' : rfcTitle.includes('8446') ? '8446' : rfcTitle.includes('9293') ? '9293' : 'default';

  useEffect(() => {
    const handleScroll = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      setProgress(scrolled);

      const headers = Array.from(document.querySelectorAll('h2, h3'));
      let currentHeader = '';
      let currentIndex = -1;
      
      for (let i = 0; i < headers.length; i++) {
        const top = headers[i].getBoundingClientRect().top;
        if (top < 200) {
          currentHeader = headers[i].textContent || '';
          currentIndex = i;
        } else {
          break;
        }
      }
      
      if (currentHeader && currentHeader !== activeHeader) {
        setActiveActiveHeader(currentHeader);
        
        // Record progress if not already recorded this session
        if (!recordedFragments.current.has(currentHeader) && rfcId !== 'default') {
          recordedFragments.current.add(currentHeader);
          
          fetch('/api/progress/fragment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rfcId: `rfc${rfcId}`,
              fragmentIndex: currentIndex,
              totalFragments: chunks.length
            })
          }).catch(err => console.error("Failed to record fragment progress", err));
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeHeader, chunks.length, rfcId]);

  useEffect(() => {
    let interval: any;
    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsTimerActive(false);
      alert("Study Sprint Complete. Take a break before your brain leaks out. I'll wait.");
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const themes = {
    '791': { hex: '#06b6d4', darkHex: 'rgba(6, 182, 212, 0.4)', icon: Network, label: 'PROTOCOL' },
    '8446': { hex: '#d946ef', darkHex: 'rgba(217, 70, 239, 0.4)', icon: Lock, label: 'SECURITY' },
    '9293': { hex: '#f59e0b', darkHex: 'rgba(245, 158, 11, 0.4)', icon: Handshake, label: 'TRANSPORT' },
    'default': { hex: '#e11d48', darkHex: 'rgba(225, 29, 72, 0.4)', icon: List, label: 'DOCUMENT' }
  };

  const theme = themes[rfcId as keyof typeof themes];
  const ThemeIcon = theme.icon;

  return (
    <div 
      className={`min-h-screen transition-colors duration-500 bg-zinc-950`}
      style={{ '--theme-color': theme.hex, '--theme-bg': theme.darkHex } as React.CSSProperties}
    >
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress}%`, backgroundColor: theme.hex, boxShadow: `0 0 15px ${theme.darkHex}` }} />
        <div className="absolute top-3 right-6 text-[10px] font-mono font-black uppercase tracking-[0.3em] bg-zinc-950/80 px-2 py-1 rounded backdrop-blur-sm border" style={{ color: theme.hex, borderColor: theme.darkHex }}>
          Compliance Level: {Math.round(progress)}%
        </div>
      </div>

      <nav className={`fixed top-0 left-0 w-full p-6 flex justify-between items-center z-40 transition-all ${focusMode ? 'opacity-20 hover:opacity-100' : 'opacity-100'}`}>
        <div className="flex items-center gap-6">
          <a href="/" className="text-zinc-500 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </a>
          <div className="flex flex-col">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2" style={{ color: theme.hex }}>
              <ThemeIcon size={12} /> {theme.label} DOSSIER
            </div>
            <div className="font-black text-white text-xl uppercase tracking-tighter">{rfcTitle}</div>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="hidden md:block text-right mr-4">
            <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Active Fragment</div>
            <div className="text-xs font-bold text-zinc-400 max-w-[200px] truncate">{activeHeader || 'Introduction'}</div>
          </div>
          
          <button onClick={() => setShowIndex(!showIndex)} className={`p-3 rounded-2xl transition-all ${showIndex ? 'text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`} style={showIndex ? { backgroundColor: theme.hex } : {}} title="Evidence Index">
            <List size={20} />
          </button>
          <button onClick={() => setFocusMode(!focusMode)} className={`p-3 rounded-2xl transition-all ${focusMode ? 'text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`} style={focusMode ? { backgroundColor: theme.hex, boxShadow: `0 0 15px ${theme.darkHex}` } : {}} title="Isolation Cell">
            <Focus size={20} />
          </button>
          <button onClick={() => setIsTimerActive(!isTimerActive)} className={`p-3 rounded-2xl transition-all flex items-center gap-3 ${isTimerActive ? 'text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`} style={isTimerActive ? { backgroundColor: '#d97706', boxShadow: `0 0 15px rgba(217,119,6,0.4)` } : {}}>
            <Timer size={20} />
            <span className="text-sm font-mono font-bold">{formatTime(timeLeft)}</span>
          </button>
        </div>
      </nav>

      <motion.aside 
        initial={false}
        animate={{ x: showIndex ? 0 : -350 }}
        className="fixed top-24 left-6 w-80 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl z-30 shadow-2xl hidden lg:block"
      >
        <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2" style={{ color: theme.hex }}>
          <List size={14} /> Evidence Index
        </h3>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-zinc-800">
          {chunks.map((chunk, i) => (
            <div 
              key={i} 
              className={`text-sm font-bold transition-all cursor-pointer ${activeHeader === chunk.title ? 'pl-4 border-l-2' : 'text-zinc-500 hover:text-white'}`}
              style={activeHeader === chunk.title ? { color: theme.hex, borderColor: theme.hex } : {}}
              onClick={() => {
                const el = document.getElementById(`chunk-${i}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {chunk.title}
            </div>
          ))}
        </div>
      </motion.aside>

      <main className="prose-container relative" style={{ maxWidth: '70ch' }}>
        <div className="mt-24 space-y-32">
          {chunks.map((chunk, i) => (
            <motion.section 
              key={i} 
              id={`chunk-${i}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="relative"
            >
              <div className="absolute -left-16 top-0 text-[10px] font-black uppercase tracking-widest [writing-mode:vertical-lr] rotate-180" style={{ color: theme.hex, opacity: 0.5 }}>
                Fragment {i + 1}
              </div>
              <h2 className="text-3xl font-black text-white mb-8 tracking-tight border-l-4 pl-4" style={{ borderColor: theme.hex }}>{chunk.title}</h2>
              <div className="text-lg text-zinc-300 leading-relaxed max-w-[70ch]">
                <div 
                  className={`markdown-content ${focusMode ? 'opacity-100' : 'opacity-100'}`}
                  dangerouslySetInnerHTML={{ __html: chunk.html || '' }} 
                />
              </div>
            </motion.section>
          ))}
        </div>

        <div className="mt-40 pb-32 text-center border-t border-zinc-900 pt-16">
          <div className="text-[10px] font-black uppercase tracking-[0.4em] mb-4" style={{ color: theme.hex }}>End of Dossier</div>
          <h2 className="text-4xl font-black text-white mb-8 tracking-tighter">Information Extracted Successfully</h2>
          <div className="flex justify-center gap-6">
            <a href="/" className="btn-secondary">
              <ChevronLeft size={20} /> Return to HQ
            </a>
            <a href="/flashcards" className="btn-primary" style={{ backgroundColor: theme.hex, boxShadow: `0 10px 20px ${theme.darkHex}` }}>
              Enter Interrogation Room <List size={20} />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};