import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';

interface RankData {
  rank: {
    id: string;
    title: string;
    description: string;
  };
  xp: number;
  nextRank: {
    id: string;
    title: string;
    xp_threshold: number;
  } | null;
  percentage: number;
}

export default function RankBadge() {
  const [data, setData] = useState<RankData | null>(null);
  const [justRankedUp, setJustRankedUp] = useState(false);
  const [prevRankId, setPrevRankId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRank() {
      try {
        const res = await fetch('/api/rank/current');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.progress) {
            setData(json.progress);
            
            // Check if rank changed (in a real app we'd persist this in a better way)
            if (prevRankId && prevRankId !== json.progress.rank.id) {
              setJustRankedUp(true);
              setTimeout(() => setJustRankedUp(false), 3000);
            }
            setPrevRankId(json.progress.rank.id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch rank", err);
      }
    }
    
    fetchRank();
    
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchRank();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [prevRankId]);

  if (!data) return null;

  return (
    <a 
      href="/dossier"
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 bg-zinc-950/80 border border-zinc-800 backdrop-blur-md px-4 py-2 rounded-xl transition-all duration-500 hover:border-rose-900/50 hover:bg-zinc-900 ${
        justRankedUp ? 'shadow-[0_0_20px_rgba(225,29,72,0.8)] border-rose-500 scale-105' : 'shadow-lg'
      } terminal-flicker`}
    >
      <div className={`p-1.5 rounded-lg ${justRankedUp ? 'bg-rose-500 text-white' : 'bg-zinc-900 text-rose-600'}`}>
        <Shield size={16} />
      </div>
      
      <div className="flex flex-col min-w-[120px]">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
            {data.rank.title}
          </span>
          <span className="text-[9px] font-mono text-zinc-500">
            {data.nextRank ? `${data.xp} / ${data.nextRank.xp_threshold}` : 'MAX'}
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-rose-600 transition-all duration-1000 ease-out" 
            style={{ width: `${data.percentage}%` }}
          />
        </div>
      </div>
    </a>
  );
}