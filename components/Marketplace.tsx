import React from 'react';
import { supabase } from '../lib/supabase';
import { User, AppSection, StoreProfile, SubscriptionPlan } from '../types';
import { ScrollContainer } from './ScrollContainer';
import { useMarketplaceLogic } from '../hooks/useMarketplaceLogic';
import { StoryViewerModal } from './marketplace/StoryViewerModal';
import { CartModal } from './marketplace/CartModal';
import { ProductDetailsModal } from './marketplace/ProductDetailsModal';
import { ReportModal } from './marketplace/ReportModal';
import { MarketplaceHeader } from './marketplace/MarketplaceHeader';
import { MarketplaceSearch } from './marketplace/MarketplaceSearch';
import { GlobalStories } from './marketplace/GlobalStories';
import { MarketplaceCard } from './marketplace/MarketplaceCard';
import { UnifiedStoreModal } from './marketplace/UnifiedStoreModal';
import { SystemPromoBanner } from './SystemPromoBanner';
import { Loader2, Store, ArrowRight } from 'lucide-react';

interface MarketplaceProps {
  user: User;
  onLogout: () => void;
  stores: StoreProfile[];
  stalls: AppSection[];
  onRefresh: () => void;
  plans: SubscriptionPlan[];
  onNavigate: (tab: string) => void;
  fetchPublicProfiles: (force?: boolean, page?: number, limit?: number) => Promise<void>;
  fetchPublicStalls: (force?: boolean, page?: number, limit?: number) => Promise<void>;
  hasMoreProfiles?: boolean; // Aliasing hasMoreStores
  hasMoreStalls: boolean;
  isLoading?: boolean;
}

export const Marketplace: React.FC<MarketplaceProps> = (props) => {
  const {
     user, onLogout, stores, stalls, onRefresh, plans, onNavigate,
     fetchPublicProfiles, fetchPublicStalls, hasMoreStores, hasMoreStalls,
     isLoading
  } = props;

  const {
    userInteractions, setUserInteractions, storeRatings, setStoreRatings,
    activeFilter, setActiveFilter, selectedStall, setSelectedStall,
    selectedProfile, setSelectedProfile, searchTerm, setSearchTerm,
    selectedProduct, setSelectedProduct, quantity, setQuantity,
    isLoadingMore, activeStory, setActiveStory, viewedStories,
    cart, isCartOpen, setIsCartOpen, couponCode, setCouponCode,
    appliedCoupon, setAppliedCoupon, couponError, isApplyingCoupon,
    ratingDraft, setRatingDraft, isSubmittingRating, setIsSubmittingRating,
    reportTarget, setReportTarget, reportReason, setReportReason, isReporting,
    visibleCount, items, activeView, displayItems, groupedItems, globalStories,
    loadMoreRef, getStoreDisplayName, calculateDistance, getEffectivePrice, getStoryToken,
    applyCoupon, handleReport, handleStoryClick, handleNextStory, handlePrevStory, handleStoryAction,
    addToCart, removeFromCart, checkout, handleOrderSingle, handleMainAction,
    cartTotal, discountAmount, deliveryFee, finalTotal,
    toggleInteraction, getUserInteractions, getStoreAverageRating, submitRating,
    isCartEnabled, hotKeywords, trendingItems, userAffinity, sponsoredAds
  } = useMarketplaceLogic({
    user, stores, stalls, onRefresh,
    fetchPublicProfiles, fetchPublicStalls, hasMoreStores, hasMoreStalls
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <MarketplaceSearch 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        hotKeywords={hotKeywords}
      />

      <div className="bg-white px-6 pb-6 rounded-b-[2.5rem] shadow-sm -mt-6 pt-6">
        <MarketplaceHeader 
          onLogout={onLogout} 
          onRefresh={onRefresh}
          isRefreshing={isLoadingMore}
        />
      </div>

      <GlobalStories 
        globalStories={globalStories}
        viewedStories={viewedStories}
        handleStoryClick={handleStoryClick}
        getStoreDisplayName={(profile) => getStoreDisplayName(profile, 'Loja Oficial')}
        getStoryToken={getStoryToken}
      />

      {sponsoredAds && sponsoredAds.length > 0 && (
        <div className="px-4 mt-6 mb-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
               Patrocinado
            </h3>
            <ScrollContainer className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-hide">
              {sponsoredAds.map((ad, idx) => {
                 return (
                   <div 
                     key={idx} 
                     onClick={() => {
                       supabase.rpc('increment_ad_clicks', { ad_id: ad.id });
                       window.open(ad.link, '_blank');
                     }}
                     className="snap-center shrink-0 w-[280px] h-[140px] rounded-3xl relative overflow-hidden shadow-lg cursor-pointer transform transition text-white"
                     style={{ backgroundColor: ad.background_color || '#f97316' }}
                   >
                     {ad.media_url ? (
                       <img src={ad.media_url} alt={ad.title} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay" />
                     ) : (
                       <div className="absolute inset-0 bg-white/10"></div>
                     )}
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex flex-col justify-end">
                       <h4 className="font-extrabold text-sm uppercase tracking-wider">{ad.title}</h4>
                       <p className="text-xs text-white/80 line-clamp-1">{ad.description}</p>
                     </div>
                   </div>
                 );
              })}
            </ScrollContainer>
        </div>
      )}

      <div className="p-4 space-y-4">
         {user.role === 'OWNER' && <SystemPromoBanner plans={plans} user={user} onNavigate={onNavigate} variant="MARKETPLACE" />}
         
         {isLoading && items.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center space-y-4 animate-pulse">
               <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
               <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Sincronizando Vitrine...</p>
            </div>
         )}

         {items.slice(0, visibleCount).map((item: any) => (
            <MarketplaceCard 
               key={`${item.type}_${item.data.id}`}
               item={item}
               userCoords={null} 
               stores={stores}
               storeRatings={storeRatings}
               userInteractions={userInteractions}
               getStoreDisplayName={getStoreDisplayName}
               calculateDistance={calculateDistance}
               onClick={(data) => item.type === 'STALL' ? setSelectedStall(data) : setSelectedProfile(data)}
               trendingItems={trendingItems}
               userAffinity={userAffinity}
            />
         ))}
         
         {items.length === 0 && (
            <div className="py-20 text-center opacity-50">
               <Store className="w-16 h-16 mx-auto mb-4 text-slate-300" />
               <p className="font-black text-slate-400 uppercase tracking-widest">Nenhum resultado encontrado</p>
            </div>
         )}

         {(hasMoreStores || hasMoreStalls) && (
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
               <Loader2 className="animate-spin text-slate-300 w-8 h-8 opacity-50" />
            </div>
         )}
      </div>

      <StoryViewerModal
        activeStory={activeStory}
        setActiveStory={setActiveStory}
        handlePrevStory={handlePrevStory}
        handleNextStory={handleNextStory}
        handleStoryAction={handleStoryAction}
        getStoreDisplayName={(profile) => getStoreDisplayName(profile, 'Loja Oficial')}
      />

      <UnifiedStoreModal 
        activeView={activeView}
        setSelectedStall={setSelectedStall}
        setSelectedProfile={setSelectedProfile}
        userInteractions={userInteractions}
        setUserInteractions={setUserInteractions}
        toggleInteraction={toggleInteraction}
        getUserInteractions={getUserInteractions}
        storeRatings={storeRatings}
        getStoreAverageRating={getStoreAverageRating}
        setStoreRatings={setStoreRatings}
        ratingDraft={ratingDraft}
        setRatingDraft={setRatingDraft}
        isSubmittingRating={isSubmittingRating}
        setIsSubmittingRating={setIsSubmittingRating}
        submitRating={submitRating}
        displayItems={displayItems}
        groupedItems={groupedItems}
        setSelectedProduct={setSelectedProduct}
        isCartEnabled={isCartEnabled}
        handleMainAction={handleMainAction}
        setReportTarget={setReportTarget}
      />

      {isCartEnabled && cart.length > 0 && activeView && (
        <div className="fixed bottom-28 left-6 right-6 z-[80] animate-in slide-in-from-bottom-6">
           <button 
             onClick={() => setIsCartOpen(true)}
             className="w-full bg-slate-900 text-white p-4 rounded-[2rem] shadow-2xl flex items-center justify-between border-2 border-slate-800 active:scale-95 transition-all"
           >
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center font-black text-lg shadow-lg">
                    {cart.reduce((a, b) => a + b.qty, 0)}
                 </div>
                 <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total do Pedido</p>
                    <p className="text-xl font-black">R$ {(finalTotal || 0).toFixed(2)}</p>
                 </div>
              </div>
              <div className="flex items-center gap-2 pr-2">
                 <span className="text-[10px] font-black uppercase tracking-widest">Ver Carrinho</span>
                 <ArrowRight size={16} />
              </div>
           </button>
        </div>
      )}

      <CartModal
        isCartOpen={isCartOpen}
        setIsCartOpen={setIsCartOpen}
        activeView={activeView}
        cart={cart}
        removeFromCart={removeFromCart}
        getEffectivePrice={getEffectivePrice}
        couponCode={couponCode}
        setCouponCode={setCouponCode}
        appliedCoupon={appliedCoupon}
        setAppliedCoupon={setAppliedCoupon}
        couponError={couponError}
        isApplyingCoupon={isApplyingCoupon}
        applyCoupon={applyCoupon}
        cartTotal={cartTotal}
        discountAmount={discountAmount}
        deliveryFee={deliveryFee}
        finalTotal={finalTotal}
        checkout={checkout}
      />

      <ProductDetailsModal
        selectedProduct={selectedProduct}
        setSelectedProduct={setSelectedProduct}
        isCartEnabled={isCartEnabled}
        quantity={quantity}
        setQuantity={setQuantity}
        addToCart={addToCart}
        handleOrderSingle={handleOrderSingle}
      />

      <ReportModal
        reportTarget={reportTarget}
        setReportTarget={setReportTarget}
        reportReason={reportReason}
        setReportReason={setReportReason}
        isReporting={isReporting}
        handleReport={handleReport}
      />
    </div>
  );
};
