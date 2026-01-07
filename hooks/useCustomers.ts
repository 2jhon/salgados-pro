
import { useState, useEffect, useCallback } from 'react';
import { Customer } from '../types';
import { supabase } from '../lib/supabase';

const LS_CUSTOMERS_KEY = 'salgados_customers_v1';

export const useCustomers = (workspaceId?: string) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    if (!workspaceId) return;
    
    const saved = localStorage.getItem(`${LS_CUSTOMERS_KEY}_${workspaceId}`);
    if (saved) {
      setCustomers(JSON.parse(saved));
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('name');
      
      if (!error && data) {
        const mapped: Customer[] = data.map(c => ({
          id: c.id,
          workspaceId: c.workspace_id,
          name: c.name,
          phone: c.phone
        }));
        setCustomers(mapped);
        localStorage.setItem(`${LS_CUSTOMERS_KEY}_${workspaceId}`, JSON.stringify(mapped));
      }
    } catch (e) {
      console.warn("Supabase não disponível, usando dados locais.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;

    fetchCustomers();

    const channel = supabase
      .channel(`customers_changes_${workspaceId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'customers', 
          filter: `workspace_id=eq.${workspaceId}` 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newCustomer: Customer = {
              id: payload.new.id,
              workspaceId: payload.new.workspace_id,
              name: payload.new.name,
              phone: payload.new.phone
            };
            setCustomers(prev => {
              // Previne duplicação se já tiver sido adicionado manualmente
              if (prev.some(c => c.id === newCustomer.id)) return prev;
              return [...prev, newCustomer].sort((a,b) => a.name.localeCompare(b.name));
            });
          } else if (payload.eventType === 'UPDATE') {
            setCustomers(prev => prev.map(c => 
              String(c.id) === String(payload.new.id) 
                ? { ...c, name: payload.new.name, phone: payload.new.phone } 
                : c
            ));
          } else if (payload.eventType === 'DELETE') {
            setCustomers(prev => prev.filter(c => String(c.id) !== String(payload.old.id)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, fetchCustomers]);

  const addCustomer = async (name: string, phone?: string) => {
    if (!workspaceId) return null;
    console.log('[DEBUG_CUSTOMER_ADD] Adding:', name, phone);
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ name, phone, workspace_id: workspaceId }])
        .select();
      
      if (!error && data) {
        const newC = {
          id: data[0].id,
          workspaceId: data[0].workspace_id,
          name: data[0].name,
          phone: data[0].phone
        } as Customer;
        
        console.log('[DEBUG_CUSTOMER_ADD] Success:', newC);
        
        // ATUALIZAÇÃO IMEDIATA DO ESTADO LOCAL
        setCustomers(prev => {
          if (prev.some(c => c.id === newC.id)) return prev;
          return [...prev, newC].sort((a,b) => a.name.localeCompare(b.name));
        });

        return newC;
      }
      if(error) console.error('[DEBUG_CUSTOMER_ADD] Error:', error);
    } catch (err) {
      console.error("Erro ao adicionar cliente:", err);
    }
    return null;
  };

  const removeCustomer = async (id: string) => {
    setCustomers(prev => prev.filter(c => String(c.id) !== String(id)));
    try {
      await supabase.from('customers').delete().eq('id', id);
    } catch (e) {}
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    // Atualização otimista local
    setCustomers(prev => prev.map(c => 
      String(c.id) === String(id) ? { ...c, ...updates } : c
    ));

    const payload: any = {};
    if (updates.name) payload.name = updates.name;
    if (updates.phone) payload.phone = updates.phone;

    try {
      const { error } = await supabase.from('customers').update(payload).eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.error("Erro ao atualizar cliente no servidor:", e);
      // O realtime reverterá o estado caso necessário
    }
  };

  return { customers, addCustomer, removeCustomer, updateCustomer, loading };
};
