
import { useState, useEffect, useCallback } from 'react';
import { Customer } from '../types';
import { supabase, safeStringifyError } from '../lib/supabase';

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
          phone: c.phone,
          type: c.type || 'CLIENT'
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
              phone: payload.new.phone,
              type: payload.new.type || 'CLIENT'
            };
            setCustomers(prev => {
              // Previne duplicação se já tiver sido adicionado manualmente
              if (prev.some(c => c.id === newCustomer.id)) return prev;
              return [...prev, newCustomer].sort((a,b) => a.name.localeCompare(b.name));
            });
          } else if (payload.eventType === 'UPDATE') {
            setCustomers(prev => prev.map(c => 
              String(c.id) === String(payload.new.id) 
                ? { ...c, name: payload.new.name, phone: payload.new.phone, type: payload.new.type || 'CLIENT' } 
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

  const addCustomer = async (name: string, phone?: string, type: 'CLIENT' | 'SUPPLIER' = 'CLIENT') => {
    if (!workspaceId) return null;
    
    // Ensure clean phone number
    const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
    
    console.log('[DEBUG_CUSTOMER_ADD] Adding:', name, cleanPhone, type);
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ name, phone: cleanPhone, workspace_id: workspaceId, type }])
        .select();
      
      if (error) {
        console.error('[DEBUG_CUSTOMER_ADD] Primary Insert Error:', safeStringifyError(error));
        
        // Fallback: If 'type' column doesn't exist (DB Schema Mismatch), retry without it
        // Error code 42703 is "undefined_column" in Postgres
        // Error code PGRST204 is "Could not find the column in the schema cache"
        const code = (error as any).code;
        const msg = (error.message || '').toLowerCase();
        
        if (code === '42703' || code === 'PGRST204' || msg.includes('type') || msg.includes('column')) {
           console.warn('[DEBUG_CUSTOMER_ADD] Retrying insert without "type" field...');
           const { data: retryData, error: retryError } = await supabase
            .from('customers')
            .insert([{ name, phone: cleanPhone, workspace_id: workspaceId }])
            .select();
            
           if (!retryError && retryData) {
              const fallbackCustomer = {
                id: retryData[0].id,
                workspaceId: retryData[0].workspace_id,
                name: retryData[0].name,
                phone: retryData[0].phone,
                type: 'CLIENT' // Default since DB doesn't support it yet
              } as Customer;
              
              setCustomers(prev => {
                if (prev.some(c => c.id === fallbackCustomer.id)) return prev;
                return [...prev, fallbackCustomer].sort((a,b) => a.name.localeCompare(b.name));
              });
              return fallbackCustomer;
           }
           if (retryError) throw retryError;
        } else {
            throw error;
        }
      }

      if (data) {
        const newC = {
          id: data[0].id,
          workspaceId: data[0].workspace_id,
          name: data[0].name,
          phone: data[0].phone,
          type: data[0].type || 'CLIENT'
        } as Customer;
        
        console.log('[DEBUG_CUSTOMER_ADD] Success:', newC);
        
        // ATUALIZAÇÃO IMEDIATA DO ESTADO LOCAL
        setCustomers(prev => {
          if (prev.some(c => c.id === newC.id)) return prev;
          return [...prev, newC].sort((a,b) => a.name.localeCompare(b.name));
        });

        return newC;
      }
    } catch (err) {
      console.error("Erro ao adicionar cliente:", safeStringifyError(err));
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
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.phone !== undefined) payload.phone = updates.phone ? updates.phone.replace(/\D/g, '') : null;
    if (updates.type !== undefined) payload.type = updates.type;

    try {
      const { error } = await supabase.from('customers').update(payload).eq('id', id);
      if (error) {
         const code = (error as any).code;
         const msg = (error.message || '').toLowerCase();
         // Fallback if updating type fails
         if ((code === '42703' || code === 'PGRST204' || msg.includes('type')) && payload.type) {
             delete payload.type;
             await supabase.from('customers').update(payload).eq('id', id);
         } else {
             throw error;
         }
      }
    } catch (e) {
      console.error("Erro ao atualizar cliente no servidor:", safeStringifyError(e));
      // O realtime reverterá o estado caso necessário
    }
  };

  return { customers, addCustomer, removeCustomer, updateCustomer, loading };
};
