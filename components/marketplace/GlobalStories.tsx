import React from 'react';
import { Zap, ShoppingBag } from 'lucide-react';
import { StoreProfile } from '../../types';

interface GlobalStoriesProps {
  globalStories: { profile: StoreProfile; items: any[] }[];
  viewedStories: Set<string>;
  handleStoryClick: (data: { profile: StoreProfile; items: any[] }) => void;
  getStoreDisplayName: (profile: StoreProfile) => string;
  getStoryToken: (profileId: string, items: any[]) => string;
}

export const GlobalStories: React.FC<GlobalStoriesProps> = ({
  globalStories,
  viewedStories,
  handleStoryClick,
  getStoreDisplayName,
  getStoryToken
}) => {
  if (globalStories.length === 0) return null;

  return (
    <div className="pt-6 px-2">
      <div className="flex gap-2 items-center mb-4 px-2">
        <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destaques do Dia</h3>
      </div>
      <div className="overflow-x-auto no-scrollbar pb-4 -mx-2 px-2">
        <div className="flex gap-4">
          {globalStories.map((storeData, i) => {
            const firstItem = storeData.items[0];
            const storyToken = getStoryToken(storeData.profile.id, storeData.items);
            const isViewed = viewedStories.has(storyToken);
            
            return (
              <button 
                key={`${storeData.profile.id}_${i}`}
                onClick={() => handleStoryClick(storeData)}
                className="flex flex-col items-center gap-2 group min-w-[70px]"
              >
                <div className={`w-16 h-16 rounded-full p-[3px] transition-all animate-in zoom-in-50 duration-500 ${isViewed ? 'bg-slate-300' : 'bg-gradient-to-tr from-amber-400 to-rose-600'}`}>
                  <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-slate-100 relative">
                    {firstItem.imageUrl ? (
                      <img src={firstItem.imageUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-200">
                        <ShoppingBag size={20} className="text-slate-400" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <p className={`text-[9px] font-bold leading-tight line-clamp-1 w-20 truncate ${isViewed ? 'text-slate-400' : 'text-slate-700'}`}>{getStoreDisplayName(storeData.profile)}</p>
                  {storeData.items.length > 1 && (
                    <p className="text-[7px] font-black text-slate-400 uppercase truncate w-20">
                      {storeData.items.length} itens
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
