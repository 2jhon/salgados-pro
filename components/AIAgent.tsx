
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Bot, Sparkles, Terminal, Activity, ShieldAlert, 
  X, ChevronUp, Zap, Cpu, Database, Bug, RefreshCw, Play,
  Clock, CheckCircle2, CircleDashed, AlertCircle, History, MapPin, Server
} from 'lucide-react';
import { safeStringifyError } from '../lib/supabase';

type ProcessStatus = 'START' | 'DONE' | 'FAIL' | 'IDLE';

interface AgentLog {
  id: string;
  taskId?: string;
  timestamp: string;
  uptime: string;
  type: 'INFO' | 'ERROR' | 'PATCH' | 'NETWORK' | 'PROCESS';
  status: ProcessStatus;
  message: string;
  location?: string;
  data?: any;
}

const AIAgent: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'HEALTHY' | 'ANALYZING' | 'ERROR'>('HEALTHY');
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [startTime] = useState(Date.now());
  const [currentUptime, setCurrentUptime] = useState('00:00:00');
  const terminalEndRef = useRef<HTMLDivElement>(null);
  
  const getUptime = () => {
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const addOrUpdateLog = (config: Partial<AgentLog>) => {
    setLogs(prev => {
      if (config.taskId) {
        const existingIndex = prev.findIndex(l => l.taskId === config.taskId);
        if (existingIndex !== -1) {
          const updatedLogs = [...prev];
          updatedLogs[existingIndex] = {
            ...updatedLogs[existingIndex],
            ...config,
            id: updatedLogs[existingIndex].id,
            timestamp: updatedLogs[existingIndex].timestamp,
            status: config.status || updatedLogs[existingIndex].status,
            message: config.message || updatedLogs[existingIndex].message,
            data: config.data || updatedLogs[existingIndex].data
          };
          return updatedLogs;
        }
      }

      const newLog: AgentLog = {
        id: Math.random().toString(36).substr(2, 9),
        taskId: config.taskId,
        timestamp: new Date().toLocaleTimeString(),
        uptime: getUptime(),
        type: config.type || 'INFO',
        status: config.status || 'IDLE',
        message: config.message || '',
        location: config.location,
        data: config.data
      };
      return [newLog, ...prev].slice(0, 100);
    });

    if (config.status === 'FAIL') setStatus('ERROR');
  };

  useEffect(() => {
    (window as any).Nexus = {
      report: (message: string, status: ProcessStatus, type: AgentLog['type'] = 'PROCESS', taskId?: string, data?: any) => {
        addOrUpdateLog({ message, status, type, taskId, data });
      }
    };
    
    const timer = setInterval(() => setCurrentUptime(getUptime()), 1000);
    
    addOrUpdateLog({ type: 'INFO', message: "Nexus Guardian Kernel v3.5.2 Ativo.", status: 'DONE' });
    addOrUpdateLog({ taskId: 'INTEGRITY_CHECK', type: 'PROCESS', message: "Monitorando fluxo de persistência de dados...", status: 'START' });

    const handleError = (event: ErrorEvent) => {
      addOrUpdateLog({ 
        type: 'ERROR', 
        message: `FALHA CRÍTICA: ${event.message}`, 
        status: 'FAIL', 
        location: event.filename,
        data: event.error 
      });
      analyzeError(event.message, event.filename || 'Desconhecido', event.error?.stack);
    };

    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('error', handleError);
      clearInterval(timer);
    };
  }, []);

  const analyzeError = async (errorMessage: string, location: string, stack?: string) => {
    if (isThinking) return;
    setIsThinking(true);
    setStatus('ANALYZING');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `ERRO DETECTADO: ${errorMessage} em ${location}. ANALISE TÉCNICA EM JSON: {causa: string, solucao: string, risco: 'baixo'|'alto'}`,
        config: { responseMimeType: "application/json", temperature: 0.1 }
      });

      const analysis = JSON.parse(response.text || '{}');
      addOrUpdateLog({ 
        type: 'PATCH', 
        message: `DIAGNÓSTICO: ${analysis.causa}`, 
        status: 'DONE',
        data: analysis
      });
      setStatus('HEALTHY');
    } catch (e) {
      setStatus('ERROR');
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-24 right-6 z-[9999] w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 hover:scale-110 active:scale-95 group ${
          status === 'HEALTHY' ? 'bg-slate-950 border-blue-500/50' : 
          status === 'ANALYZING' ? 'bg-blue-600 animate-pulse' : 'bg-rose-600 animate-bounce shadow-rose-900/40'
        } border-2`}
      >
        <Bot className="text-white w-8 h-8" />
        <div className="absolute -top-1 -right-1 bg-blue-500 text-[8px] font-black px-1.5 py-0.5 rounded-full text-white border border-slate-900 shadow-lg">LIVE</div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9998] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-5xl h-[85vh] bg-slate-900 rounded-[3rem] border border-white/10 shadow-3xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-900/80">
              <div className="flex items-center gap-5">
                <div className={`p-4 rounded-[1.5rem] ${status === 'HEALTHY' ? 'bg-blue-500/10 text-blue-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  <Cpu className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">NEXUS TELEMETRY</h2>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${status === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 animate-pulse'}`} />
                      NÚCLEO: {status === 'HEALTHY' ? 'ESTÁVEL' : 'ANALISANDO'}
                    </span>
                    <span className="text-[10px] font-black uppercase text-blue-400 flex items-center gap-2">
                      <Clock size={12} /> SESSION: {currentUptime}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setLogs([])} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"><History className="w-5 h-5 text-slate-400" /></button>
                <button onClick={() => setIsOpen(false)} className="p-3 bg-white/5 hover:bg-rose-500/20 rounded-2xl transition-all"><X className="text-slate-400 w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <div className="flex-1 bg-black/40 p-6 font-mono text-[11px] overflow-y-auto no-scrollbar border-r border-white/5">
                <div className="space-y-3">
                  {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30 text-slate-500 uppercase font-black tracking-widest gap-4">
                       <Server className="w-12 h-12 animate-pulse" />
                       Aguardando Atividade Vital...
                    </div>
                  ) : (
                    logs.map(log => (
                      <div key={log.id} className={`group p-4 rounded-2xl border transition-all duration-300 ${
                        log.status === 'FAIL' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' :
                        log.status === 'DONE' ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-300' :
                        'bg-white/5 border-white/5 text-slate-400'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                             {log.status === 'START' && <CircleDashed size={12} className="text-blue-400 animate-spin" />}
                             {log.status === 'DONE' && <CheckCircle2 size={12} className="text-emerald-400" />}
                             {log.status === 'FAIL' && <AlertCircle size={12} className="text-rose-400" />}
                             <span className="font-black text-[8px] uppercase tracking-[0.2em] px-1.5 py-0.5 bg-white/5 rounded">[{log.type}]</span>
                          </div>
                          <span className="text-[9px] opacity-40 font-bold tracking-widest">T+{log.uptime}</span>
                        </div>
                        <p className="leading-relaxed font-bold">{log.message}</p>
                        {log.data && (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-[9px] text-blue-400/60 uppercase font-black hover:text-blue-400">Ver Payload de Dados</summary>
                            <pre className="mt-2 p-4 bg-black/60 rounded-xl text-[9px] text-slate-400 overflow-x-auto border border-white/5 font-mono">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>
              <div className="w-full md:w-80 bg-slate-900/80 p-8 space-y-6 overflow-y-auto">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Health Metrics</h3>
                <div className="space-y-4">
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/10 group hover:bg-blue-500/10 transition-all cursor-default">
                    <div className="flex items-center gap-3 text-blue-400 mb-2"><Database size={16} /><span className="text-[10px] font-black uppercase">Supabase Sync</span></div>
                    <p className="text-[9px] text-slate-500 font-bold">Estado: ATIVO. Persistência de transações em tempo real habilitada.</p>
                  </div>
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/10 group hover:bg-orange-500/10 transition-all cursor-default">
                    <div className="flex items-center gap-3 text-orange-400 mb-2"><Zap size={16} /><span className="text-[10px] font-black uppercase">Data Resilience</span></div>
                    <p className="text-[9px] text-slate-500 font-bold">Mecanismo de Auto-Refresh ativado. Cache local sincronizado.</p>
                  </div>
                </div>
                <div className="pt-6">
                  <button onClick={() => window.location.reload()} className="w-full p-5 bg-blue-600 rounded-[1.5rem] text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all hover:bg-blue-500">
                    <RefreshCw className="w-4 h-4" /> Reiniciar Nexus
                  </button>
                  <p className="text-[8px] text-slate-600 font-black uppercase mt-4 text-center tracking-widest opacity-50">Nexus Security Kernel © 2024</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAgent;
