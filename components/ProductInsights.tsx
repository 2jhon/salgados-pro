import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { Package, Calendar, BarChart3, Clock, TrendingUp } from 'lucide-react';

interface ProductInsightsProps {
  transactions: Transaction[];
  title?: string;
  sectionName?: string;
}

export const ProductInsights: React.FC<ProductInsightsProps> = ({ transactions, title = 'Desempenho de Produtos', sectionName }) => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all'>('day');

  const productStats = useMemo(() => {
    const now = new Date();
    let startTime = 0;

    if (period === 'day') {
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(now.getDate() - now.getDay());
      d.setHours(0, 0, 0, 0);
      startTime = d.getTime();
    } else if (period === 'month') {
      startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    let filtered = period === 'all' ? transactions : transactions.filter(t => new Date(t.date).getTime() >= startTime);
    if (sectionName) {
      filtered = filtered.filter(t => t.category === sectionName);
    }

    const stats: Record<string, { quantity: number; revenue: number }> = {};

    filtered.forEach(t => {
      // Exclui auditorias e gastos
      if (t.subCategory === 'GASTOS' || (t.category || '').toUpperCase().trim() === 'AUDITORIA') return;
      
      // Conta apenas itens que foram de fato vendidos (receitas), incluindo pendentes ou pagas
      const itemName = t.item || 'Item Desconhecido';
      const itemUpper = itemName.toUpperCase();
      
      // Ignora recibos financeiros de contas a receber/pagar (já que o item original já foi contabilizado na data da respectiva venda)
      if (
        itemUpper.startsWith('RECEBIMENTO DE FIADO') ||
        itemUpper.startsWith('PGTO DE DÍVIDA') ||
        itemUpper.startsWith('PGTO DÍVIDA') ||
        itemUpper.startsWith('PGTO PARCIAL') ||
        itemUpper.startsWith('PAGAMENTO PARCIAL') ||
        itemUpper.includes('PAGAMENTO DE DIVIDA')
      ) {
        return;
      }

      if (!stats[itemName]) {
        stats[itemName] = { quantity: 0, revenue: 0 };
      }
      
      stats[itemName].quantity += (t.quantity || 1);
      stats[itemName].revenue += t.value;
    });

    return Object.entries(stats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [transactions, period]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 leading-tight">{title}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo de Vendas</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 flex-wrap sm:flex-nowrap rounded-2xl">
          {(['day', 'week', 'month', 'all'] as const).map(p => (
            <button 
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all ${period === p ? 'bg-white text-slate-800 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {p === 'day' ? 'Hoje' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Tudo'}
            </button>
          ))}
        </div>
      </div>

      {productStats.length === 0 ? (
        <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
          <Package className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm font-black uppercase tracking-widest">Nenhuma Venda neste período</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {productStats.map((stat, idx) => (
            <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-slate-300 group-hover:text-amber-500 transition-colors">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 text-sm leading-tight">{stat.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> {formatCurrency(stat.revenue)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-slate-800 tracking-tighter">
                  {stat.quantity}
                </div>
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                  Unidades
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
