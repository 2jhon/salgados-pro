import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { useAppConfig } from './hooks/useAppConfig';
import { useTransactions } from './hooks/useTransactions';
import { useUsers } from './hooks/useUsers';
import { useAds } from './hooks/useAds';
import { useNotes } from './hooks/useNotes';
import { useStoreProfiles } from './hooks/useStoreProfiles';
import { supabase, checkDatabaseHealth } from './lib/supabase';
import { 
  LogOut, ShieldCheck, Loader2, Settings as SettingsIcon,
  ArrowLeft, Package, ShoppingBag,
  Home as HomeIcon, Store, WifiOff, ArrowRight,
  KeyRound, CheckCircle2, UserIcon, Save, Camera, Bell
} from 'lucide-react';

const ADMIN_EMAILS = [
  'admin@admin.com', 
  'admin@salgadospro.com.br', 
  'admin@salgados.com',
  'master@admin.com'
];

console.log('[DEBUG_APP] App.tsx module loaded');

export const App: React.FC = () => {
  console.log('[DEBUG_APP] App component rendering started');

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Hooks initialization logging
  console.log('[DEBUG_APP] Initializing hooks...');
  const { sections, saveConfig, deleteSection, fetchConfigByWorkspace } = useAppConfig();
  const { users, createUser, findUserByEmail, findUserByPhone, findUserById, fetchUsersByWorkspace, removeUser, updateUser } = useUsers();
  
  const { 
    transactions, 
    addTransactions, 
    updateTransaction, 
    deleteTransaction, 
    clearTransactions, 
    settleCustomerDebt, 
    partialSettleTransaction,
    calculateTotals, 
    fetchTransactionsByWorkspace,
    fetchUserGlobalDebts 
  } = useTransactions(currentUser?.workspaceId, sections, saveConfig);

  const { ads, fetchAds, incrementClick, saveAd, deleteAd } = useAds();
  const { getMyProfile, saveProfile } = useStoreProfiles();
  const { notes, unreadCount, markAsRead, deleteNote, clearReadNotes } = useNotes(currentUser?.workspaceId);
  
  console.log('[DEBUG_APP] Hooks initialized successfully');

  const [activeTab, setActiveTab] = useState<string>('HOME');
  const [companyProfile, setCompanyProfile] = useState<StoreProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showUserProfileEditor, setShowUserProfileEditor] = useState(false);
  const [showNotesInbox, setShowNotesInbox] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'IDENTIFY' | 'CREATE_COMPANY' | 'RECOVERY'>('IDENTIFY');
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
  
  const [isGodModeUnlocked, setIsGodModeUnlocked] = useState(false);

  const isFetchingRef = useRef(false);
  const dataLoadedRef = useRef<string | null>(null);

  const isUserAdmin = useMemo(() => {
    const userEmail = currentUser?.email?.toLowerCase()?.trim() || '';
    if (!userEmail) return false;
    return ADMIN_EMAILS.includes(userEmail);
  }, [currentUser?.email]);

  const initSystem = useCallback(async () => {
    console.log('[DEBUG_APP] initSystem called');
    const health = await checkDatabaseHealth();
    console.log('[DEBUG_APP] DB Health:', health);
    setIsOffline(!health.ok);
  }, []);

  useEffect(() => { initSystem(); }, [initSystem]);

  // --- LISTENER REALTIME: USUÁRIO E PERFIL ---
  // Mantém os dados do usuário (planos, permissões) e o perfil da loja (active) atualizados
  useEffect(() => {
    if (!currentUser?.id || !currentUser?.workspaceId) return;
    
    console.log('[REALTIME] Iniciando canais de sincronização...');
    
    // Canal do Usuário
    const userChannel = supabase.channel(`user_changes_${currentUser.id}`)
      .on(
        'postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${currentUser.id}` }, 
        async (payload) => {
          console.log('[REALTIME] Usuário atualizado no banco!', payload.new);
          const freshUser = await findUserById(currentUser.id);
          if (freshUser) {
            setCurrentUser(freshUser);
            localStorage.setItem('logged_user', JSON.stringify(freshUser));
            
            // Se o plano mudou, recarrega o perfil da loja também para garantir consistência
            if (freshUser.hasProPlan !== currentUser.hasProPlan) {
                const freshProfile = await getMyProfile(currentUser.workspaceId);
                if (freshProfile) setCompanyProfile(freshProfile);
            }
          }
        }
      )
      .subscribe();

    // Canal do Perfil da Loja
    const profileChannel = supabase.channel(`profile_changes_${currentUser.workspaceId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'store_profiles', 
          filter: `workspace_id=eq.${currentUser.workspaceId}` 
        },
        async (payload) => {
          console.log('[REALTIME] Perfil da loja atualizado!', payload.new);
          if (payload.new) {
             const updatedProfile = await getMyProfile(currentUser.workspaceId);
             if (updatedProfile) {
                setCompanyProfile(updatedProfile);
             }
          }
        }
      )
      .subscribe();
      
    return () => { 
      supabase.removeChannel(userChannel);
      supabase.removeChannel(profileChannel); 
    };
  }, [currentUser?.id, currentUser?.workspaceId, currentUser?.hasProPlan, findUserById, getMyProfile]);

  const loadWorkspaceData = useCallback(async (user: User) => {
    if (isFetchingRef.current) return;
    
    console.log('[DEBUG_APP] Loading workspace data for:', user.workspaceId);
    isFetchingRef.current = true;
    try {
      const promises: Promise<any>[] = [
        fetchConfigByWorkspace(user.workspaceId),
        fetchUsersByWorkspace(user.workspaceId),
        fetchTransactionsByWorkspace(user.workspaceId, true),
        fetchAds(),
      ];

      if (user.role !== 'OWNER' && user.phone) {
        promises.push(fetchUserGlobalDebts(user.phone));
      }

      await Promise.all(promises);
      
      // Carregar perfil da loja sempre
      const profile = await getMyProfile(user.workspaceId);
      if (profile) setCompanyProfile(profile);
      
      dataLoadedRef.current = user.workspaceId;
      console.log('[DEBUG_APP] Workspace data loaded');
    } catch (e) {
      console.error('[DEBUG_APP] Error loading workspace data:', e);
    } finally {
      isFetchingRef.current = false;
    }
  }, [fetchConfigByWorkspace, fetchUsersByWorkspace, fetchTransactionsByWorkspace, fetchAds, getMyProfile, fetchUserGlobalDebts]);

  useEffect(() => {
    const saved = localStorage.getItem('logged_user');
    if (saved && !currentUser) {
      console.log('[DEBUG_APP] Found saved user in localStorage');
      try {
        const user = JSON.parse(saved);
        if (user && user.id) {
            setCurrentUser(user);
            loadWorkspaceData(user);
        } else {
            console.warn('[DEBUG_APP] Saved user data invalid');
            localStorage.removeItem('logged_user');
        }
      } catch (e) {
        console.error('[DEBUG_APP] Error parsing saved user:', e);
        localStorage.removeItem('logged_user');
      }
    }
  }, [currentUser, loadWorkspaceData]);

  // EFEITO DE SEGURANÇA: PLANO PRO E STATUS DA LOJA
  // FIX: Adicionado debounce/timeout para evitar "Race Condition" na ativação do plano.
  // Isso impede que a loja seja desativada se o sinal de "Active=True" chegar antes do sinal "Pro=True".
  useEffect(() => {
    let securityTimer: ReturnType<typeof setTimeout>;

    if (currentUser?.role === 'OWNER' && companyProfile) {
      // Caso 1: Plano Expirado mas Loja Ativa -> Desativar (Com atraso de verificação)
      if (!currentUser.hasProPlan && companyProfile.active) {
        securityTimer = setTimeout(() => {
          // Verifica novamente dentro do timeout para garantir que o estado não mudou
          console.log('[SECURITY] Verificação de integridade do Plano Pro...');
          if (!currentUser.hasProPlan && companyProfile.active) {
             console.log('[SECURITY] Plano Pro Inativo Confirmado. Ocultando vitrine.');
             saveProfile({ ...companyProfile, active: false }).then((updated) => {
               if (updated) {
                 setCompanyProfile(updated);
                 // Opcional: Mostrar alerta apenas se não for um erro de carregamento inicial
               }
             });
          }
        }, 3000); // 3 segundos de tolerância para sincronização do socket
      }
    }

    return () => {
      if (securityTimer) clearTimeout(securityTimer);
    };
  }, [currentUser?.hasProPlan, companyProfile?.active, currentUser?.role, saveProfile, companyProfile]);

  const handleLogout = () => {
    localStorage.removeItem('logged_user');
    setCurrentUser(null);
    setAuthMode('IDENTIFY');
    setCompanyProfile(null);
    dataLoadedRef.current = null;
    setActiveTab('HOME');
    setIsGodModeUnlocked(false);
  };

  const handleLogoClick = () => {
    if (currentUser?.role === 'OWNER') {
      setShowProfileSettings(true);
    } else if (currentUser) {
      setEditUserData({
        name: currentUser.name,
        phone: currentUser.phone || '',
        cpf: currentUser.cpf || '',
        accessCode: currentUser.accessCode,
        avatarUrl: currentUser.avatarUrl || '',
        bannerUrl: currentUser.bannerUrl || ''
      });
      setShowUserProfileEditor(true);
    }
  };

  const handleUnlockGodMode = () => {
    setIsGodModeUnlocked(true);
    setActiveTab('GOD_MODE');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  const handleUserImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'avatarUrl' | 'bannerUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Imagem muito grande! Escolha uma foto de até 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditUserData(prev => ({ ...prev, [field]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUserProfile = async () => {
    if (!currentUser) return;
    setIsProcessing(true);
    try {
      await updateUser(currentUser.id, editUserData);
      const updatedUser = { ...currentUser, ...editUserData };
      setCurrentUser(updatedUser);
      localStorage.setItem('logged_user', JSON.stringify(updatedUser));
      setShowUserProfileEditor(false);
    } catch (e: any) { alert("Erro ao salvar."); }
    finally { setIsProcessing(false); }
  };

  const handleRecoveryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const user = targetType === 'COMPANY' ? await findUserByEmail(email.toLowerCase().trim()) : await findUserByPhone(phone);
      if (user && user.name.toLowerCase().trim() === userName.toLowerCase().trim()) {
        const newPIN = Math.floor(100000 + Math.random() * 900000).toString();
        await updateUser(user.id, { accessCode: newPIN });
        await addTransactions([{
          workspaceId: user.workspaceId,
          category: 'SISTEMA',
          subCategory: 'SEGURANCA',
          item: `SOLICITAÇÃO DE PIN: ${user.name}`,
          customerName: user.phone || phone,
          value: 0,
          quantity: parseInt(newPIN),
          createdBy: 'SISTEMA',
          isPending: true
        }]);
        setRecoveryMessage("Solicitação enviada. Novo PIN será enviado pelo admin.");
        setRecoverySuccess(true);
      } else { setAuthError("Dados incorretos."); }
    } catch (err) { setAuthError("Erro de servidor."); }
    finally { setIsProcessing(false); }
  };

  const allowedSections = useMemo(() => {
    if (!currentUser || !sections || sections.length === 0) return [];
    if (currentUser.role === 'OWNER') return sections.filter(s => s.type !== 'STOCK_STYLE');
    const assignedIds = Array.isArray(currentUser.assignedSectionIds) ? currentUser.assignedSectionIds.map(id => String(id).trim()) : [];
    return sections.filter(s => assignedIds.includes(String(s.id).trim()));
  }, [sections, currentUser]);

  const headerData = useMemo(() => {
    const isOwner = currentUser?.role === 'OWNER';
    if (isOwner) return { image: companyProfile?.logoUrl, title: companyProfile?.name || 'Salgados Pro', subtitle: '⚙️ AJUSTAR PERFIL', isStore: true };
    return { image: currentUser?.avatarUrl, title: currentUser?.name || 'Minha Conta', subtitle: companyProfile?.name || 'Cliente', isStore: false };
  }, [currentUser, companyProfile]);

  if (isOffline) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-slate-900 rounded-[3rem] p-12 border border-slate-800 shadow-2xl">
          <WifiOff className="w-12 h-12 text-rose-500 mx-auto mb-8" />
          <h2 className="text-2xl font-black mb-4">Sem Conexão</h2>
          <button onClick={() => window.location.reload()} className="w-full py-5 bg-white text-slate-950 rounded-2xl font-black">Reconectar</button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange-400/20 via-slate-950 to-black" />
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-12">
            <button className="w-20 h-20 bg-orange-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl"><ShieldCheck className="w-10 h-10 text-white" /></button>
            <h1 className="text-4xl font-black mb-2 tracking-tighter">Salgados Pro</h1>
          </div>
          {authMode === 'IDENTIFY' ? (
            <div className="grid gap-4">
              <button onClick={() => { setTargetType('COMPANY'); setAuthMode('LOGIN'); }} className="group p-8 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center gap-6 hover:bg-orange-600 transition-all text-left"><div className="p-4 bg-orange-600 text-white rounded-2xl"><Store className="w-6 h-6" /></div><div><h3 className="text-lg font-black uppercase">Sou Empresa</h3></div></button>
              <button onClick={() => { setTargetType('CUSTOMER'); setAuthMode('LOGIN'); }} className="group p-8 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center gap-6 hover:bg-blue-600 transition-all text-left"><div className="p-4 bg-blue-600 text-white rounded-2xl"><ShoppingBag className="w-6 h-6" /></div><div><h3 className="text-lg font-black uppercase">Sou Cliente</h3></div></button>
              <button onClick={() => { setTargetType('COMPANY'); setAuthMode('CREATE_COMPANY'); }} className="mt-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center w-full">Cadastrar minha empresa</button>
            </div>
          ) : authMode === 'RECOVERY' ? (
            <div className="bg-white p-8 rounded-[3rem] space-y-6 text-slate-800 shadow-3xl">
              <button onClick={() => setAuthMode('LOGIN')} className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase"><ArrowLeft className="w-4 h-4" /> Voltar</button>
              {!recoverySuccess ? (
                <form onSubmit={handleRecoveryRequest} className="space-y-4">
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
              setIsProcessing(true);
              try {
                if(authMode === 'LOGIN') {
                   const user = targetType === 'COMPANY' ? await findUserByEmail(email.toLowerCase().trim()) : await findUserByPhone(phone);
                   if (user && String(user.accessCode) === pin) {
                     localStorage.setItem('logged_user', JSON.stringify(user));
                     setCurrentUser(user);
                     loadWorkspaceData(user);
                   } else { setAuthError("Dados inválidos."); }
                } else if (authMode === 'CREATE_COMPANY') {
                   const wsId = `ws_${Date.now()}`;
                   // Handle both COMPANY and CUSTOMER creation logic
                   const role = targetType === 'COMPANY' ? 'OWNER' : 'CUSTOMER';
                   const userType = targetType;
                   
                   const newUser = await createUser({ 
                     workspaceId: wsId, 
                     name: userName, 
                     email: targetType === 'COMPANY' ? email.toLowerCase().trim() : undefined, 
                     phone: phone, 
                     role: role, 
                     accessCode: pin, 
                     assignedSectionIds: [], 
                     isAdFree: false, 
                     isAdvertiser: false, 
                     hideSalesValues: false, 
                     enableSounds: true, 
                     userType: userType 
                   });

                   if (newUser) { 
                     // Only create store profile if it is a COMPANY
                     if (targetType === 'COMPANY') {
                        await saveProfile({ workspaceId: wsId, name: userName, description: '', address: '', whatsapp: phone, latitude: 0, longitude: 0, active: false, portfolio: [] });
                     }
                     localStorage.setItem('logged_user', JSON.stringify(newUser));
                     setCurrentUser(newUser); 
                     loadWorkspaceData(newUser); 
                   }
                }
              } catch (err: any) { 
                setAuthError("Falha na autenticação."); 
              } 
              finally { setIsProcessing(false); }
            }} className="bg-white p-8 rounded-[3rem] space-y-5 text-slate-800 shadow-3xl">
              <button type="button" onClick={() => setAuthMode('IDENTIFY')} className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase"><ArrowLeft className="w-4 h-4" /> Voltar</button>
              {authError && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase text-center">{authError}</div>}
              {authMode === 'CREATE_COMPANY' && (
                <>
                  <input required value={userName} onChange={e => setUserName(e.target.value)} placeholder={targetType === 'COMPANY' ? "Nome Empresa" : "Seu Nome"} className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none" />
                  <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="WhatsApp" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none" />
                  {targetType === 'COMPANY' && <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none" />}
                </>
              )}
              {targetType === 'COMPANY' && authMode === 'LOGIN' && <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none" />}
              {targetType === 'CUSTOMER' && authMode === 'LOGIN' && <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="WhatsApp" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none" />}
              <input required maxLength={6} type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder={authMode === 'CREATE_COMPANY' ? "Crie seu PIN 6 dígitos" : "PIN 6 dígitos"} className="w-full p-4 bg-slate-50 rounded-xl font-black text-xl text-center outline-none" />
              <button type="submit" disabled={isProcessing} className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg">{isProcessing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (authMode === 'CREATE_COMPANY' ? 'Cadastrar' : 'Entrar')}</button>
              {authMode === 'LOGIN' && (
                <div className="pt-4 space-y-3">
                  <button type="button" onClick={() => setAuthMode('RECOVERY')} className="w-full text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Esqueci meu PIN</button>
                  {targetType === 'CUSTOMER' && (
                    <button type="button" onClick={() => { setAuthMode('CREATE_COMPANY'); setUserName(''); setPhone(''); setPin(''); }} className="w-full text-center text-[9px] font-black text-blue-500 uppercase tracking-widest">Não tem conta? Cadastre-se</button>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    );
  }

  // RENDERIZAÇÃO PRINCIPAL DO APP
  return (
    <div className="w-full min-h-screen bg-slate-50 relative shadow-2xl overflow-hidden pb-10">
      {/* Header e Navegação */}
      {activeTab !== 'GOD_MODE' && (
        <div className="bg-white p-6 pb-2 rounded-b-[2.5rem] shadow-xl border-b border-slate-100 z-50 relative max-w-7xl mx-auto">
           <div className="flex items-center justify-between mb-6">
             <div onClick={handleLogoClick} className="flex items-center gap-3 cursor-pointer">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl overflow-hidden border border-slate-100 shadow-sm flex items-center justify-center">
                   {headerData.image ? <img src={headerData.image} className="w-full h-full object-cover" /> : <div className="text-slate-300 font-black">{headerData.title.charAt(0)}</div>}
                </div>
                <div>
                   <h1 className="text-lg font-black text-slate-800 leading-tight">{headerData.title}</h1>
                   <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{headerData.subtitle}</p>
                      
                      {/* INDICADOR LIVE (REALTIME) */}
                      {!isOffline && (
                        <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 animate-in fade-in zoom-in">
                           <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                           </span>
                           <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest">LIVE</span>
                        </div>
                      )}
                   </div>
                </div>
             </div>
             <div className="flex gap-2">
                {currentUser?.role === 'OWNER' && (
                  <button onClick={() => setShowNotesInbox(true)} className="relative p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all active:scale-95">
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />}
                  </button>
                )}
                <button onClick={handleLogout} className="p-3 bg-slate-100 text-rose-500 rounded-2xl hover:bg-rose-50 transition-all active:scale-95">
                  <LogOut size={20} />
                </button>
             </div>
           </div>

           {/* Navegação Principal */}
           <div className="flex overflow-x-auto gap-2 pb-4 no-scrollbar">
              <button onClick={() => setActiveTab('HOME')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all whitespace-nowrap ${activeTab === 'HOME' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                 <HomeIcon size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Início</span>
              </button>
              <button onClick={() => setActiveTab('MARKETPLACE')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all whitespace-nowrap ${activeTab === 'MARKETPLACE' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                 <ShoppingBag size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Comprar</span>
              </button>
              {allowedSections.map(s => (
                 <button key={s.id} onClick={() => setActiveTab(s.id)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all whitespace-nowrap ${activeTab === s.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                    {s.type === 'FACTORY_STYLE' ? <Package size={16} /> : s.type === 'STOCK_STYLE' ? <Package size={16} /> : <Store size={16} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{s.name}</span>
                 </button>
              ))}
              {currentUser.role === 'OWNER' && (
                 <>
                    <button onClick={() => setActiveTab('ESTOQUE')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all whitespace-nowrap ${activeTab === 'ESTOQUE' ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                       <Package size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Estoque</span>
                    </button>
                    <button onClick={() => setActiveTab('CONFIG')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all whitespace-nowrap ${activeTab === 'CONFIG' ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                       <SettingsIcon size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Gestão</span>
                    </button>
                    <button onClick={() => setActiveTab('ACTIVITY')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all whitespace-nowrap ${activeTab === 'ACTIVITY' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                       <ArrowRight size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Log</span>
                    </button>
                 </>
              )}
           </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="p-4 pt-6 max-w-7xl mx-auto">
        {activeTab === 'HOME' && (
           <Home 
              sections={sections} 
              visibleSections={allowedSections}
              transactions={transactions} 
              user={currentUser} 
              onNavigate={setActiveTab}
              ads={ads}
              incrementClick={incrementClick}
              deleteTransaction={deleteTransaction}
           />
        )}
        
        {activeTab === 'MARKETPLACE' && (
          <Marketplace 
            user={currentUser} 
            onLogout={handleLogout} 
          />
        )}

        {activeTab === 'CONFIG' && currentUser.role === 'OWNER' && (
           <Settings 
              sections={sections}
              saveConfig={saveConfig}
              deleteSection={deleteSection}
              users={users}
              addUser={createUser}
              removeUser={removeUser}
              updateUser={updateUser}
              transactions={transactions}
              clearTransactions={clearTransactions}
              currentUser={currentUser}
              companyProfile={companyProfile}
              onSaveProfile={saveProfile}
              ads={ads}
              saveAd={saveAd}
              deleteAd={deleteAd}
              onNavigate={setActiveTab}
              isGodModeUnlocked={isGodModeUnlocked}
              onUnlockGodMode={handleUnlockGodMode}
           />
        )}

        {activeTab === 'ESTOQUE' && currentUser.role === 'OWNER' && (
           <Stock sections={sections} saveConfig={saveConfig} workspaceId={currentUser.workspaceId} />
        )}

        {activeTab === 'ACTIVITY' && currentUser.role === 'OWNER' && (
          <ManagerActivity transactions={transactions} users={users} deleteTransaction={deleteTransaction} />
        )}

        {activeTab === 'GOD_MODE' && isGodModeUnlocked && (
          <SuperAdmin onExit={() => setActiveTab('CONFIG')} />
        )}
        
        {/* Abas Dinâmicas */}
        {allowedSections.map(section => {
           if (activeTab === section.id) {
             if (section.type === 'FACTORY_STYLE') {
               return (
                 <Factory 
                    key={section.id} 
                    section={section} 
                    user={currentUser} 
                    transactions={transactions} 
                    addTransactions={addTransactions}
                    settleCustomerDebt={settleCustomerDebt}
                    partialSettleTransaction={partialSettleTransaction}
                    calculateTotals={calculateTotals}
                    saveConfig={saveConfig}
                    sections={sections}
                 />
               );
             }
             if (section.type === 'STALL_STYLE') {
               return (
                 <Stall 
                    key={section.id} 
                    section={section} 
                    user={currentUser} 
                    transactions={transactions} 
                    addTransactions={addTransactions} 
                    updateTransaction={updateTransaction}
                    calculateTotals={calculateTotals}
                    saveConfig={saveConfig}
                    sections={sections}
                 />
               );
             }
             if (section.type === 'STOCK_STYLE' && currentUser.role !== 'OWNER') {
                return <Stock key={section.id} sections={sections} saveConfig={saveConfig} workspaceId={currentUser.workspaceId} />;
             }
           }
           return null;
        })}
      </div>

      {/* Modais Globais */}
      {showProfileSettings && (
        <StoreProfileSettings 
          profile={companyProfile}
          onSave={(p) => saveProfile(p)}
          onClose={() => setShowProfileSettings(false)}
          workspaceId={currentUser.workspaceId}
          hasProPlan={currentUser.hasProPlan}
        />
      )}

      {showUserProfileEditor && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase">Editar Perfil</h3>
            <div className="space-y-4">
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-slate-100 rounded-full overflow-hidden relative group cursor-pointer border-4 border-white shadow-xl" onClick={() => avatarInputRef.current?.click()}>
                   {editUserData.avatarUrl ? <img src={editUserData.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><UserIcon size={32} /></div>}
                   <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white" /></div>
                </div>
                <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={(e) => handleUserImageUpload(e, 'avatarUrl')} />
              </div>
              
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Nome</label><input value={editUserData.name} onChange={e => setEditUserData({...editUserData, name: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase text-xs outline-none" /></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">WhatsApp</label><input value={editUserData.phone} onChange={e => setEditUserData({...editUserData, phone: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase text-xs outline-none" /></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">CPF (Opcional)</label><input value={editUserData.cpf} onChange={e => setEditUserData({...editUserData, cpf: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase text-xs outline-none" /></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">PIN de Acesso</label><input type="password" maxLength={6} value={editUserData.accessCode} onChange={e => setEditUserData({...editUserData, accessCode: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-center text-xl outline-none tracking-widest" /></div>
              
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowUserProfileEditor(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                <button onClick={handleSaveUserProfile} disabled={isProcessing} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2">{isProcessing ? <Loader2 className="animate-spin" /> : <Save size={16} />} Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNotesInbox && (
        <NotesInbox 
          notes={notes} 
          onClose={() => setShowNotesInbox(false)} 
          onMarkAsRead={markAsRead} 
          onDelete={deleteNote}
          onClearAll={clearReadNotes}
        />
      )}
    </div>
  );
};