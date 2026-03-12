import type { LucideIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Clock, X } from 'lucide-react';
import { useState } from 'react';

interface StatusCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  history: Date[];
  onAction: () => void;
  onRemove: (date: Date) => void;
  actionLabel: string;
  accentColor: string;
}

export function StatusCard({ title, subtitle, icon: Icon, history, onAction, onRemove, actionLabel, accentColor }: StatusCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const lastTime = history.length > 0 ? history[0] : null;

  return (
    <div className={`relative group overflow-hidden bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-6 flex flex-col justify-between transition-all duration-300 hover:border-${accentColor}-500/50 hover:shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)] hover:shadow-${accentColor}-500/20`}>
      {/* Techy corner markers */}
      <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-${accentColor}-500 opacity-50`} />
      <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-${accentColor}-500 opacity-50`} />
      <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-${accentColor}-500 opacity-50`} />
      <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-${accentColor}-500 opacity-50`} />

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white uppercase">{title}</h2>
          <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mt-1">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`p-3 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-400 transition-colors ${showHistory ? 'bg-zinc-800 text-white' : ''}`}
          >
            <Clock size={24} />
          </button>
          <div className={`p-3 rounded-lg bg-${accentColor}-500/10 border border-${accentColor}-500/20 text-${accentColor}-400 shadow-[0_0_15px_-3px_rgba(0,0,0,0.3)] shadow-${accentColor}-500/20`}>
            <Icon size={24} />
          </div>
        </div>
      </div>
      
      {showHistory ? (
        <div className="mb-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800">
             <span className="text-xs font-mono text-zinc-500 uppercase">History Log</span>
             <span className="text-xs font-mono text-zinc-600">{history.length} ENTRIES</span>
          </div>
          <div className="space-y-2">
            {history.map((date) => (
              <div key={date.getTime()} className="flex items-center justify-between p-2 rounded bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 group/item">
                <div>
                  <div className="text-sm font-mono text-white">
                    {date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase">
                    {formatDistanceToNow(date, { addSuffix: true, locale: vi })}
                  </div>
                </div>
                <button 
                  onClick={() => onRemove(date)}
                  className="p-1.5 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {history.length === 0 && (
              <div className="text-center py-8 text-zinc-600 font-mono text-xs">NO DATA RECORDED</div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-mono text-zinc-500">STATUS:</span>
            <span className={`font-mono font-bold ${lastTime ? 'text-white' : 'text-zinc-600'}`}>
              {lastTime ? 'ACTIVE' : 'NO_DATA'}
            </span>
          </div>
          <div className="mt-2">
            <p className="text-4xl font-mono font-bold text-white tracking-tighter">
              {lastTime 
                ? formatDistanceToNow(lastTime, { addSuffix: true, locale: vi })
                : '--'}
            </p>
            {lastTime && (
              <p className="text-xs font-mono text-zinc-500 mt-1">
                T: {lastTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onAction}
        className={`w-full py-4 bg-zinc-800 hover:bg-${accentColor}-500 hover:text-white text-zinc-300 border border-zinc-700 hover:border-${accentColor}-400 rounded-lg font-bold font-mono text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-3 group-hover:shadow-[0_0_20px_-5px_rgba(0,0,0,0.3)] group-hover:shadow-${accentColor}-500/30`}
      >
        <Icon size={16} />
        {actionLabel}
      </button>
    </div>
  );
}
