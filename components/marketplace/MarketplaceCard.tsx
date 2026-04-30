import React from 'react';
import { Smartphone, Store, Navigation, Star, Heart, Flame, ChevronRight, Wand2 } from 'lucide-react';
import { StoreProfile } from '../../types';
import { TrendingItem, AffinityScore } from '../../hooks/useMarketIntelligence';

interface MarketplaceCardProps {
  item: any;
  userCoords: { lat: number; lng: number } | null;
  stores: StoreProfile[];
  storeRatings: Record<string, { average: number; count: number }>;
  userInteractions: { follows: string[]; favorites: string[]; ratings: any[] };
  getStoreDisplayName: (store: StoreProfile | null | undefined, fallback: string, prioritizeStoreName?: boolean) => string;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  onClick: (data: any) => void;
  trendingItems?: TrendingItem[];
  userAffinity?: AffinityScore[];
}

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({
  item,
  userCoords,
  stores,
  storeRatings,
  userInteractions,
  getStoreDisplayName,
  calculateDistance,
  onClick,
  trendingItems = [],
  userAffinity = []
}) => {
  const isStall = item.type === 'STALL';
  const data = item.data;
  const distance = userCoords && data.latitude && data.longitude ? calculateDistance(userCoords.lat, userCoords.lng, data.latitude, data.longitude) : null;
  const linkedProfile = isStall ? stores.find(p => p.workspaceId === data.workspaceId) : data;
  
  const displayName = getStoreDisplayName(linkedProfile, isStall ? (data.name || 'Barraca') : 'Loja Oficial', true);
  const displayImage = isStall ? (data.imageUrl || linkedProfile?.logoUrl) : data.logoUrl;
  
  const subTitle = isStall 
    ? (data.name && data.name !== 'Minha Barraca' ? data.name : 'Unidade Móvel / Barraca') 
    : (data.address && data.address !== 'Sem Endereço' ? data.address : 'Loja Oficial / Matriz');

  // Verifica se a loja está em alta
  const isTrending = trendingItems.some(t => t.workspace_id === data.workspaceId && t.engine_score > 10);
  const isRecommended = userAffinity.some(a => a.workspace_id === data.workspaceId && a.interaction_count >= 2);

  return (
    <button 
      onClick={() => onClick(data)}
      className="w-full bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-5 text-left group active:scale-95 transition-all relative overflow-hidden"
    >
      <div className="w-20 h-20 bg-slate-100 rounded-[1.8rem] overflow-hidden shrink-0 shadow-inner relative">
        {displayImage ? (
          <img src={displayImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            {isStall ? <Smartphone /> : <Store />}
          </div>
        )}
        {isTrending && !isRecommended && (
          <div className="absolute top-1 left-1 bg-orange-500 text-white rounded-full p-1 shadow-md">
            <Flame size={12} fill="currentColor" />
          </div>
        )}
        {isRecommended && (
          <div className="absolute top-1 left-1 bg-indigo-500 text-white rounded-full p-1 shadow-md ring-2 ring-white">
            <Wand2 size={12} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${isStall ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
            {isStall ? 'Barraca' : 'Loja Oficial'}
          </span>
          {isRecommended && (
            <span className="flex items-center gap-0.5 text-[8px] font-bold text-indigo-500 uppercase tracking-widest">
              Para Você
            </span>
          )}
          {isTrending && !isRecommended && (
            <span className="flex items-center gap-0.5 text-[8px] font-bold text-orange-500 uppercase tracking-widest">
              <Flame size={10} /> Em Alta
            </span>
          )}
          {distance !== null && !isTrending && !isRecommended && (
            <span className="flex items-center gap-1 text-[8px] font-bold text-slate-400">
              <Navigation size={10} /> {(distance || 0).toFixed(1)}km
            </span>
          )}
          {storeRatings[data.workspaceId] && storeRatings[data.workspaceId].count > 0 && (
            <span className="flex items-center gap-0.5 text-[8px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full">
              <Star size={8} className="fill-amber-500" /> {storeRatings[data.workspaceId].average.toFixed(1)}
            </span>
          )}
        </div>
        <h3 className="font-black text-slate-800 text-lg leading-tight truncate">{displayName}</h3>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[10px] font-bold text-slate-400 truncate">{subTitle}</p>
          {userInteractions.favorites.includes(data.workspaceId) && (
            <Heart size={12} className="fill-rose-500 text-rose-500 shrink-0" />
          )}
        </div>
      </div>
      <div className="p-3 bg-slate-50 text-slate-300 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
        <ChevronRight size={20} />
      </div>
    </button>
  );
};
