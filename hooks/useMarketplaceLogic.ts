
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { User, AppSection, StoreProfile, SubscriptionPlan } from '../types';
import { useStoreProfiles } from './useStoreProfiles';
import { useStoreInteractions } from './useStoreInteractions';
import { useAnalytics } from './useAnalytics';
import { useAppConfig } from './useAppConfig';
import { createMPPreference, redirectToMPCheckout, MPItem } from '../services/mercadopagoService';

interface CartItem {
  product: any;
  qty: number;
}

interface UseMarketplaceLogicProps {
  user: User;
  stores: StoreProfile[];
  stalls: AppSection[];
  onRefresh: () => void;
  fetchPublicProfiles: (force?: boolean, page?: number, limit?: number) => Promise<void>;
  fetchPublicStalls: (force?: boolean, page?: number, limit?: number) => Promise<void>;
  hasMoreStores: boolean;
  hasMoreStalls: boolean;
}

export const useMarketplaceLogic = ({
  user, stores, stalls, onRefresh,
  fetchPublicProfiles, fetchPublicStalls, hasMoreStores, hasMoreStalls
}: UseMarketplaceLogicProps) => {
  const { getMyProfile } = useStoreProfiles();
  const { fetchStallById } = useAppConfig();
  const { toggleInteraction, getUserInteractions, getStoreAverageRating, submitRating } = useStoreInteractions(user.id);
  const { trackView, trackProductClick } = useAnalytics(user.workspaceId);
  
  const [userInteractions, setUserInteractions] = useState<{follows: string[], favorites: string[], ratings: any[]}>({follows: [], favorites: [], ratings: []});
  const [storeRatings, setStoreRatings] = useState<Record<string, {average: number, count: number}>>({});
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'STORES' | 'STALLS'>('ALL');
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [selectedStall, setSelectedStall] = useState<AppSection | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<StoreProfile | null>(null);
  const [freshProfile, setFreshProfile] = useState<StoreProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [storesPage, setStoresPage] = useState(0);
  const [stallsPage, setStallsPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeStory, setActiveStory] = useState<{ profile: StoreProfile; items: any[]; currentIndex: number } | null>(null);
  const [viewedStories, setViewedStories] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('viewed_stories');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [ratingDraft, setRatingDraft] = useState<{ workspaceId: string, stars: number, comment: string } | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15);

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  const getEffectivePrice = useCallback((item: any) => {
    if (item.promotionalPrice && (!item.promoEndsAt || new Date(item.promoEndsAt).getTime() > Date.now())) {
      return item.promotionalPrice;
    }
    return item.price || 0;
  }, []);

  const getStoreDisplayName = useCallback((store: StoreProfile | null | undefined, fallback: string, prioritizeStoreName: boolean = true) => {
    if (!store) return fallback || 'Marketplace';
    const isGenericName = !store.name || store.name === 'Minha Loja' || store.name === 'Loja sem Nome' || store.name === 'Minha Barraca';
    if (!isGenericName) return store.name;
    if (!prioritizeStoreName) {
      const stall = stalls.find(s => s.workspaceId === store.workspaceId);
      if (stall && stall.name && stall.name !== 'Minha Barraca') return stall.name;
    }
    return fallback || 'Loja Oficial';
  }, [stalls]);

  const applyCoupon = async () => {
    if (!couponCode.trim() || !activeView) return;
    setIsApplyingCoupon(true);
    setCouponError('');
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('workspace_id', activeView.workspaceId)
        .eq('code', couponCode.toUpperCase())
        .eq('active', true)
        .single();
        
      if (error || !data) {
        setCouponError('Cupom inválido ou expirado');
        setAppliedCoupon(null);
        return;
      }
      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        setCouponError('Este cupom já expirou');
        setAppliedCoupon(null);
        return;
      }
      if (data.max_uses && data.current_uses >= data.max_uses) {
        setCouponError('Limite de usos atingido');
        setAppliedCoupon(null);
        return;
      }
      const currentTotal = cart.reduce((acc, item) => acc + (getEffectivePrice(item.product) * item.qty), 0);
      if (data.min_purchase_value && currentTotal < data.min_purchase_value) {
        setCouponError(`Valor mínimo: R$ ${data.min_purchase_value.toFixed(2)}`);
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon(data);
      setCouponError('');
      toast.success('Cupom aplicado!');
    } catch (e) {
      setCouponError('Erro ao validar cupom');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  useEffect(() => {
    onRefresh();
    getUserInteractions().then(data => setUserInteractions(data));
  }, [onRefresh, getUserInteractions]);

  useEffect(() => {
    const fetchRatings = async () => {
      const newRatings: Record<string, {average: number, count: number}> = {};
      for (const store of stores) {
        if (store.active) {
          const rating = await getStoreAverageRating(store.workspaceId);
          newRatings[store.workspaceId] = rating;
        }
      }
      setStoreRatings(newRatings);
    };
    if (stores.length > 0) fetchRatings();
  }, [stores, getStoreAverageRating]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.warn("GPS: Localização não obtida."),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
      );
    }
  }, []);

  useEffect(() => {
    const target = selectedStall || selectedProfile;
    if (target) {
        setFreshProfile(null);
        if (selectedStall) fetchStallById(selectedStall.id).then(s => { if (s) setSelectedStall(s); });
        getMyProfile(target.workspaceId).then(p => { if (p) setFreshProfile(p); });
    } else { setFreshProfile(null); }
  }, [selectedStall?.id, selectedProfile?.id, getMyProfile, fetchStallById]);

  useEffect(() => {
    if (selectedProduct) setQuantity(1);
  }, [selectedProduct]);

  const handleReport = async () => {
    if (!reportTarget || !reportReason.trim()) return;
    setIsReporting(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_workspace_id: reportTarget,
        reason: reportReason,
        status: 'PENDING'
      });
      if (error) throw error;
      toast.success("Denúncia enviada com sucesso.");
      setReportTarget(null);
      setReportReason('');
    } catch (e) { toast.error("Erro ao enviar denúncia."); } finally { setIsReporting(false); }
  };

  const activeView = useMemo(() => {
    if (selectedStall) {
      const linkedProfile = freshProfile || stores.find(p => p.workspaceId === selectedStall.workspaceId);
      let finalWhatsapp = selectedStall.whatsappMode === 'MANUAL' && selectedStall.manualWhatsapp ? selectedStall.manualWhatsapp : (linkedProfile?.whatsapp || '');
      return {
        type: 'STALL',
        workspaceId: selectedStall.workspaceId,
        data: selectedStall,
        profile: linkedProfile,
        displayName: getStoreDisplayName(linkedProfile, selectedStall.name, false),
        subName: linkedProfile ? selectedStall.name : 'Barraca',
        whatsapp: finalWhatsapp,
        address: selectedStall.address || linkedProfile?.address,
        imageUrl: selectedStall.imageUrl || linkedProfile?.logoUrl,
        fulfillmentMode: selectedStall.fulfillmentMode || 'PICKUP',
        description: selectedStall.description || linkedProfile?.description,
        openingHours: selectedStall.openingHours
      } as any;
    } 
    if (selectedProfile) {
      const profileToUse = freshProfile || selectedProfile;
      return {
        type: 'STORE',
        workspaceId: profileToUse.workspaceId,
        data: null,
        profile: profileToUse,
        displayName: getStoreDisplayName(profileToUse, 'Loja Oficial', true),
        subName: 'Loja Oficial',
        whatsapp: profileToUse.whatsapp,
        address: profileToUse.address,
        imageUrl: profileToUse.logoUrl,
        fulfillmentMode: profileToUse.fulfillmentMode || 'BOTH',
        description: profileToUse.description,
        openingHours: null
      } as any;
    }
    return null;
  }, [selectedStall, selectedProfile, stores, freshProfile, getStoreDisplayName]);

  useEffect(() => {
    if (activeView) trackView(activeView.workspaceId, user.id);
  }, [activeView?.workspaceId, trackView, user.id]);

  useEffect(() => {
    if (selectedProduct && activeView) trackProductClick(activeView.workspaceId, selectedProduct.id, user.id);
  }, [selectedProduct?.id, activeView?.workspaceId, trackProductClick, user.id]);

  useEffect(() => {
    if (!activeView) { setCart([]); setIsCartOpen(false); }
  }, [activeView]);

  useEffect(() => { setVisibleCount(15); }, [searchTerm, activeFilter]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && !isLoadingMore && (hasMoreStores || hasMoreStalls)) {
        setIsLoadingMore(true);
        const promises = [];
        if (hasMoreStores && (activeFilter === 'ALL' || activeFilter === 'STORES')) {
          const nextPage = storesPage + 1;
          setStoresPage(nextPage);
          promises.push(fetchPublicProfiles(false, nextPage));
        }
        if (hasMoreStalls && (activeFilter === 'ALL' || activeFilter === 'STALLS')) {
          const nextPage = stallsPage + 1;
          setStallsPage(nextPage);
          promises.push(fetchPublicStalls(false, nextPage));
        }
        if (promises.length > 0) await Promise.all(promises);
        
        // Importante: Incrementar a contagem visível após o fetch para mostrar os novos itens
        setVisibleCount(prev => prev + 15);
        
        setIsLoadingMore(false);
      }
    });
    if (node) observerRef.current.observe(node);
  }, [hasMoreStores, hasMoreStalls, isLoadingMore, storesPage, stallsPage, activeFilter, fetchPublicProfiles, fetchPublicStalls]);

  const items = useMemo(() => {
    let list: any[] = [];
    if (activeFilter === 'ALL' || activeFilter === 'STALLS') list = [...list, ...stalls.map(s => ({ type: 'STALL', data: s }))];
    if (activeFilter === 'ALL' || activeFilter === 'STORES') list = [...list, ...stores.filter(p => p.active).map(p => ({ type: 'STORE', data: p }))];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(item => {
        const name = item.data.name;
        let extraSearch = '';
        if (item.type === 'STALL') {
            const profile = stores.find(p => p.workspaceId === item.data.workspaceId);
            if (profile) extraSearch = profile.name;
        }
        return name.toLowerCase().includes(lower) || extraSearch.toLowerCase().includes(lower);
      });
    }

    if (userCoords) {
        list.sort((a, b) => {
            const distA = calculateDistance(userCoords.lat, userCoords.lng, a.data.latitude || 0, a.data.longitude || 0);
            const distB = calculateDistance(userCoords.lat, userCoords.lng, b.data.latitude || 0, b.data.longitude || 0);
            return distA - distB;
        });
    }
    return list;
  }, [stalls, stores, activeFilter, searchTerm, userCoords, calculateDistance]);

  const displayItems = useMemo(() => {
    if (!activeView) return [];
    if (activeView.type === 'STALL' && activeView.data?.items) {
       return activeView.data.items.map((item: any) => ({
          name: item.name,
          category: item.category || 'Geral',
          description: 'Pronta Entrega',
          price: item.defaultPrice || 0,
          imageUrl: item.imageUrl,
          id: item.id,
          promotionalPrice: item.promotionalPriceAVista,
          promoEndsAt: item.promoEndsAt
       }));
    }
    return activeView.profile?.portfolio || [];
  }, [activeView]);

  const groupedItems = useMemo(() => {
     const groups: Record<string, { display: string; items: any[] }> = {};
     displayItems.forEach(item => {
        const rawCat = (item.category || 'Destaques').trim(); 
        const normalizedCat = rawCat.toLowerCase();
        if (!groups[normalizedCat]) groups[normalizedCat] = { display: rawCat, items: [] };
        groups[normalizedCat].items.push(item);
     });
     return Object.values(groups).sort((a, b) => a.display === 'Destaques' ? -1 : b.display === 'Destaques' ? 1 : a.display.localeCompare(b.display))
            .map(group => ({ category: group.display, items: group.items }));
  }, [displayItems]);

  const globalStories = useMemo(() => {
    const grouped: { profile: StoreProfile; items: any[] }[] = [];
    stores.forEach(profile => {
      if (profile.active && profile.portfolio) {
        const validItems = profile.portfolio.filter((item: any) => item.highlightExpiresAt && new Date(item.highlightExpiresAt).getTime() > Date.now());
        if (validItems.length > 0) grouped.push({ profile, items: validItems });
      }
    });
    return grouped.sort(() => Math.random() - 0.5);
  }, [stores]);

  const getStoryToken = useCallback((profileId: string, items: any[]) => `${profileId}_${items.map(i => i.id).sort().join('-')}`, []);

  const handleStoryClick = (data: { profile: StoreProfile; items: any[] }) => {
    setActiveStory({ profile: data.profile, items: data.items, currentIndex: 0 });
    const token = getStoryToken(data.profile.id, data.items);
    if (!viewedStories.has(token)) {
      const newSet = new Set(viewedStories);
      newSet.add(token);
      setViewedStories(newSet);
      localStorage.setItem('viewed_stories', JSON.stringify(Array.from(newSet)));
    }
  };

  const handleNextStory = useCallback(() => {
    if (!activeStory) return;
    if (activeStory.currentIndex < activeStory.items.length - 1) setActiveStory(prev => prev ? ({ ...prev, currentIndex: prev.currentIndex + 1 }) : null);
    else setActiveStory(null);
  }, [activeStory]);

  const handlePrevStory = useCallback(() => {
    if (!activeStory) return;
    if (activeStory.currentIndex > 0) setActiveStory(prev => prev ? ({ ...prev, currentIndex: prev.currentIndex - 1 }) : null);
    else setActiveStory(prev => prev ? ({ ...prev, currentIndex: 0 }) : null);
  }, [activeStory]);

  const handleStoryAction = () => {
    if (!activeStory) return;
    setSelectedProfile(activeStory.profile);
    setSelectedProduct(activeStory.items[activeStory.currentIndex]);
    setActiveStory(null);
  };

  const isCartEnabled = useMemo(() => activeView?.fulfillmentMode === 'DELIVERY' || activeView?.fulfillmentMode === 'BOTH', [activeView]);

  const addToCart = () => { if (selectedProduct) { setCart(prev => [...prev, { product: selectedProduct, qty: quantity }]); setSelectedProduct(null); } };
  const removeFromCart = (index: number) => { const newCart = cart.filter((_, i) => i !== index); setCart(newCart); if (newCart.length === 0) setIsCartOpen(false); };
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (getEffectivePrice(item.product) * item.qty), 0), [cart, getEffectivePrice]);
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    return appliedCoupon.discount_type === 'PERCENTAGE' ? cartTotal * (appliedCoupon.discount_value / 100) : appliedCoupon.discount_value;
  }, [cartTotal, appliedCoupon]);

  const deliveryFee = useMemo(() => {
    if (!activeView || activeView.fulfillmentMode === 'PICKUP') return 0;
    const config = activeView.profile?.deliveryConfig;
    if (!config || !config.distanceTiers || config.distanceTiers.length === 0) return 0;
    if (config.freeDeliveryThreshold && cartTotal >= config.freeDeliveryThreshold) return 0;
    const storeLat = activeView.type === 'STALL' ? (activeView.data.latitude || activeView.profile?.latitude) : activeView.profile?.latitude;
    const storeLng = activeView.type === 'STALL' ? (activeView.data.longitude || activeView.profile?.longitude) : activeView.profile?.longitude;
    const activeDistance = userCoords && storeLat && storeLng ? calculateDistance(userCoords.lat, userCoords.lng, storeLat, storeLng) : null;
    if (activeDistance === null) return null; 
    if (config.maxDistance && activeDistance > config.maxDistance) return -1;
    const sortedTiers = [...config.distanceTiers].sort((a, b) => a.upToKm - b.upToKm);
    const applicableTier = sortedTiers.find(tier => activeDistance <= tier.upToKm);
    return applicableTier ? applicableTier.fee : (config.maxDistance && activeDistance <= config.maxDistance ? sortedTiers[sortedTiers.length - 1].fee : -1);
  }, [activeView, userCoords, cartTotal, calculateDistance]);

  const finalTotal = Math.max(0, cartTotal - discountAmount) + (typeof deliveryFee === 'number' && deliveryFee > 0 ? deliveryFee : 0);

  const checkout = async () => {
    if (!activeView?.whatsapp || deliveryFee === -1 || isCheckingOut) return;
    setIsCheckingOut(true);

    try {
      // PREPARAÇÃO DO PEDIDO PENDENTE (Salva no localStorage para inserção segura caso seja pago via Mercado Pago)
      const pendingNoteData = {
        workspace_id: activeView.workspaceId,
        created_by_id: user.id || 'anonymous',
        created_by_name: user.name || 'Cliente Marketplace',
        content: `Novo Pedido via Marketplace: ${cart.length} itens. Total: R$ ${finalTotal.toFixed(2)} (Pago online)`,
        type: 'MONEY',
        amount: finalTotal,
        is_read: false
      };

      // INTEGRAÇÃO MERCADO PAGO (Checkout Pro)
      try {
        toast.loading("Preparando pagamento seguro...");
        
        const mpItems: MPItem[] = cart.map(item => ({
          id: item.product.id,
          title: item.product.name,
          quantity: item.qty,
          unit_price: Number(getEffectivePrice(item.product)),
          currency_id: 'BRL'
        }));

        if (typeof deliveryFee === 'number' && deliveryFee > 0) {
          mpItems.push({
            title: 'Taxa de Entrega',
            quantity: 1,
            unit_price: deliveryFee,
            currency_id: 'BRL'
          });
        }

        if (discountAmount > 0) {
          mpItems.push({
            title: `Desconto Cupom: ${appliedCoupon?.code || ''}`,
            quantity: 1,
            unit_price: -discountAmount,
            currency_id: 'BRL'
          });
        }

        const externalReference = `ORDER_${Date.now()}_${activeView.workspaceId.substring(0, 8)}`;
        
        const preference = await createMPPreference(mpItems, activeView.workspaceId, externalReference);
        
        // Se a preferência for criada com sucesso, salvamos a notificação pendente para disparo apenas se o pagamento retornar `approved`!
        localStorage.setItem('marketplacePendingNote', JSON.stringify(pendingNoteData));
        
        toast.dismiss();
        toast.success("Redirecionando para pagamento...");
        
        setTimeout(() => {
          redirectToMPCheckout(preference.init_point);
          setIsCheckingOut(false);
        }, 1000);
        
        return; // Finaliza aqui, pois o redirecionamento tira do app
      } catch (mpError: any) {
        console.error("Erro no Mercado Pago:", mpError);
        toast.dismiss();
        const errorMessage = mpError.message || "Erro no pagamento";
        toast.error(`Falha no Checkout Seguro: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}. Tentando via WhatsApp.`);
        
        // Em caso de falha no MP e fallback apenas para o WhatsApp, precisamos disparar a notificação direto no banco agora
        try {
          await supabase.from('notes').insert({ ...pendingNoteData, content: pendingNoteData.content.replace(' (Pago online)', ' (Via WhatsApp)') });
        } catch (e) {
          console.warn("Falha ao registrar notificação de pedido fallback no banco:", e);
        }
      }

      let message = `*NOVO PEDIDO - ${activeView.displayName.toUpperCase()}*\n--------------------------------\n`;
    cart.forEach(item => { message += `▪ ${item.qty}x ${item.product.name} (R$ ${(getEffectivePrice(item.product) * item.qty).toFixed(2)})\n`; });
    message += `--------------------------------\n💰 *Subtotal: R$ ${(cartTotal || 0).toFixed(2)}*\n`;
    if (appliedCoupon) message += `🎟️ *Cupom (${appliedCoupon.code}): -R$ ${discountAmount.toFixed(2)}*\n`;
    if (deliveryFee !== null) message += `🛵 *Taxa de Entrega: ${deliveryFee === 0 ? 'Grátis' : 'R$ ' + deliveryFee.toFixed(2)}*\n`;
    message += `💰 *TOTAL A PAGAR: R$ ${(finalTotal || 0).toFixed(2)}*\n📍 *Entrega/Retirada:* ${activeView.fulfillmentMode === 'DELIVERY' ? 'Entrega' : activeView.fulfillmentMode === 'PICKUP' ? 'Retirada' : 'A Combinar'}`;
    window.open(`https://wa.me/55${activeView.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleOrderSingle = (item: any) => {
    if (!activeView?.whatsapp) return;
    const text = `Olá! Gostaria de pedir: *${item.name}* (R$ ${getEffectivePrice(item).toFixed(2)})`;
    window.open(`https://wa.me/55${activeView.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleMainAction = () => { if (activeView?.whatsapp) window.open(`https://wa.me/55${activeView.whatsapp}?text=${encodeURIComponent("Olá! Vim pelo App.")}`, '_blank'); };

  return {
    userInteractions, setUserInteractions, storeRatings, setStoreRatings,
    activeFilter, setActiveFilter, selectedStall, setSelectedStall,
    selectedProfile, setSelectedProfile, searchTerm, setSearchTerm,
    selectedProduct, setSelectedProduct, quantity, setQuantity,
    isLoadingMore, activeStory, setActiveStory, viewedStories,
    cart, isCartOpen, setIsCartOpen, couponCode, setCouponCode,
    appliedCoupon, couponError, isApplyingCoupon, isCheckingOut,
    ratingDraft, setRatingDraft, isSubmittingRating, setIsSubmittingRating,
    reportTarget, setReportTarget, reportReason, setReportReason, isReporting,
    visibleCount, items, activeView, displayItems, groupedItems, globalStories,
    loadMoreRef, getStoreDisplayName, calculateDistance, getEffectivePrice, getStoryToken,
    applyCoupon, handleReport, handleStoryClick, handleNextStory, handlePrevStory, handleStoryAction,
    addToCart, removeFromCart, checkout, handleOrderSingle, handleMainAction,
    cartTotal, discountAmount, deliveryFee, finalTotal,
    toggleInteraction, getUserInteractions, getStoreAverageRating, submitRating,
    setAppliedCoupon, isCartEnabled
  };
};
