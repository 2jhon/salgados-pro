import React from 'react';
import { X, ShoppingBag, ArrowRight } from 'lucide-react';
import { StoreProfile } from '../../types';

interface StoryViewerModalProps {
  activeStory: { profile: StoreProfile; items: any[]; currentIndex: number } | null;
  setActiveStory: React.Dispatch<React.SetStateAction<{ profile: StoreProfile; items: any[]; currentIndex: number } | null>>;
  handlePrevStory: () => void;
  handleNextStory: () => void;
  handleStoryAction: () => void;
  getStoreDisplayName: (profile: StoreProfile) => string;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  activeStory,
  setActiveStory,
  handlePrevStory,
  handleNextStory,
  handleStoryAction,
  getStoreDisplayName,
}) => {
  if (!activeStory) return null;

  const currentStoryItem = activeStory.items[activeStory.currentIndex];
  if (!currentStoryItem) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col animate-in fade-in duration-200">
        {/* Progress Bars */}
        <div className="absolute top-0 left-0 right-0 p-2 flex gap-1 z-20">
            {activeStory.items.map((_, idx) => (
                <div key={idx} className="h-1 bg-white/30 flex-1 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-white ${
                          idx < activeStory.currentIndex ? 'w-full' : 
                          idx === activeStory.currentIndex ? '' : 'w-0'
                      }`}
                      style={idx === activeStory.currentIndex ? { 
                          width: '0%', 
                          animation: 'progress 5s linear forwards' 
                      } : {}}
                    />
                </div>
            ))}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-0 right-0 p-4 flex justify-between items-center z-20 mt-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden bg-slate-900">
                    {activeStory.profile.logoUrl ? (
                      <img src={activeStory.profile.logoUrl} className="w-full h-full object-cover"/>
                    ) : (
                      <div className="flex items-center justify-center h-full text-white font-black">
                        {getStoreDisplayName(activeStory.profile).charAt(0)}
                      </div>
                    )}
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-white text-sm shadow-black drop-shadow-md leading-none">{getStoreDisplayName(activeStory.profile)}</span>
                  <span className="text-[8px] font-bold text-white/70 uppercase tracking-widest shadow-black drop-shadow-sm">
                      {activeStory.currentIndex + 1} de {activeStory.items.length}
                  </span>
                </div>
            </div>
            <button onClick={() => setActiveStory(null)} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white">
                <X size={24} />
            </button>
        </div>

        {/* Main Content & Navigation Zones */}
        <div className="flex-1 relative flex items-center justify-center bg-slate-900">
            {currentStoryItem.imageUrl ? (
                <img src={currentStoryItem.imageUrl} className="w-full h-full object-cover opacity-90" />
            ) : (
                <div className="text-white opacity-20"><ShoppingBag size={64} /></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 pointer-events-none" />
            
            {/* Tap Zones for Navigation */}
            <div className="absolute inset-0 flex z-10">
                <div className="w-1/3 h-full" onClick={handlePrevStory} />
                <div className="w-2/3 h-full" onClick={handleNextStory} />
            </div>
        </div>

        {/* Footer Info */}
        <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 z-20 flex flex-col items-start gap-4 pointer-events-none">
            <div className="pointer-events-auto">
                <h2 className="text-3xl font-black text-white mb-2 leading-tight drop-shadow-xl">{currentStoryItem.name}</h2>
                <p className="text-white/80 font-medium text-sm line-clamp-3 mb-2 drop-shadow-md">{currentStoryItem.description}</p>
                <p className="text-2xl font-black text-emerald-400 drop-shadow-md">R$ {(currentStoryItem.price || 0).toFixed(2)}</p>
            </div>
            
            <button 
                onClick={handleStoryAction}
                className="w-full py-4 bg-white text-black rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 pointer-events-auto"
            >
                Eu Quero <ArrowRight size={16} />
            </button>
        </div>
    </div>
  );
};
