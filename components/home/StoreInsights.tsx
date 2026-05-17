import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, History, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Transaction, AppSection, User } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface StoreInsightsProps {
  transactions: Transaction[]; // Still kept for fallback or other uses if needed
  sections: AppSection[];
  archives: AppSection[];
  user: User;
  financialInsights?: any[];
  historicalSummaries?: any[];
}

export const StoreInsights: React.FC<StoreInsightsProps> = ({
  transactions,
  sections,
  archives,
  user,
  financialInsights = [],
  historicalSummaries = []
}) => {
  const isOwner = user.role === 'OWNER';
  
  const [expandedCard, setExpandedCard] = useState<'sales' | 'expenses' | null>(null);

  const { stats, breakdowns } = React.useMemo(() => {
    // Merge historical BI data with current real-time transactions to ensure latest data is always visible
    // Deduplicate by ID to avoid double counting, prioritizing real-time transactions list which is already mapped
    const seenIds = new Set();
    const mergedData = [...(transactions || []), ...(financialInsights || [])].filter(t => {
      const id = String(t.id || `${t.date}-${t.value}`);
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    const dataSource = mergedData;
    const now = new Date();
    
    // Robust date filter that handles ISO strings and YYYY-MM-DD
    const todayTrans = dataSource.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      // Strictly use local day components to avoid mixing yesterday/today due to UTC shifts
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    });
    
    let sales = 0;
    let expenses = 0;
    
    const salesBreakdown: Record<string, number> = {};
    const expensesBreakdown: Record<string, number> = {};

    todayTrans.forEach(t => {
      if (t.isPending) return;

      const subCat = String(t.subCategory || (t as any).sub_category || '').toUpperCase();
      const isGasto = subCat === 'GASTOS';
      const isVenda = subCat === 'VENDAS';
      
      // Skip consolidation records to avoid double counting
      if (subCat === 'CONSOLIDADO') return;

      const val = Number(t.value) || 0;
      
      let rawSource = t.category || (t as any).category || '';
      
      if (!rawSource || rawSource.trim() === '' || rawSource.toUpperCase() === 'GERAL') {
        const creator = t.createdBy || (t as any).created_by;
        if (isVenda) {
          rawSource = creator || 'Venda';
        } else if (isGasto) {
          rawSource = creator || 'Gasto';
        } else {
          rawSource = creator || 'Operação';
        }
      }

      const part = String(rawSource).trim();

      if (isGasto) {
        expenses += val;
        expensesBreakdown[part] = (expensesBreakdown[part] || 0) + val;
      } else if (isVenda) {
        sales += val;
        salesBreakdown[part] = (salesBreakdown[part] || 0) + val;
      }
    });
    
    return { 
      stats: { sales, expenses },
      breakdowns: {
        sales: Object.entries(salesBreakdown).map(([k, v]) => ({ name: k, value: v })).sort((a,b) => b.value - a.value),
        expenses: Object.entries(expensesBreakdown).map(([k, v]) => ({ name: k, value: v })).sort((a,b) => b.value - a.value)
      }
    };
  }, [transactions, financialInsights]);

  const chartData = React.useMemo(() => {
    // Also merge for chart consistency, prioritizing transactions list
    const seenIds = new Set();
    const dataSource = [...(transactions || []), ...(financialInsights || [])].filter(t => {
      const id = String(t.id || `${t.date}-${t.value}`);
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      
      const dayTrans = dataSource.filter(t => {
        if (!t.date) return false;
        const txDate = new Date(t.date);
        return txDate.getFullYear() === d.getFullYear() &&
               txDate.getMonth() === d.getMonth() &&
               txDate.getDate() === d.getDate() && 
               !t.isPending;
      });
      
      const sales = dayTrans.filter(t => {
        const sc = String(t.subCategory || (t as any).sub_category || '').toUpperCase();
        return sc === 'VENDAS';
      }).reduce((acc, t) => acc + Number(t.value || 0), 0);
      
      const expenses = dayTrans.filter(t => {
        const sc = String(t.subCategory || (t as any).sub_category || '').toUpperCase();
        return sc === 'GASTOS';
      }).reduce((acc, t) => acc + Number(t.value || 0), 0);
      
      days.push({
        name: d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase(),
        Vendas: sales,
        Gastos: expenses
      });
    }
    return days;
  }, [transactions, financialInsights]);

  const [selectedArchiveYear, setSelectedArchiveYear] = useState<string | null>(null);

  // Unified archive tracker - combines legacy AppSections and new historical_summaries table
  const unifiedArchives = React.useMemo(() => {
    const list: { year: string, data: { name: string, Vendas: number, Gastos: number }[] }[] = [];
    
    // 1. New DB Summaries (Preferred)
    const years = Array.from(new Set(historicalSummaries.map(s => String(s.year))));
    years.forEach(year => {
      const yearData = historicalSummaries.filter(s => String(s.year) === year);
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const chartRows = months.map((m, idx) => {
        const monthItem = yearData.find(d => d.month === idx + 1);
        return {
          name: m,
          Vendas: Number(monthItem?.total_sales || 0),
          Gastos: Number(monthItem?.total_expenses || 0)
        };
      });
      list.push({ year, data: chartRows });
    });

    // 2. Legacy AppSections (Fallback/Compatibility)
    archives.forEach(a => {
      const year = a.name.replace('Resumo ', '');
      if (list.find(l => l.year === year)) return; // Avoid duplicates

      const monthsLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const chartRows = a.items.map((item, idx) => ({
        name: monthsLabels[idx] || item.name,
        Vendas: item.defaultPriceAVista || 0,
        Gastos: item.defaultPriceAPrazo || 0
      }));
      list.push({ year, data: chartRows });
    });

    return list.sort((a, b) => Number(b.year) - Number(a.year));
  }, [historicalSummaries, archives]);

  const archiveChartData = React.useMemo(() => {
    if (unifiedArchives.length === 0) return null;
    
    const entry = selectedArchiveYear 
      ? unifiedArchives.find(a => a.year === selectedArchiveYear)
      : unifiedArchives[0];
      
    return entry?.data || null;
  }, [unifiedArchives, selectedArchiveYear]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const vendas = payload.find((p: any) => p.dataKey === 'Vendas')?.value as number || 0;
      const gastos = payload.find((p: any) => p.dataKey === 'Gastos')?.value as number || 0;
      const saldo = vendas - gastos;

      return (
        <div className="bg-white p-4 rounded-[1.5rem] shadow-2xl border border-slate-100 min-w-[150px]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2 flex items-center gap-1">
            <Calendar size={12} /> {label}
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Vendas</span>
              <span className="text-xs font-black text-emerald-600">{formatCurrency(vendas)}</span>
            </div>
            <div className="flex items-center justify-between">
               <span className="text-[9px] font-bold text-slate-400 uppercase">Gastos</span>
               <span className="text-xs font-black text-rose-500">{formatCurrency(gastos)}</span>
            </div>
            <div className="pt-2 border-t border-slate-50 mt-2 flex items-center justify-between">
               <span className="text-[9px] font-black text-slate-800 uppercase">Resultado</span>
               <span className={`text-xs font-black ${saldo >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>
                 {saldo >= 0 ? '+' : ''}{formatCurrency(saldo)}
               </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!isOwner) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div 
          onClick={() => setExpandedCard(expandedCard === 'sales' ? null : 'sales')}
          className="bg-emerald-600 p-6 rounded-[2.5rem] shadow-xl shadow-emerald-900/10 text-white relative overflow-hidden group cursor-pointer transition-all active:scale-95"
        >
          <TrendingUp className="w-12 h-12 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Vendas Hoje</span>
            {breakdowns.sales.length > 0 && (
              expandedCard === 'sales' ? <ChevronUp size={14} className="opacity-70" /> : <ChevronDown size={14} className="opacity-70" />
            )}
          </div>
          <p className="text-2xl font-black mt-1 truncate">{formatCurrency(stats.sales)}</p>
          
          {expandedCard === 'sales' && breakdowns.sales.length > 0 && (
            <div className="mt-4 pt-4 border-t border-emerald-500/30 space-y-2 animate-in slide-in-from-top-2 fade-in duration-300 relative z-10">
               {breakdowns.sales.map((item, idx) => (
                 <div key={idx} className="flex items-center justify-between text-xs">
                   <span className="font-bold opacity-80 truncate pr-2 max-w-[70%]">{item.name}</span>
                   <span className="font-black">{formatCurrency(item.value)}</span>
                 </div>
               ))}
            </div>
          )}
        </div>
        <div 
           onClick={() => setExpandedCard(expandedCard === 'expenses' ? null : 'expenses')}
           className="bg-rose-600 p-6 rounded-[2.5rem] shadow-xl shadow-rose-900/10 text-white relative overflow-hidden group cursor-pointer transition-all active:scale-95"
        >
          <TrendingDown className="w-12 h-12 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
             <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Gastos Hoje</span>
             {breakdowns.expenses.length > 0 && (
                expandedCard === 'expenses' ? <ChevronUp size={14} className="opacity-70" /> : <ChevronDown size={14} className="opacity-70" />
             )}
          </div>
          <p className="text-2xl font-black mt-1 truncate">{formatCurrency(stats.expenses)}</p>

          {expandedCard === 'expenses' && breakdowns.expenses.length > 0 && (
            <div className="mt-4 pt-4 border-t border-rose-500/30 space-y-2 animate-in slide-in-from-top-2 fade-in duration-300 relative z-10">
               {breakdowns.expenses.map((item, idx) => (
                 <div key={idx} className="flex items-center justify-between text-xs">
                   <span className="font-bold opacity-80 truncate pr-2 max-w-[70%]">{item.name}</span>
                   <span className="font-black">{formatCurrency(item.value)}</span>
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Vendas vs Gastos (7 Dias)</h3>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={192} minWidth={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} tickFormatter={(value) => `R$${value}`} />
              <Tooltip 
                cursor={{ fill: '#f8fafc', radius: [4, 4, 0, 0] }}
                content={<CustomTooltip />}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 800, paddingTop: '10px' }} />
              <Bar dataKey="Vendas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Gastos" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {archiveChartData && (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Resumo Anual Arquivado</h3>
            </div>
            {unifiedArchives.length > 1 && (
              <select 
                value={selectedArchiveYear || (unifiedArchives[0]?.year || '')} 
                onChange={(e) => setSelectedArchiveYear(e.target.value)}
                className="bg-slate-50 border-none text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-2 outline-none"
              >
                {unifiedArchives.map(a => (
                  <option key={a.year} value={a.year}>{a.year}</option>
                ))}
              </select>
            )}
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={192} minWidth={200}>
              <BarChart data={archiveChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} tickFormatter={(value) => `R$${value}`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc', radius: [4, 4, 0, 0] }}
                  content={<CustomTooltip />}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 800, paddingTop: '10px' }} />
                <Bar dataKey="Vendas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Gastos" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] text-slate-400 text-center mt-6 font-bold uppercase tracking-widest">
            Dados consolidados para comparação anual
          </p>
        </div>
      )}
    </div>
  );
};
