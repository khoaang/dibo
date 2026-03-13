import type { LucideIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Clock, X, Plus } from 'lucide-react';
import { useState } from 'react';

interface StatusCardProps {
  title: string;
  label: string;
  icon: LucideIcon;
  history: Date[];
  onAction: () => void;
  onRemove: (date: Date) => void;
  actionLabel: string;
  accentColor: string;
}

export function StatusCard({ title, label, icon: Icon, history, onAction, onRemove, actionLabel, accentColor }: StatusCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const lastTime = history.length > 0 ? history[0] : null;

  // Color mapping
  const colors: Record<string, string> = {
    blue: 'text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20',
    emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20',
    rose: 'text-rose-400 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20',
  };
  
  const btnColors: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20',
    emerald: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20',
    rose: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20',
  };

  return (
    <div className={`relative flex flex-col h-full bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl overflow-hidden transition-all duration-300 ${showHistory ? 'ring-1 ring-zinc-700' : ''}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${colors[accentColor]}`}>
            <Icon size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight uppercase">{title}</h2>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{label}</p>
          </div>
        </div>
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className={`p-2 rounded-lg transition-all ${showHistory ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
        >
          <Clock size={20} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-5 relative">
        {showHistory ? (
          <div className="absolute inset-0 p-4 overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
              {history.map((date) => (
                <div key={date.getTime()} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-mono font-bold text-zinc-200">
                      {date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase">
                      {formatDistanceToNow(date, { addSuffix: true, locale: vi })}
                    </span>
                  </div>
                  <button 
                    onClick={() => onRemove(date)}
                    className="p-2 text-zinc-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-md transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {history.length === 0 && (
                <div className="text-center py-10 text-zinc-600 font-mono text-xs">NO_DATA_FOUND</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center h-full">
            <div className="mb-1">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Time Since Last</span>
            </div>
            <div className="text-5xl font-mono font-bold text-white tracking-tighter mb-2">
              {lastTime 
                ? formatDistanceToNow(lastTime, { locale: vi }).replace('khoảng ', '')
                : '--'}
            </div>
            {lastTime && (
              <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-zinc-800/50 border border-zinc-700/50 self-start">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                <span className="text-xs font-mono text-zinc-400">
                  {lastTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Action */}
      <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/30">
        <button
          onClick={onAction}
          className={`w-full py-4 rounded-xl font-bold font-mono text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all ${btnColors[accentColor]}`}
        >
          <Plus size={18} strokeWidth={3} />
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
