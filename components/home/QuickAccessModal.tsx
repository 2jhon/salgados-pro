import React from 'react';
import { X, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface QuickAccessModalProps {
  quickAccess: string[];
  setQuickAccess: React.Dispatch<React.SetStateAction<string[]>>;
  availableOptions: any[];
  setShowQuickAccessModal: (val: boolean) => void;
  saveQuickAccess: (selection: string[]) => void;
}

export const QuickAccessModal: React.FC<QuickAccessModalProps> = ({
  quickAccess,
  setQuickAccess,
  availableOptions,
  setShowQuickAccessModal,
  saveQuickAccess
}) => {
  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-3xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[80vh]">
        <header className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Personalizar Painel</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Escolha até 4 atalhos principais</p>
          </div>
          <button onClick={() => setShowQuickAccessModal(false)} className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            {availableOptions.map(option => {
              const isSelected = quickAccess.includes(option.id);
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    if (isSelected) {
                      setQuickAccess(prev => prev.filter(id => id !== option.id));
                    } else if (quickAccess.length < 4) {
                      setQuickAccess(prev => [...prev, option.id]);
                    } else {
                      toast.error("Você já escolheu 4 itens. Remova um para adicionar outro.");
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center gap-3 group ${
                    isSelected 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                    : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                    <Icon size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tight flex-1">{option.label}</span>
                  {isSelected ? <Check size={14} className="text-indigo-600" /> : <Plus size={14} className="text-slate-300" />}
                </button>
              );
            })}
          </div>
        </div>

        <footer className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
          <div className="flex gap-3">
            <button 
              onClick={() => setShowQuickAccessModal(false)}
              className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest"
            >
              Cancelar
            </button>
            <button 
              onClick={() => saveQuickAccess(quickAccess)}
              disabled={quickAccess.length === 0}
              className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
            >
              Salvar Alterações
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
