import React, { useMemo, useState, useEffect } from 'react';
import { 
  Megaphone, 
  CheckCircle, 
  Store, 
  ArrowUpRight,
  AlertTriangle 
} from 'lucide-react';
import { Ad, User } from '../../types';

interface AdBannerSliderProps {
  ads: Ad[];
  user: User;
  isPro: boolean;
  isAdFree: boolean;
  isAdvertiser: boolean;
  onNavigate: (tab: string) => void;
  incrementClick: (adId: string) => Promise<void>;
  setReportTarget: (workspaceId: string) => void;
}

export const AdBannerSlider: React.FC<AdBannerSliderProps> = ({ 
  ads, 
  user, 
  isPro, 
  isAdFree, 
  isAdvertiser, 
  onNavigate,
  incrementClick,
  setReportTarget 
}) => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [timeTick, setTimeTick] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setTimeTick(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredAds = useMemo(() => {
    const now = timeTick; 

    return ads.filter(ad => {
      const isMyAd = ad.ownerId === user.id;
      
      if (!ad.active) return false;
      
      if (ad.expiresAt) {
        const expirationTime = new Date(ad.expiresAt).getTime();
        if (expirationTime <= now) return false;
      }

      if ((isAdFree || isPro) && !isMyAd && !isAdvertiser) return false;

      return true;
    });
  }, [ads, isAdFree, isPro, isAdvertiser, timeTick, user.id]);

  useEffect(() => {
    if (filteredAds.length > 1) {
      const interval = setInterval(() => {
        setCurrentAdIndex(prev => (prev + 1) % filteredAds.length);
      }, 7000);
      return () => clearInterval(interval);
    } else {
      setCurrentAdIndex(0);
    }
  }, [filteredAds.length]);

  if (filteredAds.length === 0) return null;

  return (
    <div className="relative group">
      <div className="overflow-hidden rounded-[3rem] shadow-2xl border-[8px] border-white relative h-64 bg-slate-100">
        <div className="flex h-full transition-transform duration-1000" style={{ transform: `translateX(-${currentAdIndex * 100}%)` }}>
          {filteredAds.map((ad) => {
            const isMyAd = ad.ownerId === user.id;
            return (
              <div 
                key={ad.id} 
                onClick={() => {
                  incrementClick(ad.id);
                  ad.link === '#CONFIG' ? onNavigate('CONFIG') : window.open(ad.link, '_blank');
                }}
                className="w-full shrink-0 h-full relative cursor-pointer" 
                style={{ backgroundColor: ad.backgroundColor || '#f59e0b' }}
              >
                {ad.mediaUrl && <img src={ad.mediaUrl} className="w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-8 flex flex-col justify-end">
                   <div className="flex justify-between items-end">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                           {isMyAd ? (
                             <>
                               <CheckCircle className="w-3 h-3 text-emerald-400" />
                               <span className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.4em] block">Seu Anúncio Ativo</span>
                             </>
                           ) : (
                             <>
                               <Megaphone className="w-3 h-3 text-orange-400" />
                               <span className="text-[8px] font-black text-orange-400 uppercase tracking-[0.4em] block">Patrocinado</span>
                             </>
                           )}
                        </div>
                        <h3 className="text-2xl font-black text-white leading-tight drop-shadow-xl mb-1">{ad.title}</h3>
                        <p className="text-white/70 text-[10px] font-bold uppercase tracking-tight line-clamp-1">{ad.description}</p>
                        
                        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 w-full">
                          <div className="flex items-center gap-1.5">
                            <div className="bg-white/20 p-1 rounded-md">
                              <Store className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-[9px] font-black text-white uppercase tracking-widest">{ad.ownerName}</span>
                          </div>
                          {!isMyAd && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setReportTarget(ad.workspaceId);
                              }}
                              className="px-3 py-1.5 bg-rose-500/20 text-rose-300 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-rose-500/40 transition-colors flex items-center gap-1"
                            >
                              <AlertTriangle size={10} /> Denunciar
                            </button>
                          )}
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
