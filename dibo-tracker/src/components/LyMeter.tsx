import { useState } from 'react';
import { Skull, ThumbsUp, Zap } from 'lucide-react';

interface LyMeterProps {
  level: number;
  onUpdate: (newLevel: number) => void;
}

export function LyMeter({ level, onUpdate }: LyMeterProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = (delta: number) => {
    // 0 is Good Boy, 100 is Siêu Lỳ
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

  const getStatusText = (val: number) => {
    if (val < 30) return 'GOOD_BOY_MODE';
    if (val < 70) return 'WARNING_LEVEL';
    return 'CRITICAL_LY';
  };

  return (
    <div className="relative w-full max-w-md mx-auto p-6 bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-800 shadow-2xl overflow-hidden">
      {/* Techy background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
      
      <div className="relative z-10 flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-widest">
            <Skull className={`text-rose-500 ${isUpdating ? 'animate-pulse' : ''}`} size={20} />
            Lỳ Meter
          </h2>
          <p className="text-xs font-mono text-zinc-500 mt-1">NAUGHTINESS_INDEX</p>
        </div>
        <div className="text-right">
          <span className={`text-4xl font-mono font-bold ${getStatusColor(level)}`}>
            {level}%
          </span>
        </div>
      </div>

      {/* Meter Bar */}
      <div className="relative h-4 bg-zinc-800 rounded-sm overflow-hidden mb-2 border border-zinc-700">
        <div 
          className={`absolute top-0 left-0 h-full transition-all duration-300 ease-out ${
            level > 70 ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 
            level > 30 ? 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 
            'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
          }`}
          style={{ width: `${level}%` }}
        />
        {/* Tick marks */}
        <div className="absolute inset-0 flex justify-between px-1">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-[1px] h-full bg-black/20" />
          ))}
        </div>
      </div>
      
      <div className="flex justify-between font-mono text-[10px] text-zinc-500 mb-8 uppercase tracking-wider">
        <span>Good Boy</span>
        <span>Neutral</span>
        <span>Siêu Lỳ</span>
      </div>

      <div className="relative z-10 flex justify-between gap-4">
        <button
          onClick={() => handleUpdate(-10)} // Decrease Lỳ = More Good
          className="flex-1 py-4 bg-emerald-900/20 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400 rounded-lg font-bold font-mono text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all group"
        >
          <ThumbsUp size={18} className="group-hover:scale-110 transition-transform" />
          NGOAN (-10)
        </button>
        
        <button
          onClick={() => handleUpdate(10)} // Increase Lỳ = More Naughty
          className="flex-1 py-4 bg-rose-900/20 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-400 rounded-lg font-bold font-mono text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all group"
        >
          <Zap size={18} className="group-hover:scale-110 transition-transform" />
          HƯ (+10)
        </button>
      </div>

      <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
        <span className="text-[10px] font-mono text-zinc-600 uppercase">System Status</span>
        <span className={`text-xs font-mono font-bold ${getStatusColor(level)} animate-pulse`}>
          [{getStatusText(level)}]
        </span>
      </div>
    </div>
  );
}
