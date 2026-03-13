import { useState } from 'react';
import { Skull, ThumbsUp, Zap } from 'lucide-react';

interface LyMeterProps {
  level: number;
  onUpdate: (newLevel: number) => void;
}

export function LyMeter({ level, onUpdate }: LyMeterProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = (delta: number) => {
    const newLevel = Math.min(100, Math.max(0, level + delta));
    onUpdate(newLevel);
    setIsUpdating(true);
    setTimeout(() => setIsUpdating(false), 200);
  };

  const getStatusColor = (val: number) => {
    if (val < 30) return 'text-emerald-400';
    if (val < 70) return 'text-yellow-400';
    return 'text-rose-500';
  };

  const getBarColor = (val: number) => {
    if (val < 30) return 'bg-emerald-500 shadow-emerald-500/50';
    if (val < 70) return 'bg-yellow-500 shadow-yellow-500/50';
    return 'bg-rose-500 shadow-rose-500/50';
  };

  return (
    <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
            <Skull size={24} className={isUpdating ? 'animate-pulse' : ''} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-tight">Lỳ Meter</h2>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Behavior Index</p>
          </div>
        </div>
        <span className={`text-4xl font-mono font-bold tracking-tighter ${getStatusColor(level)}`}>
          {level}%
        </span>
      </div>

      {/* Meter */}
      <div className="relative h-6 bg-zinc-800 rounded-full overflow-hidden mb-8 border border-zinc-700/50">
        <div 
          className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out shadow-[0_0_20px_rgba(0,0,0,0.5)] ${getBarColor(level)}`}
          style={{ width: `${level}%` }}
        />
        {/* Grid Lines */}
        <div className="absolute inset-0 flex justify-between px-1">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-px h-full bg-black/10" />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-4 mt-auto">
        <button
          onClick={() => handleUpdate(-10)}
          className="py-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 font-bold font-mono text-sm uppercase flex flex-col items-center gap-2 transition-all active:scale-[0.98]"
        >
          <ThumbsUp size={20} />
          <span>Ngoan (-10)</span>
        </button>
        
        <button
          onClick={() => handleUpdate(10)}
          className="py-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 font-bold font-mono text-sm uppercase flex flex-col items-center gap-2 transition-all active:scale-[0.98]"
        >
          <Zap size={20} />
          <span>Hư (+10)</span>
        </button>
      </div>
    </div>
  );
}
