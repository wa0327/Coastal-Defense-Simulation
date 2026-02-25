import React, { useState, useCallback, useEffect } from 'react';
import TacticalMap from './components/TacticalMap';
import { LogEntry, SimulationStats } from './lib/simulation';
import { Shield, Crosshair, Navigation, AlertTriangle, Info, Ship, Anchor, HelpCircle, Volume2 } from 'lucide-react';
import { initAudio } from './lib/audio';

export default function App() {
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 'init-1', time: new Date(), message: '系統初始化完成...', type: 'INFO' },
    { id: 'init-2', time: new Date(), message: 'VTOL 無人機已升空，開始執行濱海巡邏任務。', type: 'INFO' },
    { id: 'init-3', time: new Date(), message: '請點擊畫面任意處以啟用音效系統。', type: 'INFO' }
  ]);
  const [stats, setStats] = useState<SimulationStats>({ friendly: 0, enemy: 0, fishing: 0, unknown: 0, weather: 'CLEAR' });
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    const handleFirstClick = () => {
      initAudio();
      setAudioEnabled(true);
      window.removeEventListener('click', handleFirstClick);
    };
    window.addEventListener('click', handleFirstClick);
    return () => window.removeEventListener('click', handleFirstClick);
  }, []);

  const handleLog = useCallback((log: LogEntry) => {
    setLogs(prev => [log, ...prev].slice(0, 50));
  }, []);

  const handleStatsUpdate = useCallback((newStats: SimulationStats) => {
    setStats(newStats);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans p-4 flex flex-col">
      <header className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-emerald-500" />
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">濱海防禦模擬系統</h1>
        </div>
        <div className="flex items-center gap-4 text-sm font-mono">
          {audioEnabled && <Volume2 className="w-4 h-4 text-emerald-500" />}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SYSTEM ONLINE
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[600px]">
        {/* Left Panel: Logs */}
        <div className="lg:col-span-3 flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden h-[800px]">
          <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-sky-400" />
            <h2 className="font-semibold text-slate-200">戰術日誌</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-slate-500 text-center mt-10">等待系統事件...</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className={`p-2 rounded border ${
                  log.type === 'ALERT' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                  'bg-slate-800/50 border-slate-700/50 text-slate-300'
                }`}>
                  <div className="flex items-center gap-2 mb-1 opacity-70">
                    {log.type === 'ALERT' ? <AlertTriangle className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                    <span>{log.time.toLocaleTimeString()}</span>
                  </div>
                  <div>{log.message}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center: Map */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-900 rounded-xl border border-slate-800 p-2 h-[800px]">
          <div className="w-full aspect-[4/3] max-h-full relative">
            <TacticalMap onLog={handleLog} onStatsUpdate={handleStatsUpdate} />
            
            {/* Overlay UI */}
            <div className="absolute top-4 left-4 pointer-events-none">
              <div className="text-emerald-500 font-mono text-xs font-bold tracking-widest">COASTAL DEFENSE GRID</div>
              <div className="text-slate-500 font-mono text-[10px]">SECTOR 7G</div>
            </div>
          </div>
        </div>

        {/* Right Panel: Stats & Legend */}
        <div className="lg:col-span-2 flex flex-col gap-4 h-[800px]">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-slate-400" />
              當前目標統計
            </h2>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between items-center">
                <span className="text-blue-400 flex items-center gap-2"><Ship className="w-4 h-4"/> 我方軍艦</span>
                <span className="text-slate-100">{stats.friendly}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-400 flex items-center gap-2"><Ship className="w-4 h-4"/> 敵方軍艦</span>
                <span className="text-slate-100">{stats.enemy}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300 flex items-center gap-2"><Anchor className="w-4 h-4"/> 漁船</span>
                <span className="text-slate-100">{stats.fishing}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-yellow-400 flex items-center gap-2"><HelpCircle className="w-4 h-4"/> 不明目標</span>
                <span className="text-slate-100">{stats.unknown}</span>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-800">
              <h3 className="text-xs text-slate-400 mb-2 uppercase tracking-wider">環境狀況</h3>
              <div className="space-y-2 font-mono text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">天候</span>
                  <span className={`font-bold ${
                    stats.weather === 'CLEAR' ? 'text-sky-400' :
                    stats.weather === 'FOG' ? 'text-slate-400' :
                    stats.weather === 'RAIN' ? 'text-blue-400' : 'text-red-400'
                  }`}>
                    {stats.weather === 'CLEAR' ? '晴朗' :
                     stats.weather === 'FOG' ? '濃霧' :
                     stats.weather === 'RAIN' ? '降雨' : '暴風雨'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">偵測範圍</span>
                  <span className="text-slate-100">
                    {stats.weather === 'CLEAR' ? '2.0km' :
                     stats.weather === 'FOG' ? '1.0km' :
                     stats.weather === 'RAIN' ? '1.6km' : '0.8km'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">耗電率</span>
                  <span className="text-slate-100">
                    {stats.weather === 'CLEAR' ? '1.0x' :
                     stats.weather === 'FOG' ? '1.0x' :
                     stats.weather === 'RAIN' ? '1.2x' : '2.0x'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex-1">
            <h2 className="font-semibold text-slate-200 mb-4">圖例</h2>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-sky-400" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}></div>
                <span>VTOL 無人機</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-orange-500" style={{ clipPath: 'polygon(100% 50%, 0 100%, 0 0)' }}></div>
                <span>攻擊型無人機</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-2 bg-blue-500"></div>
                <span>我方軍艦</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-red-500" style={{ clipPath: 'polygon(100% 50%, 0 100%, 0 0)' }}></div>
                <span>敵方軍艦</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-slate-50 rounded-full"></div>
                <span>漁船</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-yellow-500" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}></div>
                <span>不明目標</span>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                <div className="w-4 h-4 rounded-full border border-sky-400 border-dashed bg-sky-400/10"></div>
                <span className="text-xs text-slate-400">
                  {stats.weather === 'CLEAR' ? '2.0km' :
                   stats.weather === 'FOG' ? '1.0km' :
                   stats.weather === 'RAIN' ? '1.6km' : '0.8km'} 偵測範圍
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
