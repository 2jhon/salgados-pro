import React from 'react';
import { Search, Flame } from 'lucide-react';
import { HotKeyword } from '../../hooks/useMarketIntelligence';

interface MarketplaceSearchProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  activeFilter: 'ALL' | 'STORES' | 'STALLS';
  setActiveFilter: (val: 'ALL' | 'STORES' | 'STALLS') => void;
  hotKeywords?: HotKeyword[];
}

export const MarketplaceSearch: React.FC<MarketplaceSearchProps> = ({ 
  searchTerm, 
  setSearchTerm, 
  activeFilter, 
  setActiveFilter,
  hotKeywords = []
}) => {
  return (
    <div className="bg-white p-6 rounded-b-[2.5rem] shadow-xl sticky top-0 z-20">
      <div className="relative mb-4">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="O QUE VOCÊ PROCURA?" 
          className="w-full p-5 pl-14 bg-slate-50 rounded-[1.8rem] font-bold text-xs uppercase outline-none focus:ring-4 focus:ring-blue-50 transition-all"
        />
      </div>

      {hotKeywords.length > 0 && !searchTerm && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Buscas em Alta</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {hotKeywords.map((hk, i) => (
              <button
                key={i}
                onClick={() => setSearchTerm(hk.keyword)}
                className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-[10px] font-bold tracking-wide hover:bg-orange-100 transition-colors"
              >
                {hk.keyword}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        <button 
          onClick={() => setActiveFilter('ALL')} 
          className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${activeFilter === 'ALL' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
        >
          Todos
        </button>
        <button 
          onClick={() => setActiveFilter('STORES')} 
          className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${activeFilter === 'STORES' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
        >
          Lojas
        </button>
        <button 
          onClick={() => setActiveFilter('STALLS')} 
          className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${activeFilter === 'STALLS' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
        >
          Barracas
        </button>
      </div>
    </div>
  );
};
