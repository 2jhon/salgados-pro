import React, { useMemo, useState, useEffect } from 'react';
import { AppSection, Transaction, User, Ad, StoreProfile } from '../types';
import { useCustomers } from '../hooks/useCustomers';
import { useStoreProfiles } from '../hooks/useStoreProfiles';
import { 
  Factory, 
  Store, 
  Package, 
  Activity, 
  Settings as SettingsIcon, 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  ArrowUpRight, 
  Utensils, 
  Megaphone, 
  CheckCircle, 
  Wallet, 
  X, 
  Calendar, 
  Receipt, 
  CheckCircle2, 
  MapPin, 
  Phone, 
  Loader2, 
  Info, 
  Clock, 
  Trash2,
  History 
} from 'lucide-react';

interface HomeProps {
  sections: AppSection[];
  visibleSections: AppSection[]; 
  transactions: Transaction[];
  user: User;
  onNavigate: (tab: string) => void;
  ads: Ad[];
  incrementClick: (adId: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export const Home: React.FC<HomeProps> = ({ sections, visibleSections, transactions, user, onNavigate, ads, incrementClick, deleteTransaction }) => {
  const isOwner = user.role === 'OWNER';
  const isPro = !!user.hasProPlan;
  const isAdFree = !!user.isAdFree;
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [showMyNotesModal, setShowMyNotesModal] = useState(false);
  const [activeNoteTab, setActiveNoteTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  
  // Hooks
  const { customers } = useCustomers(user.workspaceId);
  const { getMyProfile } = useStoreProfiles();

  // Estados para o detalhe da nota (Agora suporta grupo de itens)
  const [selectedNoteGroup, setSelectedNoteGroup] = useState<Transaction[] | null>(null);
  const [noteStore, setNoteStore] = useState<StoreProfile | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);

  // Estado para forçar atualização do filtro de tempo (revalidação a cada minuto)
  const [timeTick, setTimeTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTimeTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenNote = async (group: Transaction[]) => {
    if (!group || group.length === 0) return;
    setSelectedNoteGroup(group);
    setLoadingNote(true);
    setNoteStore(null); // Limpa loja anterior
    try {
        const profile = await getMyProfile(group[0].workspaceId);
        setNoteStore(profile);
    } catch (e) {
        console.warn("Erro ao buscar dados da loja da nota:", e);
    } finally {
        setLoadingNote(false);
    }
  };

  const filteredAds = useMemo(() => {
    // Se o usuário paga para não ver ads ou é PRO, retorna vazio
    if (isAdFree || isPro) return [];
    
    // Usa timeTick para garantir que 'now' esteja sempre atualizado no hook
    const now = timeTick; 

    return ads.filter(ad => {
      // 1. O anúncio deve estar marcado como ATIVO no sistema
      if (!ad.active) return false;

      // 2. Verificação rigorosa de Expiração
      if (ad.expiresAt) {
        const expirationTime = new Date(ad.expiresAt).getTime();
        // Se o tempo de expiração for menor ou igual a agora, o anúncio venceu
        if (expirationTime <= now) return false;
      }

      return true;
    });
  }, [ads, isAdFree, isPro, timeTick]);

  useEffect(() => {
    if (filteredAds.length > 1) {
      const interval = setInterval(() => {
        setCurrentAdIndex(prev => (prev + 1) % filteredAds.length);
      }, 7000);
      return () => clearInterval(interval);
    } else {
      // Resetar index se a lista mudar e o index atual não existir mais
      setCurrentAdIndex(0);
    }
  }, [filteredAds.length]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayTrans = transactions.filter(t => new Date(t.date).getTime() >= startOfDay);
    const sales = todayTrans.filter(t => t.subCategory !== 'GASTOS' && !t.isPending).reduce((acc, t) => acc + t.value, 0);
    const expenses = todayTrans.filter(t => t.subCategory === 'GASTOS' && !t.isPending).reduce((acc, t) => acc + t.value, 0);
    
    const allowedStockSections = sections.filter(s => 
      s.type === 'STOCK_STYLE' && 
      (isOwner || (user.assignedSectionIds || []).includes(s.id))
    );
    
    const lowStockItems = allowedStockSections.flatMap(s => s.items).filter(i => (i.currentStock ?? 0) <= (i.minStock ?? 0) && (i.minStock ?? 0) > 0);
    return { sales, expenses, lowStockCount: lowStockItems.length };
  }, [transactions, sections, isOwner, user.assignedSectionIds]);

  /**
   * LÓGICA INTELIGENTE DE IDENTIDADE
   * Normaliza strings removendo acentos e caixa alta para garantir match.
   */
  const normalizeString = (str: string) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  const normalizePhone = (p: string | undefined) => {
    if (!p) return '';
    let clean = p.replace(/\D/g, '');
    // Remove prefixo 55 se o número for longo (Brasil)
    if (clean.startsWith('55') && clean.length > 11) {
      clean = clean.substring(2);
    }
    return clean;
  };

  // Cria uma lista de "nomes possíveis" para este usuário
  const userAliases = useMemo(() => {
    const aliases = new Set<string>();
    const userName = normalizeString(user.name);
    if (userName) aliases.add(userName); 
    
    // 1. Adiciona partes do nome como alias (ex: "Maria Clara Silva" -> "maria", "clara", "silva")
    const parts = userName.split(' ');
    parts.forEach(part => {
      if (part.length >= 2) aliases.add(part); // Aceita nomes curtos como 'Jo', 'Al'
    });

    // 2. Adiciona parte do email como alias
    if (user.email) {
      const emailUser = normalizeString(user.email.split('@')[0]);
      if (emailUser.length >= 2) aliases.add(emailUser);
    }

    // 3. Match Cruzado via Telefone (Crucial para vincular conta do App com cadastro da Loja)
    if (customers.length > 0) {
      const userPhone = normalizePhone(user.phone);
      
      customers.forEach(c => {
        const cPhone = normalizePhone(c.phone);
        // Match por Telefone (com tolerância de 8 dígitos para pegar fixo ou sem nono dígito)
        if (userPhone && cPhone && (userPhone.includes(cPhone) || cPhone.includes(userPhone)) && cPhone.length >= 8) {
           const mappedName = normalizeString(c.name);
           aliases.add(mappedName);
        }
      });
    }
    
    const finalAliases = Array.from(aliases);
    return finalAliases;
  }, [customers, user]);

  const filterMyTransactions = (list: Transaction[], requirePending: boolean) => {
    if (isOwner) return [];
    
    return list.filter(t => {
      if (t.category === 'SISTEMA') return false;
      
      // Filtra por estado (pendente vs pago)
      if (requirePending) {
        // Se queremos pendentes, isPending deve ser true e não pode ser GASTOS
        if (!t.isPending || t.subCategory === 'GASTOS') return false;
      } else {
        // Se queremos histórico (pagos), isPending deve ser false
        // Excluimos gastos que são apenas despesas internas
        if (t.isPending) return false;
      }

      if ((t as any).__forceShow) return true;
      if (!t.customerName) return false;
      
      const txName = normalizeString(t.customerName);
      if (userAliases.includes(txName)) return true;

      const partialMatch = userAliases.some(alias => {
         if (alias.length < 2) return false; 
         return txName.includes(alias) || alias.includes(txName);
      });

      return partialMatch;
    });
  };

  const myDebts = useMemo(() => {
    return filterMyTransactions(transactions, true);
  }, [transactions, userAliases, isOwner]);

  const myHistory = useMemo(() => {
    return filterMyTransactions(transactions, false).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, userAliases, isOwner]);

  const totalDebt = useMemo(() => myDebts.reduce((acc, t) => acc + t.value, 0), [myDebts]);

  const groupTransactionsByDate = (list: Transaction[]) => {
    return list.reduce((groups, t) => {
      const date = new Date(t.date).toLocaleDateString('pt-BR');
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
      return groups;
    }, {} as Record<string, Transaction[]>);
  };

  const debtsByDate = useMemo(() => groupTransactionsByDate(myDebts), [myDebts]);
  const historyByDate = useMemo(() => groupTransactionsByDate(myHistory), [myHistory]);

  // Função auxiliar para agrupar itens pelo timestamp exato (mesma nota)
  const groupItemsByTime = (items: Transaction[]) => {
    const groups: Record<string, Transaction[]> = {};
    items.forEach(t => {
      const timeKey = t.date; // Agrupa pela string de data completa (ISO)
      if (!groups[timeKey]) groups[timeKey] = [];
      groups[timeKey].push(t);
    });
    // Ordena do mais recente para o mais antigo
    return Object.values(groups).sort((a, b) => new Date(b[0].date).getTime() - new Date(a[0].date).getTime());
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const calculateGroupTotal = (items: Transaction[]) => items.reduce((acc, t) => acc + t.value, 0);

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Deseja excluir este registro do histórico?")) {
      await deleteTransaction(id);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-32">
      {/* HEADER PERSONALIZADO DO CLIENTE */}
      <div className="relative rounded-[2.5rem] overflow-hidden bg-white shadow-lg border border-slate-50 min-h-[140px] flex items-end">
         {user.bannerUrl && (
           <div className="absolute inset-0 z-0">
             <img src={user.bannerUrl} className="w-full h-full object-cover opacity-90" alt="Capa" />
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
           </div>
         )}
         
         <div className="relative z-10 w-full p-6 flex items-end justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest shadow-lg ${user.bannerUrl ? 'bg-white/20 text-white backdrop-blur-md' : (isPro ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500')}`}>
                  {isPro ? 'PRO PLAN' : 'FREE PLAN'}
                </span>
                <p className={`font-black uppercase text-[10px] tracking-[0.3em] leading-none ${user.bannerUrl ? 'text-orange-400' : 'text-orange-600'}`}>Status: {user.role}</p>
              </div>
              <h2 className={`text-4xl font-black tracking-tight drop-shadow-sm ${user.bannerUrl ? 'text-white' : 'text-slate-800'}`}>
                Olá, <span className={user.bannerUrl ? 'text-orange-400' : 'text-orange-500'}>{(user.name || 'Usuário').split(' ')[0]}!</span>
              </h2>
            </div>
            
            <div className={`p-1 rounded-[1.5rem] shadow-2xl relative overflow-hidden group ${user.bannerUrl ? 'bg-white/20 backdrop-blur-md border border-white/20' : 'bg-white'}`}>
               {user.avatarUrl ? (
                 <img src={user.avatarUrl} className="w-16 h-16 object-cover rounded-[1.2rem]" alt="Avatar" />
               ) : (
                 <div className={`p-4 rounded-[1.2rem] ${user.bannerUrl ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'}`}>
                   <Utensils className="w-8 h-8" />
                 </div>
               )}
            </div>
         </div>
      </div>

      {/* ÁREA DE DÍVIDAS DO CLIENTE */}
      {!isOwner && (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-red-100 animate-in slide-in-from-top-4 relative overflow-hidden">
           {myDebts.length > 0 ? (
             <>
               <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                     <div className="p-4 bg-red-100 text-red-600 rounded-2xl">
                        <Wallet className="w-6 h-6" />
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-slate-800">Conta em Aberto</h3>
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{myDebts.length} Itens pendentes</p>
                     </div>
                  </div>
                  <p className="text-2xl font-black text-red-600">{formatCurrency(totalDebt)}</p>
               </div>
               
               <button 
                 onClick={() => { setActiveNoteTab('PENDING'); setShowMyNotesModal(true); }}
                 className="w-full py-4 bg-slate-900 text-white rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
               >
                 <Receipt className="w-4 h-4" /> Minhas Notas (Detalhes)
               </button>
             </>
           ) : (
             <div className="text-center py-6">
                <CheckCircle className="w-12 h-12 text-emerald-200 mx-auto mb-2" />
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Tudo em dia!</p>
                <button 
                 onClick={() => { setActiveNoteTab('HISTORY'); setShowMyNotesModal(true); }}
                 className="mt-4 px-6 py-2 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[9px] hover:bg-slate-200 transition-all"
                >
                 Histórico
               </button>
             </div>
           )}
        </div>
      )}

      {isOwner && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-600 p-6 rounded-[2.5rem] shadow-xl shadow-emerald-900/10 text-white relative overflow-hidden group">
            <TrendingUp className="w-12 h-12 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-125 transition-transform" />
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Vendas Hoje</span>
            <p className="text-2xl font-black mt-1">{formatCurrency(stats.sales)}</p>
          </div>
          <div className="bg-rose-600 p-6 rounded-[2.5rem] shadow-xl shadow-rose-900/10 text-white relative overflow-hidden group">
            <TrendingDown className="w-12 h-12 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-125 transition-transform" />
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Gastos Hoje</span>
            <p className="text-2xl font-black mt-1">{formatCurrency(stats.expenses)}</p>
          </div>
        </div>
      )}

      {!isPro && isOwner && (
        <button 
          onClick={() => {
            localStorage.setItem('settings_pending_tab', 'PLANOS');
            onNavigate('CONFIG');
          }}
          className="w-full p-6 bg-gradient-to-r from-indigo-600 to-blue-700 rounded-[2.5rem] text-white flex items-center justify-between group hover:shadow-2xl transition-all active:scale-95"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 rounded-2xl">
              <Sparkles className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="text-left">
              <h4 className="font-black text-sm uppercase tracking-tight">Ative sua Vitrine Online</h4>
              <p className="text-[9px] font-black opacity-70 uppercase tracking-widest">Seja PRO por apenas R$ 34,90/mês</p>
            </div>
          </div>
          <ArrowUpRight className="w-6 h-6 opacity-40 group-hover:opacity-100 transition-opacity" />
        </button>
      )}

      {filteredAds.length > 0 && (
        <div className="relative group animate-in slide-in-from-top-6 duration-700">
          <div className="overflow-hidden rounded-[3rem] shadow-2xl border-[8px] border-white relative h-64 bg-slate-100">
            <div className="flex h-full transition-transform duration-1000" style={{ transform: `translateX(-${currentAdIndex * 100}%)` }}>
              {filteredAds.map((ad) => {
                const isMyAd = ad.ownerId === user.id;
                return (
                  <div 
                    key={ad.id} 
                    onClick={() => {
                      incrementClick(ad.id);
                      ad.link === '#CONFIG' ? onNavigate('CONFIG') : window.open(ad.link, '_blank');
                    }}
                    className="w-full shrink-0 h-full relative cursor-pointer" 
                    style={{ backgroundColor: ad.backgroundColor || '#f59e0b' }}
                  >
                    {ad.mediaUrl && <img src={ad.mediaUrl} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-8 flex flex-col justify-end">
                       <div className="flex justify-between items-end">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                               {isMyAd ? (
                                 <>
                                   <CheckCircle className="w-3 h-3 text-emerald-400" />
                                   <span className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.4em] block">Seu Anúncio Ativo</span>
                                 </>
                               ) : (
                                 <>
                                   <Megaphone className="w-3 h-3 text-orange-400" />
                                   <span className="text-[8px] font-black text-orange-400 uppercase tracking-[0.4em] block">Patrocinado</span>
                                 </>
                               )}
                            </div>
                            <h3 className="text-2xl font-black text-white leading-tight drop-shadow-xl mb-1">{ad.title}</h3>
                            <p className="text-white/70 text-[10px] font-bold uppercase tracking-tight line-clamp-1">{ad.description}</p>
                            
                            <div className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-2 w-fit">
                              <div className="bg-white/20 p-1 rounded-md">
                                <Store className="w-3 h-3 text-white" />
                              </div>
                              <span className="text-[9px] font-black text-white uppercase tracking-widest">{ad.ownerName}</span>
                            </div>
                          </div>
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-2">
          {visibleSections.length > 0 ? 'Suas Operações Autorizadas' : 'Nenhuma área operacional atribuída'}
        </h4>
        <div className="grid sm:grid-cols-2 gap-4">
          {visibleSections.map(section => (
            <button 
              key={section.id} 
              onClick={() => onNavigate(section.id)} 
              className={`group p-8 rounded-[3rem] shadow-xl transition-all text-left relative overflow-hidden active:scale-95 border-0 ${
                section.type === 'FACTORY_STYLE' 
                ? 'bg-slate-900 text-white shadow-slate-900/10' 
                : 'bg-orange-500 text-white shadow-orange-900/10'
              }`}
            >
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                {section.type === 'FACTORY_STYLE' ? <Factory size={120} /> : <Store size={120} />}
              </div>
              <h3 className="text-2xl font-black mb-1">{section.name}</h3>
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest flex items-center gap-2">
                Acessar Operação <ArrowUpRight className="w-4 h-4" />
              </p>
            </button>
          ))}
        </div>

        {isOwner && (
          <div className="grid grid-cols-3 gap-4">
            <button onClick={() => onNavigate('ESTOQUE')} className="bg-amber-100 p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group">
              <Package className="w-8 h-8 text-amber-600 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Estoque</span>
            </button>
            <button onClick={() => onNavigate('ACTIVITY')} className="bg-cyan-100 p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group">
              <Activity className="w-8 h-8 text-cyan-600 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-black text-cyan-700 uppercase tracking-widest">Log</span>
            </button>
            <button onClick={() => onNavigate('CONFIG')} className="bg-indigo-100 p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group">
              <SettingsIcon className="w-8 h-8 text-indigo-600 group-hover:rotate-90 transition-transform" />
              <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Painel</span>
            </button>
          </div>
        )}
      </div>

      {/* MODAL MINHAS NOTAS (TELA CHEIA) */}
      {showMyNotesModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom-20 duration-300">
           <header className="p-6 pt-12 bg-white rounded-b-[2.5rem] shadow-2xl relative z-10 shrink-0">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-slate-900 text-white rounded-2xl">
                      <Receipt className="w-6 h-6" />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-slate-800">Minhas Notas</h2>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Seu Extrato Completo</p>
                   </div>
                </div>
                <button onClick={() => setShowMyNotesModal(false)} className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all">
                   <X className="w-6 h-6" />
                </button>
              </div>

              {/* ABAS DE NAVEGAÇÃO INTERNA */}
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                 <button 
                   onClick={() => setActiveNoteTab('PENDING')} 
                   className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeNoteTab === 'PENDING' ? 'bg-white shadow-md text-red-600' : 'text-slate-400'}`}
                 >
                   Em Aberto
                 </button>
                 <button 
                   onClick={() => setActiveNoteTab('HISTORY')} 
                   className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeNoteTab === 'HISTORY' ? 'bg-white shadow-md text-slate-800' : 'text-slate-400'}`}
                 >
                   Histórico
                 </button>
              </div>
           </header>

           <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-6">
              {/* TAB: EM ABERTO */}
              {activeNoteTab === 'PENDING' && (
                <>
                  {myDebts.length > 0 ? (
                    <>
                      <div className="bg-red-500 p-8 rounded-[3rem] text-white shadow-xl shadow-red-900/20 text-center">
                         <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">Total Pendente</p>
                         <p className="text-4xl font-black">{formatCurrency(totalDebt)}</p>
                      </div>

                      <div className="space-y-4">
                         {/* Agrupar por Data */}
                         {Object.entries(debtsByDate).map(([date, items]: [string, Transaction[]]) => (
                            <div key={date} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
                               <div className="flex items-center gap-2 mb-4 text-slate-400">
                                  <Calendar className="w-4 h-4" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">{date}</span>
                               </div>
                               <div className="space-y-4">
                                  {/* Agrupa itens por horário (Nota) */}
                                  {groupItemsByTime(items).map(group => {
                                       const noteTotal = calculateGroupTotal(group);
                                       const firstItem = group[0];
                                       const isMultiItem = group.length > 1;
                                       
                                       return (
                                         <div key={firstItem.id} className="w-full flex items-start gap-3 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                            <button 
                                               onClick={() => handleOpenNote(group)}
                                               className="flex-1 text-left flex justify-between items-start hover:bg-slate-50 transition-colors rounded-xl p-2 -my-2 active:scale-[0.98]"
                                            >
                                               <div>
                                                  {isMultiItem ? (
                                                    <p className="font-black uppercase text-slate-800 flex items-center gap-2">
                                                      Pedido com {group.length} itens
                                                    </p>
                                                  ) : (
                                                    <p className="font-black uppercase text-slate-800">{firstItem.item}</p>
                                                  )}
                                                  
                                                  <div className="flex flex-col gap-0.5 mt-1">
                                                     <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">{firstItem.customerName}</span>
                                                     {isMultiItem ? (
                                                       <span className="text-[8px] font-bold text-slate-500 uppercase flex flex-wrap gap-1">
                                                          {group.slice(0, 2).map(i => i.item).join(', ')} {group.length > 2 && '...'}
                                                       </span>
                                                     ) : (
                                                       firstItem.quantity && <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-black w-fit">Qtd: {firstItem.quantity}</span>
                                                     )}
                                                     <span className="text-[8px] font-black text-slate-300 flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {new Date(firstItem.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                                     </span>
                                                  </div>
                                               </div>
                                               <div className="flex items-center gap-2">
                                                  <p className="font-black text-red-600">{formatCurrency(noteTotal)}</p>
                                                  <Info className="w-4 h-4 text-slate-300" />
                                               </div>
                                            </button>
                                         </div>
                                       );
                                  })}
                               </div>
                            </div>
                         ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-20">
                       <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mb-6 border-2 border-white/10">
                          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                       </div>
                       <h3 className="text-xl font-black text-white mb-2">Nenhuma Pendência</h3>
                       <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Você não possui notas em aberto.</p>
                    </div>
                  )}
                </>
              )}

              {/* TAB: HISTÓRICO */}
              {activeNoteTab === 'HISTORY' && (
                <>
                  {myHistory.length > 0 ? (
                    <div className="space-y-4">
                       {/* Agrupar por Data */}
                       {Object.entries(historyByDate).map(([date, items]: [string, Transaction[]]) => (
                          <div key={date} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
                             <div className="flex items-center gap-2 mb-4 text-slate-400">
                                <Calendar className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{date}</span>
                             </div>
                             <div className="space-y-4">
                                {groupItemsByTime(items).map(group => {
                                     const noteTotal = calculateGroupTotal(group);
                                     const firstItem = group[0];
                                     const isMultiItem = group.length > 1;
                                     
                                     return (
                                       <div key={firstItem.id} className="w-full flex items-start gap-3 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                          <button 
                                             onClick={() => handleOpenNote(group)}
                                             className="flex-1 text-left flex justify-between items-start hover:bg-slate-50 transition-colors rounded-xl p-2 -my-2 active:scale-[0.98]"
                                          >
                                             <div>
                                                {isMultiItem ? (
                                                  <p className="font-black uppercase text-slate-700 flex items-center gap-2">
                                                    Pedido com {group.length} itens
                                                  </p>
                                                ) : (
                                                  <p className="font-black uppercase text-slate-700">{firstItem.item}</p>
                                                )}
                                                
                                                <div className="flex flex-col gap-0.5 mt-1">
                                                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                                                      <CheckCircle2 size={10} className="text-emerald-500" /> Pago / Finalizado
                                                   </span>
                                                   <span className="text-[8px] font-black text-slate-300 flex items-center gap-1">
                                                      <Clock size={10} />
                                                      {new Date(firstItem.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                                   </span>
                                                </div>
                                             </div>
                                             <div className="flex items-center gap-2">
                                                <p className="font-black text-slate-600">{formatCurrency(noteTotal)}</p>
                                             </div>
                                          </button>
                                          
                                          {/* Botão de Excluir do Histórico */}
                                          <button 
                                            onClick={(e) => handleDeleteHistoryItem(e, firstItem.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            title="Excluir do Histórico"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                       </div>
                                     );
                                })}
                             </div>
                          </div>
                       ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-20">
                       <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mb-6 border-2 border-white/10">
                          <History size={40} className="text-slate-500" />
                       </div>
                       <h3 className="text-xl font-black text-white mb-2">Histórico Vazio</h3>
                       <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Nenhuma movimentação anterior encontrada.</p>
                    </div>
                  )}
                </>
              )}
           </div>
        </div>
      )}

      {/* MODAL DETALHE DA NOTA (Recibo) */}
      {selectedNoteGroup && (
          <div className="fixed inset-0 z-[250] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-3xl overflow-hidden animate-in zoom-in-95">
                 <header className="bg-slate-50 p-6 flex justify-between items-center border-b border-slate-100">
                    <h3 className="font-black text-slate-800 text-lg uppercase">Detalhes da Nota</h3>
                    <button onClick={() => setSelectedNoteGroup(null)} className="p-2 bg-white text-slate-400 rounded-full hover:bg-slate-200 transition-all"><X size={20} /></button>
                 </header>
                 
                 <div className="p-8 space-y-6">
                    {loadingNote ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Buscando dados da empresa...</p>
                        </div>
                    ) : (
                        <>
                            <div className="text-center">
                                <div className="w-20 h-20 bg-slate-100 rounded-2xl mx-auto mb-4 flex items-center justify-center overflow-hidden shadow-inner border-2 border-white">
                                    {noteStore?.logoUrl ? (
                                        <img src={noteStore.logoUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <Store className="w-8 h-8 text-slate-300" />
                                    )}
                                </div>
                                <h2 className="text-xl font-black text-slate-800 uppercase leading-tight">{noteStore?.name || 'Empresa Parceira'}</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Origem do Lançamento</p>
                            </div>

                            <div className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Data</span>
                                    <span className="text-xs font-bold text-slate-700">{new Date(selectedNoteGroup[0].date).toLocaleDateString('pt-BR')} <span className="text-[10px] text-slate-400">{new Date(selectedNoteGroup[0].date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span></span>
                                </div>
                                
                                <div className="space-y-3 py-2">
                                   {selectedNoteGroup.map((item, idx) => (
                                      <div key={item.id} className="flex justify-between items-start text-xs">
                                         <div>
                                            <p className="font-bold text-slate-700 uppercase">{item.item}</p>
                                            {item.quantity && <span className="text-[8px] font-black text-slate-400">Qtd: {item.quantity}</span>}
                                         </div>
                                         <p className="font-bold text-slate-600">{formatCurrency(item.value)}</p>
                                      </div>
                                   ))}
                                </div>

                                <div className="h-px bg-slate-200 my-2" />
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Valor Total</span>
                                    <span className="text-xl font-black text-slate-800">{formatCurrency(calculateGroupTotal(selectedNoteGroup))}</span>
                                </div>
                            </div>

                            {noteStore && (
                                <div className="space-y-3">
                                    {noteStore.address && (
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <MapPin className="w-4 h-4 text-orange-500" />
                                            <p className="text-[10px] font-bold uppercase">{noteStore.address}</p>
                                        </div>
                                    )}
                                    {noteStore.whatsapp && (
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <Phone className="w-4 h-4 text-emerald-500" />
                                            <p className="text-[10px] font-bold uppercase">{noteStore.whatsapp}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                 </div>
              </div>
          </div>
      )}
    </div>
  );
};