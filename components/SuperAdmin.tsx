
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, safeStringifyError } from '../lib/supabase';
import { Ad } from '../types';
import { 
  ShieldAlert, Globe, Users, CreditCard, MessageCircle, MessageSquare,
  CheckCircle2, XCircle, Search, Zap, ExternalLink, 
  UserCheck, Building2, Loader2, Phone, KeyRound, BarChart3,
  Settings as SettingsIcon, Save, AlertTriangle, Check, EyeOff, Megaphone, ShoppingCart,
  ImageIcon, Trash2, Clock, Calendar, X, Star, LogOut, Ban, History
} from 'lucide-react';

interface GlobalCompany {
  workspaceId: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  hasProPlan: boolean;
  isAdFree: boolean;
  isAdvertiser: boolean;
  proExpiresAt?: string;
  adFreeExpiresAt?: string;
  advertiserExpiresAt?: string;
  userCount: number;
  createdAt: string;
}

interface GlobalPinRequest {
  id: string;
  workspace_id: string;
  company_name: string;
  user_name: string;
  user_phone: string;
  requested_pin: string;
  date: string;
}

interface SuperAdminProps {
  onExit: () => void;
}

const AdTimer: React.FC<{ expiresAt: string; label?: string; lightMode?: boolean }> = ({ expiresAt, label, lightMode }) => {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const end = new Date(expiresAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((diff % (1000 * 60)) / 1000)
      });
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!timeLeft) return null;

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-fit mt-1">
      {label && <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{label}</span>}
      <div className={`flex items-center gap-1 font-mono text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm ${lightMode ? 'bg-white/20 text-white border border-white/20' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
        <Clock size={10} />
        <span className="tabular-nums">{timeLeft.d}d {timeLeft.h}h {timeLeft.m}m</span>
      </div>
    </div>
  );
};

export const SuperAdmin: React.FC<SuperAdminProps> = ({ onExit }) => {
  const [activeTab, setActiveTab] = useState<'EMPRESAS' | 'PINS' | 'ANUNCIOS' | 'SISTEMA'>('EMPRESAS');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [companies, setCompanies] = useState<GlobalCompany[]>([]);
  const [pinRequests, setPinRequests] = useState<GlobalPinRequest[]>([]);
  const [allAds, setAllAds] = useState<Ad[]>([]);
  const [supportPhone, setSupportPhone] = useState('21999999999');

  const [adToApprove, setAdToApprove] = useState<Ad | null>(null);
  
  // Modal de Aprovação (Definir Dias)
  const [planToApprove, setPlanToApprove] = useState<{
    company: GlobalCompany;
    field: 'hasProPlan' | 'isAdFree' | 'isAdvertiser';
  } | null>(null);
  
  // Modal de Gerenciamento (Já Ativo: Encerrar ou Estender)
  const [planToManage, setPlanToManage] = useState<{
    company: GlobalCompany;
    field: 'hasProPlan' | 'isAdFree' | 'isAdvertiser';
  } | null>(null);

  // Novo estado para o modal de confirmação de encerramento
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const [approvalDays, setApprovalDays] = useState(30);

  const fetchGlobalSettings = useCallback(async () => {
    try {
      const { data } = await supabase.from('app_config').select('items').eq('id', 'GLOBAL_SYSTEM_SETTINGS').maybeSingle();
      if (data && Array.isArray(data.items) && data.items[0]?.support_phone) {
        setSupportPhone(data.items[0].support_phone);
      }
    } catch (e) { console.warn("Kernel: Erro ao ler suporte global."); }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await fetchGlobalSettings();
      const { data: owners } = await supabase.from('users').select('*').eq('role', 'OWNER');
      const { data: allUsers } = await supabase.from('users').select('workspace_id');
      const { data: txs } = await supabase.from('transactions').select('*').eq('category', 'SISTEMA').eq('sub_category', 'SEGURANCA').eq('is_pending', true);
      const { data: adsData } = await supabase.from('ads').select('*');

      if (owners) {
        setCompanies(owners.map(o => ({
          workspaceId: o.workspace_id,
          ownerId: o.id,
          name: o.name,
          ownerName: o.name,
          ownerEmail: o.email,
          ownerPhone: o.phone || '',
          hasProPlan: !!o.has_pro_plan,
          isAdFree: !!o.is_ad_free,
          isAdvertiser: !!o.is_advertiser,
          proExpiresAt: o.pro_expires_at,
          adFreeExpiresAt: o.ad_free_expires_at,
          advertiserExpiresAt: o.advertiser_expires_at,
          userCount: allUsers?.filter(u => u.workspace_id === o.workspace_id).length || 0,
          createdAt: o.created_at || new Date().toISOString()
        })));
      }

      if (txs) {
        setPinRequests(txs.map(t => {
          const owner = owners?.find(o => o.workspace_id === t.workspace_id);
          return {
            id: t.id,
            workspace_id: t.workspace_id,
            company_name: owner?.name || 'Empresa Desconhecida',
            user_name: (t.item || '').replace('SOLICITAÇÃO DE PIN: ', ''),
            user_phone: t.customer_name || '',
            requested_pin: String(t.quantity),
            date: t.date
          };
        }));
      }

      if (adsData) {
        setAllAds(adsData.map(ad => ({
          id: ad.id,
          workspaceId: ad.workspace_id,
          ownerId: ad.owner_id,
          ownerName: ad.owner_name,
          title: ad.title,
          description: ad.description,
          link: ad.link,
          backgroundColor: ad.background_color,
          mediaUrl: ad.media_url,
          mediaType: ad.media_type,
          active: ad.active,
          clicks: ad.clicks || 0,
          expiresAt: ad.expires_at
        })));
      }
    } catch (e) { console.error("Kernel Sync Fail:", e); }
    finally { setLoading(false); }
  }, [fetchGlobalSettings]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprovePlan = async () => {
    if (!planToApprove) return;
    setIsSaving(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + approvalDays);
      
      const dbFields: any = {
        'hasProPlan': { f: 'has_pro_plan', d: 'pro_expires_at' },
        'isAdFree': { f: 'is_ad_free', d: 'ad_free_expires_at' },
        'isAdvertiser': { f: 'is_advertiser', d: 'advertiser_expires_at' }
      };

      const fields = dbFields[planToApprove.field];
      const { error } = await supabase.from('users').update({ 
        [fields.f]: true, 
        [fields.d]: expiresAt.toISOString() 
      }).eq('workspace_id', planToApprove.company.workspaceId).eq('role', 'OWNER');
      
      if (!error) {
        // ATIVAÇÃO AUTOMÁTICA DA VITRINE SE FOR PLANO PRO
        if (planToApprove.field === 'hasProPlan') {
          console.log("Ativando vitrine automaticamente...");
          await supabase
            .from('store_profiles')
            .update({ active: true })
            .eq('workspace_id', planToApprove.company.workspaceId);
        }

        setCompanies(prev => prev.map(c => c.workspaceId === planToApprove.company.workspaceId ? { 
          ...c, 
          [planToApprove.field]: true,
          [fields.d === 'pro_expires_at' ? 'proExpiresAt' : fields.d === 'ad_free_expires_at' ? 'adFreeExpiresAt' : 'advertiserExpiresAt']: expiresAt.toISOString() 
        } : c));
        setPlanToApprove(null);
      }
    } catch (e) { alert("Erro ao ativar plano."); }
    finally { setIsSaving(false); }
  };

  const executeEndPlan = async () => {
    if (!planToManage) return;
    
    setIsSaving(true);
    try {
      const dbFields: any = {
        'hasProPlan': { f: 'has_pro_plan', d: 'pro_expires_at' },
        'isAdFree': { f: 'is_ad_free', d: 'ad_free_expires_at' },
        'isAdvertiser': { f: 'is_advertiser', d: 'advertiser_expires_at' }
      };

      const fields = dbFields[planToManage.field];
      
      // 1. Remove o plano do usuário
      const { error } = await supabase.from('users').update({ 
        [fields.f]: false, 
        [fields.d]: null 
      }).eq('workspace_id', planToManage.company.workspaceId).eq('role', 'OWNER');
      
      if (error) throw error;

      // 2. SE FOR PLANO PRO: Força desativação da vitrine imediatamente
      if (planToManage.field === 'hasProPlan') {
        console.log("Desativando vitrine forçadamente...");
        await supabase
          .from('store_profiles')
          .update({ active: false })
          .eq('workspace_id', planToManage.company.workspaceId);
      }
      
      setCompanies(prev => prev.map(c => c.workspaceId === planToManage.company.workspaceId ? { 
        ...c, 
        [planToManage.field]: false,
        [fields.d === 'pro_expires_at' ? 'proExpiresAt' : fields.d === 'ad_free_expires_at' ? 'adFreeExpiresAt' : 'advertiserExpiresAt']: null 
      } : c));
      
      setPlanToManage(null);
      setShowEndConfirm(false);
      
    } catch (e: any) { 
      console.error("Erro ao encerrar plano:", e);
      alert("Erro ao encerrar plano: " + (e.message || "Erro desconhecido"));
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleApproveAd = async () => {
    if (!adToApprove) return;
    setIsSaving(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + approvalDays);
      const { error } = await supabase.from('ads').update({ active: true, expires_at: expiresAt.toISOString() }).eq('id', adToApprove.id);
      if (!error) {
        setAllAds(prev => prev.map(a => a.id === adToApprove.id ? { ...a, active: true, expiresAt: expiresAt.toISOString() } : a));
        setAdToApprove(null);
      }
    } catch (e) { alert("Erro ao aprovar anúncio."); }
    finally { setIsSaving(false); }
  };

  const handleSendPin = (req: GlobalPinRequest) => {
    const targetPhone = req.user_phone.replace(/\D/g, '') || companies.find(c => c.workspaceId === req.workspace_id)?.ownerPhone.replace(/\D/g, '');
    if (!targetPhone) { alert("Telefone não encontrado."); return; }
    const msg = `Olá ${req.user_name}! Seu novo PIN no Salgados Pro é: *${req.requested_pin}*`;
    window.open(`https://wa.me/55${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleDeletePinRequest = async (id: string) => {
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      setPinRequests(prev => prev.filter(p => p.id !== id));
    } catch (e) { alert("Erro ao excluir."); }
  };

  const saveSystemSettings = async () => {
    setIsSaving(true);
    try {
      await supabase.from('app_config').upsert({ id: 'GLOBAL_SYSTEM_SETTINGS', workspace_id: 'ADMIN_GLOBAL', name: 'SISTEMA', items: [{ support_phone: supportPhone.replace(/\D/g, '') }] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) { alert("Erro ao salvar."); }
    finally { setIsSaving(false); }
  };

  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // Função auxiliar para lidar com clique no botão do plano
  const handlePlanClick = (company: GlobalCompany, field: 'hasProPlan' | 'isAdFree' | 'isAdvertiser') => {
    if (company[field]) {
      // Se já tem o plano, abre modal de gerenciamento (Encerrar ou Estender)
      setPlanToManage({ company, field });
    } else {
      // Se não tem, abre modal de ativação (30 dias padrão)
      setApprovalDays(30);
      setPlanToApprove({ company, field });
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      <header className="bg-slate-950 p-8 rounded-[3rem] text-white shadow-2xl relative border-2 border-amber-500/30">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-amber-500 text-slate-950 rounded-2xl shadow-xl shadow-amber-500/20"><ShieldAlert size={28} /></div>
            <div><h2 className="text-3xl font-black tracking-tight">Painel <span className="text-amber-500">Master</span></h2><p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Gestão Global de Operações</p></div>
          </div>
          <button 
            onClick={onExit}
            className="p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-rose-900/50 hover:border-rose-500 transition-all text-slate-400 hover:text-white"
            title="Sair do Modo Deus"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex bg-slate-900 p-1.5 rounded-[2.2rem] gap-1 shadow-xl overflow-x-auto no-scrollbar">
        {['EMPRESAS', 'PINS', 'ANUNCIOS', 'SISTEMA'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-4 px-6 rounded-[1.8rem] text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
            {tab === 'PINS' && pinRequests.length > 0 ? `${tab} (${pinRequests.length})` : tab}
          </button>
        ))}
      </div>

      {activeTab !== 'SISTEMA' && (
        <div className="relative"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="LOCALIZAR..." className="w-full p-5 pl-14 bg-white rounded-[1.8rem] shadow-sm border border-slate-100 font-black text-[10px] uppercase outline-none focus:ring-4 focus:ring-amber-500/10" /></div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4"><Loader2 className="w-10 h-10 text-amber-500 animate-spin" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Kernel...</p></div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'EMPRESAS' && (
            <div className="grid gap-4">
              {filteredCompanies.map(c => (
                <div key={c.workspaceId} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                       <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-xl text-slate-400">{(c.name || '?').charAt(0).toUpperCase()}</div>
                       <div><h4 className="font-black text-slate-800 text-sm uppercase">{c.name}</h4><p className="text-[8px] font-black text-slate-300 uppercase">{c.userCount} Membros • WS: {c.workspaceId.substring(0,8)}</p></div>
                    </div>
                    <a href={`https://wa.me/55${c.ownerPhone.replace(/\D/g, '')}`} target="_blank" className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Phone size={18} /></a>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handlePlanClick(c, 'hasProPlan')} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${c.hasProPlan ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      <ShoppingCart size={18} />
                      <span className="text-[7px] font-black uppercase">Plano Pro</span>
                      {c.hasProPlan && c.proExpiresAt && <AdTimer expiresAt={c.proExpiresAt} lightMode />}
                    </button>
                    <button onClick={() => handlePlanClick(c, 'isAdFree')} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${c.isAdFree ? 'bg-blue-600 border-blue-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      <EyeOff size={18} />
                      <span className="text-[7px] font-black uppercase">Sem Ads</span>
                      {c.isAdFree && c.adFreeExpiresAt && <AdTimer expiresAt={c.adFreeExpiresAt} lightMode />}
                    </button>
                    <button onClick={() => handlePlanClick(c, 'isAdvertiser')} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${c.isAdvertiser ? 'bg-emerald-600 border-emerald-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      <Megaphone size={18} />
                      <span className="text-[7px] font-black uppercase">Anunciante</span>
                      {c.isAdvertiser && c.advertiserExpiresAt && <AdTimer expiresAt={c.advertiserExpiresAt} lightMode />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'PINS' && (
             <div className="grid gap-4">
                {pinRequests.length === 0 ? (
                  <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-100"><p className="text-[10px] font-black text-slate-300 uppercase">Sem pedidos de recuperação</p></div>
                ) : (
                  pinRequests.map(req => (
                    <div key={req.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-amber-100 flex items-center justify-between">
                       <div className="flex items-center gap-4"><div className="p-4 bg-amber-500 text-slate-950 rounded-2xl"><KeyRound size={24} /></div><div><h4 className="font-black text-slate-800 text-sm uppercase">{req.user_name}</h4><p className="text-[9px] font-bold text-slate-400 uppercase">{req.company_name}</p></div></div>
                       <div className="flex items-center gap-2">
                          <div><p className="text-[8px] font-black text-slate-400 uppercase">Novo PIN</p><p className="text-xl font-black text-slate-900">{req.requested_pin}</p></div>
                          <button onClick={() => handleSendPin(req)} className="p-4 bg-emerald-600 text-white rounded-2xl"><MessageSquare size={20} /></button>
                          <button onClick={() => handleDeletePinRequest(req.id)} className="p-4 bg-rose-100 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-colors"><Trash2 size={20} /></button>
                       </div>
                    </div>
                  ))
                )}
             </div>
          )}

          {activeTab === 'ANUNCIOS' && (
             <div className="grid gap-4">
                {allAds.map(ad => (
                  <div key={ad.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center">{ad.mediaUrl ? <img src={ad.mediaUrl} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-300" />}</div>
                        <div className="space-y-1"><h4 className="font-black text-slate-800 text-sm uppercase">{ad.title}</h4><p className="text-[9px] font-bold text-slate-400 uppercase">Empresa: {ad.ownerName}</p>{ad.active && ad.expiresAt && <AdTimer expiresAt={ad.expiresAt} label="Vencimento:" />}</div>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => { setApprovalDays(7); setAdToApprove(ad); }} className={`p-4 rounded-2xl shadow-lg transition-all ${ad.active ? 'bg-emerald-600 text-white' : 'bg-orange-500 text-white animate-pulse'}`}>{ad.active ? <CheckCircle2 size={20} /> : <Zap size={20} />}</button>
                        <button onClick={() => supabase.from('ads').delete().eq('id', ad.id).then(() => fetchData())} className="p-4 bg-rose-600 text-white rounded-2xl"><Trash2 size={20} /></button>
                     </div>
                  </div>
                ))}
             </div>
          )}

          {activeTab === 'SISTEMA' && (
             <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50 space-y-6">
                <div className="flex items-center gap-4 mb-4"><div className="p-4 bg-blue-600 text-white rounded-2xl"><SettingsIcon size={24} /></div><div><h3 className="text-xl font-black text-slate-800">Kernel Config</h3><p className="text-[10px] font-bold text-slate-400 uppercase">Número Global de Suporte</p></div></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-4">WhatsApp Admin</label><input value={supportPhone} onChange={e => setSupportPhone(e.target.value)} placeholder="Ex: 21999999999" className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.8rem] font-bold text-slate-700 outline-none transition-all" /></div>
                <button onClick={saveSystemSettings} disabled={isSaving} className={`w-full py-5 rounded-[1.8rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 transition-all ${saveSuccess ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}>{isSaving ? <Loader2 className="animate-spin" /> : saveSuccess ? <Check /> : <Save />} {saveSuccess ? 'Kernel Atualizado!' : 'Salvar Canal Global'}</button>
             </div>
          )}
        </div>
      )}

      {/* MODAL DE APROVAÇÃO (PRAZO) */}
      {(adToApprove || planToApprove) && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl overflow-hidden">
              <header className="flex justify-between items-center mb-8"><div><h3 className="text-xl font-black text-slate-800 uppercase">{adToApprove ? 'Ativar Ad' : 'Ativar Plano'}</h3><p className="text-[9px] font-black text-blue-600 uppercase mt-1">Selecione a Duração</p></div><button onClick={() => { setAdToApprove(null); setPlanToApprove(null); }}><X size={24} className="text-slate-400" /></button></header>
              <div className="grid grid-cols-2 gap-3 mb-8">
                 {[1, 7, 15, 30].map(days => (
                   <button key={days} onClick={() => setApprovalDays(days)} className={`p-5 rounded-2xl border-2 font-black transition-all ${approvalDays === days ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-lg scale-105' : 'bg-slate-50 border-slate-100 text-slate-400'}`}><span className="text-lg">{days}</span><span className="text-[8px] uppercase tracking-widest ml-1">{days === 1 ? 'Dia' : 'Dias'}</span></button>
                 ))}
              </div>
              <button onClick={adToApprove ? handleApproveAd : handleApprovePlan} disabled={isSaving} className="w-full py-5 bg-emerald-600 text-white rounded-[1.8rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">{isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Efetivar Ativação</button>
           </div>
        </div>
      )}

      {/* MODAL DE GERENCIAMENTO (ENCERRAR OU ESTENDER) */}
      {planToManage && !showEndConfirm && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl overflow-hidden text-center">
              <div className="flex justify-center mb-6">
                 <div className="p-4 bg-slate-100 rounded-3xl text-slate-500"><SettingsIcon size={32} /></div>
              </div>
              
              <h3 className="text-xl font-black text-slate-800 uppercase mb-2">Gerenciar Assinatura</h3>
              <p className="text-xs font-bold text-slate-400 uppercase mb-8">{planToManage.company.name} - {planToManage.field}</p>
              
              <div className="space-y-3">
                 <button 
                   onClick={() => {
                     // Passa para o fluxo de aprovação (extensão)
                     setPlanToApprove(planToManage);
                     setPlanToManage(null);
                     setApprovalDays(30);
                   }} 
                   className="w-full py-5 bg-blue-600 text-white rounded-[1.8rem] font-black uppercase text-xs shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-blue-500"
                 >
                   <History size={16} /> Renovar / Estender
                 </button>

                 <button 
                   onClick={() => setShowEndConfirm(true)} 
                   className="w-full py-5 bg-rose-50 text-rose-600 border border-rose-100 rounded-[1.8rem] font-black uppercase text-xs shadow-none flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-rose-100 hover:border-rose-200"
                 >
                   <Ban size={16} /> Encerrar Assinatura
                 </button>

                 <button 
                   onClick={() => setPlanToManage(null)} 
                   className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors"
                 >
                   Cancelar
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE ENCERRAMENTO */}
      {showEndConfirm && planToManage && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl text-center border-4 border-rose-100">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse">
                 <AlertTriangle className="w-10 h-10 text-rose-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">Tem Certeza?</h3>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
                 Você está prestes a remover o acesso de <strong className="text-slate-800">{planToManage.company.name}</strong> ao plano selecionado. Esta ação é imediata.
              </p>
              
              <div className="flex gap-3">
                 <button 
                   onClick={() => setShowEndConfirm(false)} 
                   className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-colors"
                 >
                   Cancelar
                 </button>
                 <button 
                   onClick={executeEndPlan}
                   disabled={isSaving}
                   className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-900/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Confirmar
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
