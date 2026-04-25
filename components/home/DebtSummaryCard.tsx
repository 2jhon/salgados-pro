
import React from 'react';
import { Wallet, Receipt, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { Transaction } from '../../types';

interface DebtSummaryCardProps {
  myDebts: Transaction[];
  totalDebt: number;
  onOpenNotes: (tab: 'PENDING' | 'HISTORY') => void;
}

export const DebtSummaryCard: React.FC<DebtSummaryCardProps> = ({ myDebts, totalDebt, onOpenNotes }) => {
  if (myDebts.length > 0) {
    return (
      <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-red-100 animate-in slide-in-from-top-4 relative overflow-hidden">
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-red-100 text-red-600 rounded-2xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">Conta em Aberto</h3>
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{myDebts.length} Itens pendentes</p>
            </div>
          </div>
          <p className="text-2xl font-black text-red-600">{formatCurrency(totalDebt)}</p>
        </div>
        
        <button 
          onClick={() => onOpenNotes('PENDING')}
          className="w-full py-4 bg-slate-900 text-white rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
        >
          <Receipt className="w-4 h-4" /> Minhas Notas (Detalhes)
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-emerald-50 animate-in slide-in-from-top-4 relative overflow-hidden">
      <div className="text-center py-6">
        <CheckCircle className="w-12 h-12 text-emerald-200 mx-auto mb-2" />
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Tudo em dia!</p>
        <button 
          onClick={() => onOpenNotes('HISTORY')}
          className="mt-4 px-6 py-2 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[9px] hover:bg-slate-200 transition-all"
        >
          Histórico
        </button>
      </div>
    </div>
  );
};
