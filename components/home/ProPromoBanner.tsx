
import React from 'react';
import { Sparkles, ArrowUpRight } from 'lucide-react';

interface ProPromoBannerProps {
  onNavigate: (tab: string) => void;
}

export const ProPromoBanner: React.FC<ProPromoBannerProps> = ({ onNavigate }) => {
  return (
    <button 
      onClick={() => {
        localStorage.setItem('settings_pending_tab', 'PLANOS');
        onNavigate('CONFIG');
      }}
      className="w-full p-6 bg-gradient-to-r from-indigo-600 to-blue-700 rounded-[2.5rem] text-white flex items-center justify-between group hover:shadow-2xl transition-all active:scale-95"
    >
      <div className="flex items-center gap-4">
        <div className="p-4 bg-white/20 rounded-2xl">
          <Sparkles className="w-6 h-6 text-yellow-400" />
        </div>
        <div className="text-left">
          <h4 className="font-black text-sm uppercase tracking-tight">Ative sua Vitrine Online</h4>
          <p className="text-[9px] font-black opacity-70 uppercase tracking-widest">Seja PRO por apenas R$ 34,90/mês</p>
        </div>
      </div>
      <ArrowUpRight className="w-6 h-6 opacity-40 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};
