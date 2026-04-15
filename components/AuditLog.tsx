import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Search, Loader2 } from 'lucide-react';

interface LogEntry {
  id: string;
  created_at: string;
  level: string;
  message: string;
  context: any;
  user_id: string;
}

export const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar logs:', error);
      } else {
        setLogs(data || []);
      }
      setIsLoading(false);
    };

    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.level.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
        <input 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          placeholder="Buscar logs..." 
          className="w-full p-4 pl-12 bg-slate-50 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-100" 
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-10">
          <Loader2 className="animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          {filteredLogs.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-bold text-xs">Nenhum log encontrado.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLogs.map(log => (
                <div key={log.id} className="p-4 flex gap-4">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${log.level === 'error' ? 'bg-rose-500' : 'bg-indigo-500'}`} />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">{log.message}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                      {new Date(log.created_at).toLocaleString()} • {log.level}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
