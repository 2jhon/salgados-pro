
import React, { useState, useEffect, useRef } from 'react';
import { safeStringifyError } from '../lib/supabase';

// Define the LogEntry interface to fix the "Cannot find name 'LogEntry'" error on line 5.
export interface LogEntry {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: string;
}

const DebugAgent: React.FC = () => {
  // Define logs and setLogs to fix the "Cannot find name 'setLogs'" error on line 16.
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // Define isProcessingLog ref to fix the "Cannot find name 'isProcessingLog'" errors on lines 6, 8, and 21.
  const isProcessingLog = useRef(false);

  // Implementation of addLog to capture and process console messages safely.
  const addLog = (type: LogEntry['type'], args: any[]) => {
    if (isProcessingLog.current) return;
    try {
      isProcessingLog.current = true;
      const message = args.map(arg => {
        if (arg instanceof Error || (typeof arg === 'object' && arg !== null)) {
            return safeStringifyError(arg);
        }
        return String(arg);
      }).join(' ');
      
      setLogs(prev => {
        if (prev.length > 0 && prev[0].message === message) return prev;
        return [{ type, message: message.substring(0, 1000), timestamp: new Date().toLocaleTimeString() }, ...prev].slice(0, 50);
      });
    } finally {
      isProcessingLog.current = false;
    }
  };

  // Intercept global console methods to route logs through the DebugAgent.
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      addLog('log', args);
      originalLog(...args);
    };
    console.error = (...args: any[]) => {
      addLog('error', args);
      originalError(...args);
    };
    console.warn = (...args: any[]) => {
      addLog('warn', args);
      originalWarn(...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  const [isOpen, setIsOpen] = useState(false);

  // Return a toggle button or the expanded log overlay.
  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-[9999] p-3 bg-slate-900 text-white rounded-full shadow-2xl opacity-50 hover:opacity-100 transition-opacity"
      >
        <span className="text-[10px] font-black uppercase">Debug</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-md p-6 overflow-hidden flex flex-col font-mono text-[10px] text-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black uppercase tracking-widest">Logs do Sistema</h3>
        <div className="flex gap-2">
          <button onClick={() => setLogs([])} className="px-4 py-2 bg-slate-800 rounded-xl uppercase hover:bg-slate-700 transition-colors">Limpar</button>
          <button onClick={() => setIsOpen(false)} className="px-4 py-2 bg-rose-600 rounded-xl uppercase hover:bg-rose-500 transition-colors">Fechar</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 bg-black/40 p-4 rounded-2xl border border-white/5">
        {logs.map((log, i) => (
          <div key={i} className={`p-1 border-b border-white/5 last:border-0 ${log.type === 'error' ? 'text-rose-400' : log.type === 'warn' ? 'text-amber-400' : 'text-slate-400'}`}>
            <span className="opacity-30 mr-2">[{log.timestamp}]</span>
            <span className="font-black uppercase mr-2 tracking-tighter">[{log.type}]</span>
            {log.message}
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-slate-600 text-center py-10 uppercase tracking-widest">Aguardando logs...</div>
        )}
      </div>
    </div>
  );
};

export default DebugAgent;
