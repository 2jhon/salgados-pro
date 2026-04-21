
import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { StoreProfile, PortfolioItem, AppSection } from '../types';
import { 
  Save, Plus, Trash2, Edit3, 
  ShoppingBag, Check, X, Loader2,
  ImageIcon, ShoppingCart, Upload, Camera,
  Zap, Clock, DollarSign, Sparkles, MessageCircle, AlertTriangle, CheckCircle2, Bike, Store as StoreIcon, DownloadCloud
} from 'lucide-react';

interface MarketplaceManagerProps {
  profile: StoreProfile | null;
  onSave: (profile: Partial<StoreProfile> & { workspaceId: string }) => Promise<StoreProfile | null>;
  workspaceId: string;
  user: { id: string; name: string; hasProPlan?: boolean; workspaceId: string };
  sections?: AppSection[];
}

export const MarketplaceManager: React.FC<MarketplaceManagerProps> = ({ profile, onSave, workspaceId, user, sections = [] }) => {
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

  const [showItemModal, setShowItemModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFactoryItems, setSelectedFactoryItems] = useState<string[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [newItem, setNewItem] = useState<PortfolioItem>({
    id: Date.now().toString(),
    name: '',
    price: 0,
    description: '',
    imageUrl: '',
    available: true
  });

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
      // Otimização Automática: Varre o portfólio em busca de imagens pesadas
      const optimizedPortfolio = await Promise.all(formData.portfolio.map(async (item) => {
        // Verifica se a imagem é base64 e se é muito grande (> 200KB aprox)
        if (item.imageUrl && item.imageUrl.startsWith('data:image') && item.imageUrl.length > 200000) {
            try {
                const compressed = await compressBase64(item.imageUrl);
                return { ...item, imageUrl: compressed };
            } catch (e) {
                console.warn("Falha ao comprimir imagem item:", item.name);
                return item;
            }
        }
        return item;
      }));

      // Atualiza o estado local com as imagens otimizadas para evitar reprocessamento
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
    
    const updatedPortfolio = [...(formData.portfolio || [])];
    if (editingItemIndex !== null) {
      updatedPortfolio[editingItemIndex] = newItem;
    } else {
      updatedPortfolio.push({ ...newItem, id: Date.now().toString() });
    }

    setFormData(prev => ({ ...prev, portfolio: updatedPortfolio }));
    setShowItemModal(false);
    setEditingItemIndex(null);
    setNewItem({ id: Date.now().toString(), name: '', price: 0, description: '', imageUrl: '', available: true });
  };

  const startEditItem = (idx: number) => {
    setEditingItemIndex(idx);
    setNewItem({ ...formData.portfolio[idx] });
    setShowItemModal(true);
  };

  const removeItem = (idx: number) => {
    const updated = formData.portfolio.filter((_, i) => i !== idx);
    setFormData({ ...formData, portfolio: updated });
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
      const resized = await resizeImage(file);
      setNewItem(prev => ({ ...prev, imageUrl: resized }));
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
                onClick={() => { setEditingItemIndex(null); setNewItem({ id: Date.now().toString(), name: '', price: 0, description: '', imageUrl: '', available: true }); setShowItemModal(true); }} 
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

        <div className="grid gap-4">
          {formData.portfolio.length === 0 ? (
            <div className="p-16 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                <ShoppingBag className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Seu cardápio está vazio.</p>
            </div>
          ) : (
            formData.portfolio.map((item, idx) => {
              const isHighlighted = item.highlightExpiresAt && new Date(item.highlightExpiresAt).getTime() > Date.now();
              
              return (
                <div key={item.id} className={`p-5 rounded-[2.5rem] border flex items-center justify-between group transition-all ${isHighlighted ? 'bg-amber-50 border-amber-200 shadow-lg shadow-amber-900/5' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-xl'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm overflow-hidden flex-shrink-0 border border-slate-100 flex items-center justify-center relative">
                          {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-200" />}
                          {isHighlighted && <div className="absolute inset-0 border-2 border-amber-500 rounded-2xl animate-pulse" />}
                      </div>
                      <div>
                          <h4 className="font-black text-slate-800 text-xs uppercase tracking-tight flex items-center gap-1">
                            {item.name}
                            {isHighlighted && <Zap size={10} className="text-amber-500 fill-amber-500" />}
                          </h4>
                          <p className="font-black text-emerald-600 text-sm mt-1">R$ {(item.price || 0).toFixed(2)}</p>
                          {isHighlighted && <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">Destaque Ativo</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => toggleHighlight(idx)} 
                        className={`p-3 rounded-xl shadow-sm border transition-all ${isHighlighted ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-300 border-slate-100 hover:text-amber-500'}`}
                        title="Promover para Stories"
                      >
                        <Zap size={16} className={isHighlighted ? "fill-white" : ""} />
                      </button>
                      <button onClick={() => startEditItem(idx)} className="p-3 bg-white text-blue-500 rounded-xl shadow-sm border border-slate-100"><Edit3 size={16} /></button>
                      <button onClick={() => removeItem(idx)} className="p-3 bg-white text-rose-500 rounded-xl shadow-sm border border-slate-100"><Trash2 size={16} /></button>
                    </div>
                </div>
              );
            })
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
                 <input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="NOME DO SALGADO" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase outline-none" />
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
                       value={newItem.promoEndsAt ? new Date(new Date(newItem.promoEndsAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} 
                       onChange={e => setNewItem({...newItem, promoEndsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined})} 
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
                 <textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="BREVE DESCRIÇÃO (EX: MASSA DE MANDIOCA...)" className="w-full p-4 bg-slate-50 rounded-xl font-bold h-24 resize-none outline-none" />
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setShowItemModal(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                 <button onClick={addOrUpdateItem} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Confirmar</button>
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
