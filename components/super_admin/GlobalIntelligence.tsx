import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Eye, MousePointerClick, Heart, Search, TrendingUp, BarChart3, Users } from 'lucide-react';

interface TelemetryMetric {
  event_type: string;
  count: number;
}

export const GlobalIntelligence: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchGlobalAnalytics = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    
    try {
      // Obter métricas globais resumidas
      const { data, error } = await supabase
        .from('market_telemetry')
        .select('event_type')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (error) throw error;
      
      if (data) {
         const map: Record<string, number> = {};
         data.forEach(item => {
            map[item.event_type] = (map[item.event_type] || 0) + 1;
         });

         const mappedMetrics = Object.entries(map).map(([event_type, count]) => ({
            event_type,
            count
         }));

         setMetrics(mappedMetrics);
         setTotalEvents(data.length);
      }
    } catch (e) {
      console.error("Erro ao carregar inteligência global", e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGlobalAnalytics();
  }, []);

  if (loading) {
     return (
       <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Processando Big Data...</p>
       </div>
     );
  }

  const getIconForEvent = (type: string) => {
    switch (type) {
      case 'view_store': return <Eye className="w-6 h-6 text-violet-500" />;
      case 'click_ad': return <MousePointerClick className="w-6 h-6 text-emerald-500" />;
      case 'search': return <Search className="w-6 h-6 text-sky-500" />;
      case 'add_to_cart': return <Heart className="w-6 h-6 text-rose-500" />;
      default: return <TrendingUp className="w-6 h-6 text-slate-500" />;
    }
  };

  const getLabelForEvent = (type: string) => {
    switch (type) {
      case 'view_store': return 'Lojas Visualizadas';
      case 'click_ad': return 'Anúncios Clicados';
      case 'search': return 'Buscas Realizadas';
      case 'add_to_cart': return 'Adições ao Carrinho';
      default: return type.toUpperCase();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50">
         <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
               <div className="p-4 bg-violet-600 text-white rounded-2xl shadow-lg shadow-violet-500/20">
                  <BarChart3 size={28} />
               </div>
               <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Global Market Intelligence</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telemetria de Tráfego do Ecossistema</p>
               </div>
            </div>
            <button 
               onClick={() => fetchGlobalAnalytics(true)} 
               disabled={isRefreshing}
               className={`p-4 rounded-2xl transition-all ${isRefreshing ? 'bg-slate-100 text-slate-400' : 'bg-violet-100 text-violet-600 hover:bg-violet-600 hover:text-white shadow-sm'}`}
            >
               <Loader2 className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
         </div>

         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((m, i) => (
               <div key={i} className="p-6 bg-slate-50 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-3 border border-slate-100">
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                     {getIconForEvent(m.event_type)}
                  </div>
                  <div>
                    <p className="font-black text-2xl text-slate-800">{m.count}</p>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-tight">{getLabelForEvent(m.event_type)}</p>
                  </div>
               </div>
            ))}
            
            {metrics.length === 0 && (
               <div className="col-span-full py-10 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  Sem dados de telemetria suficientes
               </div>
            )}
         </div>

         <div className="mt-8 p-6 bg-violet-50 border border-violet-100 rounded-[2.5rem] flex items-center justify-between">
            <div>
               <h4 className="font-black text-violet-900 text-sm uppercase">Total de Interações Analisadas</h4>
               <p className="text-[10px] font-bold text-violet-600/70 uppercase tracking-widest mt-1">Amostragem dos últimos 10 mil eventos</p>
            </div>
            <span className="text-3xl font-black text-violet-600 bg-white px-6 py-2 rounded-2xl shadow-sm">{totalEvents}</span>
         </div>
      </div>
    </div>
  );
};
