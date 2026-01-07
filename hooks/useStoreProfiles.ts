
import { useState, useCallback, useEffect } from 'react';
import { StoreProfile, PortfolioItem } from '../types';
import { supabase, withRetry, safeStringifyError, isNetworkError, withTimeout } from '../lib/supabase';

export const useStoreProfiles = () => {
  const [profiles, setProfiles] = useState<StoreProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const mapProfile = useCallback((p: any): StoreProfile => ({
    id: p.id,
    workspaceId: p.workspace_id,
    name: p.name || 'Loja sem Nome',
    description: p.description || '',
    address: p.address || '',
    whatsapp: p.whatsapp || '',
    cnpj: p.cnpj || '',
    instagram: p.instagram || '',
    facebook: p.facebook || '',
    logoUrl: p.logo_url,
    bannerUrl: p.banner_url || p.banner_uri,
    latitude: Number(p.latitude) || 0,
    longitude: Number(p.longitude) || 0,
    active: p.active === true || p.active === 1 || p.active === 'true',
    portfolio: p.portfolio || []
  }), []);

  const fetchPublicProfiles = useCallback(async () => {
    setLoading(true);
    try {
      await withRetry(async () => {
        const { data, error } = await supabase
          .from('store_profiles')
          .select('*')
          .eq('active', true)
          .order('name');
        
        if (error) throw error;
        
        if (data) {
          const mapped = data.map(mapProfile);
          setProfiles(mapped);
        }
      });
    } catch (e) {
      console.warn("Nexus: Erro ao buscar vitrine pública.", e);
    } finally {
      setLoading(false);
    }
  }, [mapProfile]);

  // --- MARKETPLACE REALTIME ---
  // Mantém a vitrine atualizada globalmente para todos os clientes
  useEffect(() => {
    const channel = supabase
      .channel('public_marketplace_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'store_profiles',
          filter: 'active=eq.true' 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newProfile = mapProfile(payload.new);
            setProfiles(prev => {
              // Evita duplicatas se já existir
              if (prev.find(p => p.id === newProfile.id)) return prev;
              return [...prev, newProfile].sort((a,b) => a.name.localeCompare(b.name));
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = mapProfile(payload.new);
            setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
          } else if (payload.eventType === 'DELETE') {
            setProfiles(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mapProfile]);

  const getMyProfile = async (workspaceId: string) => {
    if (!workspaceId) return null;
    try {
      return await withTimeout(withRetry(async () => {
        const { data, error } = await supabase
          .from('store_profiles')
          .select('*')
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        
        if (error) throw error;
        return data ? mapProfile(data) : null;
      }, 3, 2000), 45000);
    } catch (e: any) {
      console.warn("Nexus: Falha ao recuperar perfil da loja.");
      return null;
    }
  };

  /**
   * ATUALIZAÇÃO LEVE: Altera apenas campos de texto/identidade.
   * Evita enviar o portfólio (JSONB pesado) para não causar timeout.
   */
  const updateBasicProfile = async (workspaceId: string, data: Partial<Omit<StoreProfile, 'portfolio' | 'id' | 'workspaceId'>>) => {
    try {
      const payload: any = {};
      if (data.name !== undefined) payload.name = data.name.trim().substring(0, 100);
      if (data.description !== undefined) payload.description = data.description.trim().substring(0, 500);
      if (data.whatsapp !== undefined) payload.whatsapp = data.whatsapp.replace(/\D/g, '');
      if (data.cnpj !== undefined) payload.cnpj = data.cnpj.replace(/\D/g, '');
      if (data.instagram !== undefined) payload.instagram = data.instagram.replace('@', '').trim();
      if (data.facebook !== undefined) payload.facebook = data.facebook.trim();
      if (data.address !== undefined) payload.address = data.address.trim();
      if (data.logoUrl !== undefined) payload.logo_url = data.logoUrl;
      if (data.bannerUrl !== undefined) payload.banner_url = data.bannerUrl;
      if (data.active !== undefined) payload.active = Boolean(data.active);

      const result = await withTimeout(withRetry(async () => {
        const { data: updated, error } = await supabase
          .from('store_profiles')
          .update(payload)
          .eq('workspace_id', workspaceId)
          .select();

        if (error) throw error;
        return updated;
      }, 2, 3000), 60000);

      if (result && result[0]) return mapProfile(result[0]);
      return null;
    } catch (e) {
      throw new Error(safeStringifyError(e));
    }
  };

  const saveProfile = async (profile: Omit<StoreProfile, 'id'>) => {
    try {
      const payload = {
        workspace_id: profile.workspaceId,
        name: (profile.name || 'Minha Loja').trim().substring(0, 100),
        description: (profile.description || '').trim().substring(0, 500),
        address: (profile.address || '').trim().substring(0, 255),
        whatsapp: (profile.whatsapp || '').replace(/\D/g, ''),
        cnpj: (profile.cnpj || '').replace(/\D/g, ''),
        instagram: (profile.instagram || '').replace('@', '').trim(),
        facebook: (profile.facebook || '').trim(),
        logo_url: profile.logoUrl || null,
        banner_url: profile.bannerUrl || null,
        latitude: Number(profile.latitude) || 0,
        longitude: Number(profile.longitude) || 0,
        active: Boolean(profile.active),
        portfolio: Array.isArray(profile.portfolio) ? profile.portfolio : []
      };

      const result = await withTimeout(withRetry(async () => {
        const { data, error } = await supabase
          .from('store_profiles')
          .upsert(payload, { onConflict: 'workspace_id' })
          .select();

        if (error) throw error;
        return data;
      }, 2, 4000), 80000);

      if (result && result[0]) return mapProfile(result[0]);
      return null;
    } catch (e) {
      throw new Error(safeStringifyError(e));
    }
  };

  return { profiles, loading, fetchPublicProfiles, getMyProfile, saveProfile, updateBasicProfile };
};
