
import React, { useState, useRef } from 'react';
import { StoreProfile } from '../types';
import { 
  Save, Store, MapPin, Phone, Instagram, 
  Facebook, Loader2, X, Hash, Image as ImageIcon,
  Upload, Camera, Trash2
} from 'lucide-react';

interface StoreProfileSettingsProps {
  profile: StoreProfile | null;
  onSave: (profile: Omit<StoreProfile, 'id'>) => Promise<StoreProfile | null>;
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
    portfolio: profile.portfolio || []
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
    portfolio: []
  });

  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'bannerUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Imagem muito grande! Escolha uma foto de até 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, [field]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (e) {
      alert("Erro ao salvar perfil. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = () => {
    if (!hasProPlan && !formData.active) {
      alert("Para ativar sua Vitrine Online, assine o Plano Profissional!");
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

           <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Endereço de Retirada / Localização</label>
              <div className="relative">
                 <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                 <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-orange-500" placeholder="Rua, Número, Bairro, Cidade" />
              </div>
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
