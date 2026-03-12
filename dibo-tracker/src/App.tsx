import { useState, useEffect } from 'react';
import { Utensils, Footprints, Dog, Activity, Wifi } from 'lucide-react';
import { StatusCard } from './components/StatusCard';
import { LyMeter } from './components/LyMeter';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// Mock data for now - replace with Firebase logic later
const MOCK_DATA = {
  fedHistory: [
    new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
    new Date(Date.now() - 1000 * 60 * 60 * 28), // Yesterday
  ],
  walkHistory: [
    new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
    new Date(Date.now() - 1000 * 60 * 60 * 36), // Yesterday
  ],
  lyLevel: 15, // 0-100, 0 is good boy
};

function App() {
  const [fedHistory, setFedHistory] = useState<Date[]>(MOCK_DATA.fedHistory);
  const [walkHistory, setWalkHistory] = useState<Date[]>(MOCK_DATA.walkHistory);
  const [lyLevel, setLyLevel] = useState(MOCK_DATA.lyLevel);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFeed = () => {
    const now = new Date();
    setFedHistory(prev => [now, ...prev]);
    // TODO: Save to Firebase
    console.log('Fed at:', now);
  };

  const handleWalk = () => {
    const now = new Date();
    setWalkHistory(prev => [now, ...prev]);
    // TODO: Save to Firebase
    console.log('Walked at:', now);
  };

  const handleRemoveFed = (dateToRemove: Date) => {
    setFedHistory(prev => prev.filter(d => d.getTime() !== dateToRemove.getTime()));
    // TODO: Sync with Firebase
  };

  const handleRemoveWalk = (dateToRemove: Date) => {
    setWalkHistory(prev => prev.filter(d => d.getTime() !== dateToRemove.getTime()));
    // TODO: Sync with Firebase
  };

  const handleLyUpdate = (newLevel: number) => {
    setLyLevel(newLevel);
    // TODO: Save to Firebase
    console.log('Ly Level updated to:', newLevel);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans select-none touch-manipulation overflow-hidden flex flex-col">
      {/* Header / HUD Top Bar */}
      <header className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4 relative">
        <div className="absolute -bottom-[1px] left-0 w-1/3 h-[1px] bg-gradient-to-r from-blue-500 to-transparent" />
        
        <div className="flex items-center gap-4">
          <div className="relative p-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]">
            <Dog size={32} className="text-blue-400" />
            <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-2">
              DIBO_TRACKER <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">v2.0</span>
            </h1>
            <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">System Online • Monitoring Active</p>
          </div>
        </div>
        
        <div className="text-right flex flex-col items-end">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 mb-1">
            <Wifi size={12} className="text-green-500" />
            <span>CONNECTED</span>
          </div>
          <div className="text-4xl font-mono font-bold text-white tracking-widest">
            {format(currentTime, 'HH:mm', { locale: vi })}
          </div>
          <div className="text-zinc-500 text-xs font-mono uppercase tracking-wider">
            {format(currentTime, 'EEEE, d MMMM yyyy', { locale: vi })}
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
        
        {/* Feeding Card */}
        <StatusCard
          title="Feeding Status"
          subtitle="Lần ăn cuối"
          icon={Utensils}
          history={fedHistory}
          onAction={handleFeed}
          onRemove={handleRemoveFed}
          actionLabel="Confirm Feed"
          accentColor="blue"
        />

        {/* Walking Card */}
        <StatusCard
          title="Patrol Log"
          subtitle="Lần đi dạo cuối"
          icon={Footprints}
          history={walkHistory}
          onAction={handleWalk}
          onRemove={handleRemoveWalk}
          actionLabel="Log Patrol"
          accentColor="emerald"
        />

        {/* Ly Meter & Stats */}
        <div className="flex flex-col gap-6">
          <LyMeter 
            level={lyLevel} 
            onUpdate={handleLyUpdate} 
          />
          
          {/* Quick Stats / Mini HUD */}
          <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 opacity-20">
                <Activity size={40} />
             </div>
             <h3 className="text-xs font-mono text-zinc-500 uppercase mb-4">Daily Summary</h3>
             <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-sm text-zinc-400">Total Walks</span>
                  <span className="font-mono font-bold text-emerald-400">02</span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-sm text-zinc-400">Meals</span>
                  <span className="font-mono font-bold text-blue-400">01</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Avg. Lỳ Level</span>
                  <span className="font-mono font-bold text-rose-400">15%</span>
                </div>
             </div>
          </div>
        </div>

      </main>
      
      {/* Footer / Status Bar */}
      <footer className="mt-8 border-t border-zinc-900 pt-4 flex justify-between text-[10px] font-mono text-zinc-700 uppercase">
        <div>System ID: RPI-4B-DIBO</div>
        <div>Memory: OK • CPU: OK • Temp: 42°C</div>
      </footer>
    </div>
  );
}

export default App;
