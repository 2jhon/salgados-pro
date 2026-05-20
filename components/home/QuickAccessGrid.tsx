
import React from 'react';
import { LayoutGrid, Plus, ArrowUpRight, Factory, Store, Package, Activity, Settings as SettingsIcon, ShoppingCart, Info } from 'lucide-react';

interface QuickOption {
  id: string;
  label: string;
  icon: any;
  color: string;
  desc: string;
}

interface QuickAccessGridProps {
  quickAccess: string[];
  onNavigate: (tab: string) => void;
  onOpenSelection: () => void;
  getBigButtonData: (id: string) => QuickOption;
}

export const QuickAccessGrid: React.FC<QuickAccessGridProps> = ({
  quickAccess,
  onNavigate,
  onOpenSelection,
  getBigButtonData
}) => {
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between px-2">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
          {quickAccess.length > 0 ? 'Acesso Rápido' : 'Personalize seu Início'}
        </h4>
        <button 
          onClick={onOpenSelection}
          className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90"
          title="Personalizar Painel"
        >
          <LayoutGrid size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {quickAccess.map(id => {
          const data = getBigButtonData(id);
          const Icon = data.icon;
          return (
            <button 
              key={id} 
              onClick={() => onNavigate(id)} 
              className={`group p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] shadow-xl transition-all text-left relative overflow-hidden active:scale-95 border-0 ${data.color} text-white flex flex-col justify-center`}
            >
              <div className="absolute -right-2 -bottom-2 sm:-right-4 sm:-bottom-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                <Icon className="w-20 h-20 sm:w-[120px] sm:h-[120px]" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black mb-1 sm:mb-1">{data.label}</h3>
              <p className="text-[8px] sm:text-[10px] font-black opacity-60 uppercase tracking-widest flex items-center gap-1 sm:gap-2">
                <span className="truncate">{data.desc}</span> <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
              </p>
            </button>
          );
        })}
        
        {quickAccess.length === 0 && (
          <button 
            onClick={onOpenSelection}
            className="col-span-2 p-8 rounded-[3rem] border-4 border-dashed border-slate-200 text-slate-400 flex flex-col items-center justify-center gap-4 hover:border-indigo-300 hover:text-indigo-500 transition-all min-h-[140px]"
          >
            <Plus size={40} />
            <span className="text-xs font-black uppercase tracking-widest">Adicionar Atalhos</span>
          </button>
        )}
      </div>
    </div>
  );
};
