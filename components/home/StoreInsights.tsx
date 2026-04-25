import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, History, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Transaction, AppSection, User } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface StoreInsightsProps {
  transactions: Transaction[]; // Still kept for fallback or other uses if needed
  sections: AppSection[];
  archives: AppSection[];
  user: User;
  financialInsights?: any[];
}

export const StoreInsights: React.FC<StoreInsightsProps> = ({
  transactions,
  sections,
  archives,
  user,
  financialInsights = []
}) => {
  const isOwner = user.role === 'OWNER';

  const stats = useMemo(() => {
    const dataSource = (financialInsights && financialInsights.length > 0) ? financialInsights : (transactions || []);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayTrans = dataSource.filter(t => new Date(t.date).getTime() >= startOfDay);
    const sales = todayTrans.filter(t => t.sub_category !== 'GASTOS' && t.subCategory !== 'GASTOS' && !t.isPending && !t.is_pending).reduce((acc, t) => acc + t.value, 0);
    const expenses = todayTrans.filter(t => (t.sub_category === 'GASTOS' || t.subCategory === 'GASTOS') && !t.isPending && !t.is_pending).reduce((acc, t) => acc + t.value, 0);
    
    return { sales, expenses };
  }, [transactions, financialInsights]);

  const chartData = useMemo(() => {
    const dataSource = (financialInsights && financialInsights.length > 0) ? financialInsights : (transactions || []);
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const startOfDay = d.getTime();
      const endOfDay = startOfDay + 86400000;
      
      const dayTrans = dataSource.filter(t => {
        const txTime = new Date(t.date).getTime();
        return txTime >= startOfDay && txTime < endOfDay && !(t.isPending || t.is_pending);
      });
      
      const sales = dayTrans.filter(t => t.sub_category !== 'GASTOS' && t.subCategory !== 'GASTOS').reduce((acc, t) => acc + t.value, 0);
      const expenses = dayTrans.filter(t => t.sub_category === 'GASTOS' || t.subCategory === 'GASTOS').reduce((acc, t) => acc + t.value, 0);
      
      days.push({
        name: d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase(),
        Vendas: sales,
        Gastos: expenses
      });
    }
    return days;
  }, [transactions, financialInsights]);

  const [selectedArchiveYear, setSelectedArchiveYear] = useState<string | null>(null);

  const archiveChartData = useMemo(() => {
    if (archives.length === 0) return null;
    
    const archive = selectedArchiveYear 
      ? archives.find(a => a.name.includes(selectedArchiveYear))
      : archives[0];
      
    if (!archive) return null;

    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    return archive.items.map((item, idx) => ({
      name: months[idx] || item.name,
      Vendas: item.defaultPriceAVista || 0,
      Gastos: item.defaultPriceAPrazo || 0
    }));
  }, [archives, selectedArchiveYear]);

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
        <div className="bg-emerald-600 p-6 rounded-[2.5rem] shadow-xl shadow-emerald-900/10 text-white relative overflow-hidden group">
          <TrendingUp className="w-12 h-12 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-125 transition-transform" />
          <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Vendas Hoje</span>
          <p className="text-2xl font-black mt-1">{formatCurrency(stats.sales)}</p>
        </div>
        <div className="bg-rose-600 p-6 rounded-[2.5rem] shadow-xl shadow-rose-900/10 text-white relative overflow-hidden group">
          <TrendingDown className="w-12 h-12 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-125 transition-transform" />
          <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Gastos Hoje</span>
          <p className="text-2xl font-black mt-1">{formatCurrency(stats.expenses)}</p>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Vendas vs Gastos (7 Dias)</h3>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
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
            {archives.length > 1 && (
              <select 
                value={selectedArchiveYear || ''} 
                onChange={(e) => setSelectedArchiveYear(e.target.value)}
                className="bg-slate-50 border-none text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-2 outline-none"
              >
                {archives.map(a => {
                  const year = a.name.replace('Resumo ', '');
                  return <option key={a.id} value={year}>{year}</option>;
                })}
              </select>
            )}
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
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
