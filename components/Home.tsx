
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useInterval } from '../hooks/useInterval';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { AppSection, Transaction, User, Ad, StoreProfile, SubscriptionPlan } from '../types';
import { useCustomers } from '../hooks/useCustomers';
import { useStoreProfiles } from '../hooks/useStoreProfiles';
import { normalizeString, normalizePhone, formatCurrency } from '../lib/utils';
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
  History,
  ShoppingCart,
  AlertTriangle,
  BarChart3,
  LayoutGrid,
  Plus,
  Check,
  Heart,
  Star,
  ChevronRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

import { SystemPromoBanner } from './SystemPromoBanner';
import { useStoreInteractions } from '../hooks/useStoreInteractions';

interface HomeProps {
  sections: AppSection[];
  archives: AppSection[];
  visibleSections: AppSection[]; 
  transactions: Transaction[];
  user: User;
  onNavigate: (tab: string) => void;
  ads: Ad[];
  incrementClick: (adId: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  plans: SubscriptionPlan[];
  stores: StoreProfile[];
  stalls?: AppSection[];
}

export const Home: React.FC<HomeProps> = ({ sections, archives, visibleSections, transactions, user, onNavigate, ads, incrementClick, deleteTransaction, plans, stores, stalls = [] }) => {
  const isOwner = user.role === 'OWNER';
  const isPro = !!user.hasProPlan;
  const isAdFree = !!user.isAdFree;
  const isAdvertiser = !!user.isAdvertiser;
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [showMyNotesModal, setShowMyNotesModal] = useState(false);
  const [activeNoteTab, setActiveNoteTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  
  const [confirmModal, setConfirmModal] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
  const [showQuickAccessModal, setShowQuickAccessModal] = useState(false);
  const [quickAccess, setQuickAccess] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`quick_access_v2_${user.id}`);
      if (saved) return JSON.parse(saved);
      
      // Default selection: first 2 sections + Marketplace
      const defaults = visibleSections.slice(0, 2).map(s => s.id);
      defaults.push('MARKETPLACE');
      return defaults;
    } catch {
      return ['MARKETPLACE'];
    }
  });

  const saveQuickAccess = (newItems: string[]) => {
    setQuickAccess(newItems);
    localStorage.setItem(`quick_access_v2_${user.id}`, JSON.stringify(newItems));
    setShowQuickAccessModal(false);
    toast.success("Painel inicial atualizado!");
  };

  const getBigButtonData = (id: string) => {
    if (id === 'MARKETPLACE') return { label: 'Marketplace', icon: ShoppingCart, color: 'bg-emerald-600 shadow-emerald-900/10', desc: 'Ver Vitrine Pública' };
    if (id === 'ESTOQUE') return { label: 'Estoque', icon: Package, color: 'bg-amber-500 shadow-amber-900/10', desc: 'Controle de Inventário' };
    if (id === 'ACTIVITY') return { label: 'Log', icon: Activity, color: 'bg-cyan-600 shadow-cyan-900/10', desc: 'Histórico de Atividades' };
    if (id === 'CONFIG') return { label: 'Painel', icon: SettingsIcon, color: 'bg-indigo-600 shadow-indigo-900/10', desc: 'Configurações' };
    
    const section = sections.find(s => s.id === id);
    if (section) {
      return { 
        label: section.name, 
        icon: section.type === 'FACTORY_STYLE' ? Factory : Store, 
        color: section.type === 'FACTORY_STYLE' ? 'bg-slate-900 shadow-slate-900/10' : 'bg-orange-500 shadow-orange-900/10',
        desc: 'Acessar Operação'
      };
    }
    return { label: 'Opção', icon: Info, color: 'bg-slate-800', desc: '' };
  };

  const availableOptions = useMemo(() => {
    const options = [
      { id: 'MARKETPLACE', label: 'Vitrine Online', icon: ShoppingCart },
    ];

    if (isOwner) {
      options.push(
        { id: 'ESTOQUE', label: 'Controle de Estoque', icon: Package },
        { id: 'ACTIVITY', label: 'Log de Atividades', icon: Activity },
        { id: 'CONFIG', label: 'Painel de Controle', icon: SettingsIcon }
      );
    }

    sections.forEach(s => {
      if (isOwner || (user.assignedSectionIds || []).includes(s.id)) {
        options.push({ id: s.id, label: s.name, icon: s.type === 'FACTORY_STYLE' ? Factory : Store });
      }
    });

    return options;
  }, [isOwner, sections, user.assignedSectionIds]);
  
  const { customers } = useCustomers(user.workspaceId);
  const { getMyProfile } = useStoreProfiles();
  const { getUserInteractions, getStoreAverageRating } = useStoreInteractions(user.id);

  const [userInteractions, setUserInteractions] = useState<{follows: string[], favorites: string[], ratings: any[]}>({follows: [], favorites: [], ratings: []});
  const [storeRatings, setStoreRatings] = useState<Record<string, {average: number, count: number}>>({});

  useEffect(() => {
    if (!isOwner) {
      getUserInteractions().then(data => setUserInteractions(data));
    }
  }, [isOwner, getUserInteractions]);

  useEffect(() => {
    if (!isOwner && stores.length > 0) {
      const fetchRatings = async () => {
        const newRatings: Record<string, {average: number, count: number}> = {};
        for (const store of stores) {
          if (store.active) {
            const rating = await getStoreAverageRating(store.workspaceId);
            newRatings[store.workspaceId] = rating;
          }
        }
        setStoreRatings(newRatings);
      };
      fetchRatings();
    }
  }, [isOwner, stores, getStoreAverageRating]);

  const [selectedNoteGroup, setSelectedNoteGroup] = useState<Transaction[] | null>(null);
  const [noteStore, setNoteStore] = useState<StoreProfile | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);

  const getStoreDisplayName = useCallback((store: StoreProfile) => {
      const isGeneric = !store.name || store.name === 'Minha Loja' || store.name === 'Loja sem Nome';
      
      if (isGeneric) {
          const stall = stalls?.find(s => s.workspaceId === store.workspaceId);
          if (stall && stall.name && stall.name !== 'Minha Barraca' && stall.name !== 'Minha Loja') {
              return stall.name;
          }
          return 'Loja Oficial';
      }
      return store.name;
  }, [stalls]);

  // Report State
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const [timeTick, setTimeTick] = useState(Date.now());

  useInterval(() => setTimeTick(Date.now()), 60000);

  const handleReport = async () => {
    if (!reportTarget || !reportReason.trim()) return;
    setIsReporting(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_workspace_id: reportTarget,
        reason: reportReason,
        status: 'PENDING'
      });
      if (error) throw error;
      toast.success("Denúncia enviada com sucesso. Nossa equipe analisará em breve.");
      setReportTarget(null);
      setReportReason('');
    } catch (e) {
      toast.error("Erro ao enviar denúncia.");
    } finally {
      setIsReporting(false);
    }
  };

  const handleOpenNote = async (group: Transaction[]) => {
    if (!group || group.length === 0) return;
    setSelectedNoteGroup(group);
    setLoadingNote(true);
    setNoteStore(null); 
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
    const now = timeTick; 

    return ads.filter(ad => {
      const isMyAd = ad.workspace_id === user.workspaceId;
      
      // Se não estiver ativo, não mostra para ninguém (nem para o dono)
      // O dono pode ver o status "Em Análise" na aba de Configurações
      if (!ad.active) return false;
      
      // Se estiver expirado, não mostra
      if (ad.expiresAt) {
        const expirationTime = new Date(ad.expiresAt).getTime();
        if (expirationTime <= now) return false;
      }

      // Se o usuário for Pro/AdFree, ele não vê anúncios de TERCEIROS.
      // Mas ele SEMPRE vê os próprios anúncios (se ativos).
      // Se o usuário for um Anunciante, ele vê TODOS os anúncios para monitorar a plataforma.
      if ((isAdFree || isPro) && !isMyAd && !isAdvertiser) return false;

      return true;
    });
  }, [ads, isAdFree, isPro, isAdvertiser, timeTick, user.id]);

  useEffect(() => {
    if (filteredAds.length > 1) {
      const interval = setInterval(() => {
        setCurrentAdIndex(prev => (prev + 1) % filteredAds.length);
      }, 7000);
      return () => clearInterval(interval);
    } else {
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

  const chartData = useMemo(() => {
    if (!isOwner) return [];
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const startOfDay = d.getTime();
      const endOfDay = startOfDay + 86400000;
      
      const dayTrans = transactions.filter(t => {
        const txTime = new Date(t.date).getTime();
        return txTime >= startOfDay && txTime < endOfDay && !t.isPending;
      });
      
      const sales = dayTrans.filter(t => t.subCategory !== 'GASTOS').reduce((acc, t) => acc + t.value, 0);
      const expenses = dayTrans.filter(t => t.subCategory === 'GASTOS').reduce((acc, t) => acc + t.value, 0);
      
      days.push({
        name: d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase(),
        Vendas: sales,
        Gastos: expenses
      });
    }
    return days;
  }, [transactions, isOwner]);

  const [selectedArchiveYear, setSelectedArchiveYear] = useState<string | null>(null);

  const archiveChartData = useMemo(() => {
    if (!isOwner || archives.length === 0) return null;
    
    const archive = selectedArchiveYear 
      ? archives.find(a => a.name.includes(selectedArchiveYear))
      : archives[0];
      
    if (!archive) return null;

    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    return archive.items.map((item, idx) => ({
      name: months[idx] || item.name,
      Vendas: item.defaultPriceAVista || 0,
      Gastos: item.defaultPriceAPrazo || 0
    }));
  }, [archives, isOwner, selectedArchiveYear]);

  const userAliases = useMemo(() => {
    const aliases = new Set<string>();
    const userName = normalizeString(user.name);
    if (userName) aliases.add(userName); 
    
    const parts = userName.split(' ');
    parts.forEach(part => {
      if (part.length >= 2) aliases.add(part); 
    });

    if (user.email) {
      const emailUser = normalizeString(user.email.split('@')[0]);
      if (emailUser.length >= 2) aliases.add(emailUser);
    }

    if (customers.length > 0) {
      const userPhone = normalizePhone(user.phone);
      
      customers.forEach(c => {
        const cPhone = normalizePhone(c.phone);
        if (userPhone && cPhone && (userPhone.includes(cPhone) || cPhone.includes(userPhone)) && cPhone.length >= 8) {
           const mappedName = normalizeString(c.name);
           aliases.add(mappedName);
        }
      });
    }
    
    return Array.from(aliases);
  }, [customers, user]);

  const filterMyTransactions = (list: Transaction[], requirePending: boolean) => {
    if (isOwner) return [];
    
    const userPhone = normalizePhone(user.phone);

    return list.filter(t => {
      if ((t.category || '').trim().toUpperCase() === 'SISTEMA') return false;
      
      // Filtrar por estado (pendente vs pago)
      if (requirePending) {
        if (!t.isPending) return false;
      } else {
        if (t.isPending) return false;
      }

      // 1. Sempre incluir se for marcado como externo (já buscado pelo telefone no hook)
      if (t.isExternal) return true;

      // 2. Sempre incluir se o telefone bater exatamente
      const txPhone = normalizePhone(t.customerPhone);
      if (userPhone && txPhone && userPhone === txPhone) return true;

      // 3. Forçar exibição via flag interna (Debug/Manual)
      if ((t as any).__forceShow) return true;

      // 4. Fallback por nome
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
  }, [transactions, userAliases, isOwner, user.phone]);

  const myHistory = useMemo(() => {
    return filterMyTransactions(transactions, false).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, userAliases, isOwner, user.phone]);

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

  const groupItemsByTime = (items: Transaction[]) => {
    const groups: Record<string, Transaction[]> = {};
    items.forEach(t => {
      const timeKey = t.date; 
      if (!groups[timeKey]) groups[timeKey] = [];
      groups[timeKey].push(t);
    });
    return Object.values(groups).sort((a, b) => new Date(b[0].date).getTime() - new Date(a[0].date).getTime());
  };

  const calculateGroupTotal = (items: Transaction[]) => items.reduce((acc, t) => acc + t.value, 0);

  const handleDeleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmModal({
      title: "Excluir Registro?",
      message: "Deseja excluir este item do histórico? A ação é irreversível.",
      onConfirm: async () => {
        await deleteTransaction(id);
        setConfirmModal(null);
      }
    });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-32">
      <div className="flex items-center justify-between px-2">
         <div className="space-y-1">
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dashboard</p>
           <h2 className="text-3xl font-black tracking-tight text-slate-800">
             Olá, <span className="text-orange-500">{user.name || 'Usuário'}!</span>
           </h2>
         </div>
         <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
           <Utensils className="w-6 h-6" />
         </div>
      </div>

      {isOwner && <SystemPromoBanner plans={plans} user={user} onNavigate={onNavigate} />}

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

      {/* FASE 3: ENGAGEMENT SECTIONS FOR CUSTOMERS */}
      {!isOwner && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
              {/* FAVORITE STORES */}
              {userInteractions.favorites.length > 0 && (
                  <div>
                      <div className="flex items-center justify-between mb-4 px-2">
                          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                              <Heart size={16} className="text-rose-500 fill-rose-500" /> Minhas Lojas
                          </h3>
                          <button onClick={() => onNavigate('MARKETPLACE')} className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Ver Todas</button>
                      </div>
                      <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar px-2">
                          {userInteractions.favorites.map(workspaceId => {
                              const store = stores.find(s => s.workspaceId === workspaceId);
                              if (!store || !store.active) return null;
                              return (
                                  <button 
                                      key={workspaceId}
                                      onClick={() => onNavigate('MARKETPLACE')} // Ideally we'd open the modal directly, but navigating to marketplace is a good start
                                      className="snap-start shrink-0 w-40 bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 text-left active:scale-95 transition-all"
                                  >
                                      <div className="w-16 h-16 bg-slate-100 rounded-2xl mb-3 overflow-hidden shadow-inner mx-auto">
                                          {store.logoUrl ? (
                                              <img src={store.logoUrl} className="w-full h-full object-cover" />
                                          ) : (
                                              <div className="w-full h-full flex items-center justify-center text-slate-300"><Store size={24} /></div>
                                          )}
                                      </div>
                                      <h4 className="font-black text-slate-800 text-sm truncate text-center">{getStoreDisplayName(store)}</h4>
                                      <div className="flex justify-center mt-1">
                                          {storeRatings[workspaceId] && storeRatings[workspaceId].count > 0 ? (
                                              <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-500">
                                                  <Star size={10} className="fill-amber-500" /> {storeRatings[workspaceId].average.toFixed(1)}
                                              </span>
                                          ) : (
                                              <span className="text-[9px] font-bold text-slate-400">Novo</span>
                                          )}
                                      </div>
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              )}

              {/* SUGGESTED STORES (Top Rated) */}
              <div>
                  <div className="flex items-center gap-2 mb-4 px-2">
                      <Sparkles size={16} className="text-amber-500" />
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Sugeridas para Você</h3>
                  </div>
                  <div className="space-y-3 px-2">
                      {stores
                          .filter(s => s.active && !userInteractions.favorites.includes(s.workspaceId))
                          .sort((a, b) => {
                              const ratingA = storeRatings[a.workspaceId]?.average || 0;
                              const ratingB = storeRatings[b.workspaceId]?.average || 0;
                              return ratingB - ratingA;
                          })
                          .slice(0, 3)
                          .map(store => (
                              <button 
                                  key={store.id}
                                  onClick={() => onNavigate('MARKETPLACE')}
                                  className="w-full bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4 text-left active:scale-95 transition-all"
                              >
                                  <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                                      {store.logoUrl ? (
                                          <img src={store.logoUrl} className="w-full h-full object-cover" />
                                      ) : (
                                          <div className="w-full h-full flex items-center justify-center text-slate-300"><Store size={20} /></div>
                                      )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <h4 className="font-black text-slate-800 text-sm truncate">{getStoreDisplayName(store)}</h4>
                                      <p className="text-[10px] font-bold text-slate-400 truncate">{store.address || 'Loja Física'}</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                      {storeRatings[store.workspaceId] && storeRatings[store.workspaceId].count > 0 && (
                                          <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                                              <Star size={10} className="fill-amber-500" /> {storeRatings[store.workspaceId].average.toFixed(1)}
                                          </span>
                                      )}
                                      <div className="p-2 bg-slate-50 text-slate-400 rounded-xl">
                                          <ChevronRight size={14} />
                                      </div>
                                  </div>
                              </button>
                          ))
                      }
                      {stores.filter(s => s.active && !userInteractions.favorites.includes(s.workspaceId)).length === 0 && (
                          <div className="text-center py-8 bg-slate-50 rounded-[2rem] border border-slate-100 border-dashed">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma sugestão no momento</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {isOwner && (
        <div className="space-y-4">
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
          
          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Vendas vs Gastos (7 Dias)</h3>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} tickFormatter={(value) => `R$${value}`} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 800, paddingTop: '10px' }} />
                  <Bar dataKey="Vendas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Gastos" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {archiveChartData && (
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-500" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Resumo Anual Arquivado</h3>
                </div>
                {archives.length > 1 && (
                  <select 
                    value={selectedArchiveYear || ''} 
                    onChange={(e) => setSelectedArchiveYear(e.target.value)}
                    className="bg-slate-50 border-none text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-2 outline-none"
                  >
                    {archives.map(a => {
                      const year = a.name.replace('Resumo ', '');
                      return <option key={a.id} value={year}>{year}</option>;
                    })}
                  </select>
                )}
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={archiveChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} tickFormatter={(value) => `R$${value}`} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 800, paddingTop: '10px' }} />
                    <Bar dataKey="Vendas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Gastos" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[9px] text-slate-400 text-center mt-6 font-bold uppercase tracking-widest">
                Dados consolidados para comparação anual
              </p>
            </div>
          )}
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
                            
                            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 w-full">
                              <div className="flex items-center gap-1.5">
                                <div className="bg-white/20 p-1 rounded-md">
                                  <Store className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-[9px] font-black text-white uppercase tracking-widest">{ad.ownerName}</span>
                              </div>
                              {!isMyAd && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReportTarget(ad.workspaceId);
                                  }}
                                  className="px-3 py-1.5 bg-rose-500/20 text-rose-300 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-rose-500/40 transition-colors flex items-center gap-1"
                                >
                                  <AlertTriangle size={10} /> Denunciar
                                </button>
                              )}
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
        <div className="flex items-center justify-between px-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            {quickAccess.length > 0 ? 'Acesso Rápido' : 'Personalize seu Início'}
          </h4>
          <button 
            onClick={() => setShowQuickAccessModal(true)}
            className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90"
            title="Personalizar Painel"
          >
            <LayoutGrid size={14} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {quickAccess.map(id => {
            const data = getBigButtonData(id);
            const Icon = data.icon;
            return (
              <button 
                key={id} 
                onClick={() => onNavigate(id)} 
                className={`group p-8 rounded-[3rem] shadow-xl transition-all text-left relative overflow-hidden active:scale-95 border-0 ${data.color} text-white`}
              >
                <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Icon size={120} />
                </div>
                <h3 className="text-2xl font-black mb-1">{data.label}</h3>
                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest flex items-center gap-2">
                  {data.desc} <ArrowUpRight className="w-4 h-4" />
                </p>
              </button>
            );
          })}
          
          {quickAccess.length === 0 && (
            <button 
              onClick={() => setShowQuickAccessModal(true)}
              className="p-8 rounded-[3rem] border-4 border-dashed border-slate-200 text-slate-400 flex flex-col items-center justify-center gap-4 hover:border-indigo-300 hover:text-indigo-500 transition-all"
            >
              <Plus size={40} />
              <span className="text-xs font-black uppercase tracking-widest">Adicionar Atalhos</span>
            </button>
          )}
        </div>
      </div>

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
              {activeNoteTab === 'PENDING' && (
                <>
                  {myDebts.length > 0 ? (
                    <>
                      <div className="bg-red-500 p-8 rounded-[3rem] text-white shadow-xl shadow-red-900/20 text-center">
                         <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">Total Pendente</p>
                         <p className="text-4xl font-black">{formatCurrency(totalDebt)}</p>
                      </div>

                      <div className="space-y-4">
                         {Object.entries(debtsByDate).map(([date, items]: [string, Transaction[]]) => (
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
                                       const isExt = group.some(i => i.isExternal);
                                       
                                       return (
                                         <div key={firstItem.id} className="w-full flex items-start gap-3 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                            <button 
                                               onClick={() => handleOpenNote(group)}
                                               className="flex-1 text-left flex justify-between items-start hover:bg-slate-50 transition-colors rounded-xl p-2 -my-2 active:scale-[0.98]"
                                            >
                                               <div>
                                                  <div className="flex items-center gap-2">
                                                     <p className="font-black uppercase text-slate-800">
                                                        {isMultiItem ? `Pedido com ${group.length} itens` : firstItem.item}
                                                     </p>
                                                     {isExt && (
                                                         <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${firstItem.subCategory === 'GASTOS' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                            {firstItem.subCategory === 'GASTOS' ? 'A Receber' : 'A Pagar'}
                                                         </span>
                                                      )}
                                                  </div>
                                                  
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
                                                  <p className={`font-black ${firstItem.subCategory === 'GASTOS' && isExt ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(noteTotal)}</p>
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

              {activeNoteTab === 'HISTORY' && (
                <>
                  {myHistory.length > 0 ? (
                    <div className="space-y-4">
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

      {confirmModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl text-center border-4 border-rose-100">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse"><AlertTriangle className="w-10 h-10 text-rose-600" /></div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">{confirmModal.title}</h3>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">{confirmModal.message}</p>
              <div className="flex gap-3">
                 <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-colors">Cancelar</button>
                 <button onClick={confirmModal.onConfirm} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-900/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">Confirmar</button>
              </div>
           </div>
        </div>
      )}

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
      {/* MODAL DE DENÚNCIA */}
      {reportTarget && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl text-center border-4 border-rose-100">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2"><AlertTriangle className="text-rose-500" /> Denunciar</h3>
                 <button onClick={() => setReportTarget(null)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200"><X size={20} /></button>
              </div>
              <p className="text-sm text-slate-500 font-medium mb-6 text-left">
                 Por que você está denunciando este anúncio/empresa?
              </p>
              <textarea 
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Ex: Golpe, conteúdo impróprio, loja falsa..."
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:border-rose-400 min-h-[100px] text-sm mb-6 resize-none"
              />
              <button 
                onClick={handleReport}
                disabled={isReporting || !reportReason.trim()}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isReporting ? <span className="animate-spin">⏳</span> : 'Enviar Denúncia'}
              </button>
           </div>
        </div>
      )}

      {/* MODAL CONFIGURAÇÃO ACESSO RÁPIDO */}
      {showQuickAccessModal && (
        <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-3xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[80vh]">
            <header className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Personalizar Painel</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Escolha até 4 atalhos principais</p>
              </div>
              <button onClick={() => setShowQuickAccessModal(false)} className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all">
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                {availableOptions.map(option => {
                  const isSelected = quickAccess.includes(option.id);
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        if (isSelected) {
                          setQuickAccess(prev => prev.filter(id => id !== option.id));
                        } else if (quickAccess.length < 4) {
                          setQuickAccess(prev => [...prev, option.id]);
                        } else {
                          toast.error("Você já escolheu 4 itens. Remova um para adicionar outro.");
                        }
                      }}
                      className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center gap-3 group ${
                        isSelected 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                        : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                        <Icon size={18} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-tight flex-1">{option.label}</span>
                      {isSelected ? <Check size={14} className="text-indigo-600" /> : <Plus size={14} className="text-slate-300" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <footer className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowQuickAccessModal(false)}
                  className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => saveQuickAccess(quickAccess)}
                  disabled={quickAccess.length === 0}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
                >
                  Salvar Alterações
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
};
