import React from 'react';
import { 
  Receipt, 
  X, 
  Calendar, 
  CheckCircle2, 
  History, 
  Clock, 
  Info, 
  Trash2,
  Loader2
} from 'lucide-react';
import { Transaction } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface MyNotesModalProps {
  setShowMyNotesModal: (show: boolean) => void;
  activeNoteTab: 'PENDING' | 'HISTORY';
  setActiveNoteTab: (tab: 'PENDING' | 'HISTORY') => void;
  myDebts: Transaction[];
  myHistory: Transaction[];
  totalDebt: number;
  debtsByDate: Record<string, Transaction[]>;
  historyByDate: Record<string, Transaction[]>;
  handleOpenNote: (group: Transaction[]) => void;
  handleDeleteHistoryItem: (e: React.MouseEvent, id: string) => void;
  visibleHistoryCount: number;
  loadMoreHistoryRef: (node: HTMLDivElement | null) => void;
  groupItemsByTime: (list: Transaction[]) => Transaction[][];
  calculateGroupTotal: (group: Transaction[]) => number;
  handlePayNote: (group: Transaction[]) => void;
  hasMoreTransactions: boolean;
  loadingTransactions: boolean;
}

export const MyNotesModal: React.FC<MyNotesModalProps> = ({
  setShowMyNotesModal,
  activeNoteTab,
  setActiveNoteTab,
  myDebts,
  myHistory,
  totalDebt,
  debtsByDate,
  historyByDate,
  handleOpenNote,
  handleDeleteHistoryItem,
  visibleHistoryCount,
  loadMoreHistoryRef,
  groupItemsByTime,
  calculateGroupTotal,
  handlePayNote,
  hasMoreTransactions,
  loadingTransactions
}) => {
  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom-20 duration-300">
       <header className="p-6 pt-12 bg-white rounded-b-[2.5rem] shadow-2xl relative z-10 shrink-0">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-slate-900 text-white rounded-2xl">
                  <Receipt className="w-6 h-6" />
               </div>
               <div>
                  <h2 className="text-xl font-black text-slate-800">Minhas Notas</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Seu Extrato Completo</p>
               </div>
            </div>
            <button onClick={() => setShowMyNotesModal(false)} className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all">
               <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl">
             <button 
               onClick={() => setActiveNoteTab('PENDING')} 
               className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeNoteTab === 'PENDING' ? 'bg-white shadow-md text-red-600' : 'text-slate-400'}`}
             >
               Em Aberto
             </button>
             <button 
               onClick={() => setActiveNoteTab('HISTORY')} 
               className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeNoteTab === 'HISTORY' ? 'bg-white shadow-md text-slate-800' : 'text-slate-400'}`}
             >
               Histórico
             </button>
          </div>
       </header>

       <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-6">
          {activeNoteTab === 'PENDING' && (
            <>
              {myDebts.length > 0 ? (
                <>
                  <div className="bg-red-500 p-8 rounded-[3rem] text-white shadow-xl shadow-red-900/20 text-center">
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">Total Pendente</p>
                     <p className="text-4xl font-black">{formatCurrency(totalDebt)}</p>
                  </div>

                  <div className="space-y-4">
                     {Object.entries(debtsByDate).map(([date, items]: [string, Transaction[]]) => (
                        <div key={date} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
                           <div className="flex items-center gap-2 mb-4 text-slate-400">
                              <Calendar className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">{date}</span>
                           </div>
                           <div className="space-y-4">
                              {groupItemsByTime(items).map(group => {
                                   const noteTotal = calculateGroupTotal(group);
                                   const firstItem = group[0];
                                   const isMultiItem = group.length > 1;
                                   const isExt = group.some(i => i.isExternal);
                                   
                                   return (
                                     <div key={firstItem.id} className="w-full flex items-start gap-3 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                        <button 
                                           onClick={() => handleOpenNote(group)}
                                           className="flex-1 text-left flex justify-between items-start hover:bg-slate-50 transition-colors rounded-xl p-2 -my-2 active:scale-[0.98]"
                                        >
                                           <div>
                                              <div className="flex items-center gap-2">
                                                 <p className="font-black uppercase text-slate-800">
                                                    {isMultiItem ? `Pedido com ${group.length} itens` : firstItem.item}
                                                 </p>
                                                 {isExt && (
                                                     <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${firstItem.subCategory === 'GASTOS' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                        {firstItem.subCategory === 'GASTOS' ? 'A Receber' : 'A Pagar'}
                                                     </span>
                                                  )}
                                              </div>
                                              
                                              <div className="flex flex-col gap-0.5 mt-1">
                                                 <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">{firstItem.customerName}</span>
                                                 {isMultiItem ? (
                                                   <span className="text-[8px] font-bold text-slate-500 uppercase flex flex-wrap gap-1">
                                                      {group.slice(0, 2).map(i => i.item).join(', ')} {group.length > 2 && '...'}
                                                   </span>
                                                 ) : (
                                                   firstItem.quantity && <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-black w-fit">Qtd: {firstItem.quantity}</span>
                                                 )}
                                                 <span className="text-[8px] font-black text-slate-300 flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {new Date(firstItem.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                                 </span>
                                              </div>
                                           </div>
                                           <div className="flex items-center gap-2">
                                              <p className={`font-black ${firstItem.subCategory === 'GASTOS' && isExt ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(noteTotal)}</p>
                                              <Info className="w-4 h-4 text-slate-300" />
                                           </div>
                                        </button>
                                        <button 
                                           onClick={() => handlePayNote(group)} 
                                           className="bg-slate-900 text-[8px] font-black text-white px-3 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform"
                                        >
                                           PAGAR PIX
                                        </button>
                                     </div>
                                   );
                              })}
                           </div>
                        </div>
                     ))}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-20">
                   <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mb-6 border-2 border-white/10">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                   </div>
                   <h3 className="text-xl font-black text-white mb-2">Nenhuma Pendência</h3>
                   <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Você não possui notas em aberto.</p>
                </div>
              )}
            </>
          )}

          {activeNoteTab === 'HISTORY' && (
            <>
              {myHistory.length > 0 ? (
                <div className="space-y-4">
                   {Object.entries(historyByDate).map(([date, items]: [string, Transaction[]]) => (
                      <div key={date} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
                         <div className="flex items-center gap-2 mb-4 text-slate-400">
                            <Calendar className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{date}</span>
                         </div>
                         <div className="space-y-4">
                            {groupItemsByTime(items).map(group => {
                                 const noteTotal = calculateGroupTotal(group);
                                 const firstItem = group[0];
                                 const isMultiItem = group.length > 1;
                                 
                                 return (
                                   <div key={firstItem.id} className="w-full flex items-start gap-3 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                      <button 
                                         onClick={() => handleOpenNote(group)}
                                         className="flex-1 text-left flex justify-between items-start hover:bg-slate-50 transition-colors rounded-xl p-2 -my-2 active:scale-[0.98]"
                                      >
                                         <div>
                                            {isMultiItem ? (
                                              <p className="font-black uppercase text-slate-700 flex items-center gap-2">
                                                Pedido com {group.length} itens
                                              </p>
                                            ) : (
                                              <p className="font-black uppercase text-slate-700">{firstItem.item}</p>
                                            )}
                                            
                                            <div className="flex flex-col gap-0.5 mt-1">
                                               <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                                                  <CheckCircle2 size={10} className="text-emerald-500" /> Pago / Finalizado
                                               </span>
                                               <span className="text-[8px] font-black text-slate-300 flex items-center gap-1">
                                                  <Clock size={10} />
                                                  {new Date(firstItem.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                               </span>
                                            </div>
                                         </div>
                                         <div className="flex items-center gap-2">
                                            <p className="font-black text-slate-600">{formatCurrency(noteTotal)}</p>
                                         </div>
                                      </button>
                                      
                                      <button 
                                        onClick={(e) => handleDeleteHistoryItem(e, firstItem.id)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        title="Excluir do Histórico"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                   </div>
                                 );
                            })}
                         </div>
                      </div>
                   ))}
                    {(visibleHistoryCount < myHistory.length || hasMoreTransactions) && (
                       <div ref={loadMoreHistoryRef} className="h-20 flex flex-col items-center justify-center gap-2">
                          <Loader2 className={`animate-spin text-slate-300 w-8 h-8 ${loadingTransactions ? 'opacity-100' : 'opacity-30'}`} />
                          {loadingTransactions && <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Buscando mais notas...</p>}
                       </div>
                    )}
                 </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-20">
                   <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mb-6 border-2 border-white/10">
                      <History size={40} className="text-slate-500" />
                   </div>
                   <h3 className="text-xl font-black text-white mb-2">Histórico Vazio</h3>
                   <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Nenhuma movimentação anterior encontrada.</p>
                </div>
              )}
            </>
          )}
       </div>
    </div>
  );
};
