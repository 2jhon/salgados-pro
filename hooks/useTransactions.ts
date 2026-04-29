
import { useState, useCallback, useRef, useEffect } from 'react';
import localforage from 'localforage';
import { Transaction, PeriodTotals, AppSection, Note } from '../types';
import { supabase, withRetry, withTimeout, safeStringifyError, isNetworkError } from '../lib/supabase';
import { normalizePhone, normalizeString, roundMoney, Z_INDEX, playSoundFromCategory } from '../lib/utils';

let lastTxFetchTime: Record<string, number> = {};
const TX_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export const useTransactions = (
  workspaceId: string | undefined, 
  user: { role?: string, phone?: string } | null,
  sections: AppSection[], 
  saveConfig: (s: AppSection[]) => Promise<boolean>,
  addNote?: (note: Omit<Note, 'id' | 'createdAt' | 'isRead'>) => Promise<boolean>
) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Load initial cache asynchronously
  useEffect(() => {
    const loadCache = async () => {
      if (workspaceId) {
        try {
          const cached: any = await localforage.getItem(`cached_tx_${String(workspaceId).trim().toLowerCase()}`);
          if (cached) {
            setTransactions(prev => prev.length === 0 ? cached : prev);
          }
        } catch (e) {
          console.warn('Failed to load cached transactions:', e);
        }
      }
    };
    loadCache();
  }, [workspaceId]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastAutoArchiveCheck, setLastAutoArchiveCheck] = useState<number | null>(null);
  const isFetchingRef = useRef(false);



  // Offline Sync Queue
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [workspaceId]);

  const nexusReport = useCallback((msg: string, status: 'START' | 'DONE' | 'FAIL', type: 'PROCESS' | 'NETWORK' = 'PROCESS', taskId?: string, data?: any) => {
    if ((window as any).Nexus) (window as any).Nexus.report(msg, status, type, taskId, data);
  }, []);

  const addToOfflineQueue = useCallback(async (action: any) => {
    const newAction = {
      ...action,
      _queueId: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    const currentQueue: any[] = (await localforage.getItem(`offline_actions_${workspaceId}`)) || [];
    await localforage.setItem(`offline_actions_${workspaceId}`, [...currentQueue, newAction]);
  }, [workspaceId]);

  const mapTransaction = useCallback((t: any): Transaction => {
    const safeWorkspaceId = String(t.workspace_id || '').trim().toLowerCase();
    const realDate = t.date || t.created_at || new Date().toISOString();
    
    return {
      id: String(t.id),
      workspaceId: safeWorkspaceId,
      date: realDate,
      category: String(t.category || '').trim(),
      subCategory: String(t.sub_category || '').trim().toUpperCase(),
      item: String(t.item || '').trim(),
      value: Number(t.value || 0),
      quantity: t.quantity !== undefined ? Number(t.quantity) : undefined,
      paymentMethod: String(t.payment_method || '').trim(),
      customerName: t.customer_name ? String(t.customer_name).trim() : undefined,
      customerPhone: t.customer_phone ? String(t.customer_phone).trim() : undefined,
      isPending: t.is_pending === true || t.is_pending === 1 || String(t.is_pending) === 'true',
      createdBy: String(t.created_by || '').trim(),
      initialStock: t.initial_stock,
      leftoverStock: t.leftover_stock,
      unitPrice: t.unit_price,
      isExternal: !!t.is_external,
      ...((t as any).__forceShow ? { __forceShow: true } : {}) 
    };
  }, []);

  const fetchTransactionsByWorkspace = useCallback(async (wid: string, force = false, pageNum = 0, limit = 15) => {
    if (!wid || (isFetchingRef.current && !force)) return;
    
    const cleanWid = String(wid).trim().toLowerCase();
    
    const now = Date.now();
    // Paginação: Se for a página 0 e não for force, checar TTL
    if (pageNum === 0 && !force && transactions.length > 0 && lastTxFetchTime[cleanWid] && (now - lastTxFetchTime[cleanWid] < TX_CACHE_TTL)) {
      return;
    }

    isFetchingRef.current = true;
    if (pageNum === 0) setLoading(true);
    
    const from = pageNum * limit;
    const to = from + limit - 1;

    try {
      const result = await withRetry(async () => {
        // Busca transações do workspace com range para paginação (ou por telefone se cliente)
        let historyQuery = supabase.from('transactions').select('*').order('date', { ascending: false }).range(from, to);
        let pendingQuery = pageNum === 0 ? supabase.from('transactions').select('*').eq('is_pending', true) : null;
        
        if (user?.role === 'CUSTOMER' && user?.phone) {
           const cleanedPhone = normalizePhone(user.phone);
           historyQuery = historyQuery.eq('customer_phone', cleanedPhone);
           if (pendingQuery) pendingQuery = pendingQuery.eq('customer_phone', cleanedPhone);
        } else {
           historyQuery = historyQuery.eq('workspace_id', cleanWid);
           if (pendingQuery) pendingQuery = pendingQuery.eq('workspace_id', cleanWid);
        }

        const historyPromise = historyQuery;
        const pendingPromise = pendingQuery || Promise.resolve({ data: [], error: null });

        const [historyRes, pendingRes] = await Promise.all([historyPromise, pendingPromise]);

        if (historyRes.error) throw historyRes.error;
        if (pendingRes.error) throw pendingRes.error;

        const combined = [...(historyRes.data || []), ...(pendingRes.data || [])];
        
        // Remove duplicatas 
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        
        return { data: unique, length: historyRes.data?.length || 0 };
      });
      
      if (result) {
        if (pageNum === 0) lastTxFetchTime[cleanWid] = Date.now();
        const mapped = result.data.map(mapTransaction);
        
        setHasMore(result.length === limit);
        setPage(pageNum);

        setTransactions(prev => {
          if (pageNum === 0) {
            // No primeiro load, preservamos as externas (que vem de outro lugar) e as novas
            const externalOnes = prev.filter(t => t.isExternal);
            const combined = [...externalOnes, ...mapped];
            const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
            const sorted = unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            localforage.setItem(`cached_tx_${cleanWid}`, sorted.slice(0, 500)).catch(e => {
              console.warn('Failed to cache transactions:', e);
            });
            return sorted;
          } else {
            // Paginação: anexa
            const combined = [...prev, ...mapped];
            const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
            return unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          }
        });
      }
    } catch (e: any) {
      console.error("Erro Fetch Transactions:", e);
      if (pageNum === 0) {
        try {
          const cached: any = await localforage.getItem(`cached_tx_${cleanWid}`);
          if (cached && Array.isArray(cached)) {
            setTransactions(cached);
          }
        } catch (err) {}
      }
    } finally {
      if (pageNum === 0) setLoading(false);
      isFetchingRef.current = false;
    }
  }, [mapTransaction, transactions.length]);

  const fetchNextTransactions = useCallback(async () => {
    if (!workspaceId || loading || !hasMore) return;
    await fetchTransactionsByWorkspace(workspaceId, false, page + 1);
  }, [workspaceId, loading, hasMore, page, fetchTransactionsByWorkspace]);

  const addTransactions = useCallback(async (ts: Omit<Transaction, 'id' | 'date'>[], isSyncing = false) => {
    if (ts.length === 0) return null;

    // Offline Handling
    if (!navigator.onLine && !isSyncing) {
      playSoundFromCategory('SALES');
      const offlineTx = ts.map(t => ({
        ...t,
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: new Date().toISOString(),
        isOffline: true
      }));

      await addToOfflineQueue({ type: 'ADD', payload: ts });

      // Atualiza UI instantaneamente
      setTransactions(prev => [...offlineTx as any, ...prev]);
      nexusReport("Lançamento salvo localmente (Offline).", 'DONE', 'PROCESS');
      return offlineTx as any;
    }

    const taskId = `ADD_TX_${Date.now()}`;
    nexusReport(`Salvando ${ts.length} lançamentos...`, 'START', 'NETWORK', taskId);

    const generatePayload = (includePhone = true) => ts.map(t => {
      const p: any = {
        workspace_id: String(t.workspaceId).trim().toLowerCase(),
        category: String(t.category || '').trim(),
        sub_category: String(t.subCategory).toUpperCase(),
        item: t.item,
        value: roundMoney(t.value || 0),
        quantity: t.quantity,
        payment_method: t.paymentMethod,
        customer_name: t.customerName ? t.customerName.trim() : null,
        is_pending: !!t.isPending,
        created_by: t.createdBy,
        unit_price: t.unitPrice
      };
      if (includePhone) {
        // Padronização: Salva apenas os números
        p.customer_phone = t.customerPhone ? t.customerPhone.replace(/\D/g, '') : null;
      }
      return p;
    });

    try {
      let result = await withTimeout(
        withRetry(async () => {
          const res = await supabase.from('transactions').insert(generatePayload(true)).select();
          return res;
        }),
        20000
      ) as any;
      
      if (result.error) {
        const errorMsg = String(result.error.message || '').toLowerCase();
        if (result.error.code === '42703' || errorMsg.includes('customer_phone')) {
           result = await withTimeout(
             withRetry(async () => {
               const res = await supabase.from('transactions').insert(generatePayload(false)).select();
               return res;
             }),
             20000
           ) as any;
        }
      }

      if (result.error) throw result.error;

      if (result.data) {
        const created = result.data.map(mapTransaction);
        
        // Só toca o som se não for sincronização offline silenciosa
        if (!isSyncing) {
            playSoundFromCategory('SALES');
        }
        
        // High Value Sale Notification
        if (addNote) {
          created.forEach(t => {
            if (t.value >= 300 && t.category === 'venda') {
              addNote({
                workspaceId: t.workspaceId,
                createdById: 'system',
                createdByName: 'Sistema',
                content: `Venda de alto valor registrada: R$ ${t.value.toFixed(2)} por ${t.createdBy}`,
                type: 'HIGH_SALE',
                amount: t.value
              });
            }
          });
        }

        setTransactions(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newUnique = created.filter((t: any) => !existingIds.has(t.id));
          return [...newUnique, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
        nexusReport("Registros salvos.", 'DONE', 'NETWORK', taskId);
        return created;
      }
    } catch (e: any) {
      if (!isSyncing && (isNetworkError(e) || !navigator.onLine)) {
        const offlineTx = ts.map(t => ({
          ...t,
          id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toISOString(),
          isOffline: true
        }));
        await addToOfflineQueue({ type: 'ADD', payload: ts });
        setTransactions(prev => [...offlineTx as any, ...prev]);
        nexusReport("Lançamento salvo localmente (Offline).", 'DONE', 'PROCESS');
        return offlineTx as any;
      }
      const msg = safeStringifyError(e);
      nexusReport(`Falha ao salvar: ${msg}`, 'FAIL', 'NETWORK', taskId);
      throw e;
    }
    return null;
  }, [addToOfflineQueue, mapTransaction, addNote, nexusReport]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>, isSyncing = false) => {
    if (!navigator.onLine && !isSyncing) {
      await addToOfflineQueue({ type: 'UPDATE', payload: { id, updates } });
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates, isOffline: true } : t));
      return;
    }
    try {
      const dbId = Number(id) || id;
      const payload: any = {};
      if (updates.item !== undefined) payload.item = updates.item;
      if (updates.value !== undefined) payload.value = updates.value;
      if (updates.isPending !== undefined) payload.is_pending = updates.isPending;
      if (updates.quantity !== undefined) payload.quantity = updates.quantity;
      
      const { error } = await supabase.from('transactions').update(payload).eq('id', dbId);
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch (e: any) {
      if (!isSyncing && (isNetworkError(e) || !navigator.onLine)) {
        await addToOfflineQueue({ type: 'UPDATE', payload: { id, updates } });
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates, isOffline: true } : t));
        return;
      }
      throw e; 
    }
  }, [addToOfflineQueue]);

  const deleteTransaction = useCallback(async (id: string, userName?: string, isSyncing = false) => {
    if (!workspaceId) return;
    
    // OPTIMISTIC UPDATE
    const dbId = Number(id) || id;
    const txToDelete = transactions.find(t => t.id === id);
    setTransactions(prev => prev.filter(t => t.id !== id));

    if (!navigator.onLine && !isSyncing) {
      await addToOfflineQueue({ type: 'DELETE', payload: { id, userName } });
      return;
    }

    try { 
      const { error } = await supabase.from('transactions').delete().eq('id', dbId);
      if (error) throw error;

      // Audit Log
      if (addNote && txToDelete) {
        addNote({
          workspaceId: String(workspaceId),
          createdById: 'system',
          createdByName: 'Auditoria',
          content: `Transação excluída por ${userName || 'Usuário'}: ${txToDelete.item} (R$ ${txToDelete.value.toFixed(2)})`,
          type: 'LOG'
        });
      }
    } catch (e: any) {
      if (!isSyncing && (isNetworkError(e) || !navigator.onLine)) {
        await addToOfflineQueue({ type: 'DELETE', payload: { id, userName } });
        return;
      }
      if (workspaceId) fetchTransactionsByWorkspace(workspaceId, true);
      throw e;
    }
  }, [addToOfflineQueue, workspaceId, transactions, addNote, fetchTransactionsByWorkspace]);

  const settleCustomerDebt = useCallback(async (customerName: string, transactionIds: string[], isSyncing = false) => {
    if (transactionIds.length === 0) return;

    // OPTIMISTIC UPDATE
    const txsToSettle = transactions.filter(t => transactionIds.includes(t.id));
    const totalPaid = txsToSettle.reduce((sum, t) => sum + t.value, 0);

    setTransactions(prev => prev.map(t => 
      transactionIds.includes(t.id) ? { ...t, isPending: false } : t
    ));

    if (!navigator.onLine && !isSyncing) {
      await addToOfflineQueue({ type: 'SETTLE_DEBT', payload: { customerName, transactionIds } });
      return;
    }

    try {
      const dbIds = transactionIds.map(id => isNaN(Number(id)) ? id : Number(id));
      
      // 1. Update old transactions to not pending
      const { error } = await supabase.from('transactions').update({ is_pending: false }).in('id', dbIds);
      if (error) throw error;

      // 2. Create a new transaction for the payment today
      if (totalPaid > 0 && txsToSettle.length > 0) {
        const firstTx = txsToSettle[0];
        const paymentPayload = {
          workspace_id: String(firstTx.workspaceId).trim().toLowerCase(),
          category: firstTx.category, // Usually the section name
          sub_category: 'VENDAS', // It's an income
          item: `Pagamento de Fiado (${txsToSettle.length} itens)`,
          value: totalPaid,
          quantity: 1,
          payment_method: 'A_VISTA',
          customer_name: customerName,
          is_pending: false,
          created_by: firstTx.createdBy
        };
        await supabase.from('transactions').insert([paymentPayload]);
      }

      if (workspaceId) fetchTransactionsByWorkspace(workspaceId, true);
    } catch (e: any) {
      if (!isSyncing && (isNetworkError(e) || !navigator.onLine)) {
        await addToOfflineQueue({ type: 'SETTLE_DEBT', payload: { customerName, transactionIds } });
        return;
      }
      // Revert if error
      if (workspaceId) fetchTransactionsByWorkspace(workspaceId, true);
      throw e; 
    }
  }, [addToOfflineQueue, transactions, workspaceId, fetchTransactionsByWorkspace]);

  const partialSettleTransaction = useCallback(async (originalTx: Transaction, amountPaid: number, targetSubCategory?: string, isSyncing = false) => {
    if (amountPaid <= 0 || amountPaid >= originalTx.value) return false;
    
    // OPTIMISTIC UPDATE
    const remainingDebt = roundMoney(originalTx.value - amountPaid);
    setTransactions(prev => prev.map(t => t.id === originalTx.id ? { ...t, value: remainingDebt } : t));

    if (!navigator.onLine && !isSyncing) {
      await addToOfflineQueue({ type: 'PARTIAL_SETTLE', payload: { originalTx, amountPaid, targetSubCategory } });
      return true;
    }

    const dbId = Number(originalTx.id) || originalTx.id;
    try {
      // 1. Update the old transaction to the remaining debt
      const { error: upErr } = await supabase.from('transactions').update({ value: remainingDebt }).eq('id', dbId);
      if (upErr) throw upErr;
      
      // 2. Create a new transaction for the partial payment today
      const receiptPayload = {
        workspace_id: String(originalTx.workspaceId).trim().toLowerCase(),
        category: originalTx.category,
        sub_category: targetSubCategory || originalTx.subCategory,
        item: `${originalTx.item} (Pagamento Parcial)`,
        value: amountPaid,
        quantity: originalTx.quantity,
        payment_method: 'A_VISTA',
        customer_name: originalTx.customerName?.trim() || null,
        is_pending: false,
        created_by: originalTx.createdBy
      };
      await supabase.from('transactions').insert([receiptPayload]);
      
      if (workspaceId) fetchTransactionsByWorkspace(workspaceId, true);
      return true;
    } catch (e: any) {
      if (!isSyncing && (isNetworkError(e) || !navigator.onLine)) {
        await addToOfflineQueue({ type: 'PARTIAL_SETTLE', payload: { originalTx, amountPaid, targetSubCategory } });
        return true;
      }
      // Revert if error
      if (workspaceId) fetchTransactionsByWorkspace(workspaceId, true);
      throw e; 
    }
  }, [addToOfflineQueue, workspaceId, fetchTransactionsByWorkspace]);

  const syncOfflineQueue = useCallback(async () => {
    // Legacy support
    const legacyQueue: any[] = JSON.parse(localStorage.getItem(`offline_tx_${workspaceId}`) || '[]');
    if (legacyQueue.length > 0) {
      setIsSyncing(true);
      try {
        await addTransactions(legacyQueue, true);
        localStorage.removeItem(`offline_tx_${workspaceId}`);
      } catch (e) {
        console.error("Legacy sync error", e);
      }
      setIsSyncing(false);
    }

    const queue: any[] = (await localforage.getItem(`offline_actions_${workspaceId}`)) || [];
    if (queue.length === 0) return;

    setIsSyncing(true);
    console.log(`[OfflineSync] Sincronizando ${queue.length} ações pendentes...`);
    
    const remainingQueue = [...queue];
    
    for (const action of queue) {
      try {
        if (action.type === 'ADD') {
          await addTransactions(action.payload, true);
        } else if (action.type === 'UPDATE') {
          await updateTransaction(action.payload.id, action.payload.updates, true);
        } else if (action.type === 'DELETE') {
          await deleteTransaction(action.payload.id, action.payload.userName, true);
        } else if (action.type === 'SETTLE_DEBT') {
          await settleCustomerDebt(action.payload.customerName, action.payload.transactionIds, true);
        } else if (action.type === 'PARTIAL_SETTLE') {
          await partialSettleTransaction(action.payload.originalTx, action.payload.amountPaid, action.payload.targetSubCategory, true);
        }
        remainingQueue.shift();
        await localforage.setItem(`offline_actions_${workspaceId}`, remainingQueue);
      } catch (e: any) {
        console.error(`[OfflineSync] Erro na ação ${action.type}:`, e);
        if (isNetworkError(e) || !navigator.onLine) {
          break; // Stop processing on network error
        } else {
          // Discard action if it's a permanent error to prevent blocking the queue
          remainingQueue.shift();
          await localforage.setItem(`offline_actions_${workspaceId}`, remainingQueue);
        }
      }
    }
    
    if (remainingQueue.length === 0) {
      nexusReport("Sincronização offline concluída.", 'DONE', 'NETWORK');
    }
    setIsSyncing(false);
  }, [workspaceId, addTransactions, updateTransaction, deleteTransaction, nexusReport, settleCustomerDebt, partialSettleTransaction]);

  const fetchUserGlobalDebts = useCallback(async (userPhone: string, currentWorkspaceId: string) => {
    if (!userPhone) return [];
    
    const normalized = normalizePhone(userPhone);
    if (!normalized) return [];

    const cleanWorkspace = String(currentWorkspaceId).trim().toLowerCase();
    
    try {
      // Query Otimizada: Busca transações pendentes em outros workspaces
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('is_pending', true) 
        .neq('workspace_id', cleanWorkspace);

      if (error) {
        console.error('[useTransactions] Erro ao buscar dívidas globais:', error);
        throw error;
      }
      
      if (data) {
        // Filtra no cliente usando a normalização robusta para garantir match preciso
        const filtered = data
          .map(t => mapTransaction(t))
          .filter(t => normalizePhone(t.customerPhone) === normalized);

        console.log(`[useTransactions] Encontrados ${filtered.length} registros externos para ${normalized}.`);
        return filtered.map(t => ({ ...t, isExternal: true }));
      }
      return [];
    } catch (e) {
      console.warn("[useTransactions] Exceção na consulta de dívidas globais:", e);
      return null;
    }
  }, [mapTransaction]);

  const calculateTotals = useCallback((category: string, subCategory?: string): PeriodTotals => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now);
    startOfMonth.setDate(now.getDate() - 30);

    const cleanWid = String(workspaceId || '').trim().toLowerCase();
    const cleanCat = String(category || '').trim().toLowerCase();
    const filtered = transactions.filter(t => 
      t.workspaceId.toLowerCase() === cleanWid &&
      (t.category || '').trim().toLowerCase() === cleanCat && 
      (!subCategory || t.subCategory === subCategory.toUpperCase()) && 
      !t.isPending &&
      !t.isExternal 
    );
    
    return {
      daily: filtered.filter(t => new Date(t.date).getTime() >= startOfDay).reduce((acc, t) => acc + t.value, 0),
      weekly: filtered.filter(t => new Date(t.date).getTime() >= startOfWeek.getTime()).reduce((acc, t) => acc + t.value, 0),
      monthly: filtered.filter(t => new Date(t.date).getTime() >= startOfMonth.getTime()).reduce((acc, t) => acc + t.value, 0)
    };
  }, [transactions, workspaceId]);

  const clearTransactions = useCallback(async (period: any, wid: any, range?: any, cats?: any) => {
    const cleanWid = String(wid).trim().toLowerCase();
    try {
      let query = supabase.from('transactions').delete().eq('workspace_id', cleanWid);
      
      if (period !== 'all') {
         query = query.eq('is_pending', false);
      }

      const now = new Date();
      if (period === 'day') {
        query = query.gte('date', new Date(now.setHours(0,0,0,0)).toISOString());
      } else if (period === 'week') {
        const pastWeek = new Date();
        pastWeek.setDate(pastWeek.getDate() - 7);
        pastWeek.setHours(0,0,0,0);
        query = query.gte('date', pastWeek.toISOString());
      } else if (period === 'month') {
        const pastMonth = new Date();
        pastMonth.setMonth(pastMonth.getMonth() - 1);
        pastMonth.setHours(0,0,0,0);
        query = query.gte('date', pastMonth.toISOString());
      } else if (period === 'custom' && range) {
        if (range.start) {
          const dStart = new Date(range.start);
          if (!isNaN(dStart.getTime())) query = query.gte('date', dStart.toISOString());
        }
        if (range.end) {
          const dEnd = new Date(range.end + 'T23:59:59.999Z');
          if (!isNaN(dEnd.getTime())) query = query.lte('date', dEnd.toISOString());
        }
      }

      if (cats && cats.length > 0) query = query.in('category', cats);
      
      const { error } = await query;
      if (error) throw error;
      
      // also clear the cache
      localforage.removeItem(`cached_tx_${cleanWid}`).catch(()=> {});
      if (workspaceId) fetchTransactionsByWorkspace(workspaceId, true);
    } catch (e: any) { throw e; }
  }, [workspaceId, fetchTransactionsByWorkspace]);

  const archiveYear = useCallback(async (wid: string, year: number) => {
    const cleanWid = String(wid).trim().toLowerCase();
    
    try {
      nexusReport(`Iniciando consolidação do ano ${year}...`, 'START', 'PROCESS');
      
      const { data, error } = await supabase.rpc('archive_old_transactions', {
        p_workspace_id: cleanWid,
        p_months_to_keep: 12 // No modo manual "Ano", deixamos 12 meses (ou 0 se quiser limpar tudo)
      });

      if (error) throw error;

      if (workspaceId) fetchTransactionsByWorkspace(workspaceId, true);
      nexusReport("Consolidação concluída com sucesso.", 'DONE', 'PROCESS');
      return (data && data[0]?.archived_count) || 0;
    } catch (e: any) {
      console.error("Erro no ArchiveYear:", e);
      nexusReport("Falha ao consolidar dados.", 'FAIL', 'PROCESS');
      throw e;
    }
  }, [workspaceId, fetchTransactionsByWorkspace, nexusReport]);

  const runAutoArchive = useCallback(async (wid: string) => {
    if (!wid || !navigator.onLine) return;
    const cleanWid = String(wid).trim().toLowerCase();

    // Throttle checks per session
    if (lastAutoArchiveCheck && (Date.now() - lastAutoArchiveCheck < 3600000)) return; // 1h
    setLastAutoArchiveCheck(Date.now());

    try {
      // 1. Obter info da loja para saber a última data de arquivamento
      const { data: profile } = await supabase
        .from('store_profiles')
        .select('last_auto_archive_at')
        .eq('workspace_id', cleanWid)
        .maybeSingle();

      const lastRun = profile?.last_auto_archive_at ? new Date(profile.last_auto_archive_at).getTime() : 0;
      const oneMonth = 30 * 24 * 60 * 60 * 1000;

      if (Date.now() - lastRun > oneMonth) {
        console.log(`[AutoArchive] Iniciando faxina mensal para workspace ${cleanWid}...`);
        
        const { data, error } = await supabase.rpc('archive_old_transactions', {
          p_workspace_id: cleanWid,
          p_months_to_keep: 6 // Padrão: mantemos 6 meses de dados granulados
        });

        if (error) {
          console.warn("[AutoArchive] Falha silenciosa:", error);
          return;
        }

        const count = (data && data[0]?.archived_count) || 0;
        if (count > 0) {
          console.log(`[AutoArchive] Sucesso! ${count} transações compactadas.`);
          if (addNote) {
            addNote({
              workspaceId: cleanWid,
              createdById: 'system',
              createdByName: 'Sistema',
              content: `Faxina Automática Concluída: ${count} registros antigos foram compactados para otimizar a velocidade do seu banco de dados.`,
              type: 'LOG'
            });
          }
        }
      }
    } catch (e) {
      console.warn("[AutoArchive] Erro inesperado:", e);
    }
  }, [lastAutoArchiveCheck, addNote]);

  // Trigger AutoArchive on workspace activation
  useEffect(() => {
    if (workspaceId) {
      runAutoArchive(workspaceId);
    }
  }, [workspaceId, runAutoArchive]);

  const reconnect = useCallback(async () => {
    setIsOffline(false);
    await syncOfflineQueue();
  }, [syncOfflineQueue]);

  return { transactions, setTransactions, loading, hasMore, isOffline, isSyncing, reconnect, addTransactions, updateTransaction, deleteTransaction, calculateTotals, fetchTransactionsByWorkspace, fetchNextTransactions, settleCustomerDebt, partialSettleTransaction, clearTransactions, fetchUserGlobalDebts, archiveYear };
};
