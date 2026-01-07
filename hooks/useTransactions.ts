
import { useState, useCallback, useRef, useEffect } from 'react';
import { Transaction, PeriodTotals, AppSection } from '../types';
import { supabase, withRetry, safeStringifyError } from '../lib/supabase';

const roundMoney = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export const useTransactions = (workspaceId: string | undefined, sections: AppSection[], saveConfig: (s: AppSection[]) => Promise<void>) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const isFetchingRef = useRef(false);

  const nexusReport = (msg: string, status: 'START' | 'DONE' | 'FAIL', type: 'PROCESS' | 'NETWORK' = 'PROCESS', taskId?: string, data?: any) => {
    if ((window as any).Nexus) (window as any).Nexus.report(msg, status, type, taskId, data);
  };

  const mapTransaction = useCallback((t: any): Transaction => ({
    id: t.id,
    workspaceId: t.workspace_id,
    date: t.date,
    category: t.category,
    subCategory: t.sub_category,
    item: t.item,
    value: t.value || 0,
    quantity: t.quantity,
    paymentMethod: t.payment_method,
    customerName: t.customer_name,
    isPending: t.is_pending,
    createdBy: t.created_by,
    initialStock: t.initial_stock,
    leftoverStock: t.leftover_stock,
    unitPrice: t.unit_price,
    ...((t as any).__forceShow ? { __forceShow: true } : {}) 
  }), []);

  const fetchTransactionsByWorkspace = useCallback(async (wid: string, force = false) => {
    if (!wid || (isFetchingRef.current && !force)) return;
    
    isFetchingRef.current = true;
    setLoading(true);
    const taskId = 'SYNC_HISTORY';
    nexusReport("Sincronizando histórico e pendências...", 'START', 'NETWORK', taskId);

    try {
      const result = await withRetry(async () => {
        const historyPromise = supabase
          .from('transactions')
          .select('*')
          .eq('workspace_id', wid)
          .order('date', { ascending: false })
          .limit(150);

        const pendingPromise = supabase
          .from('transactions')
          .select('*')
          .eq('workspace_id', wid)
          .eq('is_pending', true);

        const [historyRes, pendingRes] = await Promise.all([historyPromise, pendingPromise]);
        
        if (historyRes.error) throw historyRes.error;
        if (pendingRes.error) throw pendingRes.error;

        const combined = [...(historyRes.data || []), ...(pendingRes.data || [])];
        const uniqueMap = new Map();
        combined.forEach(item => uniqueMap.set(item.id, item));
        
        return Array.from(uniqueMap.values());
      });
      
      if (result) {
        const mapped = (result as any[]).map(mapTransaction);
        
        setTransactions(prev => {
          const otherWorkspaceTxs = prev.filter(t => t.workspaceId !== wid);
          const merged = [...otherWorkspaceTxs, ...mapped];
          const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
          return unique.sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });

        console.log('[DEBUG_TX_FETCH] Total fetched for current workspace:', mapped.length);
        nexusReport(`Sincronização completa: ${mapped.length} registros carregados.`, 'DONE', 'NETWORK', taskId);
      }
    } catch (e: any) {
      console.error('[DEBUG_TX_FETCH] Error:', e);
      nexusReport(`Falha ao sincronizar histórico: ${e.message}`, 'FAIL', 'NETWORK', taskId);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [mapTransaction]);

  // REALTIME & REVALIDATION
  useEffect(() => {
    if (!workspaceId) return;

    // 1. WebSocket Channel
    const txChannel = supabase
      .channel(`tx_changes_${workspaceId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'transactions', 
          filter: `workspace_id=eq.${workspaceId}` 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTx = mapTransaction(payload.new);
            nexusReport(`Nova operação: ${newTx.item}`, 'DONE', 'NETWORK', 'RT_TX_NEW');
            setTransactions(prev => {
              if (prev.some(t => t.id === newTx.id)) return prev;
              return [newTx, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });
          } 
          else if (payload.eventType === 'UPDATE') {
            const updatedTx = mapTransaction(payload.new);
            setTransactions(prev => prev.map(t => String(t.id) === String(updatedTx.id) ? updatedTx : t));
          }
          else if (payload.eventType === 'DELETE') {
            setTransactions(prev => prev.filter(t => String(t.id) !== String(payload.old.id)));
          }
        }
      )
      .subscribe();

    // 2. Focus Revalidation (Garante dados frescos ao voltar para o app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[REALTIME] App focado, forçando atualização...');
        fetchTransactionsByWorkspace(workspaceId, true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      supabase.removeChannel(txChannel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [workspaceId, mapTransaction, fetchTransactionsByWorkspace]);

  const fetchUserGlobalDebts = useCallback(async (userPhone: string) => {
    if (!userPhone || userPhone.length < 8) return;
    
    const cleanPhone = userPhone.replace(/\D/g, '').replace(/^55/, '');
    const taskId = `GLOBAL_DEBT_${cleanPhone}`;
    nexusReport(`Buscando dívidas em lojas parceiras para: ${cleanPhone}`, 'START', 'NETWORK', taskId);

    try {
      const { data: customerRecords, error: custError } = await supabase
        .from('customers')
        .select('workspace_id, name')
        .or(`phone.ilike.%${cleanPhone}%,phone.eq.${cleanPhone}`);

      if (custError) throw custError;

      if (!customerRecords || customerRecords.length === 0) {
        nexusReport(`Nenhum cadastro encontrado em outras lojas.`, 'DONE', 'NETWORK', taskId);
        return;
      }

      const debtPromises = customerRecords.map(async (record) => {
        const { data: debts } = await supabase
          .from('transactions')
          .select('*')
          .eq('workspace_id', record.workspace_id)
          .eq('customer_name', record.name)
          .eq('is_pending', true);
        return debts || [];
      });

      const results = await Promise.all(debtPromises);
      const allDebts = results.flat();

      if (allDebts.length > 0) {
        const mappedDebts = allDebts.map(t => ({
          ...mapTransaction(t),
          __forceShow: true
        }));

        setTransactions(prev => {
          const uniqueMap = new Map(prev.map(t => [t.id, t]));
          mappedDebts.forEach(t => uniqueMap.set(t.id, t));
          return Array.from(uniqueMap.values()).sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
        
        nexusReport(`${mappedDebts.length} dívidas externas sincronizadas.`, 'DONE', 'NETWORK', taskId);
      } 
    } catch (e: any) {
      console.error('[DEBUG_GLOBAL_DEBT] Error:', e);
    }
  }, [mapTransaction]);

  const addTransactions = async (ts: Omit<Transaction, 'id' | 'date'>[]) => {
    if (ts.length === 0) return null;
    const taskId = `ADD_TX_${Date.now()}`;
    nexusReport(`Registrando ${ts.length} novas operações...`, 'START', 'NETWORK', taskId);

    const payload = ts.map(t => ({
      workspace_id: t.workspaceId,
      category: t.category,
      sub_category: t.subCategory,
      item: t.item,
      value: roundMoney(t.value || 0),
      quantity: t.quantity,
      payment_method: t.paymentMethod,
      customer_name: t.customerName,
      is_pending: t.isPending || false,
      created_by: t.createdBy,
      initial_stock: t.initialStock,
      leftover_stock: t.leftoverStock,
      unit_price: t.unitPrice
    }));

    try {
      const { data, error } = await supabase.from('transactions').insert(payload).select();
      if (error) throw error;

      nexusReport("Operações registradas no servidor.", 'DONE', 'NETWORK', taskId);

      if (data) {
        const created = data.map(mapTransaction);
        return created;
      }
    } catch (e: any) {
      console.error('[DEBUG_TX_ADD] Error:', e);
      nexusReport("Erro ao enviar dados para a nuvem.", 'FAIL', 'NETWORK', taskId);
      throw e;
    }
    return null;
  };

  const calculateTotals = useCallback((category: string, subCategory?: string): PeriodTotals => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0,0,0,0);
    const startOfWeekTime = startOfWeek.getTime();

    const startOfMonth = new Date(now);
    startOfMonth.setDate(now.getDate() - 30);
    startOfMonth.setHours(0,0,0,0);
    const startOfMonthTime = startOfMonth.getTime();

    const filtered = transactions.filter(t => 
      String(t.category) === String(category) && 
      (!subCategory || t.subCategory === subCategory) && 
      !t.isPending
    );
    
    return {
      daily: filtered
        .filter(t => new Date(t.date).getTime() >= startOfDay)
        .reduce((acc, t) => acc + (t.value || 0), 0),
      weekly: filtered
        .filter(t => new Date(t.date).getTime() >= startOfWeekTime)
        .reduce((acc, t) => acc + (t.value || 0), 0),
      monthly: filtered
        .filter(t => new Date(t.date).getTime() >= startOfMonthTime)
        .reduce((acc, t) => acc + (t.value || 0), 0)
    };
  }, [transactions]);

  const clearTransactions = async (period: 'day' | 'week' | 'month' | 'all', wid: string) => {
    const taskId = 'CLEAR_DATA';
    nexusReport("Limpando registros históricos...", 'START', 'PROCESS', taskId);
    try {
      await withRetry(async () => {
        let query = supabase.from('transactions').delete().eq('workspace_id', wid);
        
        if (period !== 'all') {
           query = query.eq('is_pending', false);
        }

        if (period !== 'all') {
          const dateLimit = new Date();
          if (period === 'day') dateLimit.setHours(0,0,0,0);
          else if (period === 'week') dateLimit.setDate(dateLimit.getDate() - 7);
          else if (period === 'month') dateLimit.setMonth(dateLimit.getMonth() - 1);
          query = query.gte('date', dateLimit.toISOString());
        }
        const { error } = await query;
        if (error) throw error;
      });
      nexusReport("Registros removidos com sucesso.", 'DONE', 'PROCESS', taskId);
    } catch (e: any) {
      nexusReport("Falha na limpeza de dados.", 'FAIL', 'PROCESS', taskId);
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    try {
      const payload: any = {};
      if (updates.value !== undefined) payload.value = updates.value;
      if (updates.isPending !== undefined) payload.is_pending = updates.isPending;

      const { error } = await supabase.from('transactions').update(payload).eq('id', id);
      if (error) throw error;
    } catch (e: any) {}
  };

  const deleteTransaction = async (id: string) => {
    const taskId = `DEL_TX_${id}`;
    nexusReport("Removendo registro selecionado...", 'START', 'NETWORK', taskId);
    
    // Atualização Otimista: Remove da UI imediatamente para sensação de resposta rápida
    const previousTransactions = [...transactions];
    setTransactions(prev => prev.filter(t => t.id !== id));

    try { 
      const { error } = await supabase.from('transactions').delete().eq('id', id); 
      if (error) throw error;
      nexusReport("Registro removido.", 'DONE', 'NETWORK', taskId);
    } catch (e: any) {
      // Reverte se falhar
      setTransactions(previousTransactions);
      nexusReport("Erro ao remover registro.", 'FAIL', 'NETWORK', taskId);
      alert("Erro ao excluir registro. Tente novamente.");
    }
  };

  const settleCustomerDebt = async (customerName: string, transactionIds: string[]) => {
    const taskId = `SETTLE_${Date.now()}`;
    nexusReport(`Quitando pendências de ${customerName}...`, 'START', 'NETWORK', taskId);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ is_pending: false })
        .in('id', transactionIds);
      if (error) throw error;
      nexusReport("Pendências quitadas.", 'DONE', 'NETWORK', taskId);
    } catch (e: any) {
      nexusReport("Erro ao quitar pendências.", 'FAIL', 'NETWORK', taskId);
    }
  };

  const partialSettleTransaction = async (originalTx: Transaction, amountPaid: number) => {
    if (amountPaid <= 0 || amountPaid >= originalTx.value) return false;
    
    const taskId = `PARTIAL_${originalTx.id}`;
    nexusReport(`Processando pagamento parcial de R$ ${amountPaid}...`, 'START', 'NETWORK', taskId);

    const remainingDebt = roundMoney(originalTx.value - amountPaid);

    try {
      // 1. Atualiza a dívida original para o valor restante
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ value: remainingDebt })
        .eq('id', originalTx.id);

      if (updateError) throw updateError;

      // 2. Cria o registro do pagamento (Baixa)
      const receiptPayload = {
        workspace_id: originalTx.workspaceId,
        category: originalTx.category,
        sub_category: originalTx.subCategory, // Mantém a categoria original para relatórios
        item: `${originalTx.item} (Parcial)`,
        value: amountPaid,
        quantity: originalTx.quantity,
        payment_method: 'A_VISTA',
        customer_name: originalTx.customerName,
        is_pending: false, // Pago!
        created_by: originalTx.createdBy
      };

      const { error: insertError } = await supabase.from('transactions').insert([receiptPayload]);
      if (insertError) throw insertError;

      nexusReport("Pagamento parcial registrado.", 'DONE', 'NETWORK', taskId);
      return true;
    } catch (e: any) {
      nexusReport("Erro no pagamento parcial.", 'FAIL', 'NETWORK', taskId);
      return false;
    }
  };

  return { 
    transactions, 
    loading, 
    addTransactions, 
    updateTransaction, 
    deleteTransaction, 
    calculateTotals, 
    fetchTransactionsByWorkspace, 
    fetchUserGlobalDebts, 
    settleCustomerDebt, 
    partialSettleTransaction,
    clearTransactions 
  };
};
