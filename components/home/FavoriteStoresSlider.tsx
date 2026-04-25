
import React from 'react';
import { Heart, Store, Star } from 'lucide-react';
import { StoreProfile } from '../../types';

interface FavoriteStoresSliderProps {
  favorites: string[];
  stores: StoreProfile[];
  storeRatings: Record<string, { average: number, count: number }>;
  getStoreDisplayName: (store: StoreProfile) => string;
  onNavigate: (tab: string) => void;
}

export const FavoriteStoresSlider: React.FC<FavoriteStoresSliderProps> = ({ 
  favorites, stores, storeRatings, getStoreDisplayName, onNavigate 
}) => {
  if (favorites.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
          <Heart size={16} className="text-rose-500 fill-rose-500" /> Minhas Lojas
        </h3>
        <button onClick={() => onNavigate('MARKETPLACE')} className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Ver Todas</button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar px-2">
        {Array.from(new Set(favorites)).map((workspaceId: string) => {
          const store = stores.find(s => s.workspaceId === workspaceId);
          if (!store || !store.active) return null;
          return (
            <button 
              key={workspaceId}
              onClick={() => onNavigate('MARKETPLACE')}
              className="snap-start shrink-0 w-40 bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 text-left active:scale-95 transition-all"
            >
              <div className="w-16 h-16 bg-slate-100 rounded-2xl mb-3 overflow-hidden shadow-inner mx-auto">
                {store.logoUrl ? (
                  <img src={store.logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Store size={24} />
                  </div>
                )}
              </div>
              <h4 className="font-black text-slate-800 text-sm truncate text-center">{getStoreDisplayName(store)}</h4>
              <div className="flex justify-center mt-1">
                {storeRatings[workspaceId] && storeRatings[workspaceId].count > 0 ? (
                  <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-500">
                    <Star size={10} className="fill-amber-500" /> {storeRatings[workspaceId].average.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-slate-400">Novo</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
