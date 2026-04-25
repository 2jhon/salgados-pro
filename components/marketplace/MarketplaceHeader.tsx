import React from 'react';
import { LogOut, RefreshCw } from 'lucide-react';

interface MarketplaceHeaderProps {
  onLogout: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const MarketplaceHeader: React.FC<MarketplaceHeaderProps> = ({ onLogout, onRefresh, isRefreshing }) => {
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex-1">
        <h2 className="text-2xl font-black text-slate-800">Marketplace</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Encontre o melhor da região</p>
      </div>
      
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button 
            onClick={onRefresh} 
            disabled={isRefreshing}
            className={`p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all ${isRefreshing ? 'animate-pulse' : ''}`}
            title="Atualizar"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        )}
        
        <button 
          onClick={onLogout} 
          className="p-3 bg-slate-100 text-rose-500 rounded-2xl hover:bg-rose-50 transition-all"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
      </div>
    </div>
  );
};
