
import React from 'react';
import { PeriodTotals } from '../types';
import { PERIOD_LABELS } from '../constants';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface StatsCardProps {
  title: string;
  totals: PeriodTotals;
  type: 'income' | 'expense' | 'neutral';
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, totals, type }) => {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getIcon = () => {
    if (type === 'income') return <TrendingUp className="text-white w-5 h-5" />;
    if (type === 'expense') return <TrendingDown className="text-white w-5 h-5" />;
    return <DollarSign className="text-white w-5 h-5" />;
  };

  const getCardStyle = () => {
    if (type === 'income') return 'bg-emerald-600 text-white shadow-lg shadow-emerald-200';
    if (type === 'expense') return 'bg-rose-600 text-white shadow-lg shadow-rose-200';
    return 'bg-amber-600 text-white shadow-lg shadow-amber-200';
  };

  return (
    <div className={`p-6 rounded-[2rem] border-0 ${getCardStyle()} animate-in zoom-in-95 duration-500`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white/20 rounded-xl">
          {getIcon()}
        </div>
        <h3 className="font-black uppercase text-[10px] tracking-[0.2em] opacity-90">{title}</h3>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col">
          <span className="text-white/60 text-[8px] font-black uppercase mb-1">{PERIOD_LABELS.daily}</span>
          <span className="font-black text-sm">{formatCurrency(totals.daily)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-white/60 text-[8px] font-black uppercase mb-1">{PERIOD_LABELS.weekly}</span>
          <span className="font-black text-sm">{formatCurrency(totals.weekly)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-white/60 text-[8px] font-black uppercase mb-1">{PERIOD_LABELS.monthly}</span>
          <span className="font-black text-sm">{formatCurrency(totals.monthly)}</span>
        </div>
      </div>
    </div>
  );
};
