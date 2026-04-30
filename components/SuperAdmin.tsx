import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useInterval } from '../hooks/useInterval';
import { toast } from 'sonner';
import { supabase, safeStringifyError } from '../lib/supabase';
import { Ad } from '../types';
import { 
  ShieldAlert, Globe, Users, CreditCard, MessageCircle, MessageSquare,
  CheckCircle2, XCircle, Search, Zap, ExternalLink, 
  UserCheck, Building2, Loader2, Phone, KeyRound, BarChart3, Plus, Edit2, DollarSign,
  Settings as SettingsIcon, Save, AlertTriangle, Check, EyeOff, Megaphone, ShoppingCart,
  ImageIcon, Trash2, Clock, Calendar, X, Star, LogOut, Ban, History, Store,
  Package, ChevronUp, ChevronDown
} from 'lucide-react';

import { GlobalIntelligence } from './super_admin/GlobalIntelligence';

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
  lastSeen?: string;
  isBlocked: boolean;
  totalSpent: number;
  planActivations: number;
  adCount: number;
  customAdPrice?: number;
  customProPrice?: number;
  activePlanId?: string;
  freeAdsUsedThisMonth?: number;
  commissionActive?: boolean;
  commissionRate?: number;
  mpConnected?: boolean;
}

interface SystemSettings {
  ad_daily_price: number | string;
  support_phone: string;
  promo_ad_price?: number | string;
  promo_ad_ends_at?: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number | string;
  description: string;
  benefits: string[];
  icon: string;
  active: boolean;
  sort_order: number;
  duration_days?: number;
  promo_price?: number | string;
  promo_ends_at?: string;
  grants_pro: boolean;
  grants_ad_free: boolean;
  grants_advertiser: boolean;
  free_ads_per_month: number;
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

  const update = useCallback(() => {
    const now = new Date().getTime();
    const end = new Date(expiresAt).getTime();
    const diff = end - now;

    if (isNaN(diff) || diff <= 0) {
      setTimeLeft(null);
      return;
    }

    setTimeLeft({
      d: Math.floor(diff / (1000 * 60 * 60 * 24)),
      h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      s: Math.floor((diff % (1000 * 60)) / 1000)
    });
  }, [expiresAt]);

  useEffect(() => {
    update();
  }, [update]);

  useInterval(update, 1000);

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
  const [activeTab, setActiveTab] = useState<'EMPRESAS' | 'PINS' | 'ANUNCIOS' | 'DENUNCIAS' | 'SISTEMA' | 'FINANCEIRO' | 'INTELIGENCIA'>('EMPRESAS');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [companies, setCompanies] = useState<GlobalCompany[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const ITEMS_PER_PAGE = 20;

  const [pinRequests, setPinRequests] = useState<GlobalPinRequest[]>([]);
  const [allAds, setAllAds] = useState<Ad[]>([]);
  const pendingAdsCount = useMemo(() => 
    allAds.filter(ad => ad.paymentStatus === 'PAID' && !ad.isApproved && !ad.active).length, 
  [allAds]);
  const [reports, setReports] = useState<any[]>([]);
  const [supportPhone, setSupportPhone] = useState('21999999999');
  
  // Novos estados para Financeiro
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ ad_daily_price: 5, support_phone: '21999999999' });
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  const [adToApprove, setAdToApprove] = useState<Ad | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<GlobalCompany | null>(null);
  const [warningMessage, setWarningMessage] = useState('');
  
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

  // Modal para planos customizados (criados pelo Super Admin)
  const [customPlanToApprove, setCustomPlanToApprove] = useState<{ company: GlobalCompany; plan: SubscriptionPlan } | null>(null);
  const [customPlanToManage, setCustomPlanToManage] = useState<{ company: GlobalCompany; plan: SubscriptionPlan } | null>(null);

  // Novo estado para o modal de confirmação de encerramento
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [expandedPlansForCompany, setExpandedPlansForCompany] = useState<Record<string, boolean>>({});

  const togglePlans = (workspaceId: string) => {
    setExpandedPlansForCompany(prev => ({ ...prev, [workspaceId]: !prev[workspaceId] }));
  };

  // Novo estado para o modal de exclusão de empresa
  const [companyToDelete, setCompanyToDelete] = useState<GlobalCompany | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [approvalDays, setApprovalDays] = useState(30);

  // States for Marketplace Commission
  const [commissionTarget, setCommissionTarget] = useState<GlobalCompany | null>(null);
  const [tempCommissionActive, setTempCommissionActive] = useState(false);
  const [tempCommissionRate, setTempCommissionRate] = useState(0);

  const handleUpdateCommission = async () => {
    if (!commissionTarget) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('store_profiles')
        .update({ 
          commission_active: tempCommissionActive,
          commission_rate: tempCommissionRate
        })
        .eq('workspace_id', commissionTarget.workspaceId);

      if (error) throw error;
      toast.success("Configurações de comissão atualizadas.");
      setCommissionTarget(null);
      fetchCompanies(false, searchTerm);
    } catch (e: any) {
      toast.error("Erro ao atualizar comissão: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Força atualização da UI a cada minuto para verificar expirações em tempo real
  const [timeTick, setTimeTick] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setTimeTick(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchGlobalSettings = useCallback(async () => {
    try {
      // Tenta ler da nova tabela system_settings primeiro
      const { data: newSettings } = await supabase.from('system_settings').select('*').eq('id', 'GLOBAL').maybeSingle();
      
      if (newSettings) {
        setSystemSettings({
          ad_daily_price: newSettings.ad_daily_price,
          support_phone: newSettings.support_phone
        });
        setSupportPhone(newSettings.support_phone);
      } else {
        // Fallback para app_config se a nova tabela ainda não estiver pronta ou populada
        const { data } = await supabase.from('app_config').select('items').eq('id', 'GLOBAL_SYSTEM_SETTINGS').maybeSingle();
        if (data && Array.isArray(data.items) && data.items[0]?.support_phone) {
          setSupportPhone(data.items[0].support_phone);
          setSystemSettings(prev => ({ ...prev, support_phone: data.items[0].support_phone }));
        }
      }
    } catch (e) { console.warn("Kernel: Erro ao ler suporte global."); }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const { data } = await supabase.from('subscription_plans').select('*').order('sort_order', { ascending: true });
      if (data) setPlans(data);
    } catch (e) { console.warn("Kernel: Erro ao ler planos."); }
  }, []);

  const fetchCompanies = useCallback(async (isLoadMore = false, search = '') => {
    if (isLoadMore) setIsFetchingMore(true);
    else setLoading(true);

    try {
      // Use functional update to get current value without dependency
      let targetPage = 0;
      setPage(prev => {
        targetPage = isLoadMore ? prev + 1 : 0;
        return targetPage;
      });

      const from = targetPage * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('company_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search) {
        query = query.or(`company_name.ilike.%${search}%,owner_email.ilike.%${search}%,workspace_id.ilike.%${search}%`);
      }
      
      const { data: metrics, error } = await query;

      if (error) throw error;

      if (metrics) {
        const newCompanies = metrics.map(m => ({
          workspaceId: m.workspace_id,
          ownerId: m.owner_id,
          name: m.company_name,
          ownerName: m.company_name,
          ownerEmail: m.owner_email,
          ownerPhone: m.owner_phone || '',
          hasProPlan: !!m.has_pro_plan,
          isAdFree: !!m.is_ad_free,
          isAdvertiser: !!m.is_advertiser,
          proExpiresAt: m.pro_expires_at,
          adFreeExpiresAt: m.ad_free_expires_at,
          advertiserExpiresAt: m.advertiser_expires_at,
          userCount: m.user_count || 0,
          createdAt: m.created_at || new Date().toISOString(),
          lastSeen: m.last_seen,
          isBlocked: !!m.is_blocked,
          totalSpent: m.total_spent || 0,
          planActivations: m.plan_activations || 0,
          adCount: m.ad_count || 0,
          customAdPrice: m.custom_ad_price,
          customProPrice: m.custom_pro_price,
          activePlanId: m.active_plan_id,
          freeAdsUsedThisMonth: m.free_ads_used_this_month,
          commissionActive: !!m.commission_active,
          commissionRate: m.commission_rate || 0,
          mpConnected: !!m.mp_connected
        }));

        if (isLoadMore) {
          setCompanies(prev => [...prev, ...newCompanies]);
        } else {
          setCompanies(newCompanies);
        }

        setHasMore(metrics.length === ITEMS_PER_PAGE);
      }
    } catch (e) {
      console.error("Erro ao buscar empresas:", e);
      toast.error("Erro ao carregar empresas: " + (e as any).message);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, []); // Break the [page] loop

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCompanies(false, searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchCompanies]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await fetchGlobalSettings();
      await fetchPlans();
      // fetchCompanies agora é controlado pelo useEffect do searchTerm (Fase 3)
      
      const { data: txs } = await supabase.from('transactions').select('*').eq('category', 'SISTEMA').eq('sub_category', 'SEGURANCA').eq('is_pending', true);
      const { data: adsData } = await supabase.from('app_banners').select('*');
      const { data: reportsData } = await supabase.from('reports').select('*');

      if (reportsData) {
        setReports(reportsData);
      }

      if (txs) {
        setPinRequests(txs.map(t => {
          return {
            id: t.id,
            workspace_id: t.workspace_id,
            company_name: 'Empresa Solicitante', // Simplificado para performance inicial
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
          paymentStatus: ad.payment_status || 'PENDING',
          isApproved: ad.is_approved || false,
          clicks: ad.clicks || 0,
          expiresAt: ad.expires_at,
          requestedDuration: ad.requested_duration
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
      const days = Number(approvalDays) || 30;
      expiresAt.setDate(expiresAt.getDate() + days);
      
      const isoDate = expiresAt.toISOString();
      
      const dbFields: any = {
        'hasProPlan': { f: 'has_pro_plan', d: 'pro_expires_at' },
        'isAdFree': { f: 'is_ad_free', d: 'ad_free_expires_at' },
        'isAdvertiser': { f: 'is_advertiser', d: 'advertiser_expires_at' }
      };

      const fields = dbFields[planToApprove.field];
      const { error } = await supabase.from('users').update({ 
        [fields.f]: true, 
        [fields.d]: isoDate 
      }).eq('workspace_id', planToApprove.company.workspaceId).eq('role', 'OWNER');
      
      if (error) throw error;

      // ATIVAÇÃO AUTOMÁTICA DA VITRINE SE FOR PLANO PRO
        if (planToApprove.field === 'hasProPlan') {
          console.log("Ativando vitrine automaticamente via Upsert...");
          await supabase
            .from('store_profiles')
            .upsert({ 
              workspace_id: planToApprove.company.workspaceId,
              active: true,
              name: planToApprove.company.name || 'Minha Loja'
            }, { onConflict: 'workspace_id' });
        }

        setCompanies(prev => prev.map(c => c.workspaceId === planToApprove.company.workspaceId ? { 
          ...c, 
          [planToApprove.field]: true,
          [fields.d === 'pro_expires_at' ? 'proExpiresAt' : fields.d === 'ad_free_expires_at' ? 'adFreeExpiresAt' : 'advertiserExpiresAt']: expiresAt.toISOString() 
        } : c));
        setPlanToApprove(null);
    } catch (e: any) { 
      console.error(e);
      toast.error(e.message || "Erro ao ativar plano."); 
    }
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
      toast.error("Erro ao encerrar plano: " + safeStringifyError(e));
    } finally {
      setIsSaving(false); 
    }
  };

  const handleApproveAd = async () => {
    if (!adToApprove) return;
    setIsSaving(true);
    try {
      const expiresAt = new Date();
      const days = Number(approvalDays) || 30;
      expiresAt.setDate(expiresAt.getDate() + days);
      const isoDate = expiresAt.toISOString();

      // 1. Atualiza o Anúncio
      const { error: adError } = await supabase.from('app_banners')
        .update({ active: true, is_approved: true, expires_at: isoDate })
        .eq('id', adToApprove.id);
      
      if (adError) throw adError;

      // 2. SINCRONIZA STATUS NO USUÁRIO (CRÍTICO PARA EXIBIÇÃO NA ABA EMPRESAS)
      // Atualiza o dono da empresa para ter o status de anunciante refletido
      const { error: userError } = await supabase.from('users')
        .update({ 
          is_advertiser: true, 
          advertiser_expires_at: isoDate 
        })
        .eq('workspace_id', adToApprove.workspaceId)
        .eq('role', 'OWNER');

      if (userError) console.error("Falha ao sincronizar user status:", userError);

      // 3. Atualiza estado local de Anúncios
      setAllAds(prev => prev.map(a => a.id === adToApprove.id ? { ...a, active: true, expiresAt: isoDate } : a));
      
      // 4. Atualiza estado local de Empresas (para acender o botão verde imediatamente)
      setCompanies(prev => prev.map(c => {
        if (c.workspaceId === adToApprove.workspaceId) {
          return {
            ...c,
            isAdvertiser: true,
            advertiserExpiresAt: isoDate
          };
        }
        return c;
      }));

      setAdToApprove(null);
    } catch (e) { toast.error("Erro ao aprovar anúncio."); }
    finally { setIsSaving(false); }
  };

  const handleSendPin = (req: GlobalPinRequest) => {
    const targetPhone = req.user_phone.replace(/\D/g, '') || companies.find(c => c.workspaceId === req.workspace_id)?.ownerPhone.replace(/\D/g, '');
    if (!targetPhone) { toast.error("Telefone não encontrado."); return; }
    const msg = `Olá ${req.user_name}! Seu novo PIN no Salgados Pro é: *${req.requested_pin}*`;
    window.open(`https://wa.me/55${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleDeletePinRequest = async (id: string) => {
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      setPinRequests(prev => prev.filter(p => p.id !== id));
    } catch (e) { toast.error("Erro ao excluir."); }
  };

  const saveSystemSettings = async () => {
    setIsSaving(true);
    try {
      // Salva na nova tabela system_settings
      const { error } = await supabase.from('system_settings').upsert({ 
        id: 'GLOBAL', 
        ad_daily_price: Number(systemSettings.ad_daily_price) || 0,
        support_phone: systemSettings.support_phone.replace(/\D/g, ''),
        promo_ad_price: systemSettings.promo_ad_price ? Number(systemSettings.promo_ad_price) : null,
        promo_ad_ends_at: systemSettings.promo_ad_ends_at || null
      });

      if (error) throw error;

      // Mantém compatibilidade com app_config por enquanto
      await supabase.from('app_config').upsert({ 
        id: 'GLOBAL_SYSTEM_SETTINGS', 
        workspace_id: 'ADMIN_GLOBAL', 
        name: 'SISTEMA', 
        items: [{ support_phone: systemSettings.support_phone.replace(/\D/g, '') }] 
      });

      setSupportPhone(systemSettings.support_phone);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      toast.success("Configurações globais atualizadas!");
    } catch (e) { 
      console.error(e);
      toast.error("Erro ao salvar configurações."); 
    }
    finally { setIsSaving(false); }
  };

  const handleSavePlan = async (plan: Partial<SubscriptionPlan>) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('subscription_plans').upsert({
        ...plan,
        price: Number(plan.price) || 0,
        duration_days: Number(plan.duration_days) || 30, // Default 30 days
        promo_price: plan.promo_price ? Number(plan.promo_price) : null,
        promo_ends_at: plan.promo_ends_at || null,
        grants_pro: !!plan.grants_pro,
        grants_ad_free: !!plan.grants_ad_free,
        grants_advertiser: !!plan.grants_advertiser,
        free_ads_per_month: Number(plan.free_ads_per_month) || 0,
        id: plan.id || undefined // Deixa o banco gerar se for novo
      });
      if (error) throw error;
      toast.success("Plano salvo com sucesso!");
      setEditingPlan(null);
      fetchPlans();
    } catch (e) { toast.error("Erro ao salvar plano."); }
    finally { setIsSaving(false); }
  };

  const handleDeletePlan = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este plano?")) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
      if (error) throw error;
      toast.success("Plano removido.");
      fetchPlans();
    } catch (e) { toast.error("Erro ao remover plano."); }
    finally { setIsSaving(false); }
  };

  const handleSaveCustomPrices = async () => {
    if (!selectedCompany) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('users').update({
        custom_ad_price: selectedCompany.customAdPrice ? Number(selectedCompany.customAdPrice) : null,
        custom_pro_price: selectedCompany.customProPrice ? Number(selectedCompany.customProPrice) : null,
        active_plan_id: selectedCompany.activePlanId || null,
        pro_expires_at: selectedCompany.proExpiresAt || null,
        ad_free_expires_at: selectedCompany.adFreeExpiresAt || null,
        advertiser_expires_at: selectedCompany.advertiserExpiresAt || null
      }).eq('workspace_id', selectedCompany.workspaceId).eq('role', 'OWNER');

      if (error) throw error;
      toast.success("Preços customizados salvos!");
      setCompanies(prev => prev.map(c => c.workspaceId === selectedCompany.workspaceId ? selectedCompany : c));
    } catch (e) { toast.error("Erro ao salvar preços."); }
    finally { setIsSaving(false); }
  };

  const handleSendWarning = async () => {
    if (!selectedCompany || !warningMessage.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('notes').insert({
        workspace_id: selectedCompany.workspaceId,
        created_by_id: 'ADMIN_GLOBAL',
        created_by_name: 'Administração',
        content: warningMessage,
        type: 'ALERT',
        is_read: false
      });
      if (error) throw error;
      toast.success("Aviso enviado com sucesso!");
      setWarningMessage('');
    } catch (e) { toast.error("Erro ao enviar aviso."); }
    finally { setIsSaving(false); }
  };

  const handleBlockCompany = async () => {
    if (!selectedCompany) return;
    const newStatus = !selectedCompany.isBlocked;
    if (!window.confirm(`Tem certeza que deseja ${newStatus ? 'BLOQUEAR' : 'DESBLOQUEAR'} a empresa ${selectedCompany.name}?`)) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from('users').update({ is_blocked: newStatus }).eq('workspace_id', selectedCompany.workspaceId);
      if (error) throw error;
      
      setCompanies(prev => prev.map(c => c.workspaceId === selectedCompany.workspaceId ? { ...c, isBlocked: newStatus } : c));
      setSelectedCompany(prev => prev ? { ...prev, isBlocked: newStatus } : null);
      toast.success(`Empresa ${newStatus ? 'bloqueada' : 'desbloqueada'} com sucesso!`);
    } catch (e) { toast.error("Erro ao alterar status de bloqueio."); }
    finally { setIsSaving(false); }
  };

  const handleDeleteCompany = () => {
    if (!selectedCompany) return;
    setCompanyToDelete(selectedCompany);
    setDeleteConfirmText('');
  };

  const executeDeleteCompany = async () => {
    if (!companyToDelete) return;
    if (deleteConfirmText !== 'DELETAR') {
      toast.error("Texto de confirmação incorreto.");
      return;
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('hard_delete_workspace', { p_workspace_id: companyToDelete.workspaceId });
      if (error) throw error;
      
      setCompanies(prev => prev.filter(c => c.workspaceId !== companyToDelete.workspaceId));
      if (selectedCompany?.workspaceId === companyToDelete.workspaceId) {
        setSelectedCompany(null);
      }
      toast.success("Empresa excluída permanentemente!");
      setCompanyToDelete(null);
    } catch (e) { toast.error("Erro ao excluir empresa."); }
    finally { setIsSaving(false); }
  };

  const handleUpdateReportStatus = async (reportId: string, newStatus: 'RESOLVED' | 'DISMISSED') => {
    try {
      const { error } = await supabase.from('reports').update({ status: newStatus }).eq('id', reportId);
      if (error) throw error;
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
      toast.success("Status da denúncia atualizado.");
    } catch (e) { toast.error("Erro ao atualizar denúncia."); }
  };

  const filteredCompanies = companies;

  // Função auxiliar para lidar com clique no botão do plano
  const handlePlanClick = (company: GlobalCompany, field: 'hasProPlan' | 'isAdFree' | 'isAdvertiser') => {
    // Permite abrir o gerenciamento se tiver a flag no banco, mesmo que expirado, para poder renovar
    if (company[field]) {
      setPlanToManage({ company, field });
    } else {
      setApprovalDays(30);
      setPlanToApprove({ company, field });
    }
  };

  const handleCustomPlanClick = (company: GlobalCompany, plan: SubscriptionPlan) => {
    const now = timeTick;
    const isActive = company.activePlanId === plan.id && company.hasProPlan && company.proExpiresAt && new Date(company.proExpiresAt).getTime() > now;

    if (isActive) {
       setCustomPlanToManage({ company, plan });
    } else {
       setCustomPlanToApprove({ company, plan });
    }
  };

  const handleApproveCustomPlan = async () => {
    if (!customPlanToApprove) return;
    setIsSaving(true);
    try {
      const expiresAt = new Date();
      const days = Number(customPlanToApprove.plan.duration_days) || 30;
      expiresAt.setDate(expiresAt.getDate() + days);
      
      const isoDate = expiresAt.toISOString();
      
      const { error } = await supabase.from('users').update({ 
        has_pro_plan: true,
        pro_expires_at: isoDate,
        is_ad_free: true,
        ad_free_expires_at: isoDate,
        active_plan_id: customPlanToApprove.plan.id
      }).eq('workspace_id', customPlanToApprove.company.workspaceId).eq('role', 'OWNER');
      
      if (error) throw error;

      await supabase
          .from('store_profiles')
          .upsert({ 
            workspace_id: customPlanToApprove.company.workspaceId,
            active: true,
            name: customPlanToApprove.company.name || 'Minha Loja'
          }, { onConflict: 'workspace_id' });

        setCompanies(prev => prev.map(c => c.workspaceId === customPlanToApprove.company.workspaceId ? { 
          ...c, 
          hasProPlan: true,
          proExpiresAt: isoDate,
          isAdFree: true,
          adFreeExpiresAt: isoDate,
          activePlanId: customPlanToApprove.plan.id
        } : c));
        setCustomPlanToApprove(null);
    } catch (e: any) { 
      console.error(e);
      toast.error(e.message || "Erro ao ativar plano custom."); 
    }
    finally { setIsSaving(false); }
  };

  const executeEndCustomPlan = async () => {
    if (!customPlanToManage) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from('users').update({ 
        has_pro_plan: false, 
        pro_expires_at: null,
        is_ad_free: false,
        ad_free_expires_at: null,
        active_plan_id: null
      }).eq('workspace_id', customPlanToManage.company.workspaceId).eq('role', 'OWNER');
      
      if (error) throw error;

      await supabase
        .from('store_profiles')
        .update({ active: false })
        .eq('workspace_id', customPlanToManage.company.workspaceId);
      
      setCompanies(prev => prev.map(c => c.workspaceId === customPlanToManage.company.workspaceId ? { 
        ...c, 
        hasProPlan: false,
        proExpiresAt: undefined,
        isAdFree: false,
        adFreeExpiresAt: undefined,
        activePlanId: undefined
      } : c));
      setShowEndConfirm(false);
      setCustomPlanToManage(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao encerrar.");
    } finally { setIsSaving(false); }
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
        {['EMPRESAS', 'PINS', 'ANUNCIOS', 'DENUNCIAS', 'FINANCEIRO', 'INTELIGENCIA', 'SISTEMA'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-4 px-6 rounded-[1.8rem] text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
            {tab === 'PINS' && pinRequests.length > 0 ? `${tab} (${pinRequests.length})` : tab === 'DENUNCIAS' && reports.filter(r => r.status === 'PENDING').length > 0 ? `${tab} (${reports.filter(r => r.status === 'PENDING').length})` : tab === 'ANUNCIOS' && pendingAdsCount > 0 ? `${tab} (${pendingAdsCount})` : tab === 'INTELIGENCIA' ? 'BI & INTELIGÊNCIA' : tab}
          </button>
        ))}
      </div>

      {activeTab !== 'SISTEMA' && (
        <div className="sticky top-0 z-40 bg-slate-50 py-2 -mx-2 px-2">
          <div className="relative"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="LOCALIZAR..." className="w-full p-5 pl-14 bg-white rounded-[1.8rem] shadow-sm border border-slate-100 font-black text-[10px] uppercase outline-none focus:ring-4 focus:ring-amber-500/10" /></div>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4"><Loader2 className="w-10 h-10 text-amber-500 animate-spin" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Kernel...</p></div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'EMPRESAS' && (
            <div className="grid gap-4">
              {filteredCompanies.map(c => {
                const now = timeTick; // Usa estado reativo para atualizar cores em tempo real
                
                // CRITICAL FIX: Status só é visualmente "Ativo" se a flag for true E a data for futura
                const isProActive = c.hasProPlan && c.proExpiresAt && new Date(c.proExpiresAt).getTime() > now;
                const isAdFreeActive = c.isAdFree && c.adFreeExpiresAt && new Date(c.adFreeExpiresAt).getTime() > now;
                const isAdvertiserActive = c.isAdvertiser && c.advertiserExpiresAt && new Date(c.advertiserExpiresAt).getTime() > now;

                return (
                  <div key={`${c.workspaceId}_${c.ownerId}`} className={`bg-white p-6 rounded-[2.5rem] border-2 shadow-sm ${c.isBlocked ? 'border-red-500/50 bg-red-50/30' : 'border-slate-50'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <button onClick={() => setSelectedCompany(c)} className="flex items-center gap-4 text-left hover:opacity-70 transition-opacity">
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl ${c.isBlocked ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-400'}`}>{(c.name || '?').charAt(0).toUpperCase()}</div>
                         <div>
                           <h4 className="font-black text-slate-800 text-sm uppercase flex items-center gap-2">
                             {c.name}
                             {c.isBlocked && <Ban size={14} className="text-red-500" />}
                           </h4>
                           <p className="text-[8px] font-black text-slate-300 uppercase">{c.userCount} Membros • WS: {c.workspaceId.substring(0,8)}</p>
                         </div>
                      </button>
                      <a href={`https://wa.me/55${c.ownerPhone.replace(/\D/g, '')}`} target="_blank" className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Phone size={18} /></a>
                    </div>
                    <div className="mt-4">
                      <button onClick={() => togglePlans(c.workspaceId)} className="w-full flex items-center justify-between p-4 bg-slate-50/80 rounded-2xl hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <Package size={18} className="text-slate-500" />
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Planos e Módulos</span>
                        </div>
                        {expandedPlansForCompany[c.workspaceId] ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                      </button>

                      {expandedPlansForCompany[c.workspaceId] && (
                        <div className="mt-2 space-y-6 animate-in slide-in-from-top-2 duration-300">
                          {/* SEÇÃO 1: PLANOS DE ASSINATURA (DB) */}
                          {plans.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 px-2">
                                <Zap size={12} className="text-violet-500" />
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Planos Oficiais</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {plans.map(p => {
                                  const isThisPlanActive = c.activePlanId === p.id && isProActive;
                                  return (
                                    <button key={p.id} onClick={() => handleCustomPlanClick(c, p)} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${isThisPlanActive ? 'bg-violet-600 border-violet-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-violet-200'}`}>
                                      <Zap size={18} />
                                      <span className="text-[7px] font-black uppercase text-center leading-tight">{p.name}</span>
                                      {isThisPlanActive && <AdTimer expiresAt={c.proExpiresAt!} lightMode />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* SEÇÃO 2: MÓDULOS E CONTROLE MANUAL */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 px-2">
                              <SettingsIcon size={12} className="text-slate-400" />
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Módulos & Manual</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <button onClick={() => handlePlanClick(c, 'hasProPlan')} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${isProActive ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-amber-200'}`}>
                                <ShoppingCart size={18} />
                                <span className="text-[7px] font-black uppercase">Modo Pro</span>
                                {isProActive && !c.activePlanId && <span className="text-[6px] font-bold text-amber-900/50 mt-1 uppercase tracking-tighter">Manual</span>}
                                {isProActive && <AdTimer expiresAt={c.proExpiresAt!} lightMode />}
                              </button>
                              
                              <button onClick={() => handlePlanClick(c, 'isAdFree')} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${isAdFreeActive ? 'bg-blue-600 border-blue-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-200'}`}>
                                <EyeOff size={18} />
                                <span className="text-[7px] font-black uppercase">Sem Ads</span>
                                {isAdFreeActive && <AdTimer expiresAt={c.adFreeExpiresAt!} lightMode />}
                              </button>
                              
                              <button onClick={() => handlePlanClick(c, 'isAdvertiser')} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${isAdvertiserActive ? 'bg-emerald-600 border-emerald-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-emerald-200'}`}>
                                <Megaphone size={18} />
                                <span className="text-[7px] font-black uppercase">Anunciante</span>
                                {isAdvertiserActive && <AdTimer expiresAt={c.advertiserExpiresAt!} lightMode />}
                              </button>
                              
                              <button onClick={() => {
                                setCommissionTarget(c);
                                setTempCommissionActive(c.commissionActive || false);
                                setTempCommissionRate(c.commissionRate || 0);
                              }} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${c.commissionActive ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-200'}`}>
                                <Store size={18} />
                                <span className="text-[7px] font-black uppercase">Marketplace</span>
                                {c.commissionActive && <span className="text-[10px] font-black">{c.commissionRate}%</span>}
                                {c.mpConnected && <span className="text-[6px] font-bold text-indigo-100 uppercase bg-indigo-500/30 px-2 py-0.5 rounded-full mt-1">Conectado</span>}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <button 
                  onClick={() => fetchCompanies(true, searchTerm)}
                  disabled={isFetchingMore}
                  className="w-full py-6 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                  {isFetchingMore ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Carregar Mais Empresas
                    </>
                  )}
                </button>
              )}
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
                {allAds.filter(ad => {
                  const isPaid = ad.paymentStatus === 'PAID';
                  const isExpired = ad.expiresAt && new Date(ad.expiresAt).getTime() < timeTick;
                  // Mostra: Pagos pendentes, Ativos atuais, ou Aprovados não expirados
                  return (isPaid && !ad.isApproved) || (ad.active && !isExpired) || (ad.isApproved && !isExpired);
                }).sort((a,b) => {
                  if (a.paymentStatus === 'PAID' && !a.isApproved) return -1;
                  if (b.paymentStatus === 'PAID' && !b.isApproved) return 1;
                  return 0;
                }).map(ad => {
                  const isActive = ad.active && ad.expiresAt && new Date(ad.expiresAt).getTime() > timeTick;
                  const isPendingApproval = ad.paymentStatus === 'PAID' && !ad.isApproved;
                  
                  return (
                    <div key={ad.id} className={`bg-white p-6 rounded-[2.5rem] border-2 flex items-center justify-between ${isPendingApproval ? 'border-amber-500 bg-amber-50/20' : 'border-slate-50'}`}>
                       <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center">{ad.mediaUrl ? <img src={ad.mediaUrl} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-300" />}</div>
                          <div className="space-y-1">
                             <div className="flex items-center gap-2">
                                <h4 className="font-black text-slate-800 text-sm uppercase">{ad.title}</h4>
                                {isPendingApproval && <span className="bg-amber-500 text-slate-950 text-[7px] font-black px-2 py-0.5 rounded-full animate-pulse">PAGO / AGUARDANDO APROVAÇÃO</span>}
                                {!isActive && ad.isApproved && <span className="bg-rose-100 text-rose-600 text-[7px] font-black px-2 py-0.5 rounded-full">EXPIRADO</span>}
                             </div>
                             <p className="text-[9px] font-bold text-slate-400 uppercase">Empresa: {ad.ownerName}</p>
                             <p className="text-[8px] font-black text-blue-500 uppercase">Solicitado: {ad.requestedDuration || 7} dias</p>
                             {isActive && <AdTimer expiresAt={ad.expiresAt!} label="Vencimento:" />}
                          </div>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => { setApprovalDays(ad.requestedDuration || 7); setAdToApprove(ad); }} className={`p-4 rounded-2xl shadow-lg transition-all ${isActive ? 'bg-emerald-600 text-white' : isPendingApproval ? 'bg-amber-500 text-slate-950 animate-bounce' : 'bg-orange-500 text-white'}`}>{isActive ? <CheckCircle2 size={20} /> : <Zap size={20} />}</button>
                          <button onClick={() => supabase.from('app_banners').delete().eq('id', ad.id).then(() => fetchData())} className="p-4 bg-rose-600 text-white rounded-2xl"><Trash2 size={20} /></button>
                       </div>
                    </div>
                  );
                })}
                {allAds.filter(ad => ad.paymentStatus === 'PAID' || ad.active || ad.isApproved).length === 0 && (
                   <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-300 uppercase">Nenhum anúncio pago ou ativo para gerenciar</p>
                   </div>
                )}
             </div>
          )}

          {activeTab === 'DENUNCIAS' && (
             <div className="grid gap-4">
                {reports.length === 0 ? (
                  <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-100"><p className="text-[10px] font-black text-slate-300 uppercase">Nenhuma denúncia encontrada</p></div>
                ) : (
                  reports.map(report => {
                    const reporter = companies.find(c => c.ownerId === report.reporter_id) || { name: 'Usuário Desconhecido' };
                    const reported = companies.find(c => c.workspaceId === report.reported_workspace_id) || { name: 'Empresa Desconhecida' };
                    
                    return (
                      <div key={report.id} className={`bg-white p-6 rounded-[2.5rem] border-2 shadow-sm ${report.status === 'PENDING' ? 'border-amber-500/50 bg-amber-50/30' : 'border-slate-50'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl ${report.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : report.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                              <AlertTriangle size={20} />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-800 text-sm uppercase">Denúncia contra: {reported.name}</h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Feita por: {reporter.name}</p>
                            </div>
                          </div>
                          <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${report.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : report.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                            {report.status === 'PENDING' ? 'Pendente' : report.status === 'RESOLVED' ? 'Resolvido' : 'Ignorado'}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl mb-4">
                          <p className="text-xs text-slate-600 font-medium">{report.reason}</p>
                        </div>
                        {report.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button onClick={() => handleUpdateReportStatus(report.id, 'RESOLVED')} className="flex-1 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black uppercase text-[10px] hover:bg-emerald-100 transition-colors">
                              Marcar Resolvido
                            </button>
                            <button onClick={() => handleUpdateReportStatus(report.id, 'DISMISSED')} className="flex-1 py-3 bg-slate-50 text-slate-500 rounded-xl font-black uppercase text-[10px] hover:bg-slate-100 transition-colors">
                              Ignorar
                            </button>
                            {reported.workspaceId && (
                              <button onClick={() => {
                                const comp = companies.find(c => c.workspaceId === report.reported_workspace_id);
                                if (comp) setSelectedCompany(comp);
                              }} className="flex-1 py-3 bg-amber-500 text-slate-950 rounded-xl font-black uppercase text-[10px] shadow-lg hover:scale-105 transition-all">
                                Analisar Empresa
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
             </div>
          )}

          {activeTab === 'FINANCEIRO' && (
            <div className="space-y-6">
              {/* Configurações Globais de Preço */}
              <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase">Preços Globais</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuração base do sistema</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Valor Diário do Anúncio (R$)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="number" 
                        step="0.01"
                        value={systemSettings.ad_daily_price} 
                        onChange={e => setSystemSettings(prev => ({ ...prev, ad_daily_price: e.target.value }))} 
                        className="w-full p-5 pl-12 bg-slate-50 border-2 border-transparent rounded-[1.8rem] font-bold text-slate-700 outline-none focus:border-emerald-500/30 transition-all" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4">WhatsApp de Suporte</label>
                    <div className="relative">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        value={systemSettings.support_phone} 
                        onChange={e => setSystemSettings(prev => ({ ...prev, support_phone: e.target.value }))} 
                        className="w-full p-5 pl-12 bg-slate-50 border-2 border-transparent rounded-[1.8rem] font-bold text-slate-700 outline-none focus:border-emerald-500/30 transition-all" 
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-6 bg-amber-50 rounded-[2rem] border border-amber-100 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={16} className="text-amber-500" />
                    <h4 className="text-[10px] font-black text-amber-600 uppercase">Promoção Relâmpago (Anúncios)</h4>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Preço Promo (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={systemSettings.promo_ad_price || ''} 
                        onChange={e => setSystemSettings(prev => ({ ...prev, promo_ad_price: e.target.value }))} 
                        placeholder="Deixe vazio para desativar"
                        className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Termina em</label>
                      <input 
                        type="datetime-local" 
                        value={systemSettings.promo_ad_ends_at?.slice(0, 16) || ''} 
                        onChange={e => setSystemSettings(prev => ({ ...prev, promo_ad_ends_at: e.target.value }))} 
                        className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={saveSystemSettings} 
                  disabled={isSaving} 
                  className={`mt-6 w-full py-5 rounded-[1.8rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 transition-all ${saveSuccess ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white hover:bg-slate-900'}`}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : saveSuccess ? <Check /> : <Save />} 
                  {saveSuccess ? 'Configurações Salvas!' : 'Atualizar Preços Globais'}
                </button>
              </div>

              {/* Gestão de Planos */}
              <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
                      <Zap size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800 uppercase">Planos de Assinatura</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestão de pacotes e benefícios</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setEditingPlan({ id: '', name: '', price: 0, description: '', benefits: [], icon: 'Zap', active: true, sort_order: plans.length })}
                    className="p-4 bg-amber-500 text-slate-950 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <div className="grid gap-4">
                  {plans.map(plan => (
                    <div key={plan.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group hover:border-amber-500/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm">
                          <Zap size={20} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800 text-sm uppercase">{plan.name}</h4>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase">R$ {(plan.price || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingPlan(plan)} className="p-3 bg-white text-slate-400 hover:text-blue-600 rounded-xl shadow-sm transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeletePlan(plan.id)} className="p-3 bg-white text-slate-400 hover:text-rose-600 rounded-xl shadow-sm transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                  {plans.length === 0 && (
                    <div className="py-10 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Nenhum plano cadastrado</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'INTELIGENCIA' && (
             <GlobalIntelligence />
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

      {/* MODAL PARA ATIVAR PLANO CUSTOMIZADO */}
      {customPlanToApprove && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl overflow-hidden">
              <header className="flex justify-between items-center mb-8"><div><h3 className="text-xl font-black text-slate-800 uppercase">Vincular {customPlanToApprove.plan.name}</h3><p className="text-[9px] font-black text-violet-600 uppercase mt-1">Duração: {customPlanToApprove.plan.duration_days} dias</p></div><button onClick={() => setCustomPlanToApprove(null)}><X size={24} className="text-slate-400" /></button></header>
              <button onClick={handleApproveCustomPlan} disabled={isSaving} className="w-full py-5 bg-violet-600 text-white rounded-[1.8rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">{isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Ativar Plano</button>
           </div>
        </div>
      )}

      {/* MODAL DE GERENCIAMENTO PLANO CUSTOMIZADO */}
      {customPlanToManage && !showEndConfirm && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl overflow-hidden text-center">
              <div className="flex justify-center mb-6">
                 <div className="p-4 bg-slate-100 rounded-3xl text-slate-500"><SettingsIcon size={32} /></div>
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase mb-2">Gerenciar Plano</h3>
              <p className="text-xs font-bold text-slate-400 uppercase mb-8">{customPlanToManage.company.name} - {customPlanToManage.plan.name}</p>
              
              <div className="space-y-3">
                 <button 
                   onClick={() => {
                     setCustomPlanToApprove(customPlanToManage);
                     setCustomPlanToManage(null);
                   }} 
                   className="w-full py-5 bg-violet-600 text-white rounded-[1.8rem] font-black uppercase text-xs shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-violet-500"
                 >
                   <History size={16} /> Renovar ({customPlanToManage.plan.duration_days} dias)
                 </button>

                 <button 
                   onClick={executeEndCustomPlan} 
                   className="w-full py-5 bg-rose-50 text-rose-600 border border-rose-100 rounded-[1.8rem] font-black uppercase text-xs shadow-none flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-rose-100 hover:border-rose-200"
                 >
                   <Ban size={16} /> Encerrar Assinatura
                 </button>

                 <button 
                   onClick={() => setCustomPlanToManage(null)} 
                   className="w-full py-5 text-slate-400 font-black uppercase text-xs mt-2"
                 >
                   Pular
                 </button>
              </div>
           </div>
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

      {/* MODAL DE EDIÇÃO DE PLANO */}
      {editingPlan && (
        <div className="fixed inset-0 z-[1300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-3xl overflow-y-auto max-h-[90vh]">
            <header className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase">{editingPlan.id ? 'Editar Plano' : 'Novo Plano'}</h3>
                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Configuração do pacote</p>
              </div>
              <button onClick={() => setEditingPlan(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20} /></button>
            </header>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nome do Plano</label>
                <input 
                  value={editingPlan.name} 
                  onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  placeholder="Ex: Plano Premium"
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-amber-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Preço Mensal (R$)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={editingPlan.price} 
                  onChange={e => setEditingPlan({ ...editingPlan, price: e.target.value })}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-amber-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Duração do Plano (Dias)</label>
                <input 
                  type="number"
                  value={editingPlan.duration_days || 30} 
                  onChange={e => setEditingPlan({ ...editingPlan, duration_days: parseInt(e.target.value) || 1 })}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-amber-500/30"
                />
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-3">
                <p className="text-[9px] font-black text-amber-600 uppercase">Promoção do Plano</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Preço Promo</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={editingPlan.promo_price || ''} 
                      onChange={e => setEditingPlan({ ...editingPlan, promo_price: e.target.value })} 
                      placeholder="Vazio p/ desativar"
                      className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Expira em</label>
                    <input 
                      type="datetime-local" 
                      value={editingPlan.promo_ends_at?.slice(0, 16) || ''} 
                      onChange={e => setEditingPlan({ ...editingPlan, promo_ends_at: e.target.value })} 
                      className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                <p className="text-[9px] font-black text-slate-400 uppercase">Benefícios Técnicos (Automação)</p>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer">
                    <input type="checkbox" checked={editingPlan.grants_pro} onChange={e => setEditingPlan({...editingPlan, grants_pro: e.target.checked})} className="w-4 h-4 accent-amber-500" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase">Liberar PRO</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer">
                    <input type="checkbox" checked={editingPlan.grants_ad_free} onChange={e => setEditingPlan({...editingPlan, grants_ad_free: e.target.checked})} className="w-4 h-4 accent-amber-500" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase">Sem Ads</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer">
                    <input type="checkbox" checked={editingPlan.grants_advertiser} onChange={e => setEditingPlan({...editingPlan, grants_advertiser: e.target.checked})} className="w-4 h-4 accent-amber-500" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase">Anunciante</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer">
                    <input type="checkbox" checked={editingPlan.grants_bi} onChange={e => setEditingPlan({...editingPlan, grants_bi: e.target.checked})} className="w-4 h-4 accent-violet-500" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase">Telemetria BI</span>
                  </label>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Ads Grátis/Mês</label>
                    <input type="number" value={editingPlan.free_ads_per_month} onChange={e => setEditingPlan({...editingPlan, free_ads_per_month: parseInt(e.target.value) || 0})} className="w-full p-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Descrição Curta</label>
                <input 
                  value={editingPlan.description} 
                  onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  placeholder="Ex: Ideal para grandes fábricas"
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-amber-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Benefícios (Separados por vírgula)</label>
                <textarea 
                  value={editingPlan.benefits.join(', ')} 
                  onChange={e => setEditingPlan({ ...editingPlan, benefits: e.target.value.split(',').map(b => b.trim()).filter(b => b) })}
                  placeholder="Ex: Suporte 24h, Vitrine, Relatórios"
                  rows={3}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-amber-500/30 text-xs"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setEditingPlan(null)}
                  className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleSavePlan(editingPlan)}
                  disabled={isSaving}
                  className="flex-1 py-4 bg-amber-500 text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />} Salvar Plano
                </button>
              </div>
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

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE EMPRESA */}
      {companyToDelete && (
        <div className="fixed inset-0 z-[1300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl text-center border-4 border-rose-100">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse">
                 <Trash2 className="w-10 h-10 text-rose-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">Excluir Empresa?</h3>
              <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
                 Isso apagará TODOS os dados de <strong className="text-slate-800">{companyToDelete.name}</strong> permanentemente.
              </p>
              
              <div className="mb-6 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-2 block">Digite DELETAR para confirmar</label>
                <input 
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="DELETAR"
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:border-rose-400 text-center font-black tracking-widest uppercase text-rose-600"
                />
              </div>

              <div className="flex gap-3">
                 <button 
                   onClick={() => setCompanyToDelete(null)} 
                   className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-colors"
                 >
                   Cancelar
                 </button>
                 <button 
                   onClick={executeDeleteCompany}
                   disabled={isSaving || deleteConfirmText.trim().toUpperCase() !== 'DELETAR'}
                   className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-900/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                 >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Excluir
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL DE DETALHES DA EMPRESA (CRM) */}
      {selectedCompany && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in zoom-in-95 overflow-y-auto">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] p-6 sm:p-8 shadow-3xl my-auto">
              <header className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-2xl shadow-inner ${selectedCompany.isBlocked ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-400'}`}>
                    {(selectedCompany.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 uppercase flex items-center gap-2">
                      {selectedCompany.name}
                      {selectedCompany.isBlocked && <span className="bg-red-500 text-white text-[10px] px-2 py-1 rounded-full">BLOQUEADO</span>}
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-1">ID: {selectedCompany.workspaceId}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCompany(null)} className="p-3 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors">
                  <X size={24} className="text-slate-400" />
                </button>
              </header>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 p-5 rounded-[2rem]">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Contato</p>
                  <p className="text-sm font-bold text-slate-700">{selectedCompany.ownerName}</p>
                  <p className="text-xs text-slate-500">{selectedCompany.ownerEmail || 'Sem email'}</p>
                  <p className="text-xs text-slate-500">{selectedCompany.ownerPhone || 'Sem telefone'}</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-[2rem]">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Métricas</p>
                  <p className="text-sm font-bold text-slate-700">Gasto Total: <span className="text-emerald-600">R$ {selectedCompany.totalSpent.toFixed(2)}</span></p>
                  <p className="text-xs text-slate-500">Planos Ativados: {selectedCompany.planActivations}</p>
                  <p className="text-xs text-slate-500">Anúncios Criados: {selectedCompany.adCount}</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-[2rem]">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Atividade</p>
                  <p className="text-sm font-bold text-slate-700">Entrou em: {new Date(selectedCompany.createdAt).toLocaleDateString('pt-BR')}</p>
                  <p className="text-xs text-slate-500">Último acesso: {selectedCompany.lastSeen ? new Date(selectedCompany.lastSeen).toLocaleDateString('pt-BR') : 'Desconhecido'}</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-[2rem]">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status Atual</p>
                  <div className="flex gap-2 mt-2">
                    {(() => {
                      const now = timeTick;
                      const isProActive = selectedCompany.hasProPlan && selectedCompany.proExpiresAt && new Date(selectedCompany.proExpiresAt).getTime() > now;
                      const isAdFreeActive = selectedCompany.isAdFree && selectedCompany.adFreeExpiresAt && new Date(selectedCompany.adFreeExpiresAt).getTime() > now;
                      const isAdvertiserActive = selectedCompany.isAdvertiser && selectedCompany.advertiserExpiresAt && new Date(selectedCompany.advertiserExpiresAt).getTime() > now;
                      
                      return (
                        <>
                          {isProActive && <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-1 rounded-lg">PRO</span>}
                          {isAdFreeActive && <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-1 rounded-lg">NO ADS</span>}
                          {isAdvertiserActive && <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-1 rounded-lg">ANUNCIANTE</span>}
                          {!isProActive && !isAdFreeActive && !isAdvertiserActive && <span className="text-xs text-slate-400">Plano Grátis</span>}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-5 rounded-[2rem] col-span-2 border border-emerald-100/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-2">
                      <DollarSign size={14} /> Plano Ativo e Preços Customizados
                    </h4>
                    <button 
                      onClick={handleSaveCustomPrices}
                      disabled={isSaving}
                      className="text-[9px] font-black text-white bg-emerald-600 px-3 py-1.5 rounded-lg uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                  
                  <div className="mb-6 grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Vincular Plano (Herança de Benefícios)</label>
                      <select 
                        value={selectedCompany.activePlanId || ''} 
                        onChange={e => setSelectedCompany({ ...selectedCompany, activePlanId: e.target.value || undefined })}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
                      >
                        <option value="">Nenhum Plano Vinculado (Grátis)</option>
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>{p.name} - R$ {Number(p.price).toFixed(2)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Expiração PRO</label>
                      <input 
                        type="datetime-local" 
                        value={selectedCompany.proExpiresAt?.slice(0, 16) || ''} 
                        onChange={e => setSelectedCompany({ ...selectedCompany, proExpiresAt: e.target.value })}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Expiração Sem Ads</label>
                      <input 
                        type="datetime-local" 
                        value={selectedCompany.adFreeExpiresAt?.slice(0, 16) || ''} 
                        onChange={e => setSelectedCompany({ ...selectedCompany, adFreeExpiresAt: e.target.value })}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Preço Anúncio (Dia)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={selectedCompany.customAdPrice ?? ''} 
                        onChange={e => setSelectedCompany({ ...selectedCompany, customAdPrice: e.target.value === '' ? undefined : e.target.value as any })}
                        placeholder={`Padrão: R$ ${Number(systemSettings.ad_daily_price).toFixed(2)}`}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Preço Plano PRO</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={selectedCompany.customProPrice ?? ''} 
                        onChange={e => setSelectedCompany({ ...selectedCompany, customProPrice: e.target.value === '' ? undefined : e.target.value as any })}
                        placeholder="Padrão: R$ 34.90"
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <p className="text-[7px] font-bold text-slate-400 uppercase mt-3 leading-tight">
                    * Deixe em branco para usar o preço global. Estes valores serão aplicados apenas para esta empresa.
                  </p>
                </div>

                <div className="bg-amber-50 p-5 rounded-[2rem] border border-amber-100">
                  <h4 className="text-[10px] font-black text-amber-600 uppercase mb-3 flex items-center gap-2"><MessageSquare size={14} /> Enviar Aviso Direto</h4>
                  <div className="flex gap-2">
                    <input 
                      value={warningMessage}
                      onChange={(e) => setWarningMessage(e.target.value)}
                      placeholder="Digite a mensagem que aparecerá na tela do usuário..."
                      className="flex-1 p-4 bg-white rounded-xl text-xs font-medium outline-none border border-amber-200 focus:border-amber-400"
                    />
                    <button 
                      onClick={handleSendWarning}
                      disabled={isSaving || !warningMessage.trim()}
                      className="px-6 bg-amber-500 text-white rounded-xl font-black uppercase text-[10px] shadow-lg disabled:opacity-50"
                    >
                      Enviar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleBlockCompany}
                    disabled={isSaving}
                    className={`py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${selectedCompany.isBlocked ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'}`}
                  >
                    <Ban size={16} /> {selectedCompany.isBlocked ? 'Desbloquear Conta' : 'Bloquear Conta'}
                  </button>
                  <button 
                    onClick={handleDeleteCompany}
                    disabled={isSaving}
                    className="py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20 hover:bg-rose-700 transition-all"
                  >
                    <Trash2 size={16} /> Excluir Conta (Reset)
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Modal de Comissão / Marketplace */}
      {commissionTarget && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Store size={40} />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Marketplace: {commissionTarget.name}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Configurar taxa de intermediação das vendas</p>
            </div>

            <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase">Status da Comissão</span>
                <button 
                  onClick={() => setTempCommissionActive(!tempCommissionActive)}
                  className={`w-14 h-8 rounded-full transition-all flex items-center p-1 ${tempCommissionActive ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'}`}
                >
                  <div className="w-6 h-6 bg-white rounded-full shadow-lg" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase px-2">
                  <span>Percentual de Taxa</span>
                  <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{tempCommissionRate}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={tempCommissionRate}
                  onChange={(e) => setTempCommissionRate(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <p className="text-[8px] font-bold text-slate-400 text-center uppercase tracking-tighter">O valor será deduzido automaticamente via Mercado Pago</p>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100">
                 <div className={`w-3 h-3 rounded-full ${commissionTarget.mpConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                 <span className="text-[9px] font-black text-slate-600 uppercase">
                    {commissionTarget.mpConnected ? 'Vendedor Conectado' : 'Vendedor Não Conectado'}
                 </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={() => setCommissionTarget(null)} 
                className="py-5 rounded-[2rem] font-black uppercase text-xs text-slate-400 hover:text-slate-600 transition-colors"
                disabled={isSaving}
              >
                Voltar
              </button>
              <button 
                onClick={handleUpdateCommission}
                disabled={isSaving}
                className="py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                Salvar Taxa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};