
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { StoreProfile, PortfolioItem, AppSection } from '../types';
import { 
  Save, Plus, Trash2, Edit3, 
  ShoppingBag, Check, X, Loader2,
  ImageIcon, ShoppingCart, Upload, Camera,
  Zap, Clock, DollarSign, Sparkles, MessageCircle, AlertTriangle, CheckCircle2, Bike, Store as StoreIcon, DownloadCloud, Wallet
} from 'lucide-react';

interface MarketplaceManagerProps {
  profile: StoreProfile | null;
  onSave: (profile: Partial<StoreProfile> & { workspaceId: string }) => Promise<StoreProfile | null>;
  workspaceId: string;
  user: { id: string; name: string; hasProPlan?: boolean; workspaceId: string };
  sections?: AppSection[];
  onDirtyChange?: (isDirty: boolean) => void;
}

export const MarketplaceManager: React.FC<MarketplaceManagerProps> = ({ profile, onSave, workspaceId, user, sections = [], onDirtyChange }) => {
  const isPro = !!user.hasProPlan;

  const [formData, setFormData] = useState<Omit<StoreProfile, 'id'>>({
    workspaceId: profile?.workspaceId || workspaceId,
    name: profile?.name || '',
    description: profile?.description || '',
    address: profile?.address || '',
    whatsapp: profile?.whatsapp || '',
    cnpj: profile?.cnpj || '',
    instagram: profile?.instagram || '',
    facebook: profile?.facebook || '',
    logoUrl: profile?.logoUrl || '',
    bannerUrl: profile?.bannerUrl || '',
    latitude: profile?.latitude || 0,
    longitude: profile?.longitude || 0,
    active: profile?.active ?? false,
    portfolio: profile?.portfolio || [],
    fulfillmentMode: profile?.fulfillmentMode || 'BOTH'
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  // AUTO-SYNC: Ativa a chave visual se o plano virou PRO enquanto a tela está aberta
  useEffect(() => {
    if (isPro && !formData.active && profile) {
      setFormData(prev => ({ ...prev, active: true }));
    }
  }, [isPro, profile]);

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({ ...prev, ...profile, active: profile.active }));
    }
  }, [profile]);

  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);

  // Detect dirty state
  useEffect(() => {
    if (!onDirtyChangeRef.current) return;
    
    // Normalization helper to compare only relevant fields and handle nulls consistently
    const normalize = (data: any) => ({
      workspaceId: data?.workspaceId || workspaceId,
      name: data?.name || '',
      description: data?.description || '',
      address: data?.address || '',
      whatsapp: data?.whatsapp || '',
      cnpj: data?.cnpj || '',
      instagram: data?.instagram || '',
      facebook: data?.facebook || '',
      logoUrl: data?.logoUrl || '',
      bannerUrl: data?.bannerUrl || '',
      latitude: Number(data?.latitude) || 0,
      longitude: Number(data?.longitude) || 0,
      active: !!data?.active,
      portfolio: (data?.portfolio || []).map((item: any) => ({
         name: item.name || '',
         category: item.category || '',
         price: Number(item.price) || 0,
         description: item.description || '',
         imageUrl: item.imageUrl || '',
         available: item.available ?? true,
         promotionalPrice: item.promotionalPrice || null,
         promoEndsAt: item.promoEndsAt || null,
         highlightExpiresAt: item.highlightExpiresAt || null,
         linkedFactoryItemId: item.linkedFactoryItemId || null,
         useFactoryPrice: !!item.useFactoryPrice
      })),
      fulfillmentMode: data?.fulfillmentMode || 'BOTH'
    });

    const currentNormalized = normalize(formData);
    const profileNormalized = normalize(profile);

    const isDirty = JSON.stringify(currentNormalized) !== JSON.stringify(profileNormalized);
    
    // Only update parent if status actually changed
    if (onDirtyChangeRef.current && isDirty !== lastDirtyRef.current) {
      lastDirtyRef.current = isDirty;
      // Using setTimeout to ensure it happens after the current render cycle
      setTimeout(() => onDirtyChangeRef.current?.(isDirty), 0);
    }
  }, [formData, profile, workspaceId]);

  const lastDirtyRef = useRef<boolean>(false);

  const [showItemModal, setShowItemModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFactoryItems, setSelectedFactoryItems] = useState<string[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Categorization Logic
  const categorizedPortfolio = React.useMemo(() => {
    const groups: Record<string, { items: (PortfolioItem & { originalIndex: number })[] }> = {};
    
    formData.portfolio.forEach((item, idx) => {
      const cat = (item.category || 'SEM CATEGORIA').toUpperCase().trim();
      if (!groups[cat]) groups[cat] = { items: [] };
      groups[cat].items.push({ ...item, originalIndex: idx });
    });
    
    return groups;
  }, [formData.portfolio]);

  const existingCategories = React.useMemo(() => {
    const cats = new Set<string>();
    formData.portfolio.forEach(item => {
      if (item.category) cats.add(item.category.toUpperCase().trim());
    });
    return Array.from(cats).sort();
  }, [formData.portfolio]);

  const [newItem, setNewItem] = useState<PortfolioItem>({
    id: Date.now().toString(),
    name: '',
    category: '',
    price: 0,
    description: '',
    imageUrl: '',
    available: true
  });

  const [mpAuthUrl, setMpAuthUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    if (!profile?.mpAccessToken && workspaceId) {
        fetch(`/api/mercadopago/auth-url?workspaceId=${workspaceId}`)
            .then(res => res.json())
            .then(data => {
                if (isMounted && data.url) setMpAuthUrl(data.url);
            })
            .catch(err => console.error("Erro MP URL:", err));
    }
    return () => { isMounted = false; };
  }, [workspaceId, profile?.mpAccessToken]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // In a real environment, you'd check event.origin for security
      if (event.data === 'MP_AUTH_SUCCESS' || event.data?.type === 'MP_AUTH_SUCCESS') {
        const raw = event.data?.payload;
        if (raw && onSave) {
           const mappedPayload = {
             mpAccessToken: raw.mp_access_token,
             mpRefreshToken: raw.mp_refresh_token,
             mpUserId: String(raw.mp_user_id),
             mpPublicKey: raw.mp_public_key
           };
           // Merge the existing profile fields to ensure NOT NULL columns are present during upsert
           onSave({ ...(profile || {}), ...mappedPayload, workspaceId }).then((result) => {
              if (result) {
                toast.success("Conta do Mercado Pago conectada com sucesso!");
                setTimeout(() => window.location.reload(), 1000);
              } else {
                toast.error("Falha ao salvar conta conectada.");
              }
           }).catch(err => {
              console.error("Erro ao salvar MP Auth via postMessage:", err);
              toast.error("Erro interno ao salvar Mercado Pago.");
           });
        } else {
           // Fallback for simple success message without payload
           toast.success("Conta do Mercado Pago conectada!");
           setTimeout(() => window.location.reload(), 1000); 
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSave, workspaceId, profile]);

  // Função para fazer upload de imagem para o Supabase Storage
  const uploadImageToStorage = async (base64Str: string): Promise<string | null> => {
    try {
      // Converte Base64 para Blob
      const base64Data = base64Str.split(',')[1];
      const type = base64Str.split(';')[0].split(':')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type });

      // Gera um nome de arquivo único
      const fileName = `${user.id}/portfolio_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

      const { data, error } = await supabase.storage
        .from('app_banners')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('app_banners')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (e) {
      console.error("Erro no upload para storage:", e);
      return null;
    }
  };

  // Função para comprimir novas imagens (Upload)
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress to JPEG 70% quality
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Função para comprimir imagens já existentes (Base64 String)
  const compressBase64 = (base64Str: string, maxWidth = 800): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
            resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleSave = async () => {
    if (saveStatus !== 'idle') return;
    setSaveStatus('saving');

    try {
      // MIGRAÇÃO E OTIMIZAÇÃO: Varre o portfólio em busca de imagens base64 para mover para o Storage
      const optimizedPortfolio = await Promise.all(formData.portfolio.map(async (item) => {
        // Se ainda for base64, sobe para o storage agora
        if (item.imageUrl && item.imageUrl.startsWith('data:image')) {
            try {
                // Comprime antes de subir se for muito grande
                let toUpload = item.imageUrl;
                if (toUpload.length > 200000) {
                    toUpload = await compressBase64(item.imageUrl);
                }
                const url = await uploadImageToStorage(toUpload);
                if (url) return { ...item, imageUrl: url };
            } catch (e) {
                console.warn("Falha ao migrar imagem para storage no save:", item.name);
            }
        }
        return item;
      }));

      // Atualiza o estado local com as URLs (limpa o base64 definitivamente)
      const updatedData = { ...formData, portfolio: optimizedPortfolio };
      setFormData(updatedData);

      const result = await onSave(updatedData);
      
      if (result) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        throw new Error("Falha no salvamento");
      }
    } catch (e) { 
      console.error(e);
      setSaveStatus('idle');
      toast.error("Erro ao salvar vitrine. Tente reduzir a quantidade de fotos ou a qualidade delas."); 
    }
  };

  const toggleActive = () => {
    // Permitir DESATIVAR sempre. Permitir ATIVAR apenas se for PRO.
    if (!isPro && !formData.active) {
      toast.error("Para ativar sua Vitrine Online, assine o Plano Profissional!");
      return;
    }
    setFormData(prev => ({ ...prev, active: !prev.active }));
  };

  const addOrUpdateItem = () => {
    if (!newItem.name || newItem.price <= 0) { toast.error("Preencha Nome e Valor."); return; }
    
    // TRIMS SPACES FROM CATEGORY TO PREVENT DUPLICATE COLUMNS
    const cleanedItem = {
      ...newItem,
      category: (newItem.category || '').trim()
    };

    const updatedPortfolio = [...(formData.portfolio || [])];
    if (editingItemIndex !== null) {
      updatedPortfolio[editingItemIndex] = cleanedItem;
    } else {
      updatedPortfolio.push({ ...cleanedItem, id: Date.now().toString() });
    }

    setFormData(prev => ({ ...prev, portfolio: updatedPortfolio }));
    setShowItemModal(false);
    setEditingItemIndex(null);
    setNewItem({ id: Date.now().toString(), name: '', category: '', price: 0, description: '', imageUrl: '', available: true });
  };

  const startEditItem = (idx: number) => {
    setEditingItemIndex(idx);
    setNewItem({ ...formData.portfolio[idx] });
    setShowItemModal(true);
  };

  const removeItem = (idx: number) => {
    const updated = formData.portfolio.filter((_, i) => i !== idx);
    setFormData({ ...formData, portfolio: updated });
    setItemToDelete(null);
  };

  const toggleHighlight = (idx: number) => {
    if (!isPro) {
      toast.error("A funcionalidade de Stories/Destaque é exclusiva para assinantes PRO.");
      return;
    }

    const updatedPortfolio = [...formData.portfolio];
    const item = { ...updatedPortfolio[idx] }; 
    const now = Date.now();

    if (item.highlightExpiresAt && new Date(item.highlightExpiresAt).getTime() > now) {
      delete item.highlightExpiresAt;
    } else {
      item.highlightExpiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    }
    
    updatedPortfolio[idx] = item; 
    setFormData({ ...formData, portfolio: updatedPortfolio });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const resizedBase64 = await resizeImage(file);
      // Fazer upload imediato para o Storage para evitar carregar o payload
      const storageUrl = await uploadImageToStorage(resizedBase64);
      
      if (storageUrl) {
         setNewItem(prev => ({ ...prev, imageUrl: storageUrl }));
         toast.success("Imagem processada com sucesso!");
      } else {
         // Fallback para base64 se o storage falhar (não recomendado, mas evita travar o user)
         setNewItem(prev => ({ ...prev, imageUrl: resizedBase64 }));
         toast.warning("Fallback: Imagem salva localmente (pode causar erro ao salvar vitrine cheia).");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao processar imagem.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImportFactoryItems = () => {
    if (selectedFactoryItems.length === 0) {
      toast.error("Selecione pelo menos um item para importar.");
      return;
    }

    const factorySections = sections.filter(s => s.type === 'FACTORY_STYLE');
    const allFactoryItems = factorySections.flatMap(s => s.items);
    
    const itemsToImport = allFactoryItems.filter(item => selectedFactoryItems.includes(item.id));
    
    const newPortfolioItems: PortfolioItem[] = itemsToImport.map(item => ({
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      name: item.name,
      category: item.category,
      price: item.price, // Preço inicial igual ao da fábrica
      description: '', // Descrição vazia para o dono preencher
      available: true,
      linkedFactoryItemId: item.id,
      useFactoryPrice: true // Por padrão, usa o preço da fábrica
    }));

    setFormData(prev => ({
      ...prev,
      portfolio: [...prev.portfolio, ...newPortfolioItems]
    }));

    setShowImportModal(false);
    setSelectedFactoryItems([]);
    toast.success(`${itemsToImport.length} itens importados com sucesso!`);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50 space-y-8">
        <div className="flex justify-between items-center">
           <div className="flex items-center gap-4">
              <div className="p-4 bg-emerald-600 text-white rounded-[1.5rem]"><ShoppingBag size={24} /></div>
              <div><h2 className="text-2xl font-black text-slate-800">Cardápio Vitrine</h2><p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Itens para Venda Direta</p></div>
           </div>
           <div className="flex gap-2">
             <button 
                onClick={() => setShowImportModal(true)} 
                className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl shadow-sm hover:scale-105 active:scale-95 transition-all"
                title="Importar da Fábrica"
             >
                <DownloadCloud size={24} />
             </button>
             <button 
                onClick={() => { setEditingItemIndex(null); setNewItem({ id: Date.now().toString(), name: '', category: '', price: 0, description: '', imageUrl: '', available: true }); setShowItemModal(true); }} 
                className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all"
             >
                <Plus size={24} />
             </button>
           </div>
        </div>

        <div className="space-y-3">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-4 flex items-center gap-1">
               <Bike size={10} /> Modo de Operação
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
               <button onClick={() => setFormData({...formData, fulfillmentMode: 'PICKUP'})} className={`py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${formData.fulfillmentMode === 'PICKUP' ? 'bg-white shadow-md text-orange-600' : 'text-slate-400'}`}>
                  <ShoppingBag size={14} />
                  <span className="text-[7px] font-black uppercase">Retirada</span>
               </button>
               <button onClick={() => setFormData({...formData, fulfillmentMode: 'DELIVERY'})} className={`py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${formData.fulfillmentMode === 'DELIVERY' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>
                  <Bike size={14} />
                  <span className="text-[7px] font-black uppercase">Entrega</span>
               </button>
               <button onClick={() => setFormData({...formData, fulfillmentMode: 'BOTH'})} className={`py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${formData.fulfillmentMode === 'BOTH' ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400'}`}>
                  <StoreIcon size={14} />
                  <span className="text-[7px] font-black uppercase">Ambos</span>
               </button>
            </div>
        </div>

        {/* Mercado Pago Integration */}
        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
                    <Wallet size={20} />
                 </div>
                 <div>
                    <h3 className="text-[10px] font-black text-slate-800 uppercase">Recebimentos (Mercado Pago)</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Ative o checkout automático e Pix</p>
                 </div>
              </div>
              {profile?.mpAccessToken ? (
                 <button 
                   className="px-4 py-2 rounded-xl text-[8px] font-black uppercase transition-all flex items-center gap-2 bg-emerald-50 text-emerald-600 border border-emerald-100"
                 >
                   <CheckCircle2 size={12} />
                   Conectado
                 </button>
              ) : (
                 <a 
                   href={mpAuthUrl || '#'}
                   target={mpAuthUrl ? "_blank" : "_self"}
                   
                   className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase transition-all flex items-center gap-2 bg-blue-600 text-white shadow-lg focus:outline-none ${!mpAuthUrl && 'opacity-50 cursor-not-allowed'}`}
                   onClick={(e) => {
                       if (!mpAuthUrl) {
                           e.preventDefault();
                           toast.error("Gerando link de conexão, aguarde...");
                       }
                   }}
                 >
                   <Zap size={12} />
                   Conectar Conta
                 </a>
              )}
           </div>
           
           {!profile?.mpAccessToken && (
             <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 animate-pulse">
               <AlertTriangle size={16} className="mt-0.5 shrink-0" />
               <p className="text-[9px] font-black uppercase leading-tight">
                 Atenção Crítica: Sua vitrine está no modo "CATÁLOGO" (Apenas via WhatsApp). <br/>
                 Você <span className="text-rose-600 underline">NÃO CONSEGUIRÁ</span> receber pagamentos via Pix ou Cartão enquanto não conectar sua conta do Mercado Pago abaixo.
               </p>
             </div>
           )}

           {!profile?.mpAccessToken && (
             <div className="p-4 bg-white rounded-xl border border-blue-100 flex flex-col gap-3">
                <p className="text-[8px] font-bold text-slate-500 leading-relaxed uppercase">
                   Ao conectar sua conta, você habilita o pagamento via **Pix**, **Cartão** e **Boleto** diretamente na sua vitrine. 
                   As vendas são creditadas na sua conta Mercado Pago instantaneamente (com dedução da taxa de marketplace se ativa).
                </p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-[8px] font-black text-rose-500 uppercase mb-2">Atenção Crítica:</p>
                  <p className="text-[8px] font-bold text-slate-600 mb-2 normal-case leading-relaxed">
                    Antes de clicar em "Conectar", você <strong>DEVE OBRIGATORIAMENTE</strong> copiar e colar a URL abaixo na configuração "URL de redirecionamento" do seu aplicativo no Dashboard do Mercado Pago e clicar em "Adicionar nova URL":
                  </p>
                  <div className="relative">
                    <input 
                      type="text" 
                      readOnly 
                      value={`${window.location.origin}/api/mercadopago/callback`}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-[9px] font-mono text-slate-700 select-all"
                    />
                  </div>
                </div>
             </div>
           )}
        </div>

        <div className="grid gap-8">
          {formData.portfolio.length === 0 ? (
            <div className="p-16 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                <ShoppingBag className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Seu cardápio está vazio.</p>
            </div>
          ) : (
            (Object.entries(categorizedPortfolio) as [string, { items: (PortfolioItem & { originalIndex: number })[] }][]).map(([categoryName, group]) => (
                <div key={categoryName} className="space-y-4">
                   <div className="flex items-center justify-between px-4">
                      <div className="flex items-center gap-2">
                         <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                         <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">{categoryName}</h3>
                         <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full text-[8px] font-black">{group.items.length}</span>
                      </div>
                      <button 
                         onClick={() => { 
                            setEditingItemIndex(null); 
                            setNewItem({ id: Date.now().toString(), name: '', category: categoryName, price: 0, description: '', imageUrl: '', available: true }); 
                            setShowItemModal(true); 
                         }}
                         className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                      >
                         <Plus size={12} /> Add Item
                      </button>
                   </div>

                   <div className="grid gap-3">
                      {group.items.map((item) => {
                        const isHighlighted = item.highlightExpiresAt && new Date(item.highlightExpiresAt).getTime() > Date.now();
                        const idx = item.originalIndex;
                        
                        return (
                          <div key={item.id} className={`p-4 rounded-[2rem] border flex items-center justify-between group transition-all ${isHighlighted ? 'bg-amber-50 border-amber-200 shadow-lg shadow-amber-900/5' : 'bg-white border-slate-100 hover:shadow-xl'}`}>
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-slate-50 rounded-2xl shadow-sm overflow-hidden flex-shrink-0 border border-slate-100 flex items-center justify-center relative">
                                    {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-200" />}
                                    {isHighlighted && <div className="absolute inset-0 border-2 border-amber-500 rounded-2xl animate-pulse" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <h4 className="font-black text-slate-800 text-xs uppercase tracking-tight flex items-center gap-1">
                                        {item.name}
                                        {isHighlighted && <Zap size={10} className="text-amber-500 fill-amber-500" />}
                                      </h4>
                                    </div>
                                    <p className="font-black text-emerald-600 text-xs">R$ {(item.price || 0).toFixed(2)}</p>
                                    {isHighlighted && <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">Destaque Ativo</p>}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => toggleHighlight(idx)} 
                                  className={`p-2.5 rounded-xl shadow-sm border transition-all ${isHighlighted ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-300 border-slate-100 hover:text-amber-500'}`}
                                  title="Promover para Stories"
                                >
                                  <Zap size={14} className={isHighlighted ? "fill-white" : ""} />
                                </button>
                                <button onClick={() => startEditItem(idx)} className="p-2.5 bg-white text-blue-500 rounded-xl shadow-sm border border-slate-100 hover:bg-blue-50 transition-colors"><Edit3 size={14} /></button>
                                <button 
                                  onClick={() => setItemToDelete(idx)} 
                                  className="p-2.5 bg-white text-rose-300 hover:text-rose-500 rounded-xl shadow-sm border border-slate-100 hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                          </div>
                        );
                      })}
                   </div>
                </div>
            ))
          )}
        </div>

        <div className="pt-8 border-t border-slate-100 space-y-6">
           <div className={`flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all ${isPro ? 'bg-emerald-50 border-emerald-100' : formData.active ? 'bg-orange-50 border-orange-200' : 'bg-slate-100 opacity-60'}`}>
              <button 
                onClick={toggleActive}
                className={`w-14 h-7 rounded-full relative transition-all ${formData.active ? (isPro ? 'bg-emerald-500' : 'bg-orange-500') : 'bg-slate-300'} ${!isPro && !formData.active ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${formData.active ? 'left-8' : 'left-1'}`} />
              </button>
              <div>
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{formData.active ? 'Loja Publicada' : 'Loja Oculta'}</p>
                <p className={`text-[8px] font-bold uppercase ${isPro ? 'text-emerald-600' : formData.active ? 'text-orange-600' : 'text-slate-400'}`}>
                    {isPro ? 'Sua vitrine está visível no Marketplace' : formData.active ? '⚠️ ATENÇÃO: Seu plano venceu. Desative a vitrine.' : 'Disponível apenas no Plano PRO'}
                </p>
              </div>
           </div>
           
           <button 
             onClick={handleSave} 
             disabled={saveStatus !== 'idle'} 
             className={`w-full py-5 rounded-[1.8rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${
               saveStatus === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
             }`}
           >
              {saveStatus === 'saving' ? (
                <><Loader2 className="animate-spin" size={20} /> Otimizando e Salvando...</>
              ) : saveStatus === 'success' ? (
                <><CheckCircle2 size={20} /> Vitrine Salva com Sucesso!</>
              ) : (
                <><Save size={20} /> Salvar Vitrine Completa</>
              )}
           </button>
        </div>
      </div>

      {/* MODAL PRODUTO PORTFÓLIO */}
      {showItemModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black text-slate-800 uppercase">Item do Cardápio</h3>
                 <button onClick={() => setShowItemModal(false)}><X size={24} /></button>
              </div>
              <div className="space-y-4 mb-8">
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Foto do Salgado</label>
                    <div onClick={() => !isUploadingImage && fileInputRef.current?.click()} className="w-full h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden flex items-center justify-center cursor-pointer hover:border-emerald-500 transition-all group relative">
                       {isUploadingImage ? <Loader2 className="animate-spin" /> : newItem.imageUrl ? <><img src={newItem.imageUrl} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center"><Camera text-white size={32} /></div></> : <div className="text-center"><Upload size={32} className="mx-auto mb-2 text-slate-300" /><p className="text-[8px] font-black uppercase text-slate-400">Selecionar</p></div>}
                    </div>
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileUpload} />
                 </div>
                 <div className="flex gap-2">
                   <input value={newItem.name || ''} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="NOME DO PRODUTO" className="flex-[2] p-4 bg-slate-50 rounded-xl font-bold uppercase outline-none" />
                   <input list="categories-list" value={newItem.category || ''} onChange={e => setNewItem({...newItem, category: e.target.value})} placeholder="CATEGORIA" className="flex-1 p-4 bg-slate-50 rounded-xl font-bold uppercase outline-none" />
                   <datalist id="categories-list">
                      {existingCategories.map(cat => <option key={cat} value={cat} />)}
                   </datalist>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Preço Normal</label>
                     <input type="number" step="0.01" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value) || 0, useFactoryPrice: false})} placeholder="R$ 0,00" className="w-full p-4 bg-slate-50 rounded-xl font-black text-lg outline-none" />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[9px] font-black text-emerald-500 uppercase ml-2">Preço Promocional</label>
                     <input type="number" step="0.01" value={newItem.promotionalPrice || ''} onChange={e => setNewItem({...newItem, promotionalPrice: parseFloat(e.target.value) || undefined})} placeholder="R$ 0,00 (Opcional)" className="w-full p-4 bg-emerald-50 text-emerald-700 rounded-xl font-black text-lg outline-none placeholder:text-emerald-300" />
                   </div>
                 </div>
                 {newItem.promotionalPrice && (
                   <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Validade da Promoção (Opcional)</label>
                     <input 
                       type="datetime-local" 
                       value={(() => {
                          try {
                            if (!newItem.promoEndsAt) return '';
                            const d = new Date(newItem.promoEndsAt);
                            if (isNaN(d.getTime())) return '';
                            return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                          } catch { return ''; }
                        })()} 
                       onChange={e => {
                          if (!e.target.value) {
                            setNewItem({...newItem, promoEndsAt: undefined});
                            return;
                          }
                          const d = new Date(e.target.value);
                          if (!isNaN(d.getTime())) {
                            setNewItem({...newItem, promoEndsAt: d.toISOString()});
                          }
                        }} 
                       className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-600 outline-none" 
                     />
                   </div>
                 )}
                 {newItem.linkedFactoryItemId && (
                   <div className="flex items-center gap-2 px-2">
                     <input 
                       type="checkbox" 
                       id="useFactoryPrice"
                       checked={newItem.useFactoryPrice}
                       onChange={e => setNewItem({...newItem, useFactoryPrice: e.target.checked})}
                       className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                     />
                     <label htmlFor="useFactoryPrice" className="text-[10px] font-bold text-slate-500 uppercase">
                       Usar preço dinâmico da Fábrica
                     </label>
                   </div>
                 )}
                 <textarea value={newItem.description || ''} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="BREVE DESCRIÇÃO (EX: MASSA DE MANDIOCA...)" className="w-full p-4 bg-slate-50 rounded-xl font-bold h-24 resize-none outline-none" />
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setShowItemModal(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                 <button onClick={addOrUpdateItem} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Confirmar</button>
              </div>
           </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete !== null && (
        <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl text-center border-4 border-rose-100">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse"><AlertTriangle className="w-10 h-10 text-rose-600" /></div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Remover da Vitrine</h3>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">Deseja realmente remover "{formData.portfolio[itemToDelete]?.name}"? <br/><br/> <span className="text-[10px] uppercase font-black text-slate-400">Clique em "Salvar Vitrine" depois para confirmar definitivamente.</span></p>
              <div className="flex gap-3">
                <button onClick={() => setItemToDelete(null)} className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-colors">Cancelar</button>
                <button 
                   onClick={() => itemToDelete !== null && removeItem(itemToDelete)} 
                   className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-900/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                   <Trash2 className="w-4 h-4" /> Confirmar
                </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL IMPORTAÇÃO DA FÁBRICA */}
      {showImportModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-3xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 shrink-0">
                 <div className="flex items-center gap-3">
                   <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><DownloadCloud size={20} /></div>
                   <div>
                     <h3 className="text-xl font-black text-slate-800 uppercase leading-none">Importar</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Itens da Fábrica</p>
                   </div>
                 </div>
                 <button onClick={() => setShowImportModal(false)} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200"><X size={20} /></button>
              </div>
              
              <div className="overflow-y-auto flex-1 pr-2 space-y-6 mb-6">
                {sections.filter(s => s.type === 'FACTORY_STYLE').map(section => (
                  <div key={section.id} className="space-y-3">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">{section.name}</h4>
                    {section.items.map(item => {
                      const isSelected = selectedFactoryItems.includes(item.id);
                      const isAlreadyInVitrine = formData.portfolio.some(p => p.linkedFactoryItemId === item.id);
                      
                      return (
                        <div 
                          key={item.id} 
                          onClick={() => {
                            if (isAlreadyInVitrine) return;
                            setSelectedFactoryItems(prev => 
                              isSelected ? prev.filter(id => id !== item.id) : [...prev, item.id]
                            );
                          }}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isAlreadyInVitrine ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' : isSelected ? 'bg-indigo-50 border-indigo-200 cursor-pointer' : 'bg-white border-slate-100 hover:border-indigo-100 cursor-pointer'}`}
                        >
                          <div>
                            <p className="font-bold text-slate-700 text-sm">{item.name}</p>
                            <p className="text-[10px] font-black text-slate-400">R$ {(item.price || 0).toFixed(2)}</p>
                          </div>
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 ${isAlreadyInVitrine ? 'bg-slate-200 border-slate-300' : isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200'}`}>
                            {(isSelected || isAlreadyInVitrine) && <Check size={14} />}
                          </div>
                        </div>
                      );
                    })}
                    {section.items.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum item nesta seção.</p>}
                  </div>
                ))}
                {sections.filter(s => s.type === 'FACTORY_STYLE').length === 0 && (
                  <div className="text-center py-10 text-slate-400">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma aba de fábrica encontrada</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 shrink-0 pt-4 border-t border-slate-100">
                 <button onClick={() => setShowImportModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                 <button 
                   onClick={handleImportFactoryItems} 
                   disabled={selectedFactoryItems.length === 0}
                   className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Importar ({selectedFactoryItems.length})
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
