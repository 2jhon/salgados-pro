import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StoreProfile, User, PortfolioItem } from '../types';
import { useStoreProfiles } from '../hooks/useStoreProfiles';
import { 
  Search, MapPin, Navigation, ShoppingBag, 
  MessageCircle, Star, Clock, ArrowLeft, 
  ChevronRight, Utensils, Info, Phone, RefreshCw, AlertCircle, Instagram, Facebook, Hash, Share2,
  X, ShoppingCart, CheckCircle2, LocateFixed
} from 'lucide-react';

interface MarketplaceProps {
  user: User;
  onLogout: () => void;
}

export const Marketplace: React.FC<MarketplaceProps> = ({ user, onLogout }) => {
  const { profiles, loading, fetchPublicProfiles } = useStoreProfiles();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreProfile | null>(null);
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [activeStory, setActiveStory] = useState<{ store: StoreProfile; items: PortfolioItem[] } | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  const initData = useCallback(() => {
    fetchPublicProfiles();
  }, [fetchPublicProfiles]);

  const requestGps = () => {
    if (navigator.geolocation) {
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsLoading(false);
        },
        (err) => {
          console.warn("GPS não capturado:", err.message);
          setGpsLoading(false);
        },
        { timeout: 8000, enableHighAccuracy: false }
      );
    }
  };

  useEffect(() => {
    initData();
  }, [initData]);

  // Story Auto-Advance Logic
  useEffect(() => {
    let interval: any;
    if (activeStory) {
      // Reinicia o timer sempre que o índice muda ou o story abre
      interval = setInterval(() => {
        setCurrentStoryIndex(prev => {
          if (prev < activeStory.items.length - 1) return prev + 1;
          return 0; // Loop
        });
      }, 4000); // 4 seconds per slide
    }
    return () => clearInterval(interval);
  }, [activeStory, currentStoryIndex]); // Adicionado currentStoryIndex na dependência para resetar o timer ao clicar

  // Reset index when opening a new story
  useEffect(() => {
    if (activeStory) {
      setCurrentStoryIndex(0);
    }
  }, [activeStory?.store.id]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const stories = useMemo(() => {
    const activeStories: { store: StoreProfile; items: PortfolioItem[] }[] = [];
    const now = Date.now();
    profiles.forEach(store => {
      if (!store.active) return;
      const highlightedItems = store.portfolio.filter(i => i.highlightExpiresAt && new Date(i.highlightExpiresAt).getTime() > now && i.available);
      if (highlightedItems.length > 0) {
        activeStories.push({ store, items: highlightedItems });
      }
    });
    // Randomize stories order slightly to give fair visibility or sort by name
    return activeStories.sort(() => Math.random() - 0.5);
  }, [profiles]);

  const filteredAndSortedStores = useMemo(() => {
    let list = profiles.filter(p => p.active);
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.description.toLowerCase().includes(term) ||
        p.address.toLowerCase().includes(term)
      );
    }

    if (!userCoords) return list;

    return [...list].sort((a, b) => {
      const distA = calculateDistance(userCoords.lat, userCoords.lng, a.latitude, a.longitude);
      const distB = calculateDistance(userCoords.lat, userCoords.lng, b.latitude, b.longitude);
      return distA - distB;
    });
  }, [profiles, searchTerm, userCoords]);

  const getWhatsAppLink = (phone: string, text: string) => {
    let cleanNumber = phone.replace(/\D/g, '');
    if (!cleanNumber.startsWith('55') && (cleanNumber.length === 10 || cleanNumber.length === 11)) {
      cleanNumber = '55' + cleanNumber;
    }
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
  };

  const handleOrder = (store: StoreProfile, item: PortfolioItem) => {
    const text = `Olá ${store.name}! Vi seu story no Salgados Pro e gostaria de pedir: ${item.name} (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}).`;
    window.open(getWhatsAppLink(store.whatsapp, text), '_blank');
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (selectedStore) {
    return (
      <div className="min-h-screen bg-slate-50 animate-in fade-in duration-300 pb-20">
        <div className="h-64 relative">
          {selectedStore.bannerUrl ? (
            <img src={selectedStore.bannerUrl} className="w-full h-full object-cover shadow-inner" alt="Banner" />
          ) : (
            <div className="w-full h-full bg-orange-500 flex items-center justify-center">
               <Utensils className="w-12 h-12 text-white/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <button onClick={() => setSelectedStore(null)} className="absolute top-6 left-6 p-4 bg-white/20 backdrop-blur-xl rounded-[1.5rem] text-white hover:bg-white/40 transition-all active:scale-95 shadow-lg border border-white/20">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="absolute bottom-6 left-6 right-6">
             <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white rounded-2xl p-1 shadow-2xl overflow-hidden shrink-0 border-2 border-orange-500/20">
                   {selectedStore.logoUrl ? <img src={selectedStore.logoUrl} className="w-full h-full object-cover rounded-xl" /> : <Utensils className="m-auto text-orange-200 mt-3" />}
                </div>
                <div>
                   <h2 className="text-3xl font-black text-white leading-tight drop-shadow-lg">{selectedStore.name}</h2>
                   <div className="flex flex-col gap-1">
                      <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-orange-400" /> {selectedStore.address || 'Endereço não informado'}
                      </p>
                      {selectedStore.cnpj && (
                        <p className="text-white/60 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                           <Hash className="w-2 h-2" /> CNPJ: {selectedStore.cnpj}
                        </p>
                      )}
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="p-6 space-y-8 max-w-2xl mx-auto">
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-green-100 text-green-600 rounded-2xl shadow-inner">
                      <MessageCircle className="w-6 h-6" />
                   </div>
                   <div className="hidden sm:block">
                      <h4 className="text-sm font-black text-slate-800">WhatsApp</h4>
                   </div>
                </div>
                <a href={getWhatsAppLink(selectedStore.whatsapp, `Olá ${selectedStore.name}!`)} target="_blank" className="p-5 bg-green-600 text-white rounded-[1.8rem] shadow-xl shadow-green-900/20 active:scale-95 transition-all">
                   <Phone className="w-5 h-5" />
                </a>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 flex items-center justify-center gap-4">
                 {selectedStore.instagram && (
                   <a href={`https://instagram.com/${selectedStore.instagram.replace('@', '')}`} target="_blank" className="p-4 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white rounded-2xl shadow-lg active:scale-90 transition-all">
                      <Instagram className="w-5 h-5" />
                   </a>
                 )}
                 {selectedStore.facebook && (
                   <a href={`https://facebook.com/${selectedStore.facebook.replace('/', '')}`} target="_blank" className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90 transition-all">
                      <Facebook className="w-5 h-5" />
                   </a>
                 )}
                 {!selectedStore.instagram && !selectedStore.facebook && (
                   <div className="text-slate-300 flex flex-col items-center">
                      <Share2 className="w-5 h-5" />
                      <span className="text-[8px] font-black uppercase">Social</span>
                   </div>
                 )}
              </div>
           </div>

           <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Cardápio da Loja</h3>
                 <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[8px] font-black uppercase">Disponível</span>
              </div>
              <div className="grid gap-4">
                 {selectedStore.portfolio.filter(i => i.available).length === 0 ? (
                   <div className="p-16 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                     <AlertCircle className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Nenhum produto em destaque<br/>nesta vitrine hoje.</p>
                   </div>
                 ) : (
                   selectedStore.portfolio.filter(i => i.available).map(item => (
                     <div 
                        key={item.id} 
                        onClick={() => setSelectedItem(item)}
                        className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-50 flex items-center gap-5 group cursor-pointer active:scale-[0.98] transition-all hover:border-orange-200 hover:shadow-md"
                     >
                        <div className="w-24 h-24 rounded-[1.8rem] overflow-hidden bg-slate-100 shrink-0 shadow-inner">
                           {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-8 h-8 text-slate-200" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{item.name}</h4>
                           <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">{item.description}</p>
                           <p className="text-orange-600 font-black text-xl mt-3">{formatCurrency(item.price)}</p>
                        </div>
                        <div className="p-4 bg-slate-50 text-slate-300 rounded-[1.5rem] group-hover:bg-orange-50 group-hover:text-orange-600 transition-all">
                           <ChevronRight className="w-5 h-5" />
                        </div>
                     </div>
                   ))
                 )}
              </div>
           </div>
        </div>

        {selectedItem && (
          <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-300">
             <div className="bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] shadow-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-20 duration-500 max-h-[90vh]">
                <div className="h-72 relative shrink-0">
                   {selectedItem.imageUrl ? (
                      <img src={selectedItem.imageUrl} className="w-full h-full object-cover" alt={selectedItem.name} />
                   ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                         <ShoppingBag className="w-20 h-20 text-slate-200" />
                      </div>
                   )}
                   <button 
                      onClick={() => setSelectedItem(null)} 
                      className="absolute top-6 right-6 p-3 bg-black/20 backdrop-blur-xl rounded-2xl text-white hover:bg-black/40 transition-all shadow-lg border border-white/20"
                   >
                      <X className="w-6 h-6" />
                   </button>
                </div>
                <div className="p-8 flex-1 overflow-y-auto no-scrollbar">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                         <span className="text-[9px] font-black text-orange-600 uppercase tracking-[0.3em] mb-1 block">Destaque da Casa</span>
                         <h3 className="text-2xl font-black text-slate-800 uppercase leading-tight">{selectedItem.name}</h3>
                      </div>
                      <div className="bg-orange-50 px-4 py-2 rounded-2xl">
                         <p className="text-orange-600 font-black text-xl">{formatCurrency(selectedItem.price)}</p>
                      </div>
                   </div>
                   <div className="h-px bg-slate-50 w-full mb-6" />
                   <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <Info className="w-3 h-3" /> Descrição Completa
                      </h4>
                      <p className="text-slate-600 font-medium leading-relaxed text-sm whitespace-pre-wrap">
                         {selectedItem.description || "Este item não possui uma descrição detalhada cadastrada."}
                      </p>
                   </div>
                   <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <div className="flex items-center gap-2 text-slate-400 mb-1">
                            <Clock className="w-3 h-3" />
                            <span className="text-[8px] font-black uppercase">Preparo</span>
                         </div>
                         <p className="text-[10px] font-bold text-slate-700 uppercase">Sob Encomenda</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <div className="flex items-center gap-2 text-slate-400 mb-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="text-[8px] font-black uppercase">Status</span>
                         </div>
                         <p className="text-[10px] font-bold text-emerald-600 uppercase">Disponível</p>
                      </div>
                   </div>
                </div>
                <footer className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                   <button onClick={() => setSelectedItem(null)} className="flex-1 py-5 bg-white border border-slate-200 text-slate-400 rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Voltar</button>
                   <button onClick={() => handleOrder(selectedStore, selectedItem)} className="flex-[2] py-5 bg-orange-600 text-white rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-orange-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4" /> Fazer Pedido</button>
                </footer>
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 animate-in fade-in duration-500 pb-24 font-sans">
      <header className="bg-white p-8 pt-16 rounded-b-[3.5rem] shadow-2xl border-b border-slate-100 mb-8 relative z-10">
         <div className="flex justify-between items-center mb-10">
            <div>
               <p className="text-orange-600 font-black uppercase text-[10px] tracking-[0.3em] leading-none mb-1">Marketplace</p>
               <h1 className="text-4xl font-black text-slate-800 tracking-tight">{(user.name || 'Cliente').split(' ')[0]}!</h1>
            </div>
            <div className="flex gap-2">
               <button onClick={initData} disabled={loading} className={`p-4 bg-slate-100 text-slate-500 rounded-[1.5rem] transition-all active:scale-90 ${loading ? 'animate-spin opacity-50' : 'hover:bg-orange-50 hover:text-orange-600'}`}>
                  <RefreshCw className="w-5 h-5" />
               </button>
               <button onClick={onLogout} className="p-4 bg-slate-100 text-slate-500 rounded-[1.5rem] hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90">
                  <ArrowLeft className="w-5 h-5" />
               </button>
            </div>
         </div>
         <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />
            <input 
               value={searchTerm} 
               onChange={e => setSearchTerm(e.target.value)} 
               placeholder="Buscar loja ou salgado..." 
               className="w-full p-6 pl-16 bg-slate-50 border-2 border-transparent rounded-[2rem] font-bold text-slate-700 focus:border-orange-500 focus:bg-white outline-none transition-all shadow-inner placeholder:text-slate-300" 
            />
         </div>

         {/* STORY BAR */}
         {stories.length > 0 && (
           <div className="mt-8 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 flex gap-4">
             {stories.map(({ store, items }, idx) => (
                <div key={store.id} className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setActiveStory({ store, items })}>
                   <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500">
                      <div className="w-16 h-16 rounded-full bg-white p-0.5 relative overflow-hidden group-active:scale-95 transition-transform">
                         {store.logoUrl ? <img src={store.logoUrl} className="w-full h-full object-cover rounded-full" /> : <div className="w-full h-full bg-slate-100 flex items-center justify-center"><Utensils className="w-6 h-6 text-slate-300" /></div>}
                      </div>
                      {/* Live Badge simulated */}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[6px] font-black uppercase px-1.5 py-0.5 rounded-full shadow-sm border border-white">
                        LIVE
                      </div>
                   </div>
                   <span className="text-[9px] font-bold text-slate-500 max-w-[70px] truncate text-center group-hover:text-slate-800 transition-colors">{store.name}</span>
                </div>
             ))}
           </div>
         )}
      </header>

      {/* STORY VIEWER MODAL */}
      {activeStory && (
        <div className="fixed inset-0 z-[500] bg-black flex flex-col animate-in fade-in duration-300">
           {/* Progress Bar with CSS Animation for robust timing */}
           <div className="flex gap-1 p-2 absolute top-0 left-0 right-0 z-20">
              <style>{`
                @keyframes story-progress {
                  from { width: 0%; }
                  to { width: 100%; }
                }
                .animate-story-progress {
                  animation: story-progress 4000ms linear forwards;
                }
              `}</style>
              {activeStory.items.map((_, idx) => (
                 <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-white ${
                        idx < currentStoryIndex ? 'w-full' : 
                        idx === currentStoryIndex ? 'animate-story-progress' : 
                        'w-0'
                      }`} 
                    />
                 </div>
              ))}
           </div>

           <div className="relative flex-1 flex flex-col">
              {/* Header */}
              <div className="p-4 pt-8 flex items-center justify-between z-20 text-white drop-shadow-md">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-white/50">
                       {activeStory.store.logoUrl ? <img src={activeStory.store.logoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white flex items-center justify-center"><Utensils className="text-slate-900 w-4 h-4" /></div>}
                    </div>
                    <div>
                       <h4 className="font-bold text-sm shadow-black drop-shadow-md">{activeStory.store.name}</h4>
                       <p className="text-[9px] font-medium opacity-80 shadow-black drop-shadow-md">{activeStory.store.address || 'Localização não informada'}</p>
                    </div>
                 </div>
                 <button onClick={() => setActiveStory(null)} className="p-2"><X className="w-6 h-6" /></button>
              </div>

              {/* Content Image */}
              <div className="absolute inset-0 z-0">
                 {activeStory.items[currentStoryIndex].imageUrl ? (
                    <img src={activeStory.items[currentStoryIndex].imageUrl} className="w-full h-full object-cover" />
                 ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-400 to-rose-600 flex items-center justify-center">
                       <ShoppingBag className="w-24 h-24 text-white/50" />
                    </div>
                 )}
                 <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90" />
              </div>

              {/* Navigation Tap Areas */}
              <div className="absolute inset-0 z-10 flex">
                 <div className="flex-1" onClick={() => setCurrentStoryIndex(prev => Math.max(0, prev - 1))} />
                 <div className="flex-1" onClick={() => setCurrentStoryIndex(prev => Math.min(activeStory.items.length - 1, prev + 1))} />
              </div>

              {/* Footer Details */}
              <div className="mt-auto p-8 z-20 pb-12">
                 <div className="mb-6">
                    <h2 className="text-3xl font-black text-white uppercase leading-tight drop-shadow-lg mb-2">{activeStory.items[currentStoryIndex].name}</h2>
                    <p className="text-white/80 text-sm font-medium line-clamp-2 drop-shadow-md mb-4">{activeStory.items[currentStoryIndex].description}</p>
                    <div className="inline-block bg-white text-slate-900 font-black px-4 py-2 rounded-xl text-xl shadow-lg">
                       {formatCurrency(activeStory.items[currentStoryIndex].price)}
                    </div>
                 </div>
                 
                 <button 
                   onClick={() => handleOrder(activeStory.store, activeStory.items[currentStoryIndex])}
                   className="w-full py-5 bg-emerald-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all"
                 >
                    <MessageCircle className="w-5 h-5" /> Eu Quero!
                 </button>
              </div>
           </div>
        </div>
      )}

      <div className="px-6 space-y-8 max-w-2xl mx-auto">
         <div className="flex items-center justify-between px-2">
            <button 
              onClick={requestGps}
              disabled={gpsLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${userCoords ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}
            >
               {gpsLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
               <span className="text-[10px] font-black uppercase tracking-widest">{userCoords ? 'Filtrando por proximidade' : 'Ativar Filtro de Distância'}</span>
            </button>
         </div>

         <div className="grid gap-6">
            {loading ? (
              <div className="p-24 flex flex-col items-center justify-center gap-5 text-slate-300">
                 <div className="relative">
                   <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
                   <Utensils className="w-6 h-6 text-orange-600 absolute inset-0 m-auto" />
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Sincronizando Vitrine...</p>
              </div>
            ) : filteredAndSortedStores.length === 0 ? (
              <div className="p-20 text-center bg-white rounded-[3.5rem] border-2 border-dashed border-slate-100 shadow-xl shadow-slate-900/[0.02] animate-in zoom-in-95 duration-500">
                 <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                    <Utensils className="w-10 h-10 text-slate-200" />
                 </div>
                 <h3 className="text-xl font-black text-slate-800 mb-2">Nada por aqui!</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-[220px] mx-auto">
                   Nenhuma loja ativa encontrada no momento.<br/>Tente recarregar a lista.
                 </p>
                 <button onClick={initData} className="mt-8 px-8 py-4 bg-orange-600 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-orange-900/20 active:scale-95 transition-all">
                   Verificar Novamente
                 </button>
              </div>
            ) : (
              filteredAndSortedStores.map(store => {
                const distance = userCoords ? calculateDistance(userCoords.lat, userCoords.lng, store.latitude, store.longitude) : null;
                const isVeryFar = distance && distance > 500;

                return (
                  <button key={store.id} onClick={() => setSelectedStore(store)} className="bg-white p-6 rounded-[3rem] shadow-xl border border-slate-50 flex items-center gap-6 group hover:border-orange-200 hover:shadow-orange-900/5 transition-all text-left animate-in slide-in-from-bottom-4 duration-500">
                     <div className="w-24 h-24 bg-slate-50 rounded-[2rem] overflow-hidden shrink-0 shadow-inner border-2 border-slate-50 p-1">
                        {store.logoUrl ? <img src={store.logoUrl} className="w-full h-full object-cover rounded-[1.6rem]" /> : <div className="w-full h-full flex items-center justify-center bg-orange-50"><Utensils className="text-orange-200" /></div>}
                     </div>
                     <div className="flex-1 min-w-0">
                        <h3 className="font-black text-slate-800 text-xl leading-tight mb-1 group-hover:text-orange-600 transition-colors truncate">{store.name}</h3>
                        <p className="text-[10px] text-slate-400 line-clamp-2 mb-3 font-medium leading-relaxed">{store.description}</p>
                        <div className="flex flex-wrap items-center gap-2">
                           {distance !== null && distance !== 999999 && !isVeryFar && (
                             <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full flex items-center gap-1">
                               <MapPin className="w-3 h-3" /> {distance.toFixed(1)} km
                             </span>
                           )}
                           <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full flex items-center gap-1">
                             <Clock className="w-3 h-3" /> Aberto agora
                           </span>
                        </div>
                     </div>
                     <div className="p-4 bg-slate-50 text-slate-200 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all group-hover:rotate-12">
                        <ChevronRight className="w-6 h-6" />
                     </div>
                  </button>
                );
              })
            )}
         </div>
      </div>
    </div>
  );
};