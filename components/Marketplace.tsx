import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { User, AppSection, StoreProfile, PortfolioItem, SubscriptionPlan } from '../types';
import { useStoreProfiles } from '../hooks/useStoreProfiles';
import { SystemPromoBanner } from './SystemPromoBanner';
import { 
  LogOut, MapPin, Store, Smartphone, Navigation, Clock, 
  ChevronRight, Flag, Search, ShoppingCart, ArrowRight,
  MessageCircle, ExternalLink, Bike, ShoppingBag, X,
  Plus, Minus, Trash2, Receipt, CheckCircle, Zap, Instagram, Sparkles, Loader2, Heart, Star
} from 'lucide-react';
import { useStoreInteractions } from '../hooks/useStoreInteractions';

// Helper to calculate distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

interface MarketplaceProps {
  user: User;
  onLogout: () => void;
  stores: StoreProfile[];
  stalls: AppSection[];
  onRefresh: () => void;
  plans: SubscriptionPlan[];
  onNavigate: (tab: string) => void;
}

interface CartItem {
  product: any;
  qty: number;
}

export const Marketplace: React.FC<MarketplaceProps> = ({ user, onLogout, stores, stalls, onRefresh, plans, onNavigate }) => {
  // We only use the hook here to get the 'getMyProfile' utility function for detailed views.
  // The main list data is now passed via props (stores, stalls).
  const { getMyProfile } = useStoreProfiles();
  const { toggleInteraction, getUserInteractions, getStoreAverageRating, submitRating } = useStoreInteractions(user.id);
  const [userInteractions, setUserInteractions] = useState<{follows: string[], favorites: string[], ratings: any[]}>({follows: [], favorites: [], ratings: []});
  const [storeRatings, setStoreRatings] = useState<Record<string, {average: number, count: number}>>({});
  
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'STORES' | 'STALLS'>('ALL');
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [selectedStall, setSelectedStall] = useState<AppSection | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<StoreProfile | null>(null);
  const [freshProfile, setFreshProfile] = useState<StoreProfile | null>(null); // State for fresh data
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  
  // NEW: Story Viewer State (Multi-item support)
  const [activeStory, setActiveStory] = useState<{ profile: StoreProfile; items: any[]; currentIndex: number } | null>(null);
  
  // State for Viewed Stories
  const [viewedStories, setViewedStories] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('viewed_stories');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const getEffectivePrice = (item: any) => {
    if (item.promotionalPrice && (!item.promoEndsAt || new Date(item.promoEndsAt).getTime() > Date.now())) {
      return item.promotionalPrice;
    }
    return item.price || 0;
  };

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
      console.error(e);
      setCouponError('Erro ao validar cupom');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Report State
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  // Data Refresh Effect
  useEffect(() => {
    onRefresh();
    
    // Fetch user interactions
    getUserInteractions().then(data => {
      setUserInteractions(data);
    });
  }, [onRefresh, getUserInteractions]);

  // Fetch ratings for all stores
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
    if (stores.length > 0) {
      fetchRatings();
    }
  }, [stores, getStoreAverageRating]);

  // GPS Effect (Isolated to run only once)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          // Silent fail or just log warning to prevent spam
          console.warn("GPS: Localização não obtida ou permissão negada. Ordenação por distância desativada.");
        },
        { 
          enableHighAccuracy: false, // Faster, less battery
          timeout: 15000,            // Give up after 15s
          maximumAge: 300000         // Accept cached position from last 5 mins
        }
      );
    }
  }, []); // Empty dependency array ensures this runs ONCE

  // Fetch fresh profile data when a store/stall is selected
  useEffect(() => {
    const target = selectedStall || selectedProfile;
    if (target) {
        setFreshProfile(null); // Reset previous data
        // Fetch specific profile data to ensure highlights/stories are up to date
        getMyProfile(target.workspaceId).then(p => {
            if (p) setFreshProfile(p);
        });
    } else {
        setFreshProfile(null);
    }
  }, [selectedStall, selectedProfile, getMyProfile]);

  // Reset Quantity when product changes
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
      toast.success("Denúncia enviada com sucesso. Nossa equipe analisará em breve.");
      setReportTarget(null);
      setReportReason('');
    } catch (e) {
      toast.error("Erro ao enviar denúncia.");
    } finally {
      setIsReporting(false);
    }
  };

  // Determine active view data (Stall or Profile)
  const activeView = useMemo(() => {
    if (selectedStall) {
      // Use freshProfile if available, otherwise fallback to cache list
      const linkedProfile = freshProfile || stores.find(p => p.workspaceId === selectedStall.workspaceId);
      
      let finalWhatsapp = '';
      if (selectedStall.whatsappMode === 'MANUAL' && selectedStall.manualWhatsapp) {
        finalWhatsapp = selectedStall.manualWhatsapp;
      } else if (linkedProfile?.whatsapp) {
        finalWhatsapp = linkedProfile.whatsapp;
      }

      return {
        type: 'STALL',
        data: selectedStall,
        profile: linkedProfile,
        displayName: linkedProfile?.name || selectedStall.name,
        subName: linkedProfile ? selectedStall.name : 'Ponto de Venda',
        whatsapp: finalWhatsapp,
        address: selectedStall.address || linkedProfile?.address,
        imageUrl: selectedStall.imageUrl || linkedProfile?.logoUrl,
        fulfillmentMode: selectedStall.fulfillmentMode || 'PICKUP',
        description: selectedStall.description || linkedProfile?.description,
        openingHours: selectedStall.openingHours
      };
    } 
    
    if (selectedProfile) {
      // Use freshProfile if available
      const profileToUse = freshProfile || selectedProfile;

      return {
        type: 'STORE',
        data: null,
        profile: profileToUse,
        displayName: profileToUse.name,
        subName: 'Loja Oficial',
        whatsapp: profileToUse.whatsapp,
        address: profileToUse.address,
        imageUrl: profileToUse.logoUrl,
        fulfillmentMode: profileToUse.fulfillmentMode || 'BOTH',
        description: profileToUse.description,
        openingHours: null
      };
    }

    return null;
  }, [selectedStall, selectedProfile, stores, freshProfile]);

  // Clear cart when store changes or closes
  useEffect(() => {
    if (!activeView) {
      setCart([]);
      setIsCartOpen(false);
    }
  }, [activeView]);

  const items = useMemo(() => {
    let list: any[] = [];
    
    if (activeFilter === 'ALL' || activeFilter === 'STALLS') {
      list = [...list, ...stalls.map(s => ({ type: 'STALL', data: s }))];
    }
    
    if (activeFilter === 'ALL' || activeFilter === 'STORES') {
      list = [...list, ...stores.filter(p => p.active).map(p => ({ type: 'STORE', data: p }))];
    }

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
            const latA = a.data.latitude;
            const lngA = a.data.longitude;
            const latB = b.data.latitude;
            const lngB = b.data.longitude;

            if (!latA || !lngA) return 1;
            if (!latB || !lngB) return -1;

            const distA = calculateDistance(userCoords.lat, userCoords.lng, latA, lngA);
            const distB = calculateDistance(userCoords.lat, userCoords.lng, latB, lngB);
            return distA - distB;
        });
    }

    return list;
  }, [stalls, stores, activeFilter, searchTerm, userCoords]);

  const displayItems = useMemo(() => {
    if (!activeView) return [];

    if (activeView.type === 'STALL' && activeView.data?.items && activeView.data.items.length > 0) {
       return activeView.data.items.map((item: any) => ({
          name: item.name,
          description: 'Pronta Entrega',
          price: item.defaultPrice || item.defaultPriceAVista || 0,
          imageUrl: item.imageUrl,
          id: item.id
       }));
    }

    if (activeView.profile?.portfolio) {
       return activeView.profile.portfolio;
    }

    return [];
  }, [activeView]);

  // NEW: Calculate Global Stories GROUPED BY PROFILE
  const globalStories = useMemo(() => {
    const grouped: { profile: StoreProfile; items: any[] }[] = [];
    const now = Date.now();

    stores.forEach(profile => {
      if (profile.active && profile.portfolio) {
        const validItems = profile.portfolio.filter((item: any) => 
          item.highlightExpiresAt && new Date(item.highlightExpiresAt).getTime() > now
        );
        if (validItems.length > 0) {
          grouped.push({ profile, items: validItems });
        }
      }
    });

    // Shuffle slightly to give everyone a chance
    return grouped.sort(() => Math.random() - 0.5);
  }, [stores]);

  const handleStoryClick = (data: { profile: StoreProfile; items: any[] }) => {
    setActiveStory({ profile: data.profile, items: data.items, currentIndex: 0 });
    
    // Mark as viewed
    if (!viewedStories.has(data.profile.id)) {
      const newSet = new Set(viewedStories);
      newSet.add(data.profile.id);
      setViewedStories(newSet);
      localStorage.setItem('viewed_stories', JSON.stringify(Array.from(newSet)));
    }
  };

  // Auto-advance logic for stories
  useEffect(() => {
    if (!activeStory) return;
    
    const timer = setTimeout(() => {
        handleNextStory();
    }, 5000); // 5 seconds per story item

    return () => clearTimeout(timer);
  }, [activeStory?.currentIndex, activeStory?.profile.id]);

  const handleNextStory = () => {
    if (!activeStory) return;
    if (activeStory.currentIndex < activeStory.items.length - 1) {
        setActiveStory(prev => prev ? ({ ...prev, currentIndex: prev.currentIndex + 1 }) : null);
    } else {
        setActiveStory(null); // Close viewer if last item finished
    }
  };

  const handlePrevStory = () => {
    if (!activeStory) return;
    if (activeStory.currentIndex > 0) {
        setActiveStory(prev => prev ? ({ ...prev, currentIndex: prev.currentIndex - 1 }) : null);
    } else {
        setActiveStory(prev => prev ? ({ ...prev, currentIndex: 0 }) : null); // Restart first item
    }
  };

  const handleStoryAction = () => {
    if (!activeStory) return;
    const currentItem = activeStory.items[activeStory.currentIndex];
    // Transition to store/product view for purchase
    setSelectedProfile(activeStory.profile);
    setSelectedProduct(currentItem);
    setActiveStory(null);
  };

  const isCartEnabled = useMemo(() => {
    if (!activeView) return false;
    return activeView.fulfillmentMode === 'DELIVERY' || activeView.fulfillmentMode === 'BOTH';
  }, [activeView]);

  const handleOrderSingle = (item: any) => {
    if (!activeView?.whatsapp) {
      toast.error("Esta loja não configurou um WhatsApp para pedidos.");
      return;
    }
    const price = getEffectivePrice(item);
    const text = `Olá! Gostaria de pedir: *${item.name}* (R$ ${price.toFixed(2)})`;
    window.open(`https://wa.me/55${activeView.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleMainAction = () => {
    if (!activeView?.whatsapp) return;
    window.open(`https://wa.me/55${activeView.whatsapp}?text=${encodeURIComponent("Olá! Vim pelo App e gostaria de ver o cardápio.")}`, '_blank');
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    setCart(prev => [...prev, { product: selectedProduct, qty: quantity }]);
    setSelectedProduct(null);
  };

  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
    if (newCart.length === 0) setIsCartOpen(false);
  };

  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (getEffectivePrice(item.product) * item.qty), 0), [cart]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discount_type === 'PERCENTAGE') {
      return cartTotal * (appliedCoupon.discount_value / 100);
    }
    return appliedCoupon.discount_value;
  }, [cartTotal, appliedCoupon]);

  const deliveryFee = useMemo(() => {
    if (!activeView || activeView.fulfillmentMode === 'PICKUP') return 0;
    const config = activeView.profile?.deliveryConfig;
    
    // Se não há configuração ou não há faixas de distância, é grátis por padrão
    if (!config || !config.distanceTiers || config.distanceTiers.length === 0) return 0;

    // Frete grátis por valor
    if (config.freeDeliveryThreshold && cartTotal >= config.freeDeliveryThreshold) return 0;

    // Pegar coordenadas da loja (priorizar da barraca se for o caso)
    const storeLat = activeView.type === 'STALL' ? (activeView.data.latitude || activeView.profile?.latitude) : activeView.profile?.latitude;
    const storeLng = activeView.type === 'STALL' ? (activeView.data.longitude || activeView.profile?.longitude) : activeView.profile?.longitude;

    const hasStoreCoords = typeof storeLat === 'number' && typeof storeLng === 'number' && (storeLat !== 0 || storeLng !== 0);

    const activeDistance = userCoords && hasStoreCoords
      ? calculateDistance(userCoords.lat, userCoords.lng, storeLat, storeLng) 
      : null;

    // Se não temos a distância (localização desativada), mas existem faixas, 
    // retornamos null para indicar que o cálculo depende da localização.
    if (activeDistance === null) return null; 

    if (config.maxDistance && activeDistance > config.maxDistance) return -1; // Fora da área

    const sortedTiers = [...config.distanceTiers].sort((a, b) => a.upToKm - b.upToKm);
    const applicableTier = sortedTiers.find(tier => activeDistance <= tier.upToKm);

    if (applicableTier) return applicableTier.fee;

    // Se estiver dentro da distância máxima mas acima da última faixa
    if (config.maxDistance && activeDistance <= config.maxDistance) {
       return sortedTiers[sortedTiers.length - 1].fee;
    }

    return -1;
  }, [activeView, userCoords, cartTotal]);

  const finalTotal = Math.max(0, cartTotal - discountAmount) + (typeof deliveryFee === 'number' && deliveryFee > 0 ? deliveryFee : 0);

  const checkout = () => {
    if (!activeView?.whatsapp) return;
    
    if (deliveryFee === -1) {
      toast.error("Desculpe, você está fora da área de entrega desta loja.");
      return;
    }

    if (deliveryFee === null && activeView.fulfillmentMode !== 'PICKUP') {
      toast.error("Por favor, ative sua localização para calcular a taxa de entrega.");
      return;
    }

    let message = `*NOVO PEDIDO - ${activeView.displayName.toUpperCase()}*\n`;
    message += `--------------------------------\n`;
    cart.forEach(item => {
      const price = getEffectivePrice(item.product);
      message += `▪ ${item.qty}x ${item.product.name} (R$ ${(price * item.qty).toFixed(2)})\n`;
    });
    message += `--------------------------------\n`;
    message += `💰 *Subtotal: R$ ${(cartTotal || 0).toFixed(2)}*\n`;
    
    if (appliedCoupon) {
      message += `🎟️ *Cupom (${appliedCoupon.code}): -R$ ${discountAmount.toFixed(2)}*\n`;
    }

    if (activeView.fulfillmentMode !== 'PICKUP' && deliveryFee > 0) {
      message += `🛵 *Taxa de Entrega: R$ ${deliveryFee.toFixed(2)}*\n`;
    } else if (activeView.fulfillmentMode !== 'PICKUP' && deliveryFee === 0) {
      message += `🛵 *Taxa de Entrega: Grátis*\n`;
    }
    message += `💰 *TOTAL A PAGAR: R$ ${(finalTotal || 0).toFixed(2)}*\n`;
    message += `📍 *Entrega/Retirada:* ${activeView.fulfillmentMode === 'DELIVERY' ? 'Entrega' : activeView.fulfillmentMode === 'PICKUP' ? 'Retirada' : 'A Combinar'}`;

    window.open(`https://wa.me/55${activeView.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Helper variables for Active Story render
  const currentStoryItem = activeStory ? activeStory.items[activeStory.currentIndex] : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white p-6 rounded-b-[2.5rem] shadow-xl sticky top-0 z-20">
         <div className="flex justify-between items-center mb-6">
            <div>
               <h2 className="text-2xl font-black text-slate-800">Marketplace</h2>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Encontre o melhor da região</p>
            </div>
            <button onClick={onLogout} className="p-3 bg-slate-100 text-rose-500 rounded-2xl hover:bg-rose-50 transition-all">
               <LogOut size={20} />
            </button>
         </div>

         <div className="relative mb-6">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               placeholder="O QUE VOCÊ PROCURA?" 
               className="w-full p-5 pl-14 bg-slate-50 rounded-[1.8rem] font-bold text-xs uppercase outline-none focus:ring-4 focus:ring-blue-50 transition-all"
            />
         </div>

         <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button onClick={() => setActiveFilter('ALL')} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${activeFilter === 'ALL' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Todos</button>
            <button onClick={() => setActiveFilter('STORES')} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${activeFilter === 'STORES' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Lojas</button>
            <button onClick={() => setActiveFilter('STALLS')} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${activeFilter === 'STALLS' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Barracas</button>
         </div>
      </div>

      {/* GLOBAL STORIES SECTION */}
      {globalStories.length > 0 && (
        <div className="pt-6 px-2">
           <div className="flex gap-2 items-center mb-4 px-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destaques do Dia</h3>
           </div>
           <div className="overflow-x-auto no-scrollbar pb-4 -mx-2 px-2">
              <div className="flex gap-4">
                 {globalStories.map((storeData, i) => {
                    const firstItem = storeData.items[0];
                    const isViewed = viewedStories.has(storeData.profile.id);
                    
                    return (
                      <button 
                         key={`${storeData.profile.id}_${i}`}
                         onClick={() => handleStoryClick(storeData)}
                         className="flex flex-col items-center gap-2 group min-w-[70px]"
                      >
                         <div className={`w-16 h-16 rounded-full p-[3px] transition-all animate-in zoom-in-50 duration-500 ${isViewed ? 'bg-slate-300' : 'bg-gradient-to-tr from-amber-400 to-rose-600'}`}>
                            <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-slate-100 relative">
                               {/* Use first item image for story preview, or logo if missing */}
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
                            <p className={`text-[9px] font-bold leading-tight line-clamp-1 w-20 truncate ${isViewed ? 'text-slate-400' : 'text-slate-700'}`}>{storeData.profile.name}</p>
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
      )}

      <div className="p-4 space-y-4">
         {user.role === 'OWNER' && <SystemPromoBanner plans={plans} user={user} onNavigate={onNavigate} variant="MARKETPLACE" />}
         
         {items.map((item: any) => {
            const isStall = item.type === 'STALL';
            const data = item.data;
            const distance = userCoords && data.latitude && data.longitude ? calculateDistance(userCoords.lat, userCoords.lng, data.latitude, data.longitude) : null;
            const linkedProfile = isStall ? stores.find(p => p.workspaceId === data.workspaceId) : data;
            const displayName = linkedProfile?.name || data.name;
            const displayImage = isStall ? (data.imageUrl || linkedProfile?.logoUrl) : data.logoUrl;
            const subTitle = isStall ? (linkedProfile ? data.name : 'Ponto de Venda') : (data.address || 'Loja Física');

            return (
               <button 
                  key={`${item.type}_${data.id}`}
                  onClick={() => isStall ? setSelectedStall(data) : setSelectedProfile(data)}
                  className="w-full bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-5 text-left group active:scale-95 transition-all relative overflow-hidden"
               >
                  <div className="w-20 h-20 bg-slate-100 rounded-[1.8rem] overflow-hidden shrink-0 shadow-inner">
                     {displayImage ? (
                        <img src={displayImage} className="w-full h-full object-cover" />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                           {isStall ? <Smartphone /> : <Store />}
                        </div>
                     )}
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${isStall ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                           {isStall ? 'Ponto de Rua' : 'Loja'}
                        </span>
                        {distance !== null && (
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
         })}
         
         {items.length === 0 && (
            <div className="py-20 text-center opacity-50">
               <Store className="w-16 h-16 mx-auto mb-4 text-slate-300" />
               <p className="font-black text-slate-400 uppercase tracking-widest">Nenhum resultado encontrado</p>
            </div>
         )}
      </div>

      {/* STORY VIEWER MODAL */}
      {activeStory && currentStoryItem && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
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
                          {activeStory.profile.logoUrl ? <img src={activeStory.profile.logoUrl} className="w-full h-full object-cover"/> : <div className="flex items-center justify-center h-full text-white font-black">{activeStory.profile.name.charAt(0)}</div>}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-white text-sm shadow-black drop-shadow-md leading-none">{activeStory.profile.name}</span>
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
      )}

      {/* MODAL DETALHES UNIFICADO */}
      {activeView && (
         <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-md h-[85vh] sm:h-auto sm:max-h-[90vh] rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col shadow-3xl animate-in slide-in-from-bottom-10">
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
                      <button onClick={() => { setSelectedStall(null); setSelectedProfile(null); }} className="absolute top-4 right-4 p-2 bg-black/20 text-white rounded-full backdrop-blur-md z-10 hover:bg-black/30 transition-all">
                          <X size={20} />
                      </button>
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
                                {activeView.type === 'STALL' ? 'Barraca' : 'Loja'}
                             </span>
                             
                             {activeView.fulfillmentMode === 'DELIVERY' && <span className="px-2 py-0.5 bg-sky-100 text-sky-600 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Bike size={8} /> Apenas Entrega</span>}
                             {activeView.fulfillmentMode === 'PICKUP' && <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><ShoppingBag size={8} /> Retirada no Local</span>}
                             {activeView.fulfillmentMode === 'BOTH' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Store size={8} /> Entrega & Retirada</span>}
                          </div>
                          
                          {/* Interactions Row */}
                          <div className="flex items-center justify-center gap-4 mb-4">
                              <button 
                                onClick={async () => {
                                    const workspaceId = activeView.data?.workspaceId || activeView.profile?.workspaceId;
                                    if (!workspaceId) return;
                                    
                                    // Optimistic update
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
                                        // Revert on failure
                                        const updated = await getUserInteractions();
                                        setUserInteractions(updated);
                                    }
                                }}
                                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                                    userInteractions.follows.includes(activeView.data?.workspaceId || activeView.profile?.workspaceId || '') 
                                    ? 'bg-slate-800 text-white' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                  {userInteractions.follows.includes(activeView.data?.workspaceId || activeView.profile?.workspaceId || '') ? 'Seguindo' : 'Seguir'}
                              </button>
                              
                              <button 
                                onClick={async () => {
                                    const workspaceId = activeView.data?.workspaceId || activeView.profile?.workspaceId;
                                    if (!workspaceId) return;
                                    
                                    // Optimistic update
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
                                        // Revert on failure
                                        const updated = await getUserInteractions();
                                        setUserInteractions(updated);
                                    }
                                }}
                                className={`p-2 rounded-full transition-all ${
                                    userInteractions.favorites.includes(activeView.data?.workspaceId || activeView.profile?.workspaceId || '') 
                                    ? 'bg-rose-100 text-rose-500' 
                                    : 'bg-slate-100 text-slate-400 hover:text-rose-500'
                                }`}
                              >
                                  <Heart size={20} className={userInteractions.favorites.includes(activeView.data?.workspaceId || activeView.profile?.workspaceId || '') ? 'fill-rose-500' : ''} />
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
                             onClick={() => setReportTarget(activeView.data?.workspaceId || activeView.profile?.workspaceId || null)}
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
                                  {storeRatings[activeView.data?.workspaceId || activeView.profile?.workspaceId || '']?.count > 0 && (
                                      <div className="flex items-center gap-1 bg-amber-100 text-amber-600 px-2 py-1 rounded-full">
                                          <Star size={10} className="fill-amber-500" />
                                          <span className="text-[10px] font-black">{storeRatings[activeView.data?.workspaceId || activeView.profile?.workspaceId || ''].average.toFixed(1)}</span>
                                      </div>
                                  )}
                              </div>
                              
                              <div className="flex flex-col items-center gap-2 py-2">
                                  <p className="text-xs font-bold text-slate-500 text-center">Como foi sua experiência?</p>
                                  <div className="flex items-center gap-2">
                                      {[1, 2, 3, 4, 5].map((star) => {
                                          const currentRating = userInteractions.ratings.find(r => r.workspace_id === (activeView.data?.workspaceId || activeView.profile?.workspaceId))?.stars || 0;
                                          return (
                                              <button 
                                                  key={star}
                                                  onClick={async () => {
                                                      const workspaceId = activeView.data?.workspaceId || activeView.profile?.workspaceId;
                                                      if (!workspaceId) return;
                                                      await submitRating(workspaceId, star, '');
                                                      const updated = await getUserInteractions();
                                                      setUserInteractions(updated);
                                                      // Refresh global ratings
                                                      const newAvg = await getStoreAverageRating(workspaceId);
                                                      setStoreRatings(prev => ({...prev, [workspaceId]: newAvg}));
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
                              </div>
                          </div>

                          {displayItems.length > 0 && (
                             <div className="mt-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2 flex items-center gap-2">
                                   {isCartEnabled ? <ShoppingCart size={12} /> : <Store size={12} />} 
                                   {activeView.type === 'STALL' ? 'Disponível na Barraca' : 'Destaques do Cardápio'}
                                </p>
                                <div className="space-y-3">
                                   {displayItems.map((item: any, i: number) => (
                                      <button 
                                         key={i} 
                                         onClick={() => setSelectedProduct(item)}
                                         className="w-full flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-emerald-200 hover:bg-emerald-50/30 transition-all text-left group"
                                      >
                                         <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden shrink-0 relative">
                                            {item.imageUrl ? (
                                               <img src={item.imageUrl} className="w-full h-full object-cover" />
                                            ) : (
                                               <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                  {isCartEnabled ? <ShoppingCart size={16} /> : <ShoppingBag size={16} />}
                                               </div>
                                            )}
                                         </div>
                                         <div className="flex-1">
                                            <h4 className="font-black text-slate-700 text-xs uppercase group-hover:text-emerald-700 transition-colors">{item.name}</h4>
                                            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{item.description}</p>
                                            {item.promotionalPrice && (!item.promoEndsAt || new Date(item.promoEndsAt).getTime() > Date.now()) ? (
                                              <div className="flex items-center gap-2 mt-1">
                                                <p className="text-emerald-600 font-black text-sm">R$ {item.promotionalPrice.toFixed(2)}</p>
                                                <p className="text-slate-400 font-bold text-[10px] line-through">R$ {(item.price || 0).toFixed(2)}</p>
                                              </div>
                                            ) : (
                                              <p className="text-emerald-600 font-black text-sm mt-1">R$ {(item.price || 0).toFixed(2)}</p>
                                            )}
                                         </div>
                                         <div className="p-2 bg-slate-50 text-slate-300 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                            {isCartEnabled ? <Plus size={16} /> : <ChevronRight size={16} />}
                                         </div>
                                      </button>
                                   ))}
                                </div>
                             </div>
                          )}
                       </div>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* FLOATING CART BAR */}
      {isCartEnabled && cart.length > 0 && activeView && (
        <div className="fixed bottom-28 left-6 right-6 z-[60] animate-in slide-in-from-bottom-6">
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

      {/* MODAL CARRINHO */}
      {isCartOpen && activeView && (
         <div className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in slide-in-from-bottom-10">
            <div className="bg-white w-full max-w-sm h-[80vh] sm:h-auto rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-3xl flex flex-col">
               <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                     <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><ShoppingCart size={24} /></div>
                     <h3 className="text-xl font-black text-slate-800 uppercase">Seu Carrinho</h3>
                  </div>
                  <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-50 rounded-full"><X size={20} /></button>
               </div>

               <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {cart.map((item, idx) => {
                     const effectivePrice = getEffectivePrice(item.product);
                     return (
                       <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                             <p className="font-black text-slate-800 text-xs uppercase">{item.product.name}</p>
                             <p className="text-[10px] font-bold text-slate-400">{item.qty}x R$ {effectivePrice.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-4">
                             <p className="font-black text-emerald-600 text-sm">R$ {(item.qty * effectivePrice).toFixed(2)}</p>
                             <button onClick={() => removeFromCart(idx)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl"><Trash2 size={16} /></button>
                          </div>
                       </div>
                     );
                  })}
               </div>

               <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                  {/* Coupon Section */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Sparkles size={14} /></div>
                          <div>
                            <p className="text-[10px] font-black text-slate-800 uppercase">{appliedCoupon.code}</p>
                            <p className="text-[8px] font-bold text-emerald-600 uppercase">Cupom Aplicado</p>
                          </div>
                        </div>
                        <button onClick={() => setAppliedCoupon(null)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input 
                          value={couponCode} 
                          onChange={e => setCouponCode(e.target.value.toUpperCase())} 
                          placeholder="CUPOM DE DESCONTO" 
                          className="flex-1 bg-white p-3 rounded-xl text-[10px] font-black uppercase outline-none border border-slate-200 focus:border-emerald-500"
                        />
                        <button 
                          onClick={applyCoupon}
                          disabled={!couponCode || isApplyingCoupon}
                          className="px-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-50"
                        >
                          {isApplyingCoupon ? <Loader2 className="animate-spin" size={14} /> : 'Aplicar'}
                        </button>
                      </div>
                    )}
                    {couponError && <p className="text-[9px] font-bold text-rose-500 mt-2 ml-1">{couponError}</p>}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                     <span className="text-[10px] font-black uppercase text-slate-400">Subtotal</span>
                     <span className="text-sm font-black text-slate-600">R$ {(cartTotal || 0).toFixed(2)}</span>
                  </div>

                  {appliedCoupon && (
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-emerald-500">Desconto ({appliedCoupon.code})</span>
                       <span className="text-sm font-black text-emerald-600">- R$ {discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {activeView.fulfillmentMode !== 'PICKUP' && (
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-slate-400">Taxa de Entrega</span>
                       <span className={`text-sm font-black ${deliveryFee === 0 ? 'text-emerald-600' : deliveryFee === -1 ? 'text-rose-500' : 'text-slate-600'}`}>
                          {deliveryFee === 0 ? 'Grátis' : deliveryFee === -1 ? 'Fora da Área' : deliveryFee === null ? 'Ative o GPS' : `R$ ${deliveryFee.toFixed(2)}`}
                       </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                     <span className="text-xs font-black uppercase text-slate-400">Total a Pagar</span>
                     <span className="text-2xl font-black text-slate-800">R$ {(finalTotal || 0).toFixed(2)}</span>
                  </div>
                  
                  <button 
                    onClick={checkout} 
                    disabled={deliveryFee === -1}
                    className={`w-full py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all ${deliveryFee === -1 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white'}`}
                  >
                     <MessageCircle size={20} /> Enviar Pedido
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* MODAL DETALHES DO PRODUTO */}
      {selectedProduct && (
          <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
             <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl relative overflow-y-auto max-h-[90vh]">
                <button 
                  onClick={() => setSelectedProduct(null)} 
                  className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 transition-all z-10"
                >
                   <X size={20} />
                </button>

                <div className="w-full aspect-square bg-slate-100 rounded-[2rem] mb-6 overflow-hidden shadow-inner flex items-center justify-center relative">
                   {selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} className="w-full h-full object-cover" />
                   ) : (
                      <div className="text-slate-300">
                         <ShoppingBag size={48} />
                      </div>
                   )}
                </div>

                <div className="mb-8">
                   <h3 className="text-2xl font-black text-slate-800 uppercase leading-tight mb-2">{selectedProduct.name}</h3>
                   <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">
                      {selectedProduct.description || 'Sem descrição detalhada.'}
                   </p>
                   
                   <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Preço Unitário</p>
                         <p className="text-2xl font-black text-emerald-600">R$ {(selectedProduct.price || 0).toFixed(2)}</p>
                      </div>
                      {isCartEnabled && (
                         <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:bg-slate-200"><Minus size={16} /></button>
                            <span className="font-black text-lg w-6 text-center">{quantity}</span>
                            <button onClick={() => setQuantity(quantity + 1)} className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"><Plus size={16} /></button>
                         </div>
                      )}
                   </div>
                </div>

                {isCartEnabled ? (
                   <button 
                      onClick={addToCart}
                      className="w-full py-5 bg-slate-900 text-white rounded-[1.8rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                   >
                      <Plus size={20} /> Adicionar - R$ {((selectedProduct.price || 0) * quantity).toFixed(2)}
                   </button>
                ) : (
                   <button 
                      onClick={() => handleOrderSingle(selectedProduct)}
                      className="w-full py-5 bg-emerald-600 text-white rounded-[1.8rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-emerald-500"
                   >
                      <MessageCircle size={20} /> Pedir no WhatsApp
                   </button>
                )}
             </div>
          </div>
      )}

      {/* MODAL DE DENÚNCIA */}
      {reportTarget && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl text-center border-4 border-rose-100">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2"><Flag className="text-rose-500" /> Denunciar</h3>
                 <button onClick={() => setReportTarget(null)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200"><X size={20} /></button>
              </div>
              <p className="text-sm text-slate-500 font-medium mb-6 text-left">
                 Por que você está denunciando esta empresa?
              </p>
              <textarea 
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Ex: Golpe, conteúdo impróprio, loja falsa..."
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:border-rose-400 min-h-[100px] text-sm mb-6 resize-none"
              />
              <button 
                onClick={handleReport}
                disabled={isReporting || !reportReason.trim()}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isReporting ? <span className="animate-spin">⏳</span> : 'Enviar Denúncia'}
              </button>
           </div>
        </div>
      )}
    </div>
  );
};
