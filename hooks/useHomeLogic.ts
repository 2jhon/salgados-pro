
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { AppSection, Transaction, User, Ad, StoreProfile, SubscriptionPlan } from '../types';
import { useCustomers } from './useCustomers';
import { useStoreProfiles } from './useStoreProfiles';
import { useStoreInteractions } from './useStoreInteractions';
import { normalizeString, normalizePhone } from '../lib/utils';

interface UseHomeLogicProps {
  user: User;
  sections: AppSection[];
  transactions: Transaction[];
  stores: StoreProfile[];
  visibleSections: AppSection[];
  deleteTransaction: (id: string) => Promise<void>;
  stalls?: AppSection[];
  hasMoreTransactions: boolean;
  fetchNextTransactions: () => Promise<void>;
  loadingTransactions: boolean;
}

export const useHomeLogic = ({
  user,
  sections,
  transactions,
  stores,
  visibleSections,
  deleteTransaction,
  stalls = [],
  hasMoreTransactions,
  fetchNextTransactions,
  loadingTransactions
}: UseHomeLogicProps) => {
  const isOwner = user.role === 'OWNER';
  
  const [showMyNotesModal, setShowMyNotesModal] = useState(false);
  const [activeNoteTab, setActiveNoteTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [selectedNoteGroup, setSelectedNoteGroup] = useState<Transaction[] | null>(null);
  const [noteStore, setNoteStore] = useState<StoreProfile | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
  const [showQuickAccessModal, setShowQuickAccessModal] = useState(false);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(20);
  
  const [quickAccess, setQuickAccess] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`quick_access_v2_${user.id}`);
      if (saved) return JSON.parse(saved);
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
      toast.success("Denúncia enviada com sucesso.");
      setReportTarget(null);
      setReportReason('');
    } catch (e) {
      toast.error("Erro ao enviar denúncia.");
    } finally {
      setIsReporting(false);
    }
  };

  const userAliases = useMemo(() => {
    const aliases = new Set<string>();
    const userName = normalizeString(user.name);
    if (userName) aliases.add(userName); 
    const parts = userName.split(' ');
    parts.forEach(part => { if (part.length >= 2) aliases.add(part); });
    if (user.email) {
      const emailUser = normalizeString(user.email.split('@')[0]);
      if (emailUser.length >= 2) aliases.add(emailUser);
    }
    if (customers.length > 0) {
      const userPhone = normalizePhone(user.phone);
      customers.forEach(c => {
        const cPhone = normalizePhone(c.phone);
        if (userPhone && cPhone && (userPhone.includes(cPhone) || cPhone.includes(userPhone)) && cPhone.length >= 8) {
           aliases.add(normalizeString(c.name));
        }
      });
    }
    return Array.from(aliases);
  }, [customers, user]);

  const filterMyTransactions = useCallback((list: Transaction[], requirePending: boolean) => {
    if (isOwner) return [];
    const userPhone = normalizePhone(user.phone);
    return list.filter(t => {
      if ((t.category || '').trim().toUpperCase() === 'SISTEMA') return false;
      if (requirePending ? !t.isPending : t.isPending) return false;
      if (t.isExternal) return true;
      const txPhone = normalizePhone(t.customerPhone);
      if (userPhone && txPhone && userPhone === txPhone) return true;
      if ((t as any).__forceShow) return true;
      if (!t.customerName) return false;
      const txName = normalizeString(t.customerName);
      if (userAliases.includes(txName)) return true;
      return userAliases.some(alias => alias.length >= 2 && (txName.includes(alias) || alias.includes(txName)));
    });
  }, [isOwner, user.phone, userAliases]);

  const myDebts = useMemo(() => filterMyTransactions(transactions, true), [transactions, filterMyTransactions]);
  const myHistory = useMemo(() => filterMyTransactions(transactions, false).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [transactions, filterMyTransactions]);
  const totalDebt = useMemo(() => myDebts.reduce((acc, t) => acc + t.value, 0), [myDebts]);

  const groupTransactionsByDate = useCallback((list: Transaction[]) => {
    return list.reduce((groups, t) => {
      const date = new Date(t.date).toLocaleDateString('pt-BR');
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
      return groups;
    }, {} as Record<string, Transaction[]>);
  }, []);

  const debtsByDate = useMemo(() => groupTransactionsByDate(myDebts), [myDebts, groupTransactionsByDate]);
  const historyByDate = useMemo(() => groupTransactionsByDate(myHistory.slice(0, visibleHistoryCount)), [myHistory, visibleHistoryCount, groupTransactionsByDate]);

  const groupItemsByTime = useCallback((list: Transaction[]) => {
    const groups: Record<string, Transaction[]> = {};
    list.forEach(t => {
      const time = new Date(t.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
      const key = `${time}_${t.workspaceId}_${t.customerPhone || ''}`; 
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return Object.values(groups);
  }, []);

  const calculateGroupTotal = useCallback((group: Transaction[]) => group.reduce((acc, t) => acc + t.value, 0), []);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreHistoryRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        // Incrementa a contagem visível local
        setVisibleHistoryCount(prev => prev + 20);
        
        // Se chegamos perto do fim do que temos localmente e há mais no servidor, buscamos mais
        if (hasMoreTransactions && !loadingTransactions) {
           fetchNextTransactions();
        }
      }
    });
    if (node) observerRef.current.observe(node);
  }, [hasMoreTransactions, fetchNextTransactions, loadingTransactions]);

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmModal({
      title: "Excluir Registro",
      message: "Deseja remover este registro do seu histórico? Isso não alterará o saldo da loja.",
      onConfirm: async () => {
        await deleteTransaction(id);
        setConfirmModal(null);
        toast.success("Registro removido");
      }
    });
  };

  const getStoreDisplayName = useCallback((store: StoreProfile) => {
      if (!store.name || store.name === 'Minha Loja' || store.name === 'Loja sem Nome') {
          const stall = stalls.find(s => s.workspaceId === store.workspaceId);
          return (stall && stall.name && stall.name !== 'Minha Barraca' && stall.name !== 'Minha Loja') ? stall.name : 'Loja Oficial';
      }
      return store.name;
  }, [stalls]);

  const handlePayNote = async (group: Transaction[]) => {
    if (!group || group.length === 0 || !navigator.onLine) return;
    const total = calculateGroupTotal(group);
    const workspaceId = group[0].workspaceId;

    const loadingToast = toast.loading("Gerando link de pagamento Pix...");

    try {
      const response = await fetch('/api/mercadopago/create-note-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: group.map(t => t.id),
          workspace_id: workspaceId,
          amount: total,
          description: group.length > 1 ? `Pedido de ${group.length} itens` : group[0].item,
          returnUrl: window.location.origin
        })
      });

      const data = await response.json();
      toast.dismiss(loadingToast);

      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error(data.error || "Erro ao gerar checkout");
      }
    } catch (e: any) {
      toast.dismiss(loadingToast);
      console.error("[PayNote] Erro:", e);
      toast.error(e.message || "Falha ao iniciar pagamento.");
    }
  };

  const availableOptions = useMemo(() => {
    const options = [{ id: 'MARKETPLACE', label: 'Vitrine Online', icon: 'ShoppingCart' }]; // Icons handled in component
    if (isOwner) {
      options.push(
        { id: 'ESTOQUE', label: 'Controle de Estoque', icon: 'Package' },
        { id: 'ACTIVITY', label: 'Log de Atividades', icon: 'Activity' },
        { id: 'CONFIG', label: 'Painel de Controle', icon: 'SettingsIcon' }
      );
    }
    sections.forEach(s => {
      if (isOwner || (user.assignedSectionIds || []).includes(s.id)) {
        options.push({ id: s.id, label: s.name, icon: s.type === 'FACTORY_STYLE' ? 'Factory' : 'Store' });
      }
    });
    return options;
  }, [isOwner, sections, user.assignedSectionIds]);

  return {
    isOwner,
    showMyNotesModal, setShowMyNotesModal,
    activeNoteTab, setActiveNoteTab,
    selectedNoteGroup, setSelectedNoteGroup,
    noteStore, loadingNote,
    reportTarget, setReportTarget,
    reportReason, setReportReason,
    isReporting,
    confirmModal, setConfirmModal,
    showQuickAccessModal, setShowQuickAccessModal,
    quickAccess, setQuickAccess,
    saveQuickAccess,
    userInteractions, storeRatings,
    myDebts, myHistory, totalDebt,
    debtsByDate, historyByDate,
    handleOpenNote, handleReport,
    handleDeleteHistoryItem, handlePayNote,
    loadMoreHistoryRef, groupItemsByTime, calculateGroupTotal,
    getStoreDisplayName, availableOptions, visibleHistoryCount
  };
};
