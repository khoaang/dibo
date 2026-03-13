import { useState, useEffect } from 'react';
import { Utensils, Footprints, Dog, Activity } from 'lucide-react';
import { StatusCard } from './components/StatusCard';
import { LyMeter } from './components/LyMeter';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// Mock data
const MOCK_DATA = {
  fedHistory: [
    new Date(Date.now() - 1000 * 60 * 60 * 4), 
    new Date(Date.now() - 1000 * 60 * 60 * 28),
  ],
  walkHistory: [
    new Date(Date.now() - 1000 * 60 * 60 * 12),
    new Date(Date.now() - 1000 * 60 * 60 * 36),
  ],
  lyLevel: 15,
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
    console.log('Fed at:', now);
  };

  const handleWalk = () => {
    const now = new Date();
    setWalkHistory(prev => [now, ...prev]);
    console.log('Walked at:', now);
  };

  const handleRemoveFed = (dateToRemove: Date) => {
    setFedHistory(prev => prev.filter(d => d.getTime() !== dateToRemove.getTime()));
  };

  const handleRemoveWalk = (dateToRemove: Date) => {
    setWalkHistory(prev => prev.filter(d => d.getTime() !== dateToRemove.getTime()));
  };

  const handleLyUpdate = (newLevel: number) => {
    setLyLevel(newLevel);
    console.log('Ly Level updated to:', newLevel);
  };

  // Calculate daily stats
  const today = new Date().setHours(0,0,0,0);
  const mealsToday = fedHistory.filter(d => d.getTime() >= today).length;
  const walksToday = walkHistory.filter(d => d.getTime() >= today).length;

  return (
    <div className="h-screen w-screen bg-[#09090b] text-white p-6 font-sans select-none overflow-hidden flex flex-col">
      
      {/* Top Bar */}
      <header className="flex justify-between items-start mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Dog size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight leading-none">DIBO TRACKER</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">System Online</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-4xl font-mono font-bold tracking-tighter leading-none">
            {format(currentTime, 'HH:mm')}
          </div>
          <div className="text-xs font-mono text-zinc-500 uppercase mt-1">
            {format(currentTime, 'EEEE, d MMMM', { locale: vi })}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Status Cards */}
        <div className="col-span-7 grid grid-rows-2 gap-6 h-full">
          <StatusCard
            title="Feeding"
            label="Last Meal Time"
            icon={Utensils}
            history={fedHistory}
            onAction={handleFeed}
            onRemove={handleRemoveFed}
            actionLabel="Log Meal"
            accentColor="blue"
          />
          <StatusCard
            title="Patrol"
            label="Last Walk Time"
            icon={Footprints}
            history={walkHistory}
            onAction={handleWalk}
            onRemove={handleRemoveWalk}
            actionLabel="Log Patrol"
            accentColor="emerald"
          />
        </div>

        {/* Right Column: Ly Meter & Stats */}
        <div className="col-span-5 flex flex-col gap-6 h-full">
          <div className="flex-1">
            <LyMeter level={lyLevel} onUpdate={handleLyUpdate} />
          </div>
          
          {/* Daily Stats Summary */}
          <div className="h-1/3 bg-zinc-900/30 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-4 text-zinc-500">
              <Activity size={16} />
              <span className="text-xs font-mono uppercase tracking-widest">Daily Stats</span>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-3xl font-mono font-bold text-white">{mealsToday}</div>
                <div className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Meals Today</div>
              </div>
              <div>
                <div className="text-3xl font-mono font-bold text-white">{walksToday}</div>
                <div className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Walks Today</div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
