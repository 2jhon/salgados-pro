
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useInterval } from './hooks/useInterval';
import { User, StoreProfile, UserType } from './types';
import { Factory } from './components/Factory';
import { Stall } from './components/Stall';
import { Settings } from './components/Settings';
import { Stock } from './components/Stock';
import { Home } from './components/Home';
import { ManagerActivity } from './components/ManagerActivity';
import { Marketplace } from './components/Marketplace';
import { StoreProfileSettings } from './components/StoreProfileSettings';
import { SuperAdmin } from './components/SuperAdmin';
import { NotesInbox } from './components/NotesModals';
import { RealtimeBroker } from './components/RealtimeBroker';
import { useAppConfig } from './hooks/useAppConfig';
import { useTransactions } from './hooks/useTransactions';
import { useUsers } from './hooks/useUsers';
import { useAds } from './hooks/useAds';
import { useNotes } from './hooks/useNotes';
import { useStoreProfiles } from './hooks/useStoreProfiles';
import { useAnalytics } from './hooks/useAnalytics';
import { useCustomers } from './hooks/useCustomers'; 
import { supabase, checkDatabaseHealth, safeStringifyError } from './lib/supabase';
import { ADMIN_EMAILS } from './constants';
import { 
  LogOut, ShieldCheck, Loader2, Settings as SettingsIcon,
  ArrowLeft, Package, ShoppingBag, AlertTriangle,
  Home as HomeIcon, Store, WifiOff, ArrowRight,
  KeyRound, CheckCircle2, UserIcon, Save, Camera, Bell, Activity, ShoppingCart,
  Phone, Fingerprint, Printer, RefreshCw
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { bluetoothPrinter } from './services/bluetoothPrinter';
import { hasBiometryConfigured, registerBiometryLocal, removeBiometryLocal, verifyBiometryLocal } from './lib/webauthnUtils';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);

  const handleTabChangeWithGuard = (tab: any) => {
    if (activeTab === 'CONFIG' && isSettingsDirty && tab !== 'CONFIG') {
      if (window.confirm("Kernel: Você tem alterações de vitrine não salvas na vitrine. Sair mesmo assim?")) {
        setIsSettingsDirty(false);
        setActiveTab(tab);
      }
    } else {
      setActiveTab(tab);
    }
  };
  
  const { 
    sections, archives, saveConfig, updateSingleSection, deleteSection, updateStockAtomic, 
    fetchConfigByWorkspace, publicStalls, fetchPublicStalls, hasMorePublic: hasMoreStalls, 
    fetchStallById, isSyncing: isStockSyncing, reconnect: reconnectStock, loading: loadingStalls 
  } = useAppConfig();

  const { users, createUser, fetchUsersByWorkspace, findUserById, updateUser, removeUser, findUserByEmail, findUserByPhone, authenticateUser } = useUsers();
  
  const { notes, unreadCount, markAsRead, markAllAsRead, deleteNote, clearReadNotes, addNote } = useNotes(currentUser?.workspaceId);
  
  const { 
    transactions, 
    setTransactions,
    loading,
    hasMore: hasMoreTransactions,
    isOffline: isTxOffline,
    isSyncing: isTxSyncing,
    reconnect: reconnectTx,
    addTransactions, 
    updateTransaction, 
    deleteTransaction, 
    clearTransactions, 
    settleCustomerDebt, 
    partialSettleTransaction, 
    calculateTotals, 
    fetchTransactionsByWorkspace,
    fetchNextTransactions,
    fetchUserGlobalDebts,
    archiveYear
  } = useTransactions(currentUser?.workspaceId, sections, saveConfig, addNote);

  const { ads, fetchAds, incrementClick, saveAd, deleteAd } = useAds();
  const { 
    profiles: marketplaceStores, fetchPublicProfiles, getMyProfile, saveProfile, 
    hasMore: hasMoreStores, loading: loadingProfiles 
  } = useStoreProfiles();
  const { customers, addCustomer } = useCustomers(currentUser?.workspaceId);
  const { trackView, getStoreSummary, getFinancialInsights } = useAnalytics(currentUser?.workspaceId);

  const [activeTab, setActiveTab] = useState<string>('HOME');
  const [financialInsights, setFinancialInsights] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Conexão estabelecida! O sistema está operando online.");
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.warning("Modo Offline Ativado. Você pode visualizar dados, mas algumas ações exigem internet.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Pre-fetch BI data
  useEffect(() => {
    if (currentUser?.workspaceId && activeTab === 'HOME') {
       getFinancialInsights(currentUser.workspaceId).then(setFinancialInsights);
    }
  }, [currentUser?.workspaceId, activeTab, getFinancialInsights]);
  const [companyProfile, setCompanyProfile] = useState<StoreProfile | null>(() => {
    try {
      const saved = localStorage.getItem('cached_company_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showNotesInbox, setShowNotesInbox] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'IDENTIFY' | 'CREATE_COMPANY' | 'CREATE_CUSTOMER' | 'RECOVERY'>('IDENTIFY');
  const [targetType, setTargetType] = useState<UserType>('COMPANY');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [userName, setUserName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  
  const [editUserData, setEditUserData] = useState<{name: string, phone: string, cpf: string, accessCode: string, avatarUrl: string, bannerUrl: string}>({ name: '', phone: '', cpf: '', accessCode: '', avatarUrl: '', bannerUrl: '' });
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/^(\d{2})(\d)/g, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .substring(0, 15);
    }
    return value.substring(0, 15);
  };
  
  const [isGodModeUnlocked, setIsGodModeUnlocked] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mpAuthRaw = params.get('mp_auth');
    if (mpAuthRaw && currentUser?.workspaceId) {
       // Limpa a URL imediatamente para evitar duplo disparo
       params.delete('mp_auth');
       const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
       window.history.replaceState({}, document.title, newUrl);

       try {
         const payload = JSON.parse(decodeURIComponent(mpAuthRaw));
         // Merge companyProfile to avoid NOT NULL constraint errors
         saveProfile({ ...(companyProfile || {}), ...payload, workspaceId: currentUser.workspaceId }).then((result) => {
           if (result) setCompanyProfile(result);
           toast.success("Conta do Mercado Pago conectada com sucesso!");
           // Força o recarregamento total após 1 segundo para garantir que todas as telas resetem o render
           setTimeout(() => {
              window.location.reload();
           }, 1000);
         }).catch(err => {
           console.error('Erro no saveProfile (MP Auth):', err);
           toast.error("Erro interno ao salvar suas chaves do Mercado Pago. (" + String(err) + ")");
         });
       } catch(e) {
         console.error('Erro ao processar MP payload', e);
         toast.error("Erro ao validar dados da conta conectada do Mercado Pago. Tente novamente.");
       }
    }
  }, [currentUser?.workspaceId, saveProfile, companyProfile]);

  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase.from('subscription_plans').select('*');
      if (data) setPlans(data);
    };
    fetchPlans();
  }, []);

  const activePlan = useMemo(() => {
    if (!currentUser?.activePlanId) return null;
    return plans.find(p => p.id === currentUser.activePlanId);
  }, [currentUser?.activePlanId, plans]);

  const now = Date.now();

  const isProActive = useMemo(() => {
    if (!currentUser) return false;
    const manual = currentUser.hasProPlan && currentUser.proExpiresAt && new Date(currentUser.proExpiresAt).getTime() > now;
    const fromPlan = activePlan?.grants_pro && currentUser.proExpiresAt && new Date(currentUser.proExpiresAt).getTime() > now;
    return !!(manual || fromPlan);
  }, [currentUser, activePlan, now]);

  const isAdFreeActive = useMemo(() => {
    if (!currentUser) return false;
    const manual = currentUser.isAdFree && currentUser.adFreeExpiresAt && new Date(currentUser.adFreeExpiresAt).getTime() > now;
    const fromPlan = activePlan?.grants_ad_free && currentUser.adFreeExpiresAt && new Date(currentUser.adFreeExpiresAt).getTime() > now;
    return !!(manual || fromPlan);
  }, [currentUser, activePlan, now]);

  const isAdvertiserActive = useMemo(() => {
    if (!currentUser) return false;
    const manual = currentUser.isAdvertiser && currentUser.advertiserExpiresAt && new Date(currentUser.advertiserExpiresAt).getTime() > now;
    const fromPlan = activePlan?.grants_advertiser && currentUser.advertiserExpiresAt && new Date(currentUser.advertiserExpiresAt).getTime() > now;
    return !!(manual || fromPlan);
  }, [currentUser, activePlan, now]);

  // Prevenir fechamento acidental da aba
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentUser) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentUser]);

  const initSystem = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOffline(true);
      return;
    }
    setIsOffline(false);
    
    console.log('[App] Initializing system and database health check...');
    
    // Proactive Health Check (Non-blocking warning)
    checkDatabaseHealth(60000, 2).then(health => {
      if (!health.ok) {
        console.error("[App] Banco de dados inacessível ou hibernando muito profundamente.");
        toast.error("O servidor não respondeu a tempo. O banco de dados pode estar 'dormindo'.", { 
          duration: 20000,
          action: {
            label: "Limpar Sessão",
            onClick: () => {
              localStorage.clear();
              window.location.reload();
            }
          }
        });
      } else {
        console.log('[App] Database health verified.');
      }
    });

    reconnectTx();
    reconnectStock();
  }, [reconnectTx, reconnectStock]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const userChannel = supabase
      .channel(`self_sync_${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${currentUser.id}` },
        (payload) => {
          setCurrentUser(prev => {
            if (!prev) return prev;
            const updated: User = {
              ...prev,
              hasProPlan: payload.new.has_pro_plan !== undefined ? !!payload.new.has_pro_plan : prev.hasProPlan,
              proExpiresAt: payload.new.pro_expires_at !== undefined ? payload.new.pro_expires_at : prev.proExpiresAt,
              isAdFree: payload.new.is_ad_free !== undefined ? !!payload.new.is_ad_free : prev.isAdFree,
              adFreeExpiresAt: payload.new.ad_free_expires_at !== undefined ? payload.new.ad_free_expires_at : prev.adFreeExpiresAt,
              isAdvertiser: payload.new.is_advertiser !== undefined ? !!payload.new.is_advertiser : prev.isAdvertiser,
              advertiserExpiresAt: payload.new.advertiser_expires_at !== undefined ? payload.new.advertiser_expires_at : prev.advertiserExpiresAt,
              activePlanId: payload.new.active_plan_id !== undefined ? payload.new.active_plan_id : prev.activePlanId,
              freeAdsUsedThisMonth: payload.new.free_ads_used_this_month !== undefined ? payload.new.free_ads_used_this_month : prev.freeAdsUsedThisMonth,
              name: payload.new.name !== undefined ? payload.new.name : prev.name,
              phone: payload.new.phone !== undefined ? payload.new.phone : prev.phone,
              email: payload.new.email !== undefined ? payload.new.email : prev.email,
              hideSalesValues: payload.new.hide_sales_values !== undefined ? !!payload.new.hide_sales_values : prev.hideSalesValues,
              enableSounds: payload.new.enable_sounds !== undefined ? payload.new.enable_sounds : prev.enableSounds,
              avatarUrl: payload.new.avatar_url !== undefined ? payload.new.avatar_url : prev.avatarUrl,
              bannerUrl: payload.new.banner_url !== undefined ? payload.new.banner_url : prev.bannerUrl,
              lastSeen: payload.new.last_seen !== undefined ? payload.new.last_seen : prev.lastSeen
            };
            try {
              localStorage.setItem('logged_user', JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to save user to localStorage, possibly due to quota limits:', e);
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [currentUser?.id]);

  const updateLastSeen = useCallback(async () => {
    if (!currentUser?.id) return;
    if (currentUser?.lastSeen && new Date().getTime() - new Date(currentUser.lastSeen).getTime() < 60 * 1000) return;
    try {
      await updateUser(currentUser.id, { lastSeen: new Date().toISOString() });
    } catch (e) {
      console.warn('[HEARTBEAT] Falha ao atualizar presença:', e);
    }
  }, [currentUser?.id, currentUser?.lastSeen, updateUser]);

  useInterval(updateLastSeen, currentUser?.id ? 120000 : null);

  const loadWorkspaceData = useCallback(async (user: User) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      console.log(`[App] Loading sequential data for workspace: ${user.workspaceId}`);
      
      // 1. Prioridade Máxima (Interface): Sequencial para não sobrecarregar conexão fria
      await fetchConfigByWorkspace(user.workspaceId);
      await fetchUsersByWorkspace(user.workspaceId);
      
      const profile = await getMyProfile(user.workspaceId);
      if (profile) {
        setCompanyProfile(profile);
        try {
          localStorage.setItem('cached_company_profile', JSON.stringify(profile));
        } catch (e) {}
      }

      // 2. Prioridade Secundária (Dados Pesados): Carrega transações e anúncios EM SEGUIDA
      const adsPromise = fetchAds();
      const stallsPromise = fetchPublicStalls();
      const profilesPromise = fetchPublicProfiles();
      
      // Carrega transações (Ponto crítico de performance)
      await fetchTransactionsByWorkspace(user.workspaceId, false);
      
      // Aguarda os outros em background
      await Promise.allSettled([adsPromise, stallsPromise, profilesPromise]);
      
      // 3. Verificações de Fundo: Dívidas externas
      // IMPORTANTE: Passa o telefone do usuário explicitamente
      if (user.phone) {
         console.log('[App] Checando dívidas globais para:', user.phone);
         const globalDebts = await fetchUserGlobalDebts(user.phone, user.workspaceId);
         // Atualiza SOMENTE se não for null (null indica erro de rede). Se for array vazio, atualiza para limpar.
         if (globalDebts !== null) {
            setTransactions(prev => {
               const localOnly = prev.filter(t => !t.isExternal);
               const combined = [...localOnly, ...globalDebts];
               // Deduplicação por ID
               const unique = Array.from(new Map(combined.map(item => [String(item.id), item])).values());
               return unique.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });
         }
      } else {
         console.warn('[App] Usuário sem telefone cadastrado, ignorando busca de dívidas externas.');
      }
    } catch (e) {
      console.error('[loadWorkspaceData] Erro crítico ao carregar dados:', e);
      if ((window as any).Nexus) {
        (window as any).Nexus.report(`Falha ao carregar dados do workspace: ${e instanceof Error ? e.message : String(e)}`, 'FAIL', 'NETWORK');
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [fetchConfigByWorkspace, fetchUsersByWorkspace, fetchTransactionsByWorkspace, fetchAds, getMyProfile, fetchUserGlobalDebts, setTransactions, fetchPublicStalls, fetchPublicProfiles]);

  useEffect(() => {
    initSystem();

    const handleOnline = () => {
      setIsOffline(false);
      reconnectTx();
      reconnectStock();
      if (currentUser) {
        loadWorkspaceData(currentUser).catch(e => console.error("Erro ao recarregar dados pós-offline:", e));
      }
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('logged_user');
        setCurrentUser(null);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initSystem]); // Only re-run if initSystem itself changes (which is stabilized by useCallback)

  const handleManualDataRefresh = async () => {
    if (currentUser) {
      // Force fetch by resetting ref
      isFetchingRef.current = false;
      await loadWorkspaceData(currentUser);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('logged_user');
    if (saved && !currentUser) {
      try {
        const user = JSON.parse(saved);
        if (user?.id) {
            setCurrentUser(user);
            loadWorkspaceData(user);
        }
      } catch (e) { localStorage.removeItem('logged_user'); }
    }
  }, [currentUser, loadWorkspaceData]);

  // Sincronização Omnichannel (Fase 3)
  useEffect(() => {
    // Detectar retorno do Mercado Pago
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const externalRef = urlParams.get('external_reference');

    if (status === 'approved') {
      toast.success("Pagamento Aprovado! Seu pedido foi confirmado.", { duration: 10000 });
      // Limpa os parâmetros da URL sem recarregar
      window.history.replaceState({}, document.title, "/");
    } else if (status === 'pending') {
      toast.info("Pagamento Pendente. Aguardando processamento.");
      window.history.replaceState({}, document.title, "/");
    } else if (status === 'failure') {
      toast.error("O pagamento não foi concluído. Tente novamente.");
      window.history.replaceState({}, document.title, "/");
    }

    if (!companyProfile?.portfolio || !sections || !currentUser?.workspaceId) return;
    
    let hasChanges = false;
    const updatedPortfolio = companyProfile.portfolio.map(item => {
      if (item.useFactoryPrice && item.linkedFactoryItemId) {
        // Encontra o item original na fábrica
        const factorySections = sections.filter(s => s.type === 'FACTORY_STYLE');
        const factoryItem = factorySections.flatMap(s => s.items).find(i => i.id === item.linkedFactoryItemId);
        
        // Se o preço da fábrica mudou, atualiza na vitrine
        if (factoryItem && factoryItem.price !== item.price) {
          hasChanges = true;
          return { ...item, price: factoryItem.price };
        }
      }
      return item;
    });

    if (hasChanges) {
      console.log('[Omnichannel] Sincronizando preços da Vitrine com a Fábrica...');
      saveProfile({ workspaceId: currentUser.workspaceId, portfolio: updatedPortfolio }).then(updated => {
        if (updated) setCompanyProfile(updated);
      });
    }
  }, [sections, companyProfile, currentUser?.workspaceId, saveProfile]);

  const handleLogout = async () => {
    setShowExitConfirm(true);
  };

  const confirmLogout = async () => {
    setIsProcessing(true);
    try {
      // Limpa local primeiro para feedback instantâneo
      localStorage.removeItem('logged_user');
      localStorage.removeItem('active_workspace_id'); // Clear workspace context
      setCurrentUser(null);
      setAuthMode('IDENTIFY');
      setCompanyProfile(null);
      setActiveTab('HOME');
      setIsGodModeUnlocked(false);
      setShowExitConfirm(false);
      
      // Tenta deslogar do Supabase em background
      supabase.auth.signOut().catch(e => console.warn("Sign out error:", e));
    } finally {
      setIsProcessing(false);
      // Optional: reload to ensure clean slate
      // window.location.reload(); 
    }
  };

  const [isBiometryActive, setIsBiometryActive] = useState(hasBiometryConfigured());

  const handleOpenProfileEditor = () => {
    if (currentUser) {
      setShowProfileSettings(true);
    }
  };

  const handleSaveProfile = useCallback(async (profile: any) => {
    const result = await saveProfile(profile);
    if (result) {
      setCompanyProfile(result);
    }
    return result;
  }, [saveProfile]);

  const handleMarketplaceRefresh = useCallback(() => {
    fetchPublicStalls(true);
    fetchPublicProfiles(true);
  }, [fetchPublicStalls, fetchPublicProfiles]);

  const allowedSections = useMemo(() => {
    if (!currentUser || !sections.length) return [];
    if (targetType === 'CUSTOMER') return [];
    if (currentUser.role === 'OWNER') return sections.filter(s => s.type !== 'STOCK_STYLE');
    const assignedIds = currentUser.assignedSectionIds || [];
    return sections.filter(s => assignedIds.includes(s.id));
  }, [sections, currentUser, targetType]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange-400/10 via-slate-950 to-black" />
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-orange-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-900/40"><ShieldCheck className="w-10 h-10 text-white" /></div>
            <h1 className="text-4xl font-black mb-2 tracking-tighter">Salgados Pro</h1>
          </div>
          {authMode === 'IDENTIFY' ? (
            <div className="grid gap-4">
              <button onClick={() => { setTargetType('COMPANY'); setAuthMode('LOGIN'); }} className="group p-8 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center gap-6 hover:bg-orange-600 transition-all text-left"><div className="p-4 bg-orange-600 text-white rounded-2xl"><Store className="w-6 h-6" /></div><div><h3 className="text-lg font-black uppercase">Sou Empresa</h3></div></button>
              <button onClick={() => { setTargetType('CUSTOMER'); setAuthMode('LOGIN'); }} className="group p-8 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center gap-6 hover:bg-blue-600 transition-all text-left"><div className="p-4 bg-blue-600 text-white rounded-2xl"><ShoppingBag className="w-6 h-6" /></div><div><h3 className="text-lg font-black uppercase">Sou Cliente</h3></div></button>
              
              <div className="mt-6 flex flex-col gap-3">
                <button onClick={() => { setTargetType('COMPANY'); setAuthMode('CREATE_COMPANY'); }} className="text-[10px] font-black text-slate-500 hover:text-orange-500 uppercase tracking-widest text-center w-full transition-colors">Cadastrar Minha Empresa</button>
                <button onClick={() => { setTargetType('CUSTOMER'); setAuthMode('CREATE_CUSTOMER'); }} className="text-[10px] font-black text-slate-500 hover:text-blue-500 uppercase tracking-widest text-center w-full transition-colors">Criar Minha Conta de Cliente</button>
              </div>
            </div>
          ) : authMode === 'RECOVERY' ? (
            <div className="bg-white p-8 rounded-[3rem] space-y-6 text-slate-800 shadow-3xl">
              <button onClick={() => setAuthMode('LOGIN')} className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase"><ArrowLeft className="w-4 h-4" /> Voltar</button>
              {!recoverySuccess ? (
                <form onSubmit={async (e) => { e.preventDefault(); setIsProcessing(true); const user = targetType === 'COMPANY' ? await findUserByEmail(email) : await findUserByPhone(phone); if(user){ setRecoverySuccess(true); setRecoveryMessage("Pedido de PIN enviado. Fale com o suporte."); } else { setAuthError("Usuário não encontrado."); } setIsProcessing(false); }} className="space-y-4">
                  <KeyRound className="w-12 h-12 text-orange-500 mx-auto" />
                  <input required value={userName} onChange={e => setUserName(e.target.value)} placeholder="NOME CADASTRADO" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-xs uppercase" />
                  {targetType === 'COMPANY' ? <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-MAIL" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-xs" /> : <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="WHATSAPP" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-xs" />}
                  <button type="submit" disabled={isProcessing} className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs">Solicitar Recuperação</button>
                </form>
              ) : <div className="text-center py-10"><CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" /><p className="text-xs font-bold">{recoveryMessage}</p></div>}
            </div>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (pin.length !== 6) {
                setAuthError("O PIN deve ter exatamente 6 dígitos.");
                return;
              }
              setIsProcessing(true);
              let forceStop = false;
              const authWatchdog = setTimeout(() => {
                forceStop = true;
                setIsProcessing(false);
                setAuthError("A conexão com o servidor expirou. O banco de dados está em hibernação profunda. Clique no botão de entrar novamente para finalizar o despertar.");
              }, 150000); // 150s safety valve
              
              try {
                if(authMode === 'LOGIN') {
                   const identifier = email || phone;
                   const user = await authenticateUser(identifier, pin, targetType);
                   if (forceStop) return;
                   
                   if (user) {
                     if (user.isBlocked) {
                       setAuthError("Acesso negado: Sua conta foi bloqueada por violação dos termos.");
                       return;
                     }
                     localStorage.setItem('logged_user', JSON.stringify(user));
                     setCurrentUser(user);
                     loadWorkspaceData(user);
                   } else { setAuthError("Credenciais incorretas ou usuário não existe."); }
                } else {
                   const wsId = authMode === 'CREATE_COMPANY' ? `ws_${Date.now()}` : `ws_cust_${Date.now()}`;
                   const identifier = email || phone;
                   
                   // 1. Criar o usuário na tabela public.users
                   const newUser = await createUser({ 
                     workspaceId: wsId, 
                     name: userName, 
                     email: email || undefined, 
                     phone: phone, 
                     role: authMode === 'CREATE_COMPANY' ? 'OWNER' : 'CUSTOMER', 
                     accessCode: pin, 
                     assignedSectionIds: [], 
                     isAdFree: false, 
                     isAdvertiser: false, 
                     hideSalesValues: false, 
                     enableSounds: true, 
                     userType: targetType 
                   });

                   if (newUser) {
                     // 2. Autenticar imediatamente para criar a conta no Supabase Auth e obter sessão
                     // Isso é CRITICO para que o RLS permita o saveProfile subsequente
                     try {
                        await authenticateUser(identifier, pin, targetType);
                     } catch (authErr) {
                        console.warn("[Auth] Erro ao autenticar após criar, tentando prosseguir de qualquer forma:", authErr);
                     }

                     // 3. Criar perfil da loja se for OWNER
                     if (authMode === 'CREATE_COMPANY') {
                        try {
                           await saveProfile({ 
                             workspaceId: wsId, 
                             name: userName, 
                             description: '', 
                             address: '', 
                             whatsapp: phone, 
                             latitude: 0, 
                             longitude: 0, 
                             active: false, 
                             portfolio: [] 
                           });
                        } catch (profileErr) {
                           console.error("[Auth] Erro ao criar store_profile inicial:", profileErr);
                        }
                     }

                     localStorage.setItem('logged_user', JSON.stringify(newUser));
                     setCurrentUser(newUser); 
                     if (newUser.role === 'CUSTOMER') setActiveTab('MARKETPLACE');
                     loadWorkspaceData(newUser); 
                   }
                }
              } catch (err: any) { 
                if (forceStop) return;
                console.error("[Auth] Erro capturado:", err);
                const msg = safeStringifyError(err);
                setAuthError(msg); 
              } 
              finally { 
                clearTimeout(authWatchdog);
                setIsProcessing(false); 
              }
            }} className="bg-white p-8 rounded-[3rem] space-y-5 text-slate-800 shadow-3xl">
              <button type="button" onClick={() => setAuthMode('IDENTIFY')} className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase"><ArrowLeft className="w-4 h-4" /> Voltar</button>
              {authError && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl space-y-2">
                   <div className="text-[10px] font-black uppercase text-center">{authError}</div>
                   {authError.toLowerCase().includes('rede') || authError.toLowerCase().includes('fetch') || authError.toLowerCase().includes('conexão') ? (
                     <div className="text-[9px] font-bold text-center text-red-400 uppercase leading-tight bg-white/50 p-2 rounded-lg">
                        DICA: Se estiver no Wi-Fi, tente desligar e usar os Dados Móveis. Sua rede pode estar bloqueando o servidor.
                     </div>
                   ) : null}
                </div>
              )}
              {(authMode === 'CREATE_COMPANY' || authMode === 'CREATE_CUSTOMER') && (
                <>
                  <input required value={userName} onChange={e => setUserName(e.target.value)} placeholder="NOME COMPLETO" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none uppercase text-xs" />
                  <input required type="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="WHATSAPP (00) 00000-0000" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none text-xs" />
                  {authMode === 'CREATE_COMPANY' && <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-MAIL" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none text-xs" />}
                </>
              )}
              {targetType === 'COMPANY' && authMode === 'LOGIN' && (
                <input 
                  required 
                  type="text" 
                  value={email || phone} 
                  onChange={e => {
                    const val = "trimStart" in String.prototype ? e.target.value.trimStart() : e.target.value;
                    if (val.includes('@') || /[a-zA-Z]/.test(val)) {
                      setEmail(val);
                      setPhone('');
                    } else {
                      setPhone(formatPhone(val));
                      setEmail('');
                    }
                  }} 
                  placeholder="E-MAIL OU WHATSAPP" 
                  className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none text-xs" 
                />
              )}
              {targetType === 'CUSTOMER' && authMode === 'LOGIN' && <input required type="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="WHATSAPP" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none text-xs" />}
              <div className="space-y-1">
                <input required maxLength={6} type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="PIN 6 DÍGITOS" className="w-full p-4 bg-slate-50 rounded-xl font-black text-xl text-center outline-none tracking-widest" />
                <p className="text-[8px] text-center text-slate-400 font-bold uppercase tracking-tighter">Use apenas números para o seu PIN</p>
              </div>

              {authMode === 'LOGIN' && hasBiometryConfigured() && (
                 <button 
                   type="button" 
                   disabled={isProcessing}
                   onClick={async () => {
                      setIsProcessing(true);
                      setAuthError(null);
                      try {
                          const rawData = await verifyBiometryLocal();
                          if (rawData.userType && rawData.userType !== targetType) {
                             const translated = rawData.userType === 'COMPANY' ? 'Empresa / Gerente' : 'Cliente';
                             setAuthError(`Esta digital está vinculada a uma conta de ${translated}. Mude o modo de acesso para entrar.`);
                             return;
                          }
                         const user = await authenticateUser(rawData.identifier, rawData.pin, targetType);
                         if (user) {
                           if (user.isBlocked) { setAuthError("Acesso negado: Sua conta foi bloqueada."); return; }
                           localStorage.setItem('logged_user', JSON.stringify(user));
                           setCurrentUser(user);
                           loadWorkspaceData(user);
                         } else {
                           setAuthError("Credenciais biométricas incorretas.");
                         }
                      } catch (e: any) {
                         setAuthError(e.message || "Autenticação biométrica cancelada ou falhou.");
                      } finally {
                         setIsProcessing(false);
                      }
                   }}
                   className="w-full py-4 bg-slate-100 text-indigo-600 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-indigo-50 border-2 border-indigo-100 transition-all shadow-sm"
                 >
                    <Fingerprint size={18} /> Entrar com Digital
                 </button>
              )}

              <button type="submit" disabled={isProcessing} className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg">{isProcessing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (authMode.startsWith('CREATE_') ? 'Criar Conta' : 'Entrar')}</button>
              
              {authMode === 'LOGIN' && (
                <button 
                  type="button" 
                  onClick={() => setAuthMode(targetType === 'COMPANY' ? 'CREATE_COMPANY' : 'CREATE_CUSTOMER')}
                  className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Não tem conta? Cadastre-se aqui
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    );
  }

  const getTabStyles = (tabId: string) => {
    const isActive = activeTab === tabId;
    if (!isActive) return "text-slate-500 hover:text-slate-300";

    switch (tabId) {
      case 'HOME':
        return "bg-slate-800 text-white shadow-lg shadow-slate-950/50 scale-105";
      case 'MARKETPLACE':
        return "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 scale-105";
      case 'ESTOQUE':
        return "bg-amber-500 text-white shadow-lg shadow-amber-900/40 scale-105";
      case 'ACTIVITY':
        return "bg-cyan-600 text-white shadow-lg shadow-cyan-900/40 scale-105";
      case 'CONFIG':
        return "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 scale-105";
      default:
        const section = sections.find(s => s.id === tabId);
        if (section?.type === 'FACTORY_STYLE') {
          return "bg-indigo-600 text-white shadow-lg shadow-indigo-500/50 border border-indigo-400/50 ring-2 ring-indigo-500/20 scale-105";
        }
        return "bg-orange-500 text-white shadow-lg shadow-orange-900/40 scale-105";
    }
  };

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-slate-50 relative shadow-2xl overflow-hidden">
      {(isOffline || isTxSyncing || isStockSyncing) && (
        <div className={`fixed top-0 left-0 right-0 z-[999] text-white py-2 px-4 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top duration-500 ${isOffline ? 'bg-rose-600' : 'bg-amber-500'}`}>
          <div className="flex items-center gap-2">
            {isOffline ? (
              <><WifiOff size={14} /> Modo Offline Ativo - Sincronização Pendente</>
            ) : (
              <><RefreshCw size={14} className="animate-spin" /> Sincronizando dados...</>
            )}
          </div>
          {isOffline && (
            <button 
              onClick={async () => {
                setIsProcessing(true);
                const loadingToast = toast.loading("Verificando conexão com a internet...");
                try {
                  // Simula um pequeno delay para feedback visual
                  await new Promise(resolve => setTimeout(resolve, 800));
                  
                  if (navigator.onLine) {
                    toast.dismiss(loadingToast);
                    setIsOffline(false);
                    // Dispara reconexão nos hooks em background
                    reconnectTx();
                    reconnectStock();
                    
                    if (currentUser) {
                      // Carrega dados de forma não-bloqueante para a UI responder rápido
                      loadWorkspaceData(currentUser).catch(e => console.error("Erro ao recarregar dados pós-offline:", e));
                    }
                    toast.success("Conexão com a internet restabelecida!");
                  } else {
                    toast.dismiss(loadingToast);
                    toast.error("Ainda sem conexão com a internet.");
                    setIsOffline(true);
                  }
                } catch (e) {
                  toast.dismiss(loadingToast);
                  console.error("Erro na tentativa de reconexão:", e);
                  toast.error("Erro ao tentar reconectar.");
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg flex items-center gap-1 transition-all active:scale-95"
            >
              {isProcessing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              Tentar Reconectar
            </button>
          )}
        </div>
      )}
      <Toaster position="top-center" richColors />
      {activeTab !== 'GOD_MODE' && (
        <div className={`shrink-0 p-6 pb-6 rounded-b-[2.5rem] shadow-xl z-50 relative max-w-7xl mx-auto w-full transition-all duration-500 overflow-hidden ${currentUser.bannerUrl || companyProfile?.bannerUrl ? 'min-h-[220px] flex items-end' : 'bg-white border-b border-slate-100'}`}>
           
           {/* Fundo de Capa Imersivo */}
           {(currentUser.bannerUrl || companyProfile?.bannerUrl) && (
             <div className="absolute inset-0 z-0">
                <img 
                  src={currentUser.bannerUrl || companyProfile?.bannerUrl} 
                  className="w-full h-full object-cover" 
                  alt="Capa" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute inset-0 backdrop-blur-[2px]" />
             </div>
           )}

           <div className="flex items-center justify-between w-full relative z-10">
             <div onClick={handleOpenProfileEditor} className="flex items-center gap-4 cursor-pointer group">
                <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 flex items-center justify-center transition-all shadow-lg ${currentUser.bannerUrl || companyProfile?.bannerUrl ? 'border-white/30 bg-white/10 backdrop-blur-md scale-110' : 'border-slate-100 bg-slate-100'}`}>
                   {currentUser.avatarUrl || companyProfile?.logoUrl ? (
                     <img src={currentUser.avatarUrl || companyProfile?.logoUrl} className="w-full h-full object-cover" />
                   ) : (
                     <div className={`${currentUser.bannerUrl || companyProfile?.bannerUrl ? 'text-white' : 'text-slate-300'} font-black text-xl`}>
                       {currentUser.name.charAt(0)}
                     </div>
                   )}
                </div>
                <div>
                   <h1 className={`text-xl font-black leading-tight transition-colors ${currentUser.bannerUrl || companyProfile?.bannerUrl ? 'text-white drop-shadow-md' : 'text-slate-800'}`}>
                     {currentUser.name}
                   </h1>
                   <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${currentUser.bannerUrl || companyProfile?.bannerUrl ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-emerald-500'}`} />
                      <p className={`text-[9px] font-black uppercase tracking-widest ${currentUser.bannerUrl || companyProfile?.bannerUrl ? 'text-white/70' : 'text-slate-400'}`}>
                        {currentUser.role}
                      </p>
                   </div>
                </div>
             </div>
             <div className="flex gap-2">
                <button 
                  onClick={async () => {
                     try {
                        if (isBiometryActive) {
                           removeBiometryLocal();
                           setIsBiometryActive(false);
                           toast.success("Acesso por digital desativado neste aparelho.");
                        } else {
                           const identifier = currentUser?.email || currentUser?.phone || '';
                           if (!identifier || !currentUser?.accessCode) {
                              toast.error("É necessário estar logado com PIN para ativar."); return;
                           }
                           await registerBiometryLocal(currentUser.id, identifier, currentUser.accessCode, currentUser.userType || 'COMPANY');
                           setIsBiometryActive(true);
                           toast.success("Acesso por digital ativado!");
                        }
                     } catch(e: any) { toast.error(e.message || "Erro ao configurar biometria"); }
                  }}
                  className={`relative p-3 rounded-2xl transition-all active:scale-95 ${currentUser.bannerUrl || companyProfile?.bannerUrl ? (isBiometryActive ? 'bg-white/20 text-white backdrop-blur-md border border-white/30' : 'bg-white/10 text-white backdrop-blur-md border border-white/10') : (isBiometryActive ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'bg-slate-100 text-slate-500')}`}
                  title={isBiometryActive ? "Biometria Ativada" : "Ativar Biometria"}
                >
                  <Fingerprint size={20} />
                  {isBiometryActive && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />}
                </button>

                {currentUser.role === 'OWNER' && (
                  <button 
                    onClick={() => setShowNotesInbox(true)} 
                    className={`relative p-3 rounded-2xl transition-all active:scale-95 ${currentUser.bannerUrl || companyProfile?.bannerUrl ? 'bg-white/10 text-white backdrop-blur-md border border-white/10 hover:bg-white/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />}
                  </button>
                )}
                <button 
                  onClick={handleLogout} 
                  className={`p-3 rounded-2xl transition-all active:scale-95 ${currentUser.bannerUrl || companyProfile?.bannerUrl ? 'bg-white/10 text-white backdrop-blur-md border border-white/10 hover:bg-rose-500/20' : 'bg-slate-100 text-rose-500 hover:bg-rose-50'}`}
                >
                  <LogOut size={20} />
                </button>
             </div>
           </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      {currentUser && (
        <RealtimeBroker 
          workspaceId={currentUser.workspaceId} 
          enabledSounds={currentUser.enableSounds}
          currentUserName={currentUser.name}
          onNewTransaction={(newTx) => {
            setTransactions(prev => {
              if (prev.find(t => t.id === String(newTx.id))) return prev;
              const mapped = {
                id: String(newTx.id),
                workspaceId: newTx.workspace_id,
                date: newTx.date || newTx.created_at,
                category: newTx.category,
                subCategory: newTx.sub_category,
                item: newTx.item,
                value: Number(newTx.value),
                quantity: newTx.quantity,
                paymentMethod: newTx.payment_method,
                customerName: newTx.customer_name,
                isPending: !!newTx.is_pending,
                createdBy: newTx.created_by
              };
              return [mapped, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });
          }}
        />
      )}
      {activeTab !== 'GOD_MODE' && (
        <div className="fixed bottom-6 left-0 right-0 z-[90] flex justify-center pointer-events-none">
          <div className="bg-slate-900 p-2 rounded-[2.5rem] shadow-2xl flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[92vw] pointer-events-auto border border-slate-800">
              <button 
                onClick={() => handleTabChangeWithGuard('HOME')} 
                className={`flex items-center gap-2 px-5 py-3 rounded-[2rem] transition-all whitespace-nowrap ${getTabStyles('HOME')}`}
              >
                 <HomeIcon size={18} className={activeTab === 'HOME' ? 'text-white' : 'text-slate-500/70'} /> 
                 {activeTab === 'HOME' && (
                   <span className="text-[10px] font-black uppercase tracking-widest">
                     {currentUser.role === 'CUSTOMER' ? 'Minhas Notas' : 'Início'}
                   </span>
                 )}
              </button>
              
              <button 
                onClick={() => handleTabChangeWithGuard('MARKETPLACE')} 
                className={`flex items-center gap-2 px-5 py-3 rounded-[2rem] transition-all whitespace-nowrap ${getTabStyles('MARKETPLACE')}`}
              >
                 <ShoppingCart size={18} className={activeTab === 'MARKETPLACE' ? 'text-white' : 'text-emerald-500/40'} /> {activeTab === 'MARKETPLACE' && <span className="text-[10px] font-black uppercase tracking-widest">Vitrine</span>}
              </button>

              {allowedSections.map(s => (
                 <button 
                    key={s.id} 
                    onClick={() => handleTabChangeWithGuard(s.id)} 
                    className={`flex items-center gap-2 px-5 py-3 rounded-[2rem] transition-all whitespace-nowrap ${getTabStyles(s.id)}`}
                 >
                    {s.type === 'FACTORY_STYLE' ? (
                      <Package size={18} className={activeTab === s.id ? 'text-white' : 'text-indigo-400/40'} />
                    ) : (
                      <Store size={18} className={activeTab === s.id ? 'text-white' : 'text-orange-400/40'} />
                    )}
                    {activeTab === s.id && <span className="text-[10px] font-black uppercase tracking-widest">{s.name}</span>}
                 </button>
              ))}
              
              {currentUser.role === 'OWNER' && (
                 <>
                    <button 
                      onClick={() => handleTabChangeWithGuard('ESTOQUE')} 
                      className={`flex items-center gap-2 px-5 py-3 rounded-[2rem] transition-all whitespace-nowrap ${getTabStyles('ESTOQUE')}`}
                    >
                       <Package size={18} className={activeTab === 'ESTOQUE' ? 'text-white' : 'text-amber-500/40'} /> {activeTab === 'ESTOQUE' && <span className="text-[10px] font-black uppercase tracking-widest">Estoque</span>}
                    </button>
                    <button 
                      onClick={() => handleTabChangeWithGuard('ACTIVITY')} 
                      className={`flex items-center gap-2 px-5 py-3 rounded-[2rem] transition-all whitespace-nowrap ${getTabStyles('ACTIVITY')}`}
                    >
                       <Activity size={18} className={activeTab === 'ACTIVITY' ? 'text-white' : 'text-cyan-500/40'} /> {activeTab === 'ACTIVITY' && <span className="text-[10px] font-black uppercase tracking-widest">Log</span>}
                    </button>
                    <button 
                      onClick={() => handleTabChangeWithGuard('CONFIG')} 
                      className={`flex items-center gap-2 px-5 py-3 rounded-[2rem] transition-all whitespace-nowrap ${getTabStyles('CONFIG')}`}
                    >
                       <SettingsIcon size={18} className={activeTab === 'CONFIG' ? 'text-white' : 'text-indigo-500/40'} /> {activeTab === 'CONFIG' && <span className="text-[10px] font-black uppercase tracking-widest">Painel</span>}
                    </button>
                 </>
              )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <div className="p-4 pt-6 max-w-7xl mx-auto">
          {activeTab === 'HOME' && <Home sections={sections} archives={archives} visibleSections={allowedSections} transactions={transactions} user={currentUser} onNavigate={setActiveTab} ads={ads} incrementClick={incrementClick} deleteTransaction={(id) => deleteTransaction(id, currentUser.name)} plans={plans} stores={marketplaceStores} stalls={publicStalls} hasMoreTransactions={hasMoreTransactions} fetchNextTransactions={fetchNextTransactions} loadingTransactions={loading} financialInsights={financialInsights} />}
        {activeTab === 'CONFIG' && currentUser.role === 'OWNER' && <Settings sections={sections} saveConfig={saveConfig} deleteSection={deleteSection} users={users} addUser={createUser} removeUser={removeUser} updateUser={updateUser} transactions={transactions} clearTransactions={clearTransactions} archiveYear={archiveYear} currentUser={currentUser} companyProfile={companyProfile} onSaveProfile={handleSaveProfile} ads={ads} saveAd={saveAd} deleteAd={deleteAd} onNavigate={setActiveTab} isGodModeUnlocked={isGodModeUnlocked} onUnlockGodMode={() => { setIsGodModeUnlocked(true); setActiveTab('GOD_MODE'); }} addNote={addNote} onDirtyChange={setIsSettingsDirty} />}
        {activeTab === 'GOD_MODE' && isGodModeUnlocked && (currentUser.email === 'hacker3d22@gmail.com' || currentUser.email === 'brasilanonymous66@gmail.com') && <SuperAdmin onExit={() => setActiveTab('CONFIG')} />}
        {activeTab === 'ESTOQUE' && currentUser.role === 'OWNER' && <Stock sections={sections} saveConfig={saveConfig} workspaceId={currentUser.workspaceId} user={currentUser} />}
        {activeTab === 'ACTIVITY' && currentUser.role === 'OWNER' && <ManagerActivity transactions={transactions} users={users} deleteTransaction={(id) => deleteTransaction(id, currentUser.name)} hasMore={hasMoreTransactions} fetchNext={fetchNextTransactions} loading={loading} />}
        {activeTab === 'MARKETPLACE' && (
          <Marketplace 
            user={currentUser} 
            onLogout={() => setActiveTab('HOME')}
            stores={marketplaceStores}
            stalls={publicStalls}
            onRefresh={handleMarketplaceRefresh}
            plans={plans}
            onNavigate={setActiveTab}
            fetchPublicProfiles={fetchPublicProfiles}
            fetchPublicStalls={fetchPublicStalls}
            hasMoreStores={hasMoreStores}
            hasMoreStalls={hasMoreStalls}
            isLoading={loadingProfiles || loadingStalls}
          />
        )}
        
         {allowedSections.map(section => {
           if (activeTab === section.id) {
             if (section.type === 'FACTORY_STYLE') return <Factory key={section.id} section={section} user={currentUser} transactions={transactions} addTransactions={addTransactions} updateTransaction={updateTransaction} settleCustomerDebt={settleCustomerDebt} partialSettleTransaction={partialSettleTransaction} calculateTotals={calculateTotals} saveConfig={saveConfig} updateSingleSection={updateSingleSection} updateStockAtomic={updateStockAtomic} sections={sections} customers={customers} addCustomer={addCustomer} onRefreshData={handleManualDataRefresh} addNote={addNote} />;
             if (section.type === 'STALL_STYLE') return <Stall key={section.id} section={section} user={currentUser} transactions={transactions} addTransactions={addTransactions} updateTransaction={updateTransaction} calculateTotals={calculateTotals} saveConfig={saveConfig} updateSingleSection={updateSingleSection} updateStockAtomic={updateStockAtomic} sections={sections} customers={customers} addNote={addNote} />;
           }
           return null;
        })}
        </div>
      </div>

      {showProfileSettings && currentUser && (
        <StoreProfileSettings 
          profile={companyProfile} 
          onSave={async (p) => {
            const updated = await saveProfile(p);
            if (updated) setCompanyProfile(updated);
            return updated;
          }} 
          onClose={() => setShowProfileSettings(false)} 
          workspaceId={currentUser.workspaceId!} 
          hasProPlan={isProActive}
          user={currentUser}
          isOwner={currentUser.role === 'OWNER'}
          onSaveUser={async (userData) => {
             await updateUser(currentUser.id, userData);
             const updatedUser = { ...currentUser, ...userData };
             setCurrentUser(updatedUser);
             localStorage.setItem('logged_user', JSON.stringify(updatedUser));
             // Recarrega dívidas se o telefone mudar
             if (userData.phone && userData.phone !== currentUser.phone) {
               handleManualDataRefresh();
             }
          }}
        />
      )}
      {showNotesInbox && <NotesInbox notes={notes} onClose={() => setShowNotesInbox(false)} onMarkAsRead={markAsRead} onMarkAllAsRead={markAllAsRead} onDelete={deleteNote} onClearAll={clearReadNotes} />}

      {/* Modal de Confirmação de Saída */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="text-rose-500" size={40} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Sair do Aplicativo?</h3>
                <p className="text-slate-500 text-sm font-medium">
                  Você será desconectado e precisará entrar novamente. Tem certeza?
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={confirmLogout}
                  disabled={isProcessing}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-rose-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={16} /> : 'Sim, Sair Agora'}
                </button>
                <button 
                  onClick={() => setShowExitConfirm(false)}
                  className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs active:scale-95 transition-all"
                >
                  Continuar no App
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
