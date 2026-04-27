
import React from 'react';
import { 
  Megaphone, Plus, Search, Sparkles, Image as ImageIcon, 
  Send, Clock, Trash2, Edit3, MessageCircle, AlertTriangle, 
  Check, ArrowRight, CheckCircle2 
} from 'lucide-react';
import { Ad, User } from '../../types';

interface AdsTabProps {
  ads: Ad[];
  adForm: any;
  setAdForm: (form: any) => void;
  isProcessing: boolean;
  isGeneratingAI: boolean;
  handleGenerateAdText: () => void;
  handleGenerateAdImage: () => void;
  handleSaveAd: () => void;
  deleteAd: (id: string) => Promise<boolean>;
  editingAdId: string | null;
  setEditingAdId: (id: string | null) => void;
  effectiveAdPrice: number;
  freeAdsRemaining: number;
  adFileInputRef: React.RefObject<HTMLInputElement>;
  handleAdImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  currentUser: User;
}

export const AdsTab: React.FC<AdsTabProps> = ({
  ads, adForm, setAdForm, isProcessing, isGeneratingAI,
  handleGenerateAdText, handleGenerateAdImage, handleSaveAd, deleteAd,
  editingAdId, setEditingAdId, effectiveAdPrice, freeAdsRemaining,
  adFileInputRef, handleAdImageUpload, currentUser
}) => {
  const filteredAds = ads.filter(ad => ad.ownerId === currentUser.id);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
             <div className="flex items-center justify-between mb-8">
                <div>
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Criar Novo Anúncio</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apareça para milhares de clientes</p>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={handleGenerateAdText}
                     disabled={isGeneratingAI}
                     className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                   >
                     <Sparkles size={18} />
                     <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">IA Texto</span>
                   </button>
                   <button 
                     onClick={handleGenerateAdImage}
                     disabled={isGeneratingAI || !adForm.title}
                     className="p-3 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
                   >
                     <ImageIcon size={18} />
                     <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">IA Imagem</span>
                   </button>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Título Chamativo</label>
                      <input 
                        type="text" 
                        value={adForm.title}
                        onChange={e => setAdForm({...adForm, title: e.target.value.slice(0, 35)})}
                        placeholder="Ex: Super Combo de Coxinha"
                        className="w-full bg-slate-50 p-5 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                      />
                      <div className="text-right text-[8px] font-bold text-slate-300 uppercase tracking-widest">{adForm.title.length}/35</div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Descrição Vendedora</label>
                      <textarea 
                        rows={3}
                        value={adForm.description}
                        onChange={e => setAdForm({...adForm, description: e.target.value.slice(0, 100)})}
                        placeholder="Descreva sua oferta em poucas palavras..."
                        className="w-full bg-slate-50 p-5 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold resize-none"
                      />
                      <div className="text-right text-[8px] font-bold text-slate-300 uppercase tracking-widest">{adForm.description.length}/100</div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">WhatsApp</label>
                         <input 
                          type="text" 
                          value={adForm.whatsapp}
                          onChange={e => setAdForm({...adForm, whatsapp: e.target.value})}
                          placeholder="219..."
                          className="w-full bg-slate-50 p-4 rounded-xl border-none font-bold text-xs"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Dias</label>
                         <select 
                          value={adForm.duration}
                          onChange={e => setAdForm({...adForm, duration: parseInt(e.target.value)})}
                          className="w-full bg-slate-50 p-4 rounded-xl border-none font-bold text-xs"
                         >
                            <option value={1}>1 dia</option>
                            <option value={7}>7 dias</option>
                            <option value={15}>15 dias</option>
                            <option value={30}>30 dias</option>
                         </select>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Imagem do Anúncio</label>
                      <div 
                        onClick={() => adFileInputRef.current?.click()}
                        className="aspect-[4/3] bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-400 hover:bg-slate-100 transition-all overflow-hidden relative group"
                      >
                         {adForm.mediaUrl ? (
                            <>
                               <img src={adForm.mediaUrl} className="w-full h-full object-cover" />
                               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ImageIcon className="text-white" size={32} />
                               </div>
                            </>
                         ) : (
                           <>
                              <div className="p-4 bg-white rounded-2xl text-slate-400">
                                 <Plus size={24} />
                              </div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Clique para subir imagem</span>
                           </>
                         )}
                      </div>
                      <input type="file" ref={adFileInputRef} onChange={handleAdImageUpload} className="hidden" accept="image/*" />
                   </div>

                   <div className="p-5 bg-indigo-50 rounded-[2rem] space-y-4">
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-black text-indigo-900 uppercase tracking-tight">Investimento</span>
                         <span className="text-xl font-black text-indigo-600">
                           {effectiveAdPrice === 0 ? 'GRÁTIS' : `R$ ${(effectiveAdPrice * adForm.duration).toFixed(2)}`}
                         </span>
                      </div>
                      {freeAdsRemaining > 0 && (
                        <div className="flex items-center gap-2 text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                           <Sparkles size={12} /> Você tem {freeAdsRemaining} anúncio(s) grátis este mês!
                        </div>
                      )}
                      <button 
                        onClick={handleSaveAd}
                        disabled={isProcessing}
                        className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        {isProcessing ? <Clock className="animate-spin" size={16} /> : <Send size={16} />}
                        {editingAdId ? 'Salvar Alterações' : 'Publicar Anúncio'}
                      </button>
                   </div>
                </div>
             </div>
           </div>

           {/* Ads List */}
           <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest px-2">Meus Anúncios ({filteredAds.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
                 {filteredAds.map(ad => (
                   <div key={ad.id} className="bg-white p-4 rounded-[2rem] border border-slate-100 flex items-center gap-4 group">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                         <img src={ad.mediaUrl || 'https://images.unsplash.com/photo-1541533231363-b55c93e807a0?w=200'} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                         <h4 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{ad.title}</h4>
                         <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                               ad.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' :
                               ad.status === 'REJECTED' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                               {ad.status === 'APPROVED' ? 'Ativo' : ad.status === 'REJECTED' ? 'Recusado' : 'Em Análise'}
                            </span>
                             {ad.expiresAt && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Expira em {new Date(ad.expiresAt).toLocaleDateString()}</span>}
                         </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                         <button onClick={() => deleteAd(ad.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                            <Trash2 size={16} />
                         </button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Info Column */}
        <div className="space-y-6">
           <div className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
              <Sparkles className="absolute top-4 right-4 text-white/20" size={64} />
              <h4 className="text-xl font-black uppercase tracking-tighter mb-4 relative z-10">Por que anunciar?</h4>
              <ul className="space-y-4 relative z-10">
                 <li className="flex gap-3">
                    <div className="p-1 bg-white/20 rounded-full h-fit"><Check size={12} strokeWidth={4} /></div>
                    <p className="text-[10px] font-bold uppercase tracking-tight leading-relaxed">Sua marca aparece no topo de todas as barracas</p>
                 </li>
                 <li className="flex gap-3">
                    <div className="p-1 bg-white/20 rounded-full h-fit"><Check size={12} strokeWidth={4} /></div>
                    <p className="text-[10px] font-bold uppercase tracking-tight leading-relaxed">Cliques diretos para o seu WhatsApp comercial</p>
                 </li>
                 <li className="flex gap-3">
                    <div className="p-1 bg-white/20 rounded-full h-fit"><Check size={12} strokeWidth={4} /></div>
                    <p className="text-[10px] font-bold uppercase tracking-tight leading-relaxed">IA inclusa para criar seus textos e imagens</p>
                 </li>
              </ul>
              <div className="mt-8 pt-8 border-t border-white/10">
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-2">Suporte via WhatsApp</p>
                  <button className="flex items-center gap-2 text-sm font-black group">
                     Falar com Especialista
                     <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 border-dashed">
              <div className="flex items-center gap-3 mb-4">
                 <AlertTriangle size={18} className="text-amber-500" />
                 <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Regras da Vitrine</h5>
              </div>
              <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase">
                Não são permitidos anúncios de terceiros, conteúdo impróprio ou imagens de baixa qualidade. Todo anúncio passa por verificação humana.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

