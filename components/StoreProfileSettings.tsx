
import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { StoreProfile } from '../types';
import { 
  Save, Store, MapPin, Phone, Instagram, 
  Facebook, Loader2, X, Hash, Image as ImageIcon,
  Upload, Camera, Trash2, Bike, ShoppingBag, Store as StoreIcon, Navigation
} from 'lucide-react';

interface StoreProfileSettingsProps {
  profile: StoreProfile | null;
  onSave: (profile: Partial<StoreProfile> & { workspaceId: string }) => Promise<StoreProfile | null>;
  onClose: () => void;
  workspaceId: string;
  hasProPlan?: boolean;
}

export const StoreProfileSettings: React.FC<StoreProfileSettingsProps> = ({ profile, onSave, onClose, workspaceId, hasProPlan }) => {
  const [formData, setFormData] = useState<Omit<StoreProfile, 'id'>>(profile ? {
    workspaceId: profile.workspaceId,
    name: profile.name,
    description: profile.description,
    address: profile.address,
    whatsapp: profile.whatsapp,
    cnpj: profile.cnpj,
    instagram: profile.instagram,
    facebook: profile.facebook,
    logoUrl: profile.logoUrl,
    bannerUrl: profile.bannerUrl,
    latitude: profile.latitude,
    longitude: profile.longitude,
    active: profile.active,
    portfolio: profile.portfolio || [],
    fulfillmentMode: profile.fulfillmentMode || 'BOTH',
    deliveryConfig: profile.deliveryConfig || {}
  } : {
    workspaceId,
    name: '',
    description: '',
    address: '',
    whatsapp: '',
    cnpj: '',
    instagram: '',
    facebook: '',
    logoUrl: '',
    bannerUrl: '',
    latitude: 0,
    longitude: 0,
    active: true,
    portfolio: [],
    fulfillmentMode: 'BOTH',
    deliveryConfig: {}
  });

  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const resizeImage = (file: File, maxWidth: number = 1200): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'bannerUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const maxWidth = field === 'logoUrl' ? 400 : 1200;
      const resized = await resizeImage(file, maxWidth);
      setFormData(prev => ({ ...prev, [field]: resized }));
    } catch (e) {
      toast.error("Erro ao processar imagem.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Construction of payload strictly to avoid sending unchanged heavy data (images/portfolio)
      // This prevents 500 errors (Payload Too Large / Server Timeout)
      
      const payload: any = {
        workspaceId: formData.workspaceId,
        name: formData.name,
        description: formData.description,
        address: formData.address,
        whatsapp: formData.whatsapp,
        cnpj: formData.cnpj,
        instagram: formData.instagram,
        facebook: formData.facebook,
        latitude: formData.latitude,
        longitude: formData.longitude,
        active: formData.active,
        fulfillmentMode: formData.fulfillmentMode,
        deliveryConfig: formData.deliveryConfig
      };

      // 1. Process Logo - Only add to payload if changed
      if (formData.logoUrl !== profile?.logoUrl) {
        let finalLogo = formData.logoUrl;
        if (finalLogo && finalLogo.startsWith('data:image') && finalLogo.length > 200000) {
           finalLogo = await compressBase64(finalLogo, 400);
        }
        payload.logoUrl = finalLogo;
      }

      // 2. Process Banner - Only add to payload if changed
      if (formData.bannerUrl !== profile?.bannerUrl) {
        let finalBanner = formData.bannerUrl;
        if (finalBanner && finalBanner.startsWith('data:image') && finalBanner.length > 300000) {
           finalBanner = await compressBase64(finalBanner, 1000);
        }
        payload.bannerUrl = finalBanner;
      }

      // 3. Portfolio - Only add if needed (though usually handled by MarketplaceManager, here we skip it to be safe)
      // The settings modal doesn't edit portfolio items, so we simply omit it to prevent sending the array.
      
      await onSave(payload);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar perfil. Tente novamente ou use imagens menores.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = () => {
    if (!hasProPlan && !formData.active) {
      toast.error("Para ativar sua Vitrine Online, assine o Plano Profissional!");
      return;
    }
    setFormData(prev => ({ ...prev, active: !prev.active }));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
                <Store className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Perfil da Empresa</h2>
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Configurações de Identidade</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-all">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
           {/* Seção de Imagens (Banner e Logo) */}
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Imagens da Loja</label>
              <div className="relative h-48 w-full group">
                 {/* Banner */}
                 <div className="w-full h-full bg-slate-100 rounded-[2rem] overflow-hidden border-2 border-dashed border-slate-200 flex items-center justify-center relative">
                    {formData.bannerUrl ? (
                       <img src={formData.bannerUrl} className="w-full h-full object-cover" />
                    ) : (
                       <div className="text-center">
                          <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <p className="text-[8px] font-black text-slate-400 uppercase">Banner de Fundo</p>
                       </div>
                    )}
                    <button 
                       onClick={() => bannerInputRef.current?.click()}
                       className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                       <div className="p-4 bg-white/90 rounded-2xl shadow-xl flex items-center gap-2">
                          <Camera className="w-5 h-5 text-orange-600" />
                          <span className="text-[10px] font-black uppercase text-slate-800">Trocar Banner</span>
                       </div>
                    </button>
                    <input type="file" ref={bannerInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'bannerUrl')} />
                 </div>

                 {/* Logo / Foto de Perfil */}
                 <div className="absolute -bottom-6 left-8 group/logo">
                    <div className="w-24 h-24 bg-white rounded-[2rem] p-1 shadow-2xl border-4 border-white overflow-hidden relative">
                       {formData.logoUrl ? (
                          <img src={formData.logoUrl} className="w-full h-full object-cover rounded-[1.6rem]" />
                       ) : (
                          <div className="w-full h-full bg-orange-50 flex items-center justify-center">
                             <Store className="w-8 h-8 text-orange-200" />
                          </div>
                       )}
                       <button 
                          onClick={() => logoInputRef.current?.click()}
                          className="absolute inset-0 bg-orange-600/60 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center"
                       >
                          <Upload className="w-6 h-6 text-white" />
                       </button>
                       <input type="file" ref={logoInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'logoUrl')} />
                    </div>
                 </div>
              </div>
           </div>

           <div className="grid sm:grid-cols-2 gap-6 mt-12">
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Nome Público da Loja</label>
                 <div className="relative">
                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-orange-500" placeholder="Ex: Salgadinhos da Praça" />
                 </div>
              </div>
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase ml-4">WhatsApp de Vendas</label>
                 <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-orange-500" placeholder="Ex: 21999999999" />
                 </div>
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

           {/* CONFIGURAÇÃO DE ENTREGA */}
           {(formData.fulfillmentMode === 'DELIVERY' || formData.fulfillmentMode === 'BOTH') && (
             <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                   <Bike size={16} className="text-blue-600" />
                   <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Regras de Entrega</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Grátis Acima de (R$)</label>
                     <input 
                       type="number" 
                       value={formData.deliveryConfig?.freeDeliveryThreshold || ''} 
                       onChange={e => setFormData({...formData, deliveryConfig: { ...formData.deliveryConfig, freeDeliveryThreshold: Number(e.target.value) }})} 
                       className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500" 
                       placeholder="Ex: 50" 
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Distância Máxima (Km)</label>
                     <input 
                       type="number" 
                       value={formData.deliveryConfig?.maxDistance || ''} 
                       onChange={e => setFormData({...formData, deliveryConfig: { ...formData.deliveryConfig, maxDistance: Number(e.target.value) }})} 
                       className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500" 
                       placeholder="Ex: 10" 
                     />
                  </div>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Taxas por Distância (Km)</label>
                     <button 
                       onClick={(e) => {
                         e.preventDefault();
                         const currentTiers = formData.deliveryConfig?.distanceTiers || [];
                         setFormData({
                           ...formData, 
                           deliveryConfig: { 
                             ...formData.deliveryConfig, 
                             distanceTiers: [...currentTiers, { upToKm: 0, fee: 0 }] 
                           }
                         });
                       }}
                       className="text-[9px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded-lg"
                     >
                       + Adicionar Faixa
                     </button>
                   </div>
                   
                   {(formData.deliveryConfig?.distanceTiers || []).map((tier, idx) => (
                     <div key={idx} className="flex items-center gap-2">
                       <div className="flex-1 flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl">
                         <span className="text-[10px] font-bold text-slate-400">Até</span>
                         <input 
                           type="number" 
                           value={tier.upToKm || ''} 
                           onChange={e => {
                             const newTiers = [...(formData.deliveryConfig?.distanceTiers || [])];
                             newTiers[idx].upToKm = Number(e.target.value);
                             setFormData({...formData, deliveryConfig: { ...formData.deliveryConfig, distanceTiers: newTiers }});
                           }}
                           className="w-12 text-center font-black text-sm outline-none" 
                           placeholder="Km" 
                         />
                         <span className="text-[10px] font-bold text-slate-400">km</span>
                       </div>
                       <div className="flex-1 flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl">
                         <span className="text-[10px] font-bold text-slate-400">R$</span>
                         <input 
                           type="number" 
                           value={tier.fee || ''} 
                           onChange={e => {
                             const newTiers = [...(formData.deliveryConfig?.distanceTiers || [])];
                             newTiers[idx].fee = Number(e.target.value);
                             setFormData({...formData, deliveryConfig: { ...formData.deliveryConfig, distanceTiers: newTiers }});
                           }}
                           className="w-16 text-center font-black text-sm outline-none" 
                           placeholder="Taxa" 
                         />
                       </div>
                       <button 
                         onClick={(e) => {
                           e.preventDefault();
                           const newTiers = [...(formData.deliveryConfig?.distanceTiers || [])];
                           newTiers.splice(idx, 1);
                           setFormData({...formData, deliveryConfig: { ...formData.deliveryConfig, distanceTiers: newTiers }});
                         }}
                         className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl"
                       >
                         <Trash2 size={14} />
                       </button>
                     </div>
                   ))}
                   {(!formData.deliveryConfig?.distanceTiers || formData.deliveryConfig.distanceTiers.length === 0) && (
                     <p className="text-[10px] text-slate-400 italic ml-2">Nenhuma taxa configurada. A entrega será grátis.</p>
                   )}
                </div>
             </div>
           )}

           <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Endereço de Retirada / Localização</label>
              <div className="flex gap-2">
                 <div className="relative flex-1">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-orange-500" placeholder="Rua, Número, Bairro, Cidade" />
                 </div>
                 <button 
                   onClick={(e) => {
                     e.preventDefault();
                     if ("geolocation" in navigator) {
                       toast.info("Obtendo sua localização atual...");
                       navigator.geolocation.getCurrentPosition((pos) => {
                         setFormData({
                           ...formData,
                           latitude: pos.coords.latitude,
                           longitude: pos.coords.longitude
                         });
                         toast.success("Localização capturada com sucesso!");
                       }, (err) => {
                         toast.error("Não foi possível obter sua localização. Verifique as permissões do navegador.");
                       });
                     }
                   }}
                   className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center ${formData.latitude !== 0 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'}`}
                   title="Capturar Localização Atual"
                 >
                   <Navigation size={20} className={formData.latitude !== 0 ? 'animate-pulse' : ''} />
                 </button>
              </div>
              {formData.latitude !== 0 && (
                <p className="text-[8px] font-bold text-blue-500 uppercase ml-4 mt-1">📍 Localização Geográfica Configurada</p>
              )}
           </div>

           <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Instagram</label>
                 <div className="relative">
                    <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input value={formData.instagram || ''} onChange={e => setFormData({...formData, instagram: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-orange-500" placeholder="@seuperfil" />
                 </div>
              </div>
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase ml-4">CNPJ (Opcional)</label>
                 <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input value={formData.cnpj || ''} onChange={e => setFormData({...formData, cnpj: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-orange-500" placeholder="Somente números" />
                 </div>
              </div>
           </div>

           <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Descrição do Negócio</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-orange-500 h-32 resize-none" placeholder="Conte um pouco sobre a sua produção e tradição..." />
           </div>

           <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-[2rem] border border-emerald-100">
              <button 
                onClick={toggleActive}
                className={`w-14 h-7 rounded-full transition-all relative ${formData.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${formData.active ? 'left-8' : 'left-1'}`} />
              </button>
              <div>
                <p className="text-[10px] font-black text-emerald-800 uppercase">Loja Ativa no Marketplace</p>
                <p className="text-[8px] font-bold text-emerald-600/60 uppercase">
                  {hasProPlan ? 'Sua vitrine está visível no Marketplace' : 'Disponível apenas no Plano PRO'}
                </p>
              </div>
           </div>
        </div>

        <footer className="p-8 border-t border-slate-100 bg-slate-50">
           <button onClick={handleSave} disabled={isSaving} className="w-full py-5 bg-orange-600 text-white rounded-[1.8rem] font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Salvar Perfil
           </button>
        </footer>
      </div>
    </div>
  );
};
