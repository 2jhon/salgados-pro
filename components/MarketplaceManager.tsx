import React, { useState, useRef, useEffect } from 'react';
import { StoreProfile, PortfolioItem } from '../types';
import { 
  Save, Plus, Trash2, Edit3, 
  ShoppingBag, Check, X, Loader2,
  ImageIcon, ShoppingCart, Upload, Camera,
  Zap, Clock, DollarSign, Sparkles, MessageCircle, AlertTriangle
} from 'lucide-react';

interface MarketplaceManagerProps {
  profile: StoreProfile | null;
  onSave: (profile: Omit<StoreProfile, 'id'>) => Promise<StoreProfile | null>;
  workspaceId: string;
  user: { id: string; name: string; hasProPlan?: boolean; workspaceId: string };
}

export const MarketplaceManager: React.FC<MarketplaceManagerProps> = ({ profile, onSave, workspaceId, user }) => {
  const isPro = user.hasProPlan;

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
    portfolio: profile?.portfolio || []
  });

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({ ...prev, ...profile, active: profile.active }));
    }
  }, [profile]);

  const [isSaving, setIsSaving] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await onSave(formData);
      if (result) alert("Vitrine publicada!");
    } catch (e) { alert("Erro ao salvar."); }
    finally { setIsSaving(false); }
  };

  const toggleActive = () => {
    // Permitir DESATIVAR sempre. Permitir ATIVAR apenas se for PRO.
    if (!isPro && !formData.active) {
      alert("Para ativar sua Vitrine Online, assine o Plano Profissional!");
      return;
    }
    setFormData(prev => ({ ...prev, active: !prev.active }));
  };

  const addOrUpdateItem = () => {
    if (!newItem.name || newItem.price <= 0) { alert("Preencha Nome e Valor."); return; }
    
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
      alert("A funcionalidade de Stories/Destaque é exclusiva para assinantes PRO.");
      return;
    }

    const updatedPortfolio = [...formData.portfolio];
    const item = updatedPortfolio[idx];
    const now = Date.now();

    // Se já está ativo e não expirou, desativa
    if (item.highlightExpiresAt && new Date(item.highlightExpiresAt).getTime() > now) {
      delete item.highlightExpiresAt;
    } else {
      // Ativa por 24 horas
      item.highlightExpiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    }

    setFormData({ ...formData, portfolio: updatedPortfolio });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewItem(prev => ({ ...prev, imageUrl: reader.result as string }));
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50 space-y-8">
        <div className="flex justify-between items-center">
           <div className="flex items-center gap-4">
              <div className="p-4 bg-emerald-600 text-white rounded-[1.5rem]"><ShoppingBag size={24} /></div>
              <div><h2 className="text-2xl font-black text-slate-800">Cardápio Vitrine</h2><p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Itens para Venda Direta</p></div>
           </div>
           <button 
              onClick={() => { setEditingItemIndex(null); setNewItem({ id: Date.now().toString(), name: '', price: 0, description: '', imageUrl: '', available: true }); setShowItemModal(true); }} 
              className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all"
           >
              <Plus size={24} />
           </button>
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
                          <p className="font-black text-emerald-600 text-sm mt-1">R$ {item.price.toFixed(2)}</p>
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
           <div className={`flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all ${isPro ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-100 opacity-60'}`}>
              <button 
                onClick={toggleActive}
                className={`w-14 h-7 rounded-full relative transition-all ${formData.active ? 'bg-emerald-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${formData.active ? 'left-8' : 'left-1'}`} />
              </button>
              <div><p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Loja Publicada</p><p className="text-[8px] font-bold text-slate-400 uppercase">{isPro ? 'Sua vitrine está visível no Marketplace' : 'Disponível apenas no Plano PRO'}</p></div>
           </div>
           <button onClick={handleSave} disabled={isSaving} className="w-full py-5 bg-slate-900 text-white rounded-[1.8rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3">
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Salvar Vitrine Completa
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
                 <input type="number" step="0.01" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value) || 0})} placeholder="PREÇO DE VENDA R$" className="w-full p-4 bg-slate-50 rounded-xl font-black text-lg outline-none" />
                 <textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="BREVE DESCRIÇÃO (EX: MASSA DE MANDIOCA...)" className="w-full p-4 bg-slate-50 rounded-xl font-bold h-24 resize-none outline-none" />
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setShowItemModal(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                 <button onClick={addOrUpdateItem} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Confirmar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};