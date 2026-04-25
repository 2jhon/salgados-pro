import React from 'react';
import { X, Loader2, Store, MapPin, Phone } from 'lucide-react';
import { StoreProfile, Transaction } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface NoteDetailsModalProps {
  selectedNoteGroup: Transaction[] | null;
  setSelectedNoteGroup: (group: Transaction[] | null) => void;
  loadingNote: boolean;
  noteStore: StoreProfile | null;
  calculateGroupTotal: (group: Transaction[]) => number;
}

export const NoteDetailsModal: React.FC<NoteDetailsModalProps> = ({
  selectedNoteGroup,
  setSelectedNoteGroup,
  loadingNote,
  noteStore,
  calculateGroupTotal
}) => {
  if (!selectedNoteGroup) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in">
        <div className="bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col shadow-3xl animate-in slide-in-from-bottom-10 relative">
            
            <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10 hidden sm:flex">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Detalhes do Pedido</h3>
                <button onClick={() => setSelectedNoteGroup(null)} className="p-2 bg-white rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 transition-all">
                    <X size={18} />
                </button>
            </header>

            {/* HEADER MOBILE COM FECHAMENTO SOBREPOSTO */}
            <div className="sm:hidden w-full flex justify-end p-4 absolute top-0 right-0 z-20">
                <button onClick={() => setSelectedNoteGroup(null)} className="p-3 bg-white/80 backdrop-blur-sm shadow-xl rounded-full text-slate-500 border border-slate-200">
                    <X size={20} />
                </button>
            </div>

            <div className="overflow-y-auto max-h-[80vh] sm:max-h-[70vh]">
                <div className="h-32 bg-slate-100 relative">
                    {noteStore?.bannerUrl ? (
                        <img src={noteStore.bannerUrl} className="w-full h-full object-cover opacity-80" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-indigo-500 to-purple-500 opacity-20" />
                    )}
                </div>
                
                <div className="p-8 space-y-6">
                {loadingNote ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Buscando dados da empresa...</p>
                    </div>
                ) : (
                    <>
                        <div className="text-center -mt-16 relative">
                            <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center overflow-hidden shadow-xl border border-slate-100 p-1">
                                <div className="w-full h-full bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center">
                                    {noteStore?.logoUrl ? (
                                        <img src={noteStore.logoUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <Store className="w-8 h-8 text-slate-300" />
                                    )}
                                </div>
                            </div>
                            <h2 className="text-xl font-black text-slate-800 uppercase leading-tight">{noteStore?.name || 'Empresa Parceira'}</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Origem do Lançamento</p>
                        </div>

                        <div className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Data</span>
                                <span className="text-xs font-bold text-slate-700">{new Date(selectedNoteGroup[0].date).toLocaleDateString('pt-BR')} <span className="text-[10px] text-slate-400">{new Date(selectedNoteGroup[0].date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span></span>
                            </div>
                            
                            <div className="space-y-3 py-2">
                                {selectedNoteGroup.map((item, idx) => (
                                <div key={item.id} className="flex justify-between items-start text-xs">
                                    <div>
                                        <p className="font-bold text-slate-700 uppercase">{item.item}</p>
                                        {item.quantity && <span className="text-[8px] font-black text-slate-400">Qtd: {item.quantity}</span>}
                                    </div>
                                    <p className="font-bold text-slate-600">{formatCurrency(item.value)}</p>
                                </div>
                                ))}
                            </div>

                            <div className="h-px bg-slate-200 my-2" />
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Valor Total</span>
                                <span className="text-xl font-black text-slate-800">{formatCurrency(calculateGroupTotal(selectedNoteGroup))}</span>
                            </div>
                        </div>

                        {noteStore && (
                            <div className="space-y-3">
                                {noteStore.address && (
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <MapPin className="w-4 h-4 text-orange-500" />
                                        <p className="text-[10px] font-bold uppercase">{noteStore.address}</p>
                                    </div>
                                )}
                                {noteStore.whatsapp && (
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <Phone className="w-4 h-4 text-emerald-500" />
                                        <p className="text-[10px] font-bold uppercase">{noteStore.whatsapp}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
                </div>
            </div>
        </div>
    </div>
  );
};
