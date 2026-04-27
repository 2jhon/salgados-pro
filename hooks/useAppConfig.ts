
import { useState, useCallback, useEffect } from 'react';
import localforage from 'localforage';
import { AppSection } from '../types';
import { supabase, withRetry, safeStringifyError, isNetworkError, registerStockMovement } from '../lib/supabase';
import { toast } from 'sonner';

const LS_CONFIG_KEY = 'salgados_app_config_v1';
const LS_PUBLIC_STALLS_KEY = 'salgados_public_stalls_cache_v1';

let lastStallsFetchTime = 0;
const STALLS_CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache to prevent backend spam on initialization

export const useAppConfig = () => {
  const [sections, setSections] = useState<AppSection[]>([]);
  const [archives, setArchives] = useState<AppSection[]>([]);
  const [publicStalls, setPublicStalls] = useState<AppSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMorePublic, setHasMorePublic] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);

  // Carregar cache IMEDIATAMENTE quando o workspaceId mudar
  useEffect(() => {
    if (activeWorkspace) {
      const loadCache = async () => {
        try {
          const saved: any = await localforage.getItem(`${LS_CONFIG_KEY}_${activeWorkspace}`);
          if (saved && Array.isArray(saved) && saved.length > 0) {
            setSections(prev => {
              if (prev.length === 0) return saved;
              return prev;
            });
          }
        } catch (e) {}
      };
      loadCache();
    }
  }, [activeWorkspace]);

  const nexusReport = useCallback((msg: string, status: 'START' | 'DONE' | 'FAIL', type: 'PROCESS' | 'NETWORK' = 'PROCESS', taskId?: string) => {
    if ((window as any).Nexus) (window as any).Nexus.report(msg, status, type, taskId);
  }, []);

  // Extremely Robust JSON parser that handles double-stringified JSON, object wrappers, or map-like objects
  const parseJsonField = useCallback((field: any) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    
    let parsed = field;

    if (typeof field === 'string') {
      try {
        parsed = JSON.parse(field);
        // Handle double-stringified
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch { }
        }
      } catch (e) { 
        console.warn("Falha ao analisar JSON de configuração:", e);
        return []; 
      }
    }

    if (Array.isArray(parsed)) return parsed;

    // Handle object wrapper case directly { items: [...] }
    if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.items)) return parsed.items;
        
        // Handle Map-like objects { "0": {...}, "1": {...} } which can happen with some DB saves
        const values = Object.values(parsed);
        // Verify if values look like items (have 'name' or 'id')
        if (values.length > 0 && values.every(v => typeof v === 'object' && v !== null)) {
            // Check heuristic: does it look like our config item?
            const sample = values[0] as any;
            if (sample.name || sample.id || sample.price || sample.defaultPrice) {
               console.log("Recuperado array de itens de objeto malformado.");
               return values;
            }
        }
    }
    
    return [];
  }, []);

  const mapSection = useCallback((s: any): AppSection => {
    let rawItems = parseJsonField(s.items);
    
    // SAFETY CLEANUP: Ensure we have an array
    if (!Array.isArray(rawItems)) rawItems = [];

    // Extract Metadata Item (Hidden storage for stall config)
    const metadataItem = rawItems.find((i: any) => i && i.id === 'SECTION_METADATA') || {};

    // Filter logic: Keep valid objects AND exclude metadata item
    const cleanItems = rawItems.filter((i: any) => i && typeof i === 'object' && i.id !== 'SECTION_METADATA');

    // Ensure every item has at least a name placeholder if missing AND a valid ID
    const finalItems = cleanItems.map((i: any, idx: number) => ({
        ...i,
        id: i.id || `gen_item_${s.id}_${idx}_${Date.now()}`, // Fallback ID to prevent key=undefined
        name: i.name || 'Item Sem Nome'
    }));

    // Parse expenses with same safety
    let rawExpenses = parseJsonField(s.expenses);
    if (!Array.isArray(rawExpenses)) rawExpenses = [];
    const finalExpenses = rawExpenses.filter((i: any) => i && typeof i === 'object').map((i: any, idx: number) => ({
        ...i,
        id: i.id || `gen_exp_${s.id}_${idx}_${Date.now()}`,
        name: i.name || 'Despesa Sem Nome'
    }));

    // PRIORITIZE METADATA ITEM VALUES, FALLBACK TO COLUMNS (Backward Compatibility)
    return {
      id: s.id,
      workspaceId: s.workspace_id,
      name: s.name,
      type: s.type,
      order: s.sort_order,
      items: finalItems,
      expenses: finalExpenses,
      globalStockMode: s.global_stock_mode || 'GLOBAL',
      linkedSectionId: s.linked_section_id,
      isPublic: s.is_public,
      latitude: s.latitude,
      longitude: s.longitude,
      
      // Read from metadata if available, otherwise check column
      imageUrl: metadataItem.imageUrl || s.image_url,
      address: metadataItem.address || s.address,
      description: metadataItem.description || s.description,
      openingHours: metadataItem.openingHours || s.opening_hours,
      whatsappMode: (metadataItem.whatsappMode || s.whatsapp_mode || 'SYSTEM').toUpperCase() as 'SYSTEM' | 'MANUAL',
      manualWhatsapp: metadataItem.manualWhatsapp || s.manual_whatsapp,
      fulfillmentMode: metadataItem.fulfillmentMode || s.fulfillment_mode || 'PICKUP',
      
      lastSync: s.last_sync
    };
  }, [parseJsonField]);

  const fetchConfigByWorkspace = useCallback(async (workspaceId: string) => {
    if (!workspaceId) return;
    setActiveWorkspace(workspaceId);
    setLoading(true);
    const taskId = 'SYNC_CONFIG';
    nexusReport("Baixando configuração de abas...", 'START', 'NETWORK', taskId);
    
    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('app_config')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('sort_order');
        if (error) throw error;
        return data;
      });

      // Fetch inventory data
      const inventoryData = await withRetry(async () => {
        const { data, error } = await supabase
          .from('inventory')
          .select('section_id, item_id, quantity, min_stock')
          .eq('workspace_id', workspaceId);
        if (error) {
          console.warn('Could not fetch inventory:', error);
          return [];
        }
        return data || [];
      });
      
      if (data) {
        const allMapped: AppSection[] = data.map(mapSection);
        
        // Merge inventory data and find missing items
        const missingInventory: any[] = [];
        
        const mapped = allMapped.map(section => {
          if (section.type === 'ARCHIVE_SUMMARY') return section;
          const sectionInventory = inventoryData.filter(inv => inv.section_id === section.id);
          
          const updatedItems = section.items.map(item => {
            const invItem = sectionInventory.find(inv => inv.item_id === item.id);
            if (invItem) {
              return {
                ...item,
                currentStock: Number(invItem.quantity),
                minStock: invItem.min_stock !== null ? Number(invItem.min_stock) : item.minStock
              };
            } else {
              // Item is missing from inventory table, queue for upsert
              missingInventory.push({
                workspace_id: workspaceId,
                section_id: section.id,
                item_id: item.id,
                quantity: item.currentStock || 0,
                min_stock: item.minStock || 0,
                updated_at: new Date().toISOString()
              });
            }
            return item;
          });
          
          return { ...section, items: updatedItems };
        });

        // Background sync missing inventory
        if (missingInventory.length > 0) {
          supabase.from('inventory').upsert(missingInventory, { onConflict: 'workspace_id, section_id, item_id' })
            .then(({ error }) => {
              if (error) console.error('Failed to sync missing inventory:', error);
              else console.log(`Synced ${missingInventory.length} missing items to inventory table.`);
            });
        }

        const finalMapped = mapped.filter(s => s.type !== 'ARCHIVE_SUMMARY');
        const archiveList = mapped.filter(s => s.type === 'ARCHIVE_SUMMARY');
        
        // Log para auditoria de dados
        const totalItems = finalMapped.reduce((acc, s) => acc + s.items.length, 0);
        nexusReport(`Configuração carregada: ${finalMapped.length} abas, ${totalItems} produtos encontrados.`, 'DONE', 'NETWORK', taskId);

        setSections(finalMapped);
        setArchives(archiveList);
        try {
          await localforage.setItem(`${LS_CONFIG_KEY}_${workspaceId}`, finalMapped);
        } catch (e) { console.warn("Falha ao salvar cache config"); }
      }
    } catch (e: any) {
      nexusReport(`Erro ao baixar abas: ${safeStringifyError(e)}`, 'FAIL', 'NETWORK', taskId);
      toast.error("Erro ao carregar configurações. Verifique sua conexão.");
      try {
        const saved: any = await localforage.getItem(`${LS_CONFIG_KEY}_${workspaceId}`);
        if (saved && Array.isArray(saved)) {
           setSections(saved);
           nexusReport("Usando backup local de configuração.", 'DONE', 'PROCESS');
        }
      } catch (err) {
        await localforage.removeItem(`${LS_CONFIG_KEY}_${workspaceId}`);
      }
    } finally {
      setLoading(false);
    }
  }, [mapSection]);

  const fetchPublicStalls = useCallback(async (force = false, page: number = 0, limit: number = 50) => {
    if (!force && page === 0 && Date.now() - lastStallsFetchTime < STALLS_CACHE_TTL && publicStalls.length > 0) {
      return; 
    }
    
    const from = page * limit;
    const to = from + limit - 1;

    if (page === 0) setLoading(true);
    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('app_config')
          .select('id, workspace_id, name, type, sort_order, is_public, latitude, longitude, items')
          .eq('type', 'STALL_STYLE')
          .eq('is_public', true)
          .order('name')
          .range(from, to);
        
        if (error) throw error;
        return data;
      });
      
      if (data) {
        const mapped = data.map(mapSection);
        setHasMorePublic(data.length === limit);
        setPublicStalls(prev => {
          if (page === 0) return mapped;
          const existingIds = new Set(prev.map((s: any) => s.id));
          const fresh = mapped.filter((s: any) => !existingIds.has(s.id));
          return [...prev, ...fresh];
        });

        if (page === 0) {
          lastStallsFetchTime = Date.now();
          // Update local cache
          try { await localforage.setItem(LS_PUBLIC_STALLS_KEY, mapped); } catch {}
        }
      }
    } catch (e: any) {
      console.warn("Vitrine: Falha na conexão, carregando cache local.", safeStringifyError(e));
      if (page === 0) {
        toast.error("Erro ao carregar vitrine. Exibindo dados em cache.");
        try {
          const saved: any = await localforage.getItem(LS_PUBLIC_STALLS_KEY);
          if (saved && Array.isArray(saved)) {
            setPublicStalls(saved);
          }
        } catch {}
      }
    } finally {
      if (page === 0) setLoading(false);
    }
  }, [mapSection, publicStalls.length]);

  const fetchStallById = useCallback(async (stallId: string): Promise<AppSection | null> => {
    try {
       const { data, error } = await supabase
         .from('app_config')
         .select('*')
         .eq('id', stallId)
         .single();
       if (error) throw error;
       return data ? mapSection(data) : null;
    } catch (e) {
       console.error("Error fetching stall by id:", e);
       return null;
    }
  }, [mapSection]);


  useEffect(() => {
    if (!activeWorkspace) return;

    const configChannel = supabase
      .channel(`config_changes_${activeWorkspace}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'app_config', 
          filter: `workspace_id=eq.${activeWorkspace}` 
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = mapSection(payload.new);
            
            setSections(prev => {
              const others = prev.filter(s => String(s.id) !== String(updated.id));
              const merged = [...others, updated].sort((a, b) => (a.order || 0) - (b.order || 0));
              return merged;
            });

            if (updated.type === 'STALL_STYLE' && updated.isPublic) {
              setPublicStalls(prev => {
                const others = prev.filter(s => String(s.id) !== String(updated.id));
                return [...others, updated].sort((a, b) => a.name.localeCompare(b.name));
              });
            } else if (updated.type === 'STALL_STYLE' && !updated.isPublic) {
              setPublicStalls(prev => prev.filter(s => String(s.id) !== String(updated.id)));
            }
          } else if (payload.eventType === 'DELETE') {
            setSections(prev => prev.filter(s => String(s.id) !== String(payload.old.id)));
            setPublicStalls(prev => prev.filter(s => String(s.id) !== String(payload.old.id)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(configChannel);
    };
  }, [activeWorkspace, mapSection]);

  const updateSingleSection = useCallback(async (updatedSection: AppSection): Promise<boolean> => {
    // Optimistic Update
    setSections(prev => prev.map(s => String(s.id) === String(updatedSection.id) ? updatedSection : s));

    const taskId = `SAVE_SEC_${updatedSection.id}`;
    nexusReport("Sincronizando aba rápida com o servidor...", 'START', 'NETWORK', taskId);
    
    try {
      const metadataItem = {
          id: 'SECTION_METADATA',
          openingHours: updatedSection.openingHours || null,
          description: updatedSection.description || null,
          address: updatedSection.address || null,
          imageUrl: updatedSection.imageUrl || null,
          whatsappMode: (updatedSection.whatsappMode || 'SYSTEM').toUpperCase(),
          manualWhatsapp: updatedSection.manualWhatsapp || null,
          fulfillmentMode: updatedSection.fulfillmentMode || 'PICKUP'
      };

      const itemsWithMetadata = [...(updatedSection.items || []), metadataItem];

      const payload = {
        id: updatedSection.id,
        workspace_id: updatedSection.workspaceId,
        name: updatedSection.name,
        type: updatedSection.type,
        sort_order: updatedSection.order,
        items: itemsWithMetadata, 
        expenses: updatedSection.expenses || [],
        global_stock_mode: updatedSection.globalStockMode || 'GLOBAL',
        linked_section_id: updatedSection.linkedSectionId || null,
        is_public: updatedSection.isPublic || false,
        latitude: updatedSection.latitude || null,
        longitude: updatedSection.longitude || null,
        last_sync: new Date().toISOString()
      };

      await withRetry(async () => {
        const { error } = await supabase.from('app_config').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
      });

      // Note: Full local storage update is ideal, but relying on Optimistic state for now
      // This solves the payload size drastically without rewriting the cache engine.
      if (activeWorkspace) {
        const currentQueue: any = (await localforage.getItem(`${LS_CONFIG_KEY}_${activeWorkspace}`)) || [];
        if (Array.isArray(currentQueue)) {
            const updatedCache = currentQueue.map(s => String(s.id) === String(updatedSection.id) ? updatedSection : s);
            await localforage.setItem(`${LS_CONFIG_KEY}_${activeWorkspace}`, updatedCache);
        }
      }

      nexusReport("Aba única salva eficientemente.", 'DONE', 'NETWORK', taskId);
      return true;
    } catch (e: any) {
      nexusReport(`Erro ao salvar aba rápida: ${safeStringifyError(e)}`, 'FAIL', 'NETWORK', taskId);
      toast.error("Erro ao salvar configuração da aba isolada.");
      return false;
    }
  }, [activeWorkspace, nexusReport]);

  const saveConfig = useCallback(async (input: AppSection[] | ((prev: AppSection[]) => AppSection[])): Promise<boolean> => {
    let newSections: AppSection[];
    if (typeof input === 'function') {
      let resolved: AppSection[] = [];
      setSections(prev => {
        resolved = input(prev);
        return resolved;
      });
      newSections = resolved;
    } else {
      newSections = input;
      setSections(newSections);
    }

    if (newSections.length === 0 && sections.length > 0) return true;

    const taskId = 'SAVE_CONFIG';
    nexusReport("Sincronizando novas abas com o servidor...", 'START', 'NETWORK', taskId);
    
    try {
      const payload = newSections.map(s => {
        // Construct Metadata Item to store extended config inside JSON
        // This avoids "Column not found" 400 errors for non-standard columns
        const metadataItem = {
            id: 'SECTION_METADATA',
            openingHours: s.openingHours || null,
            description: s.description || null,
            address: s.address || null,
            imageUrl: s.imageUrl || null,
            whatsappMode: (s.whatsappMode || 'SYSTEM').toUpperCase(),
            manualWhatsapp: s.manualWhatsapp || null,
            fulfillmentMode: s.fulfillmentMode || 'PICKUP'
        };

        // Inject metadata into items array
        const itemsWithMetadata = [...(s.items || []), metadataItem];

        const base = {
          id: s.id,
          workspace_id: s.workspaceId,
          name: s.name,
          type: s.type,
          sort_order: s.order,
          items: itemsWithMetadata, 
          expenses: s.expenses || [],
          global_stock_mode: s.globalStockMode || 'GLOBAL',
          linked_section_id: s.linkedSectionId || null,
          is_public: s.isPublic || false,
          latitude: s.latitude || null,
          longitude: s.longitude || null,
          last_sync: new Date().toISOString()
        };

        return base;
      });

      await withRetry(async () => {
        const { error } = await supabase.from('app_config').upsert(payload);
        if (error) throw error;
      });

      if (newSections.length > 0) {
        await localforage.setItem(`${LS_CONFIG_KEY}_${newSections[0].workspaceId}`, newSections);
      }
      nexusReport("Estrutura salva e replicada.", 'DONE', 'NETWORK', taskId);
      return true;
    } catch (e: any) {
      nexusReport(`Erro ao salvar estrutura: ${safeStringifyError(e)}`, 'FAIL', 'NETWORK', taskId);
      toast.error("Erro ao salvar configuração.");
      return false;
    }
  }, [sections]);

  const deleteSection = useCallback(async (sectionId: string) => {
    const sectionToDelete = sections.find(s => String(s.id) === String(sectionId));
    if (!sectionToDelete) return;

    const taskId = `DEL_SEC_${sectionId}`;
    nexusReport(`Removendo aba ${sectionToDelete.name}...`, 'START', 'NETWORK', taskId);
    setSections(prev => prev.filter(s => String(s.id) !== String(sectionId)));
    
    try {
      await withRetry(async () => {
        const { error } = await supabase.from('app_config').delete().eq('id', sectionId);
        if (error) throw error;
      });
      nexusReport("Aba removida do servidor.", 'DONE', 'NETWORK', taskId);
    } catch (e: any) {
      nexusReport(`Erro ao deletar aba: ${safeStringifyError(e)}`, 'FAIL', 'NETWORK', taskId);
      toast.error("Erro ao deletar aba.");
    }
  }, [sections]);

  const addToOfflineStockQueue = useCallback(async (sectionId: string, itemUpdates: { id: string, quantity: number }[]) => {
    if (!activeWorkspace) return;
    const newAction = {
      sectionId,
      itemUpdates,
      _queueId: `stock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    const currentQueue: any[] = (await localforage.getItem(`offline_stock_${activeWorkspace}`)) || [];
    await localforage.setItem(`offline_stock_${activeWorkspace}`, [...currentQueue, newAction]);
  }, [activeWorkspace]);

  const updateStockAtomic = useCallback(async (sectionId: string, itemUpdates: { id: string, quantity: number }[], isSyncing = false): Promise<boolean> => {
    if (!navigator.onLine && !isSyncing) {
      await addToOfflineStockQueue(sectionId, itemUpdates);
      
      // Optimistic update locally
      setSections(prev => prev.map(s => {
        if (s.id !== sectionId) return s;
        const updatedItems = [...s.items];
        itemUpdates.forEach(update => {
          const itemIdx = updatedItems.findIndex(i => i.id === update.id);
          if (itemIdx !== -1) {
            const currentStock = updatedItems[itemIdx].currentStock || 0;
            updatedItems[itemIdx].currentStock = Math.max(0, currentStock - update.quantity);
          }
        });
        return { ...s, items: updatedItems };
      }));
      return true;
    }

    const taskId = `STOCK_ATOMIC_${sectionId}`;
    nexusReport(`Atualizando estoque atômico para aba ${sectionId}...`, 'START', 'NETWORK', taskId);
    
    try {
      // Tenta usar a função RPC (se o usuário já rodou o script SQL)
      let rpcSuccess = true;
      for (const update of itemUpdates) {
        const { error: rpcError } = await supabase.rpc('decrement_stock', {
          p_workspace_id: activeWorkspace || '',
          p_section_id: sectionId,
          p_item_id: update.id,
          p_amount: update.quantity
        });
        if (rpcError) {
          rpcSuccess = false;
          break;
        }
      }

      if (rpcSuccess) {
        nexusReport("Estoque atualizado via RPC.", 'DONE', 'NETWORK', taskId);
        // Atualiza o estado local para refletir a mudança
        setSections(prev => prev.map(s => {
          if (s.id !== sectionId) return s;
          const updatedItems = [...s.items];
          itemUpdates.forEach(update => {
            const itemIdx = updatedItems.findIndex(i => i.id === update.id);
            if (itemIdx !== -1) {
              const currentStock = updatedItems[itemIdx].currentStock || 0;
              updatedItems[itemIdx].currentStock = Math.max(0, currentStock - update.quantity);
            }
          });
          return { ...s, items: updatedItems };
        }));
        return true;
      }

      // Fallback: Lógica atual (lê, modifica, salva) caso o RPC falhe ou não exista
      if (!rpcSuccess) {
        const { data, error: fetchError } = await supabase
          .from('app_config')
          .select('*')
          .eq('id', sectionId)
          .single();
        
        if (fetchError) throw fetchError;
        if (!data) throw new Error("Seção não encontrada no servidor.");

        const currentSection = mapSection(data);
        const updatedItems = [...currentSection.items];

        itemUpdates.forEach(update => {
          const itemIdx = updatedItems.findIndex(i => i.id === update.id);
          if (itemIdx !== -1) {
            const currentStock = updatedItems[itemIdx].currentStock || 0;
            updatedItems[itemIdx].currentStock = Math.max(0, currentStock - update.quantity);
          }
        });

        // 2. Save back to app_config
        // Fallback: Full App Config update if RPC fails
        // We use a functional approach to construct the payload for saveConfig
        const success = await saveConfig((prev) => prev.map(s => {
          if (s.id !== sectionId) return s;
          return {
            ...s,
            items: (s.items || []).map(item => {
              const update = itemUpdates.find(u => u.id === item.id);
              if (!update) return item;
              const currentStock = item.currentStock || 0;
              return { ...item, currentStock: Math.max(0, currentStock - update.quantity) };
            })
          };
        }));
        
        if (success) {
          // 3. Also update inventory table for consistency
          const inventoryUpdates = itemUpdates.map(update => {
            const item = updatedItems.find(i => i.id === update.id);
            return {
              workspace_id: activeWorkspace,
              section_id: sectionId,
              item_id: update.id,
              quantity: item?.currentStock || 0,
              updated_at: new Date().toISOString()
            };
          });
          
          if (inventoryUpdates.length > 0) {
            supabase.from('inventory').upsert(inventoryUpdates, { onConflict: 'workspace_id, section_id, item_id' })
              .then(({ error }) => {
                if (error) console.error('Error updating inventory in fallback:', error);
              });
          }

          nexusReport("Estoque atualizado com sucesso (atômico).", 'DONE', 'NETWORK', taskId);
          return true;
        }
        throw new Error("Falha ao salvar configuração atualizada.");
      }
      return true;
    } catch (e: any) {
      if (!isSyncing && (isNetworkError(e) || !navigator.onLine)) {
        await addToOfflineStockQueue(sectionId, itemUpdates);
        
        // Optimistic update locally
        setSections(prev => prev.map(s => {
          if (s.id !== sectionId) return s;
          const updatedItems = [...s.items];
          itemUpdates.forEach(update => {
            const itemIdx = updatedItems.findIndex(i => i.id === update.id);
            if (itemIdx !== -1) {
              const currentStock = updatedItems[itemIdx].currentStock || 0;
              updatedItems[itemIdx].currentStock = Math.max(0, currentStock - update.quantity);
            }
          });
          return { ...s, items: updatedItems };
        }));
        return true;
      }
      nexusReport(`Erro no estoque atômico: ${safeStringifyError(e)}`, 'FAIL', 'NETWORK', taskId);
      toast.error("Erro ao atualizar estoque.");
      return false;
    }
  }, [activeWorkspace, isSyncing, mapSection, saveConfig, sections]);

  const syncOfflineStockQueue = useCallback(async () => {
    if (!activeWorkspace) return;
    const queue: any[] = (await localforage.getItem(`offline_stock_${activeWorkspace}`)) || [];
    if (queue.length === 0) return;

    setIsSyncing(true);
    console.log(`[OfflineSync] Sincronizando ${queue.length} atualizações de estoque pendentes...`);
    
    const remainingQueue = [...queue];
    
    for (const action of queue) {
      try {
        await updateStockAtomic(action.sectionId, action.itemUpdates, true);
        remainingQueue.shift();
        await localforage.setItem(`offline_stock_${activeWorkspace}`, remainingQueue);
      } catch (e: any) {
        console.error(`[OfflineSync] Erro na sincronização de estoque:`, e);
        if (isNetworkError(e) || !navigator.onLine) {
          break; // Stop processing on network error
        } else {
          // Discard action if it's a permanent error
          remainingQueue.shift();
          await localforage.setItem(`offline_stock_${activeWorkspace}`, remainingQueue);
        }
      }
    }
    setIsSyncing(false);
  }, [activeWorkspace, updateStockAtomic]);

  const adjustStockItem = useCallback(async (sectionId: string, itemId: string, amount: number, reason: string, userName: string) => {
    const taskId = `ADJUST_STOCK_${itemId}_${Date.now()}`;
    
    // Let updateStockAtomic handle the optimistic update and technical details
    try {
      // Note: updateStockAtomic subtracts, so we pass -amount for an adjustment
      const success = await updateStockAtomic(sectionId, [{ id: itemId, quantity: -amount }], false);
      
      if (success) {
        // Register movement
        const section = sections.find(s => s.id === sectionId);
        const item = section?.items.find(i => i.id === itemId);
        
        if (item) {
          const oldStock = (item.currentStock || 0);
          await registerStockMovement({
            workspace_id: activeWorkspace || '',
            item_id: itemId,
            item_name: item.name,
            movement_type: amount > 0 ? 'IN' : 'OUT',
            reason: reason as any,
            quantity: Math.abs(amount),
            previous_balance: oldStock,
            new_balance: Math.max(0, oldStock + amount),
            created_by: userName
          });
        }
      }

      return success;
    } catch (e) {
      console.error("Error adjusting stock:", e);
      // Revert if needed? Usually Realtime will sync back the truth if update fails
      return false;
    }
  }, [activeWorkspace, sections, updateStockAtomic]);

  const setActiveWorkspaceId = useCallback((id: string) => { setActiveWorkspace(id); }, []);

  const reconnect = useCallback(async () => {
    await syncOfflineStockQueue();
  }, [syncOfflineStockQueue]);

  return { sections, archives, publicStalls, saveConfig, updateSingleSection, deleteSection, updateStockAtomic, adjustStockItem, loading, hasMorePublic, isSyncing, reconnect, fetchConfigByWorkspace, fetchPublicStalls, fetchStallById };
};
