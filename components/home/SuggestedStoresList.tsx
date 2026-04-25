
import React from 'react';
import { Sparkles, Star, Store, ChevronRight } from 'lucide-react';
import { StoreProfile } from '../../types';

interface SuggestedStoresListProps {
  stores: StoreProfile[];
  favorites: string[];
  storeRatings: Record<string, { average: number, count: number }>;
  getStoreDisplayName: (store: StoreProfile) => string;
  onNavigate: (tab: string) => void;
}

export const SuggestedStoresList: React.FC<SuggestedStoresListProps> = ({
  stores, favorites, storeRatings, getStoreDisplayName, onNavigate
}) => {
  const suggested = stores
    .filter(s => s.active && !favorites.includes(s.workspaceId))
    .sort((a, b) => {
      const ratingA = storeRatings[a.workspaceId]?.average || 0;
      const ratingB = storeRatings[b.workspaceId]?.average || 0;
      return ratingB - ratingA;
    })
    .slice(0, 3);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 px-2">
        <Sparkles size={16} className="text-amber-500" />
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Sugeridas para Você</h3>
      </div>
      <div className="space-y-3 px-2">
        {suggested.map(store => (
          <button 
            key={store.id}
            onClick={() => onNavigate('MARKETPLACE')}
            className="w-full bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4 text-left active:scale-95 transition-all"
          >
            <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden shrink-0">
              {store.logoUrl ? (
                <img src={store.logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Store size={20} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-slate-800 text-sm truncate">{getStoreDisplayName(store)}</h4>
              <p className="text-[10px] font-bold text-slate-400 truncate">{store.address || 'Loja Física'}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {storeRatings[store.workspaceId] && storeRatings[store.workspaceId].count > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Star size={10} className="fill-amber-500" /> {storeRatings[store.workspaceId].average.toFixed(1)}
                </span>
              )}
              <div className="p-2 bg-slate-50 text-slate-400 rounded-xl">
                <ChevronRight size={14} />
              </div>
            </div>
          </button>
        ))}
        {suggested.length === 0 && (
          <div className="text-center py-8 bg-slate-50 rounded-[2rem] border border-slate-100 border-dashed">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma sugestão no momento</p>
          </div>
        )}
      </div>
    </div>
  );
};
