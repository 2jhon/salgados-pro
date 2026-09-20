
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
    <div className="grid gap-4">
      <div className="flex items-center justify-between px-2">
        <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
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
              className={`group p-5 sm:p-7 rounded-[2.2rem] sm:rounded-[2.8rem] shadow-lg transition-all text-left relative overflow-hidden active:scale-95 border-0 ${data.color} text-white flex flex-col justify-between min-h-[110px] sm:min-h-[140px]`}
            >
              <div className="absolute -right-3 -bottom-3 sm:-right-4 sm:-bottom-4 opacity-15 group-hover:scale-110 transition-transform pointer-events-none">
                <Icon size={80} className="sm:w-28 sm:h-28" />
              </div>
              <div className="relative z-10">
                <h3 className="text-base sm:text-xl font-black mb-1 leading-tight tracking-tight">{data.label}</h3>
                <p className="text-[8px] sm:text-[9px] font-black opacity-75 uppercase tracking-wider flex items-center gap-1 leading-tight">
                  {data.desc} <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                </p>
              </div>
            </button>
          );
        })}
        
        {quickAccess.length === 0 && (
          <button 
            onClick={onOpenSelection}
            className="col-span-2 p-8 rounded-[2.5rem] border-4 border-dashed border-slate-200 text-slate-400 flex flex-col items-center justify-center gap-4 hover:border-indigo-300 hover:text-indigo-500 transition-all"
          >
            <Plus size={36} />
            <span className="text-xs font-black uppercase tracking-widest">Adicionar Atalhos</span>
          </button>
        )}
      </div>
    </div>
  );
};
