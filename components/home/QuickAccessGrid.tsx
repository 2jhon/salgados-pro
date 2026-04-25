
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

      <div className="grid sm:grid-cols-2 gap-4">
        {quickAccess.map(id => {
          const data = getBigButtonData(id);
          const Icon = data.icon;
          return (
            <button 
              key={id} 
              onClick={() => onNavigate(id)} 
              className={`group p-8 rounded-[3rem] shadow-xl transition-all text-left relative overflow-hidden active:scale-95 border-0 ${data.color} text-white`}
            >
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                <Icon size={120} />
              </div>
              <h3 className="text-2xl font-black mb-1">{data.label}</h3>
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest flex items-center gap-2">
                {data.desc} <ArrowUpRight className="w-4 h-4" />
              </p>
            </button>
          );
        })}
        
        {quickAccess.length === 0 && (
          <button 
            onClick={onOpenSelection}
            className="p-8 rounded-[3rem] border-4 border-dashed border-slate-200 text-slate-400 flex flex-col items-center justify-center gap-4 hover:border-indigo-300 hover:text-indigo-500 transition-all"
          >
            <Plus size={40} />
            <span className="text-xs font-black uppercase tracking-widest">Adicionar Atalhos</span>
          </button>
        )}
      </div>
    </div>
  );
};
