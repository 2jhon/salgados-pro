
import React, { useEffect, useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  MousePointerClick, 
  Star, 
  Heart, 
  AlertCircle,
  Loader2,
  ChevronRight,
  TrendingDown,
  ShoppingBag,
  ArrowUpRight,
  Sparkles,
  MessageCircle,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Cell
} from 'recharts';
import { useAnalytics } from '../hooks/useAnalytics';
import { StoreAnalyticsSummary, ProductClickDetail, StoreProfile, Transaction, StoreRating } from '../types';
import { supabase } from '../lib/supabase';
import { exportToExcel, exportToPDF } from '../lib/exportUtils';

interface StoreInsightsProps {
  workspaceId: string;
  profile: StoreProfile | null;
  transactions: Transaction[];
}

export const StoreInsights: React.FC<StoreInsightsProps> = ({ workspaceId, profile = null, transactions = [] }) => {
  const { getStoreSummary, getTopProducts } = useAnalytics();
  const [summary, setSummary] = useState<StoreAnalyticsSummary | null>(null);
  const [topProducts, setTopProducts] = useState<ProductClickDetail[]>([]);
  const [recentRatings, setRecentRatings] = useState<StoreRating[]>([]);
  const [loading, setLoading] = useState(true);

  const handleExportBI = (type: 'XLSX' | 'PDF') => {
    if (!summary) return;

    if (type === 'XLSX') {
      const data = [
        { Metrica: 'Total de Views', Valor: summary.totalViews },
        { Metrica: 'Total de Cliques', Valor: summary.totalClicks },
        { Metrica: 'Seguidores', Valor: summary.totalFollowers },
        { Metrica: 'Curtidas', Valor: summary.totalFavorites },
        { Metrica: 'Avaliação Média', Valor: summary.avgRating },
        { Metrica: 'Total de Avaliações', Valor: summary.totalRatings },
      ];
      exportToExcel(data, `BI_Summary_${workspaceId}`);
    } else {
      const headers = ['Métrica', 'Valor'];
      const data = [
        ['Total de Views', String(summary.totalViews)],
        ['Total de Cliques', String(summary.totalClicks)],
        ['Seguidores', String(summary.totalFollowers)],
        ['Curtidas', String(summary.totalFavorites)],
        ['Avaliação Média', String(summary.avgRating)],
        ['Total de Avaliações', String(summary.totalRatings)],
      ];
      exportToPDF(headers, data, `BI_Summary_${workspaceId}`, `Relatório de Inteligência - ${profile?.name || 'Loja'}`);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [summaryData, productsData, ratingsRes] = await Promise.all([
          getStoreSummary(workspaceId),
          getTopProducts(workspaceId),
          supabase.from('store_ratings').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(3)
        ]);
        
        setSummary(summaryData);
        if (ratingsRes.data) setRecentRatings(ratingsRes.data);

        // Cruzando os IDs dos produtos com os nomes no portfolio para o gráfico
        if (profile?.portfolio && Array.isArray(productsData)) {
          const enrichedProducts = productsData.map(p => {
            const portfolioItem = profile.portfolio.find(i => i.id === p.productId);
            return {
              ...p,
              productName: portfolioItem ? portfolioItem.name : 'Excluído'
            };
          }).filter(p => p.productName !== 'Excluído');
          setTopProducts(enrichedProducts.slice(0, 5)); // Apenas Top 5
        }
      } catch (e) {
        console.error("[Insights] Error fetching data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workspaceId, getStoreSummary, getTopProducts, profile]);

  const conversionRate = useMemo(() => {
    if (!summary || summary.totalViews === 0) return 0;
    return ((summary.totalClicks / summary.totalViews) * 100).toFixed(1);
  }, [summary]);

  const topCustomers = useMemo(() => {
    const customerMap: Record<string, { name: string, total: number, count: number }> = {};
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    
    safeTransactions
      .filter(t => t.subCategory !== 'GASTOS' && !t.isPending && t.customerName)
      .forEach(t => {
        const name = t.customerName!;
        if (!customerMap[name]) {
          customerMap[name] = { name, total: 0, count: 0 };
        }
        customerMap[name].total += t.value;
        customerMap[name].count += 1;
      });

    return Object.values(customerMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [transactions]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-xs font-black uppercase tracking-widest">Carregando Inteligência...</p>
      </div>
    );
  }

  const kpis = [
    { label: 'Alcance', value: summary?.totalViews || 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Interesse', value: summary?.totalClicks || 0, icon: MousePointerClick, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { 
      label: 'Engajamento', 
      value: (summary?.totalFollowers || 0) + (summary?.totalFavorites || 0), 
      icon: Heart, 
      color: 'text-rose-500', 
      bg: 'bg-rose-50',
      sub: `${summary?.totalFollowers || 0} seg. / ${summary?.totalFavorites || 0} curtidas`
    },
    { label: 'Avaliação', value: summary?.avgRating || '0.0', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50', sub: `${summary?.totalRatings || 0} votos` }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER WITH EXPORT */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
         <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
               <BarChart3 className="text-indigo-600" size={24} />
               Painel de Inteligência
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Análise de performance e engajamento</p>
         </div>
         <div className="flex items-center gap-2">
            <button 
              onClick={() => handleExportBI('XLSX')}
              className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all flex items-center gap-2"
            >
               <FileSpreadsheet size={14} /> XLSX
            </button>
            <button 
              onClick={() => handleExportBI('PDF')}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center gap-2"
            >
               <Download size={14} /> PDF
            </button>
         </div>
      </div>
      
      {/* KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
             <div className={`w-10 h-10 ${kpi.bg} ${kpi.color} rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <kpi.icon size={20} />
             </div>
             <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{kpi.label}</p>
             <h4 className="text-xl font-black text-slate-800">{kpi.value}</h4>
             {kpi.sub && <p className="text-[8px] font-bold text-slate-400 mt-1">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* GRAPH: TOP CLICKS */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <div>
                 <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                    <TrendingUp className="text-emerald-500" size={18} />
                    Produtos "Queridinhos"
                 </h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Ranking de cliques na vitrine</p>
              </div>
           </div>

           <div className="h-64 w-full">
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="productName" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                      width={100}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800">
                               <p className="text-[10px] font-black uppercase">{payload[0].payload.productName}</p>
                               <p className="text-lg font-black">{payload[0].value} <span className="text-[10px] opacity-60">Cliques</span></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="clicks" radius={[0, 12, 12, 0]} barSize={24}>
                       {topProducts.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : index === 1 ? '#6366f1' : '#818cf8'} />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-3xl">
                   <ShoppingBag size={48} className="opacity-20 mb-2" />
                   <p className="text-[10px] font-black uppercase tracking-widest">Sem cliques registrados ainda</p>
                </div>
              )}
           </div>
        </div>

        {/* SIDE WIDGETS */}
        <div className="space-y-6">
           {/* CONVERSION WIDGET */}
           <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-900/20 relative overflow-hidden">
              <Sparkles className="absolute -top-4 -right-4 w-24 h-24 text-white/5 rotate-12" />
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-2">Taxa de Conversão</p>
              <h3 className="text-4xl font-black mb-2">{conversionRate}%</h3>
              <p className="text-xs text-indigo-100/60 font-medium leading-tight">Dos clientes que viram sua vitrine hoje, esta porcentagem clicou para ver um detalhe.</p>
              <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase py-2 px-4 bg-white/10 rounded-full w-fit">
                 <ArrowUpRight size={14} className="text-emerald-400" /> +2.4% vs ontem
              </div>
           </div>

           {/* COMPLAINTS ALERT */}
           {summary && summary.pendingReports > 0 ? (
             <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center animate-pulse">
                   <AlertCircle size={24} />
                </div>
                <div>
                   <h4 className="text-sm font-black text-rose-800 uppercase tracking-tight">Alerta de Crise</h4>
                   <p className="text-[10px] font-bold text-rose-600 uppercase mt-0.5">{summary.pendingReports} denúncias pendentes</p>
                </div>
             </div>
           ) : (
             <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center">
                   <Star size={24} />
                </div>
                <div>
                   <h4 className="text-sm font-black text-emerald-800 uppercase tracking-tight">Reputação Limpa</h4>
                   <p className="text-[10px] font-bold text-emerald-600 uppercase mt-0.5">Sem pendências ou denúncias</p>
                </div>
             </div>
           )}
        </div>

      </div>

      {/* ADVANCED BI: CUSTOMERS & FEEDBACK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         
         {/* TOP CUSTOMERS (LOYALTY) */}
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-6">
               <Sparkles className="text-amber-500" size={18} />
               Ranking de Fidelidade (VIPS)
            </h3>
            
            <div className="space-y-4">
               {topCustomers.length > 0 ? (
                 topCustomers.map((customer, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-indigo-50 hover:border-indigo-100 transition-all">
                      <div className="flex items-center gap-4">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-200 text-slate-500' : 'bg-orange-100 text-orange-600'}`}>
                            #{i + 1}
                         </div>
                         <div>
                            <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{customer.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{customer.count} Pedidos realizados</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-sm font-black text-slate-800">R$ {customer.total.toFixed(2)}</p>
                         <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Total Gasto</p>
                      </div>
                   </div>
                 ))
               ) : (
                 <div className="py-12 text-center text-slate-300">
                    <Users size={40} className="mx-auto mb-2 opacity-20" />
                    <p className="text-[10px] font-black uppercase">Dados de clientes insuficientes</p>
                 </div>
               )}
            </div>
         </div>

         {/* RECENT FEEDBACK FEED */}
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-6">
               <MessageCircle className="text-blue-500" size={18} />
               O que estão falando...
            </h3>

            <div className="space-y-4">
               {recentRatings.length > 0 ? (
                 recentRatings.map((rating, i) => (
                   <div key={i} className="p-5 bg-slate-50 rounded-[1.8rem] border border-slate-100 border-l-4 border-l-blue-500 relative">
                      <div className="flex items-center gap-1 mb-2">
                         {[...Array(5)].map((_, starIdx) => (
                           <Star 
                             key={starIdx} 
                             size={10} 
                             className={starIdx < rating.stars ? "text-amber-500 fill-amber-500" : "text-slate-200"} 
                           />
                         ))}
                      </div>
                      <p className="text-xs text-slate-700 italic font-medium leading-relaxed">
                         "{rating.comment || 'O cliente não deixou um comentário, apenas avaliou.'}"
                      </p>
                      <div className="mt-4 flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Avaliação Real</span>
                         <span className="text-[8px] font-bold text-slate-300">{new Date(rating.created_at || '').toLocaleDateString('pt-BR')}</span>
                      </div>
                   </div>
                 ))
               ) : (
                 <div className="py-12 text-center text-slate-300">
                    <Star size={40} className="mx-auto mb-2 opacity-20" />
                    <p className="text-[10px] font-black uppercase">Nenhuma avaliação recente</p>
                 </div>
               )}
            </div>
         </div>

      </div>
    </div>
  );
};
