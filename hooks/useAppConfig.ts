
import { useState, useCallback, useEffect } from 'react';
import { AppSection } from '../types';
import { supabase, withRetry, safeStringifyError } from '../lib/supabase';

const LS_CONFIG_KEY = 'salgados_app_config_v1';

export const useAppConfig = () => {
  const [sections, setSections] = useState<AppSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);

  const nexusReport = (msg: string, status: 'START' | 'DONE' | 'FAIL', type: 'PROCESS' | 'NETWORK' = 'PROCESS', taskId?: string) => {
    if ((window as any).Nexus) (window as any).Nexus.report(msg, status, type, taskId);
  };

  const mapSection = useCallback((s: any): AppSection => ({
    id: s.id,
    workspaceId: s.workspace_id,
    name: s.name,
    type: s.type,
    order: s.sort_order,
    items: s.items || [],
    expenses: s.expenses || [],
    globalStockMode: s.global_stock_mode,
    linkedSectionId: s.linked_section_id
  }), []);

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
      
      if (data) {
        const mapped = data.map(mapSection);
        setSections(mapped);
        try {
          localStorage.setItem(`${LS_CONFIG_KEY}_${workspaceId}`, JSON.stringify(mapped));
        } catch (e) { console.warn("Falha ao salvar cache config"); }
        nexusReport(`Configuração de abas carregada (${mapped.length} abas).`, 'DONE', 'NETWORK', taskId);
      }
    } catch (e: any) {
      nexusReport(`Erro ao baixar abas: ${safeStringifyError(e)}`, 'FAIL', 'NETWORK', taskId);
      // Fallback
      try {
        const saved = localStorage.getItem(`${LS_CONFIG_KEY}_${workspaceId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setSections(parsed);
        }
      } catch (err) {
        console.warn("Cache de configuração corrompido, iniciando limpo.");
        localStorage.removeItem(`${LS_CONFIG_KEY}_${workspaceId}`);
      }
    } finally {
      setLoading(false);
    }
  }, [mapSection]);

  // --- SINCRONIZAÇÃO REALTIME E REVALIDAÇÃO ---
  useEffect(() => {
    if (!activeWorkspace) return;

    // 1. Canal Realtime
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
              return [...others, updated].sort((a, b) => (a.order || 0) - (b.order || 0));
            });
          } else if (payload.eventType === 'DELETE') {
            setSections(prev => prev.filter(s => String(s.id) !== String(payload.old.id)));
          }
        }
      )
      .subscribe();

    // 2. Revalidação por Foco
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchConfigByWorkspace(activeWorkspace);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      supabase.removeChannel(configChannel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [activeWorkspace, mapSection, fetchConfigByWorkspace]);

  const saveConfig = async (newSections: AppSection[]) => {
    setSections(newSections);
    const taskId = 'SAVE_CONFIG';
    nexusReport("Sincronizando novas abas com o servidor...", 'START', 'NETWORK', taskId);
    
    try {
      const payload = newSections.map(s => ({
        id: s.id,
        workspace_id: s.workspaceId,
        name: s.name,
        type: s.type,
        sort_order: s.order,
        items: s.items || [],
        expenses: s.expenses || [],
        global_stock_mode: s.globalStockMode || 'GLOBAL',
        linked_section_id: s.linkedSectionId || null
      }));

      await withRetry(async () => {
        const { error } = await supabase.from('app_config').upsert(payload);
        if (error) throw error;
      });

      if (newSections.length > 0) {
        localStorage.setItem(`${LS_CONFIG_KEY}_${newSections[0].workspaceId}`, JSON.stringify(newSections));
      }
      nexusReport("Estrutura salva e replicada.", 'DONE', 'NETWORK', taskId);
    } catch (e: any) {
      nexusReport(`Erro ao salvar estrutura: ${safeStringifyError(e)}`, 'FAIL', 'NETWORK', taskId);
    }
  };

  const deleteSection = async (sectionId: string) => {
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
      
      const wsId = sectionToDelete.workspaceId;
      localStorage.setItem(`${LS_CONFIG_KEY}_${wsId}`, JSON.stringify(sections.filter(s => String(s.id) !== String(sectionId))));
      nexusReport("Aba removida do servidor.", 'DONE', 'NETWORK', taskId);
    } catch (e: any) {
      nexusReport(`Erro ao deletar aba: ${safeStringifyError(e)}`, 'FAIL', 'NETWORK', taskId);
    }
  };

  return { sections, saveConfig, deleteSection, loading, fetchConfigByWorkspace };
};
