import React from 'react';
import { 
  X, Smartphone, Store, Bike, ShoppingBag, Heart, MessageCircle, 
  Instagram, Flag, MapPin, Clock, Star, Plus, ChevronRight, ShoppingCart
} from 'lucide-react';
import { StoreProfile } from '../../types';

interface UnifiedStoreModalProps {
  activeView: any;
  setSelectedStall: (val: any) => void;
  setSelectedProfile: (val: any) => void;
  userInteractions: { follows: string[]; favorites: string[]; ratings: any[] };
  setUserInteractions: React.Dispatch<React.SetStateAction<{ follows: string[]; favorites: string[]; ratings: any[] }>>;
  toggleInteraction: (id: string, type: 'FOLLOW' | 'FAVORITE') => Promise<boolean | null>;
  getUserInteractions: () => Promise<any>;
  storeRatings: Record<string, { average: number; count: number }>;
  getStoreAverageRating: (wid: string) => Promise<{ average: number; count: number }>;
  setStoreRatings: React.Dispatch<React.SetStateAction<Record<string, { average: number; count: number }>>>;
  ratingDraft: { workspaceId: string; stars: number; comment: string } | null;
  setRatingDraft: (val: { workspaceId: string; stars: number; comment: string } | null) => void;
  isSubmittingRating: boolean;
  setIsSubmittingRating: (val: boolean) => void;
  submitRating: (wid: string, stars: number, comment: string) => Promise<boolean>;
  displayItems: any[];
  groupedItems: { category: string; items: any[] }[];
  setSelectedProduct: (val: any) => void;
  isCartEnabled: boolean;
  handleMainAction: () => void;
  setReportTarget: (val: string | null) => void;
}

export const UnifiedStoreModal: React.FC<UnifiedStoreModalProps> = ({
  activeView,
  setSelectedStall,
  setSelectedProfile,
  userInteractions,
  setUserInteractions,
  toggleInteraction,
  getUserInteractions,
  storeRatings,
  getStoreAverageRating,
  setStoreRatings,
  ratingDraft,
  setRatingDraft,
  isSubmittingRating,
  setIsSubmittingRating,
  submitRating,
  displayItems,
  groupedItems,
  setSelectedProduct,
  isCartEnabled,
  handleMainAction,
  setReportTarget
}) => {
  if (!activeView) return null;

  const workspaceId = activeView.data?.workspaceId || activeView.profile?.workspaceId;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-5xl h-[85vh] sm:h-[90vh] rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col shadow-3xl animate-in slide-in-from-bottom-10 relative">
        
        {/* BOTÃO X DE FECHAR GLOBAL (Sempre Visível) */}
        <button onClick={() => { setSelectedStall(null); setSelectedProfile(null); }} className="absolute top-5 right-5 p-2 bg-black/40 text-white rounded-full backdrop-blur-md z-[60] shadow-xl hover:bg-black/60 transition-all border border-white/10 active:scale-90">
            <X size={20} />
        </button>

        <div className="overflow-y-auto pb-32 relative">
          {/* Banner Header */}
          <div className="h-40 w-full relative bg-slate-200">
              {activeView.profile?.bannerUrl ? (
                  <>
                    <img src={activeView.profile.bannerUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20" />
                  </>
              ) : (
                  <div className="w-full h-full bg-gradient-to-r from-indigo-500 to-purple-600 opacity-80" />
              )}
          </div>

          <div className="px-8 relative">
              {/* Logo Overlap */}
              <div className="-mt-16 mb-4 flex justify-center">
                  <div className="w-32 h-32 bg-white rounded-[2.5rem] p-1 shadow-2xl relative z-10">
                      <div className="w-full h-full bg-slate-100 rounded-[2.2rem] overflow-hidden relative">
                          {activeView.imageUrl ? (
                             <img src={activeView.imageUrl} className="w-full h-full object-cover" />
                          ) : (
                             <div className="w-full h-full flex items-center justify-center text-slate-300">
                                {activeView.type === 'STALL' ? <Smartphone /> : <Store />}
                             </div>
                          )}
                      </div>
                  </div>
              </div>

              {/* Header Content */}
              <div className="text-center mb-6">
                  <h2 className="text-2xl font-black text-slate-800 uppercase leading-tight mb-2">
                     {activeView.displayName}
                  </h2>
                  <div className="flex flex-wrap justify-center gap-2 mb-3">
                     <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${activeView.type === 'STALL' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {activeView.type === 'STALL' ? 'Barraca' : 'Loja Oficial'}
                     </span>
                     
                     {activeView.fulfillmentMode === 'DELIVERY' && <span className="px-2 py-0.5 bg-sky-100 text-sky-600 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Bike size={8} /> Apenas Entrega</span>}
                     {activeView.fulfillmentMode === 'PICKUP' && <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><ShoppingBag size={8} /> Retirada no Local</span>}
                     {activeView.fulfillmentMode === 'BOTH' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Store size={8} /> Entrega & Retirada</span>}
                  </div>
                  
                  {/* Interactions Row */}
                  <div className="flex items-center justify-center gap-4 mb-4">
                      <button 
                        onClick={async () => {
                            if (!workspaceId) return;
                            
                            setUserInteractions(prev => {
                                const isFollowing = prev.follows.includes(workspaceId);
                                return {
                                    ...prev,
                                    follows: isFollowing 
                                        ? prev.follows.filter(id => id !== workspaceId)
                                        : [...prev.follows, workspaceId]
                                };
                            });

                            const success = await toggleInteraction(workspaceId, 'FOLLOW');
                            if (success === null) {
                                const updated = await getUserInteractions();
                                setUserInteractions(updated);
                            }
                        }}
                        className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                            userInteractions.follows.includes(workspaceId || '') 
                            ? 'bg-slate-800 text-white' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                          {userInteractions.follows.includes(workspaceId || '') ? 'Seguindo' : 'Seguir'}
                      </button>
                      
                      <button 
                        onClick={async () => {
                            if (!workspaceId) return;
                            
                            setUserInteractions(prev => {
                                const isFavorited = prev.favorites.includes(workspaceId);
                                return {
                                    ...prev,
                                    favorites: isFavorited 
                                        ? prev.favorites.filter(id => id !== workspaceId)
                                        : [...prev.favorites, workspaceId]
                                };
                            });

                            const success = await toggleInteraction(workspaceId, 'FAVORITE');
                            if (success === null) {
                                const updated = await getUserInteractions();
                                setUserInteractions(updated);
                            }
                        }}
                        className={`p-2 rounded-full transition-all ${
                            userInteractions.favorites.includes(workspaceId || '') 
                            ? 'bg-rose-100 text-rose-500' 
                            : 'bg-slate-100 text-slate-400 hover:text-rose-500'
                        }`}
                      >
                          <Heart size={20} className={userInteractions.favorites.includes(workspaceId || '') ? 'fill-rose-500' : ''} />
                      </button>
                  </div>

                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                     {activeView.subName}
                  </p>
              </div>

              {/* Actions */}
              <div className="space-y-3 mb-6">
                  {activeView.whatsapp ? (
                      <button 
                         onClick={handleMainAction}
                         className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-emerald-500"
                      >
                         <MessageCircle size={20} /> Falar no WhatsApp
                      </button>
                   ) : (
                      <div className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
                         <Clock size={16} /> Contato Indisponível
                      </div>
                   )}

                   {activeView.profile?.instagram && (
                      <button 
                         onClick={() => window.open(`https://instagram.com/${activeView.profile?.instagram.replace('@', '').replace('/', '')}`, '_blank')}
                         className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all"
                      >
                         <Instagram size={20} /> Ver no Instagram
                      </button>
                   )}

                   <button 
                     onClick={() => setReportTarget(workspaceId || null)}
                     className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-rose-100 transition-all"
                   >
                     <Flag size={16} /> Denunciar Empresa
                   </button>
              </div>

              {/* Details & Items */}
              <div className="space-y-4">
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <MapPin size={12} /> Localização
                     </p>
                     <p className="font-bold text-slate-700 text-sm">
                        {activeView.address || 'Localização via GPS'}
                     </p>
                  </div>

                  {activeView.openingHours && (
                     <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                           <Clock size={12} /> Funcionamento
                        </p>
                        <p className="font-bold text-slate-700 text-sm">
                           {activeView.openingHours}
                        </p>
                     </div>
                  )}
                  
                  {activeView.description && (
                     <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                           <Store size={12} /> Sobre
                        </p>
                        <p className="font-medium text-slate-600 text-sm leading-relaxed">
                           {activeView.description}
                        </p>
                     </div>
                  )}

                  {/* Ratings Section */}
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <Star size={12} /> Avaliações
                          </p>
                          {storeRatings[workspaceId || '']?.count > 0 && (
                              <div className="flex items-center gap-1 bg-amber-100 text-amber-600 px-2 py-1 rounded-full">
                                  <Star size={10} className="fill-amber-500" />
                                  <span className="text-[10px] font-black">{storeRatings[workspaceId || ''].average.toFixed(1)}</span>
                              </div>
                          )}
                      </div>
                      
                      <div className="flex flex-col items-center gap-2 py-2">
                          <p className="text-xs font-bold text-slate-500 text-center">Como foi sua experiência?</p>
                          <div className="flex items-center gap-2">
                              {[1, 2, 3, 4, 5].map((star) => {
                                  const existingRating = userInteractions.ratings.find(r => r.workspace_id === workspaceId);
                                  const currentRating = (ratingDraft?.workspaceId === workspaceId) ? ratingDraft.stars : (existingRating?.stars || 0);
                                  
                                  return (
                                      <button 
                                          key={star}
                                          onClick={() => {
                                              if (!workspaceId) return;
                                              setRatingDraft({ 
                                                  workspaceId, 
                                                  stars: star, 
                                                  comment: existingRating?.comment || '' 
                                              });
                                          }}
                                          className="p-1 transition-all active:scale-90"
                                      >
                                          <Star 
                                              size={28} 
                                              className={`${star <= currentRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-200'}`} 
                                          />
                                      </button>
                                  );
                              })}
                          </div>
                          
                          {ratingDraft && ratingDraft.workspaceId === workspaceId && (
                              <div className="w-full flex justify-center mt-2 w-full animate-in fade-in slide-in-from-top-2">
                                  <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-col gap-2">
                                      <textarea 
                                          value={ratingDraft.comment}
                                          onChange={e => setRatingDraft({...ratingDraft, comment: e.target.value})}
                                          placeholder="Deixe um comentário (opcional)..."
                                          className="w-full text-sm resize-none bg-slate-50 p-3 rounded-lg border-none focus:ring-1 focus:ring-emerald-500 text-slate-700 placeholder-slate-400"
                                          rows={2}
                                      />
                                      <div className="flex gap-2">
                                          <button
                                              onClick={() => setRatingDraft(null)}
                                              className="flex-1 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200"
                                              disabled={isSubmittingRating}
                                          >
                                              Cancelar
                                          </button>
                                          <button
                                              onClick={async () => {
                                                  if (!workspaceId) return;
                                                  setIsSubmittingRating(true);
                                                  await submitRating(workspaceId, ratingDraft.stars, ratingDraft.comment);
                                                  const updated = await getUserInteractions();
                                                  setUserInteractions(updated);
                                                  const newAvg = await getStoreAverageRating(workspaceId);
                                                  setStoreRatings(prev => ({...prev, [workspaceId]: newAvg}));
                                                  setIsSubmittingRating(false);
                                                  setRatingDraft(null);
                                              }}
                                              className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                                              disabled={isSubmittingRating}
                                          >
                                              {isSubmittingRating ? 'Enviando...' : 'Publicar'}
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  {displayItems.length > 0 && (
                     <div className="mt-8">
                        {/* CABEÇALHO PEGAJOSO (STICKY) DE PRODUTOS COM CHIPS */}
                        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md pt-4 pb-3 border-b border-slate-100 mb-4 -mx-8 px-8 flex flex-col gap-3 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.05)] transition-all">
                           <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200 shadow-sm">
                                   {activeView.imageUrl ? <img src={activeView.imageUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Store size={16}/></div>}
                               </div>
                               <div className="flex-1 min-w-0">
                                  <p className="text-xs font-black text-slate-800 uppercase tracking-widest leading-tight block truncate">{activeView.displayName}</p>
                                  <p className="text-[10px] font-bold text-slate-400 capitalize flex items-center gap-1 mt-0.5">
                                     {isCartEnabled ? <ShoppingCart size={10} /> : <ShoppingBag size={10} />} 
                                     {displayItems.length} Produtos
                                  </p>
                               </div>
                           </div>
                           {groupedItems.length > 0 && (
                             <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
                               <button onClick={(e) => { e.preventDefault(); document.getElementById('cat-geral')?.scrollIntoView({ behavior: 'smooth' }); }} className="shrink-0 snap-start px-3 py-1.5 rounded-full bg-slate-800 text-white font-bold text-[10px] shadow-sm active:scale-95 transition-all">CATEGORIAS</button>
                               {groupedItems.map(g => (
                                  <button key={g.category} onClick={(e) => { e.preventDefault(); document.getElementById(`cat-${g.category.replace(/\s+/g, '-').toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth' }); }} className="shrink-0 snap-start px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-100 hover:bg-emerald-100 active:scale-95 transition-all uppercase">
                                    {g.category}
                                  </button>
                               ))}
                             </div>
                           )}
                        </div>

                        {/* LISTAGEM DE GRUPOS EM CARROSSEL HORIZONTAL */}
                        <div className="space-y-8 pb-10" id="cat-geral">
                           {groupedItems.map((group, gIdx) => (
                              <div key={gIdx} id={`cat-${group.category.replace(/\s+/g, '-').toLowerCase()}`} className="scroll-mt-40">
                                 <div className="px-8 flex items-center justify-between mb-3">
                                     <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-4 rounded-full bg-emerald-500"></span>
                                        {group.category}
                                     </h3>
                                     <span className="text-[10px] font-bold text-slate-400">{group.items.length} ITENS</span>
                                 </div>
                                 <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory px-8 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                    {group.items.map((item: any, i: number) => (
                                      <button 
                                         key={i} 
                                         onClick={() => setSelectedProduct(item)}
                                         className="shrink-0 snap-center sm:snap-start w-64 flex flex-col p-3 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all text-left group relative focus:outline-none"
                                      >
                                         <div className="w-full h-36 bg-slate-100 rounded-2xl overflow-hidden relative mb-3">
                                            {item.imageUrl ? (
                                               <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                               <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                  {isCartEnabled ? <ShoppingCart size={24} /> : <ShoppingBag size={24} />}
                                               </div>
                                            )}
                                         </div>
                                         <div className="flex-1 flex flex-col px-1">
                                            <h4 className="font-black text-slate-700 text-sm uppercase group-hover:text-emerald-600 transition-colors line-clamp-1">{item.name}</h4>
                                            <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 mb-3">{item.description}</p>
                                            <div className="mt-auto border-t border-slate-50 pt-2 flex items-center justify-between">
                                              <div>
                                                  {item.promotionalPrice && (!item.promoEndsAt || new Date(item.promoEndsAt).getTime() > Date.now()) ? (
                                                    <div className="flex flex-col">
                                                      <p className="text-slate-400 font-bold text-[10px] line-through leading-none">R$ {(item.price || 0).toFixed(2)}</p>
                                                      <p className="text-emerald-600 font-black text-lg leading-none">R$ {item.promotionalPrice.toFixed(2)}</p>
                                                    </div>
                                                  ) : (
                                                    <p className="text-emerald-600 font-black text-lg">R$ {(item.price || 0).toFixed(2)}</p>
                                                  )}
                                              </div>
                                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white group-active:scale-90 transition-all shadow-sm">
                                                 {isCartEnabled ? <Plus size={16} /> : <ChevronRight size={16} />}
                                              </div>
                                            </div>
                                         </div>
                                      </button>
                                    ))}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}
               </div>
          </div>
        </div>
      </div>
    </div>
  );
};
