import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { StoreProfile, User } from '../types';
import { 
  Save, Store, MapPin, Phone, Instagram, 
  Facebook, Loader2, X, Hash, Image as ImageIcon,
  Upload, Camera, Trash2, Bike, ShoppingBag, Store as StoreIcon, Navigation,
  ShieldCheck, Fingerprint, Lock, UserIcon, Edit2,
  MessageSquare, Zap, RefreshCcw, CheckCircle2, ShoppingCart, AlertTriangle
} from 'lucide-react';
import { hasBiometryConfigured, registerBiometryLocal, removeBiometryLocal } from '../lib/webauthnUtils';

interface StoreProfileSettingsProps {
  profile: StoreProfile | null;
  onSave: (profile: Partial<StoreProfile> & { workspaceId: string }) => Promise<StoreProfile | null>;
  onClose: () => void;
  workspaceId: string;
  hasProPlan?: boolean;
  user: User;
  onSaveUser: (userData: Partial<User>) => Promise<void>;
  isOwner: boolean;
}

export const StoreProfileSettings: React.FC<StoreProfileSettingsProps> = ({ profile, onSave, onClose, workspaceId, hasProPlan, user, onSaveUser, isOwner }) => {
  const [activeTab, setActiveTab] = useState<'USER' | 'IDENTITY' | 'LOCATION' | 'LOGISTICS' | 'WHATSAPP'>('USER');

  // Defensive initialization
  const [formData, setFormData] = useState<Omit<StoreProfile, 'id'>>(() => {
    const p = profile;
    if (p) {
      return {
        workspaceId: p.workspaceId || workspaceId,
        name: p.name || '',
        description: p.description || '',
        address: p.address || '',
        whatsapp: p.whatsapp || '',
        cnpj: p.cnpj || '',
        instagram: p.instagram || '',
        facebook: p.facebook || '',
        logoUrl: p.logoUrl || '',
        bannerUrl: p.bannerUrl || '',
        latitude: p.latitude || 0,
        longitude: p.longitude || 0,
        active: p.active ?? true,
        portfolio: p.portfolio || [],
        fulfillmentMode: p.fulfillmentMode || 'BOTH',
        deliveryConfig: p.deliveryConfig || {},
        waEnabled: p.waEnabled ?? false,
        waNotifyOnPayment: p.waNotifyOnPayment ?? true,
        waNotifyOnNewNote: p.waNotifyOnNewNote ?? false,
        waNotifyOnNewOrder: p.waNotifyOnNewOrder ?? true,
        waInstanceName: p.waInstanceName || '',
        waInstanceStatus: p.waInstanceStatus || ''
      };
    }
    return {
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
      deliveryConfig: {},
      waEnabled: false,
      waNotifyOnPayment: true,
      waNotifyOnNewNote: false,
      waNotifyOnNewOrder: true,
      waInstanceName: '',
      waInstanceStatus: ''
    };
  });

  const [editUserData, setEditUserData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    cpf: user?.cpf || '',
    accessCode: user?.accessCode || '',
    avatarUrl: user?.avatarUrl || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [waState, setWaState] = useState<{ state: string, qrcode: string | null }>({ state: 'DISCONNECTED', qrcode: null });
  const [loadingWa, setLoadingWa] = useState(false);
  const [hasWaInstanceLocal, setHasWaInstanceLocal] = useState(!!profile?.waInstanceName);
  const [showWaDeleteConfirm, setShowWaDeleteConfirm] = useState(false);

  const fetchWaStatus = React.useCallback(async (force = false, isSilent = false) => {
    if (!profile?.workspaceId) return;
    if (!isSilent) setLoadingWa(true);
    try {
      const resp = await fetch(`/api/whatsapp/instance-status/${profile.workspaceId}${force ? '?force=true' : ''}`);
      const data = await resp.json();
      setWaState(data);
      if (data.state === 'CONNECTED') {
        setHasWaInstanceLocal(true);
      }
    } catch (e) {
      console.warn("Falha ao checar WhatsApp status");
    } finally {
      if (!isSilent) setLoadingWa(false);
    }
  }, [profile?.workspaceId]);

  useEffect(() => {
    if (profile?.waInstanceName || hasWaInstanceLocal) {
      fetchWaStatus();
    }
  }, [profile?.waInstanceName, hasWaInstanceLocal, fetchWaStatus]);

  // Polling em background
  useEffect(() => {
    if ((profile?.waInstanceName || hasWaInstanceLocal) && waState.state !== 'CONNECTED' && waState.state !== 'ERROR') {
      const interval = setInterval(() => {
        fetchWaStatus(false, true);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [profile?.waInstanceName, hasWaInstanceLocal, waState.state, fetchWaStatus]);

  const handleCreateWaInstance = async () => {
    setLoadingWa(true);
    try {
      const resp = await fetch('/api/whatsapp/create-instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspaceId })
      });
      const data = await resp.json();
      
      if (!resp.ok) {
        throw new Error(data.error || "Erro desconhecido no servidor");
      }

      if (data.instance) {
        toast.success("Instância preparada! Aguarde o QR Code.");
        setHasWaInstanceLocal(true);
        // Pequeno delay para a Evolution processar
        setTimeout(() => fetchWaStatus(), 2000);
      } else {
        toast.error("A API não retornou uma instância válida.");
      }
    } catch (e: any) {
      console.error("[WA Create]:", e);
      toast.error(e.message || "Erro ao criar instância.");
    } finally {
      setLoadingWa(false);
    }
  };

  const handleLogoutWa = async () => {
    setLoadingWa(true);
    setShowWaDeleteConfirm(false);
    try {
      await fetch('/api/whatsapp/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspaceId })
      });
      setWaState({ state: 'DISCONNECTED', qrcode: null });
      setHasWaInstanceLocal(false);
      toast.success("WhatsApp desconectado.");
    } catch (e) {
      toast.error("Erro ao desconectar.");
    } finally {
      setLoadingWa(false);
    }
  };

  const [isBiometryActive, setIsBiometryActive] = useState(false);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const userAvatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsBiometryActive(hasBiometryConfigured());
  }, []);

  // Update form data if profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        workspaceId: profile.workspaceId || workspaceId,
        name: profile.name || '',
        description: profile.description || '',
        address: profile.address || '',
        whatsapp: profile.whatsapp || '',
        cnpj: profile.cnpj || '',
        instagram: profile.instagram || '',
        facebook: profile.facebook || '',
        logoUrl: profile.logoUrl || '',
        bannerUrl: profile.bannerUrl || '',
        latitude: profile.latitude || 0,
        longitude: profile.longitude || 0,
        active: profile.active ?? true,
        portfolio: profile.portfolio || [],
        fulfillmentMode: profile.fulfillmentMode || 'BOTH',
        deliveryConfig: profile.deliveryConfig || {},
        waEnabled: profile.waEnabled ?? false,
        waNotifyOnPayment: profile.waNotifyOnPayment ?? true,
        waNotifyOnNewNote: profile.waNotifyOnNewNote ?? false,
        waNotifyOnNewOrder: profile.waNotifyOnNewOrder ?? true,
        waInstanceName: profile.waInstanceName || '',
        waInstanceStatus: profile.waInstanceStatus || ''
      });
    }
  }, [profile, workspaceId]);

  if (!user) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[2rem] text-center">
            <Loader2 className="animate-spin mx-auto text-indigo-600 mb-4" />
            <p className="text-xs font-black uppercase text-slate-400">Carregando Perfil...</p>
        </div>
      </div>
    );
  }

  const handleToggleBiometry = async () => {
    try {
      if (isBiometryActive) { 
        removeBiometryLocal(); 
        setIsBiometryActive(false); 
        toast.info("Biometria desativada deste aparelho."); 
      } else { 
        await registerBiometryLocal(user.id, user.name, editUserData.accessCode || user.accessCode, user.userType || 'COMPANY'); 
        setIsBiometryActive(true); 
        toast.success("Biometria configurada com sucesso!"); 
      }
    } catch(e: any) { 
      toast.error(e.message || "Erro ao configurar biometria"); 
    }
  };

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

  // Helper para upload de storage
  const uploadToStorage = async (base64Str: string, folder: string): Promise<string | null> => {
    try {
      const base64Data = base64Str.split(',')[1];
      const type = base64Str.split(';')[0].split(':')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type });

      // Nome do arquivo baseado no user e data
      const fileName = `${user.id}/${folder}_${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from('app_banners')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('app_banners').getPublicUrl(data.path);
      return publicUrl;
    } catch (e) {
      console.error("Storage error:", e);
      return null;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'bannerUrl' | 'userAvatar') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (field === 'userAvatar') {
         const resized = await resizeImage(file, 400);
         const storageUrl = await uploadToStorage(resized, 'avatar');
         setEditUserData(prev => ({...prev, avatarUrl: storageUrl || resized }));
      } else {
         const maxWidth = field === 'logoUrl' ? 400 : 1200;
         const resized = await resizeImage(file, maxWidth);
         const storageUrl = await uploadToStorage(resized, field);
         setFormData(prev => ({ ...prev, [field]: storageUrl || resized }));
      }
      toast.success("Imagem enviada com sucesso!");
    } catch (e) {
      toast.error("Erro ao processar imagem.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveUser(editUserData);

      if (isOwner) {
         const payload: any = {
           workspaceId: formData.workspaceId,
           name: formData.name,
           description: formData.description,
           address: formData.address,
           whatsapp: formData.whatsapp?.replace(/\D/g, '') || '',
           cnpj: formData.cnpj,
           instagram: formData.instagram,
           facebook: formData.facebook,
           latitude: formData.latitude,
           longitude: formData.longitude,
           active: formData.active,
           fulfillmentMode: formData.fulfillmentMode,
           deliveryConfig: formData.deliveryConfig,
           waEnabled: formData.waEnabled,
           waNotifyOnPayment: formData.waNotifyOnPayment,
           waNotifyOnNewNote: formData.waNotifyOnNewNote,
           waNotifyOnNewOrder: formData.waNotifyOnNewOrder
         };

         if (formData.logoUrl !== profile?.logoUrl) {
           let finalLogo = formData.logoUrl || '';
           if (finalLogo.startsWith('data:image')) {
              const url = await uploadToStorage(finalLogo, 'logo');
              if (url) finalLogo = url;
           }
           payload.logoUrl = finalLogo;
         }

         if (formData.bannerUrl !== profile?.bannerUrl) {
           let finalBanner = formData.bannerUrl || '';
           if (finalBanner.startsWith('data:image')) {
              const url = await uploadToStorage(finalBanner, 'banner');
              if (url) finalBanner = url;
           }
           payload.bannerUrl = finalBanner;
         }
         await onSave(payload);
         toast.success("Perfil e loja atualizados com sucesso!");
      } else {
         toast.success("Perfil atualizado com sucesso!");
      }
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar perfil.");
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

  const TABS = [
    { id: 'USER', label: 'Segurança e Acesso', icon: ShieldCheck, show: true },
    { id: 'IDENTITY', label: 'Identidade da Empresa', icon: Store, show: isOwner },
    { id: 'LOCATION', label: 'Contato e Localização', icon: MapPin, show: isOwner },
    { id: 'LOGISTICS', label: 'Logística e Vendas', icon: Bike, show: isOwner },
    { id: 'WHATSAPP', label: 'Robô WhatsApp', icon: MessageSquare, show: isOwner },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <header className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                <StoreIcon className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Painel da Conta e Loja</h2>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Configurações Unificadas</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-all">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto no-scrollbar border-b border-slate-100 px-6 pt-4 bg-slate-50/50">
          <div className="flex gap-4">
            {TABS.filter(t => t.show).map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex leading-none items-center gap-2 pb-4 px-2 border-b-4 transition-all whitespace-nowrap ${isActive ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  <Icon size={16} className={isActive ? 'animate-pulse' : ''} />
                  <span className="text-xs font-black uppercase tracking-wider">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white no-scrollbar">
          
          {/* USER TAB */}
          {activeTab === 'USER' && (
            <div className="space-y-8 max-w-xl mx-auto">
              <div className="flex flex-col items-center mb-8 relative">
                 <div className="w-28 h-28 bg-slate-100 rounded-[2rem] overflow-hidden relative group cursor-pointer border-4 border-white shadow-xl" onClick={() => userAvatarInputRef.current?.click()}>
                    {editUserData.avatarUrl ? <img src={editUserData.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><UserIcon size={32} /></div>}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white" /></div>
                 </div>
                 <input type="file" ref={userAvatarInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'userAvatar')} />
                 <h3 className="mt-4 text-lg font-black text-slate-800 tracking-tight">{user.name}</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.role}</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-[2rem] space-y-4 shadow-sm border border-slate-100">
                 <h4 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2 mb-4"><Lock size={14}/> Segurança Reforçada</h4>
                 
                 <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                       <div className={`p-3 rounded-xl ${isBiometryActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Fingerprint size={24} />
                       </div>
                       <div>
                          <p className="text-sm font-black text-slate-800">Autenticação Biométrica</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Use Face ID ou Digital</p>
                       </div>
                    </div>
                    <button 
                      onClick={handleToggleBiometry}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isBiometryActive ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                      {isBiometryActive ? 'Remover' : 'Ativar'}
                    </button>
                 </div>

                 <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400 ml-4">PIN de Acesso (6 Dígitos)</label>
                   <input type="password" maxLength={6} value={editUserData.accessCode || ''} onChange={e => setEditUserData({...editUserData, accessCode: e.target.value})} className="w-full p-4 bg-white border border-slate-100 rounded-2xl font-black text-center text-xl outline-none focus:border-indigo-300 transition-all" placeholder="NOVO PIN" />
                 </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2 ml-2"><UserIcon size={14}/> Dados Pessoais</h4>
                 <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400 ml-4">Nome Completo</label>
                   <input value={editUserData.name || ''} onChange={e => setEditUserData({...editUserData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold uppercase text-xs outline-none focus:border-indigo-300" placeholder="NOME" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-4">WhatsApp Pessoal</label>
                      <input type="tel" value={editUserData.phone || ''} onChange={e => setEditUserData({...editUserData, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-indigo-300" placeholder="21999999999" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-4">CPF (Opcional)</label>
                      <input value={editUserData.cpf || ''} onChange={e => setEditUserData({...editUserData, cpf: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-indigo-300" placeholder="000.000.000-00" />
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* IDENTITY TAB */}
          {activeTab === 'IDENTITY' && isOwner && (
            <div className="space-y-8 max-w-xl mx-auto">
               <div className="relative h-48 w-full group">
                  {/* Banner */}
                  <div className="w-full h-full bg-slate-100 rounded-[2rem] overflow-hidden border-2 border-dashed border-slate-200 flex items-center justify-center relative">
                     {formData.bannerUrl ? (
                        <img src={formData.bannerUrl} className="w-full h-full object-cover" />
                     ) : (
                        <div className="text-center">
                           <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                           <p className="text-[8px] font-black text-slate-400 uppercase">Capa do seu Negócio</p>
                        </div>
                     )}
                     <button onClick={() => bannerInputRef.current?.click()} className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="p-4 bg-white/90 rounded-2xl shadow-xl flex items-center gap-2">
                           <Camera className="w-5 h-5 text-indigo-600" />
                           <span className="text-[10px] font-black uppercase text-slate-800">Trocar Capa</span>
                        </div>
                     </button>
                     <input type="file" ref={bannerInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'bannerUrl')} />
                  </div>

                  {/* Logo */}
                  <div className="absolute -bottom-6 left-8 group/logo">
                     <div className="w-24 h-24 bg-white rounded-[2rem] p-1 shadow-2xl border-4 border-white overflow-hidden relative">
                        {formData.logoUrl ? (
                           <img src={formData.logoUrl} className="w-full h-full object-cover rounded-[1.6rem]" />
                        ) : (
                           <div className="w-full h-full bg-indigo-50 flex items-center justify-center rounded-[1.6rem]">
                              <StoreIcon className="w-8 h-8 text-indigo-200" />
                           </div>
                        )}
                        <button onClick={() => logoInputRef.current?.click()} className="absolute inset-0 bg-black/30 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center rounded-[1.6rem]">
                           <Camera className="w-5 h-5 text-white" />
                        </button>
                     </div>
                     <input type="file" ref={logoInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'logoUrl')} />
                  </div>
               </div>

               <div className="pt-8 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Fantasia</label>
                        <input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300" placeholder="Ex: Salgados do João" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CNPJ (Opcional)</label>
                        <input value={formData.cnpj || ''} onChange={e => setFormData({...formData, cnpj: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300" placeholder="00.000.000/0001-00" />
                     </div>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição Curta / Bio</label>
                     <textarea value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm outline-none focus:border-indigo-300 resize-none" placeholder="Conte um pouco sobre os seus salgados e sua história..." />
                  </div>
               </div>
            </div>
          )}

          {/* LOCATION & SOCIAL TAB */}
          {activeTab === 'LOCATION' && isOwner && (
            <div className="space-y-8 max-w-xl mx-auto pt-4">
               <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2 ml-2"><Phone size={14}/> Contato Principal</h4>
                  <div className="relative">
                     <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                     <input value={formData.whatsapp || ''} onChange={e => setFormData({...formData, whatsapp: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300" placeholder="WhatsApp da Loja" />
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2 ml-2"><MapPin size={14}/> Endereço Base</h4>
                  <div className="relative">
                     <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                     <input value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300" placeholder="Endereço de Retirada/Produção" />
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2 ml-2"><Instagram size={14}/> Redes Sociais</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="relative">
                        <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-500" />
                        <input value={formData.instagram || ''} onChange={e => setFormData({...formData, instagram: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300" placeholder="@seuinstagram" />
                     </div>
                     <div className="relative">
                        <Facebook className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500" />
                        <input value={formData.facebook || ''} onChange={e => setFormData({...formData, facebook: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300" placeholder="/suapagina" />
                     </div>
                  </div>
               </div>

               <div className={`p-6 rounded-[2rem] border mt-8 flex flex-col sm:flex-row items-center justify-between gap-6 transition-all ${hasProPlan ? 'bg-indigo-50 border-indigo-100' : formData.active ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
                  <div>
                     <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">Vitrine Online (Catálogo)</h3>
                     <p className={`text-xs font-medium mt-1 max-w-sm ${formData.active && !hasProPlan ? 'text-orange-600 font-bold' : 'text-slate-500'}`}>
                       {hasProPlan ? 'Permita que clientes vejam o cardápio.' : formData.active ? '⚠️ Seu plano venceu. Desative a vitrine.' : 'Exclusivo do Plano Profissional.'}
                     </p>
                  </div>
                  <button onClick={toggleActive} className={`relative inline-flex h-8 w-14 shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none ${!hasProPlan && !formData.active ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${formData.active ? (hasProPlan ? 'bg-indigo-600' : 'bg-orange-500') : 'bg-slate-300 shadow-inner'}`}>
                     <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.active ? 'translate-x-3' : '-translate-x-3'}`} />
                  </button>
               </div>
            </div>
          )}

          {/* LOGISTICS TAB */}
          {activeTab === 'LOGISTICS' && isOwner && (
            <div className="space-y-8 max-w-xl mx-auto pt-4">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Modo de Operação</label>
                  <div className="grid grid-cols-3 gap-3">
                     {[
                        { id: 'DELIVERY', label: 'Só Delivery', icon: Bike },
                        { id: 'PICKUP', label: 'Só Retirada', icon: StoreIcon },
                        { id: 'BOTH', label: 'Ambos', icon: ShoppingBag }
                     ].map(mode => {
                        const Icon = mode.icon;
                        const isSelected = formData.fulfillmentMode === mode.id;
                        return (
                           <button
                              key={mode.id}
                              onClick={() => setFormData({...formData, fulfillmentMode: mode.id as any})}
                              className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-white text-slate-400 hover:border-indigo-200'}`}
                           >
                              <Icon size={24} />
                              <span className="text-[10px] font-black uppercase text-center">{mode.label}</span>
                           </button>
                        );
                     })}
                  </div>
               </div>
               
               {formData.fulfillmentMode !== 'PICKUP' && (
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                     <h4 className="text-xs font-black text-slate-600 uppercase flex items-center gap-2"><Navigation size={14}/> Configurações de Entrega</h4>
                     
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Taxa Fixa (R$)</label>
                           <input type="number" value={formData.deliveryConfig?.fee || ''} onChange={e => setFormData({...formData, deliveryConfig: { ...formData.deliveryConfig, fee: Number(e.target.value) }})} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300" placeholder="Ex: 5" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nº Mínimo (R$)</label>
                           <input type="number" value={formData.deliveryConfig?.minOrder || ''} onChange={e => setFormData({...formData, deliveryConfig: { ...formData.deliveryConfig, minOrder: Number(e.target.value) }})} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300" placeholder="Ex: 20" />
                        </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Tempo (30-45)</label>
                           <input value={formData.deliveryConfig?.estimatedMinutes || ''} onChange={e => setFormData({...formData, deliveryConfig: { ...formData.deliveryConfig, estimatedMinutes: e.target.value }})} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300" placeholder="30-45 min" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Raio Máx (KM)</label>
                           <input type="number" value={formData.deliveryConfig?.radiusKm || ''} onChange={e => setFormData({...formData, deliveryConfig: { ...formData.deliveryConfig, radiusKm: Number(e.target.value) }})} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300" placeholder="Ex: 5" />
                        </div>
                     </div>
                  </div>
               )}
            </div>
          )}

          {/* WHATSAPP TAB */}
          {activeTab === 'WHATSAPP' && (
            <div className="space-y-6 max-w-xl mx-auto">
               <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 overflow-hidden relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Automação de WhatsApp</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Notificações Inteligentes & Evolution API</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {!hasWaInstanceLocal ? (
                      <div className="text-center py-8 px-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-white border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                           <Zap size={24} className="text-slate-300" />
                        </div>
                        <h4 className="text-xs font-black text-slate-700 uppercase mb-2">Sincronização Desconectada</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase max-w-[200px] mx-auto mb-6">
                          Ative as notificações automáticas para pagamentos Pix e novos pedidos via IA.
                        </p>
                        <button 
                          type="button"
                          onClick={handleCreateWaInstance}
                          disabled={loadingWa}
                          className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest py-3 px-8 rounded-2xl hover:bg-emerald-700 transition-all disabled:opacity-50"
                        >
                          {loadingWa ? 'PREPARANDO...' : 'ATIVAR AGORA'}
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="bg-slate-50 rounded-3xl p-6 text-center flex flex-col items-center justify-center min-h-[300px]">
                            {waState.state === 'CONNECTED' ? (
                              <div className="space-y-4">
                                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                   <MessageSquare size={32} />
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                   <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">CONECTADO</span>
                                </div>
                                <button 
                                   type="button"
                                   onClick={handleLogoutWa}
                                   className="text-[8px] font-black text-red-400 hover:text-red-600 uppercase tracking-tighter"
                                >
                                   Desconectar Dispositivo
                                </button>
                              </div>
                            ) : waState.state === 'ERROR' ? (
                              <div className="space-y-4">
                                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                   <AlertTriangle size={32} />
                                </div>
                                <div className="flex flex-col items-center justify-center gap-2">
                                   <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">SERVIÇO INDISPONÍVEL</span>
                                   <p className="text-[9px] text-slate-500 font-bold uppercase text-center max-w-[200px]">A API do WhatsApp está fora do ar ou reiniciando no momento.</p>
                                </div>
                                <div className="flex items-center justify-center gap-4 mt-4">
                                   <button 
                                      onClick={() => fetchWaStatus(true)} 
                                      disabled={loadingWa}
                                      type="button" 
                                      className="bg-white border border-slate-200 text-[9px] font-black text-slate-600 px-4 py-2 rounded-xl shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                                   >
                                      <RefreshCcw size={12} className={loadingWa ? 'animate-spin' : ''} /> TENTAR NOVAMENTE
                                   </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-6 w-full">
                                <div className="flex flex-col items-center gap-2">
                                   <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Pareamento WhatsApp</h4>
                                   <p className="text-[9px] text-slate-400 font-bold uppercase">Abra o WhatsApp &gt; Dispositivos Conectados</p>
                                </div>

                                <div className="relative group">
                                   {waState.qrcode ? (
                                      <div className="bg-white p-6 rounded-[40px] inline-block shadow-xl border-4 border-slate-100 relative overflow-hidden">
                                         <img 
                                           src={waState.qrcode.startsWith('data:') ? waState.qrcode : `data:image/png;base64,${waState.qrcode}`} 
                                           alt="QR Code WhatsApp" 
                                           className="w-56 h-56 md:w-64 md:h-64 object-contain"
                                         />
                                         {loadingWa && (
                                           <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-[36px]">
                                              <RefreshCcw className="w-8 h-8 text-emerald-500 animate-spin" />
                                           </div>
                                         )}
                                      </div>
                                   ) : (
                                      <div className="w-56 h-56 md:w-64 md:h-64 bg-slate-200 animate-pulse rounded-[40px] mx-auto flex flex-col items-center justify-center gap-3">
                                         <Zap size={24} className="text-slate-400" />
                                         <span className="text-[8px] font-black text-slate-500 uppercase">Aguardando Servidor...</span>
                                      </div>
                                   )}
                                </div>
                                <div className="flex items-center justify-center gap-4">
                                   <button 
                                      onClick={() => fetchWaStatus(true)} 
                                      disabled={loadingWa}
                                      type="button" 
                                      className="bg-white border border-slate-200 text-[9px] font-black text-slate-600 px-4 py-2 rounded-xl shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                                   >
                                      <RefreshCcw size={12} className={loadingWa ? 'animate-spin' : ''} /> ATUALIZAR QR
                                   </button>
                                   <button 
                                      onClick={() => setShowWaDeleteConfirm(true)} 
                                      type="button" 
                                      className="text-[9px] font-black text-red-500 uppercase hover:underline"
                                   >
                                      Reiniciar
                                   </button>
                                </div>
                              </div>
                            )}
                         </div>

                         {/* Modal de Confirmação de Deleção WA */}
                         {showWaDeleteConfirm && (
                            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                              <div className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl border-4 border-slate-50">
                                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                   <Zap size={32} />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 text-center mb-2 uppercase">Reiniciar WhatsApp?</h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase text-center mb-8 leading-relaxed">
                                  Isso removerá a sessão atual na Evolution API. Você precisará escanear o QR Code novamente para reconectar.
                                </p>
                                <div className="flex flex-col gap-3">
                                  <button 
                                    onClick={handleLogoutWa}
                                    className="w-full bg-red-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-red-200 hover:bg-red-600 transition-all text-[10px] uppercase tracking-widest"
                                  >
                                    REINICIAR AGORA
                                  </button>
                                  <button 
                                    onClick={() => setShowWaDeleteConfirm(false)}
                                    className="w-full bg-slate-100 text-slate-600 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all text-[10px] uppercase tracking-widest"
                                  >
                                    VOLTAR
                                  </button>
                                </div>
                              </div>
                            </div>
                         )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 pt-4">
                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm">
                                  <CheckCircle2 size={14} className="text-emerald-500" />
                                </div>
                                <span className="text-[10px] font-black text-slate-600 uppercase">Habilitar Robô</span>
                              </div>
                              <input 
                                type="checkbox" 
                                checked={formData.waEnabled} 
                                onChange={e => setFormData({...formData, waEnabled: e.target.checked})} 
                                className="w-4 h-4 accent-emerald-600" 
                              />
                            </label>

                            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-500">
                                  <StoreIcon size={14} />
                                </div>
                                <span className="text-[10px] font-black text-slate-600 uppercase">Pagamentos Pix</span>
                              </div>
                              <input 
                                type="checkbox" 
                                checked={formData.waNotifyOnPayment} 
                                onChange={e => setFormData({...formData, waNotifyOnPayment: e.target.checked})} 
                                className="w-4 h-4 accent-indigo-600" 
                              />
                            </label>

                            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm text-violet-500">
                                  <ShoppingCart size={14} />
                                </div>
                                <span className="text-[10px] font-black text-slate-600 uppercase">Novos Pedidos IA</span>
                              </div>
                              <input 
                                type="checkbox" 
                                checked={formData.waNotifyOnNewOrder} 
                                onChange={e => setFormData({...formData, waNotifyOnNewOrder: e.target.checked})} 
                                className="w-4 h-4 accent-violet-600" 
                              />
                            </label>
                         </div>
                  
                  <div className="mt-6 flex items-center gap-2 px-2">
                     <AlertTriangle size={12} className="text-amber-500" />
                     <p className="text-[8px] font-bold text-slate-400 uppercase leading-relaxed">
                        Este módulo utiliza uma instância dedicada da evolution API. Evite enviar spam para não comprometer seu número.
                     </p>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-4">
          <button onClick={onClose} className="py-4 px-8 text-slate-400 font-black uppercase text-xs hover:bg-slate-100 rounded-2xl transition-all">Cancelar</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all">
             {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />} 
             Salvar Tudo
          </button>
        </div>

      </div>
    </div>
  );
};
