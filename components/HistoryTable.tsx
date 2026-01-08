

import React, { memo, useState } from 'react';
import { Transaction } from '../types';
import { Trash2, AlertTriangle, X, FileText } from 'lucide-react';

interface HistoryTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  title?: string;
}

export const HistoryTable: React.FC<HistoryTableProps> = memo(({ transactions, onDelete, title = "Histórico Recente" }) => {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  if (!transactions || transactions.length === 0) {
    return (
      <div className="mt-6 text-center p-8 bg-white rounded-xl border border-dashed border-slate-300">
        <p className="text-slate-500">Nenhum registro encontrado.</p>
      </div>
    );
  }

  const handleDelete = (id: string) => {
    onDelete(id);
    setDeleteConfirm(null);
  };

  const formatCurrency = (val: number | undefined | null) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val ?? 0);

  const formatDate = (input: any) => {
    try {
      if (!input) return { date: '—', time: '--:--' };
      
      let d: Date;
      if (input?.toDate && typeof input.toDate === 'function') {
        d = input.toDate();
      } else {
        d = new Date(input);
      }

      if (isNaN(d.getTime())) return { date: 'Data Inválida', time: '--:--' };
      
      return {
        date: d.toLocaleDateString('pt-BR'),
        time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
    } catch {
      return { date: 'Erro', time: '--:--' };
    }
  };

  return (
    <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-semibold text-slate-700">{title}</h3>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
          {transactions.length} registros
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Item</th>
              <th className="px-4 py-3 font-semibold">Detalhes</th>
              <th className="px-4 py-3 font-semibold text-right">Valor</th>
              <th className="px-4 py-3 font-semibold text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const safeId = t.id ? String(t.id) : null;
              if (!safeId) return null;

              const { date, time } = formatDate(t.date);
              
              // Verifica se é registro de auditoria
              const isAudit = t.category === 'AUDITORIA';

              // Se é pendente e não é gasto, é a receber. Se é pendente e gasto, é a pagar.
              const isReceivable = !isAudit && t.isPending && t.subCategory !== 'GASTOS';
              const isPayable = !isAudit && t.isPending && t.subCategory === 'GASTOS';
              const isExpense = !isAudit && t.subCategory === 'GASTOS';

              return (
                <tr 
                  key={safeId} 
                  className={`border-b border-slate-50 last:border-b-0 transition-colors ${
                    isAudit ? 'bg-amber-50/30 hover:bg-amber-50' :
                    isReceivable ? 'bg-orange-50/50 hover:bg-orange-50' : 
                    isPayable ? 'bg-red-50/50 hover:bg-red-50' : 
                    'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {date} <span className="text-xs text-slate-400 ml-1">{time}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {isAudit ? (
                      <span className="flex items-center gap-2 text-amber-700 font-bold uppercase text-xs">
                        <FileText className="w-3 h-3" /> {t.item}
                      </span>
                    ) : (
                      t.item || <span className="text-slate-400 italic">Sem nome</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {isAudit ? (
                      <span className="font-mono text-[10px] text-amber-600 block max-w-[200px] truncate" title={t.customerName}>
                        {t.customerName}
                      </span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {t.quantity ? <span>Qtd: {t.quantity}</span> : null}
                        {t.isPending && (
                          <span className={`font-black uppercase text-[8px] tracking-widest ${isReceivable ? 'text-orange-600' : 'text-red-600'}`}>
                            {isReceivable ? 'A Receber' : 'A Pagar (Dívida)'}
                          </span>
                        )}
                        {t.customerName && (
                          <span className="text-slate-700 font-bold">
                            {isExpense ? 'Fornecedor' : 'Cliente'}: {t.customerName}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${isAudit ? 'text-slate-400' : isReceivable ? 'text-orange-600' : isPayable ? 'text-red-600' : 'text-slate-700'}`}>
                    {isAudit ? '-' : formatCurrency(t.value)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => setDeleteConfirm(safeId)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all focus:outline-none"
                      aria-label="Excluir registro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="bg-red-100 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Excluir Registro?</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Esta ação é permanente e removerá este lançamento do banco de dados.
              </p>
            </div>
            <div className="flex p-4 gap-3 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-4 bg-white text-slate-400 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-slate-200"
              >
                Manter
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-4 bg-red-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg shadow-red-900/20"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});