
import { useState, useCallback, useEffect } from 'react';
import { StoreProfile, PortfolioItem } from '../types';
import { supabase, withRetry, safeStringifyError, isNetworkError, withTimeout } from '../lib/supabase';
import { toast } from 'sonner';

let lastProfilesFetchTime = 0;
const PROFILES_CACHE_TTL = 1000 * 60 * 2; // 2 minutes cache 

export const useStoreProfiles = () => {
  const [profiles, setProfiles] = useState<StoreProfile[]>(() => {
    try {
      const saved = localStorage.getItem('cached_marketplace_profiles');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

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
    portfolio: p.portfolio || [],
    fulfillmentMode: p.fulfillment_mode || 'BOTH',
    pixKey: p.pix_key || '',
    deliveryConfig: p.delivery_config || {}
  }), []);

  const fetchPublicProfiles = useCallback(async (force: boolean = false, page: number = 0, limit: number = 50) => {
    if (!force && page === 0 && Date.now() - lastProfilesFetchTime < PROFILES_CACHE_TTL && profiles.length > 0) {
      return; 
    }
    
    const from = page * limit;
    const to = from + limit - 1;

    if (page === 0) setLoading(true);
    try {
      await withRetry(async () => {
        // PERFORMANCE OPTIMIZATION: Exclude heavy portfolio and banner_url from list view
        let response = await supabase
          .from('vw_active_marketplace')
          .select('id, workspace_id, name, description, address, whatsapp, logo_url, latitude, longitude, active, fulfillment_mode')
          .order('name')
          .range(from, to);
          
        if (response.error) {
          response = await supabase
            .from('store_profiles')
            .select('id, workspace_id, name, description, address, whatsapp, logo_url, latitude, longitude, active, fulfillment_mode')
            .eq('active', true)
            .order('name')
            .range(from, to);
        }

        if (response.error) throw response.error;
        
        if (response.data) {
          const mapped = response.data.map(mapProfile);
          setHasMore(mapped.length === limit);
          setProfiles(prev => {
            if (page === 0) return mapped;
            // Merge avoid duplicates
            const existingIds = new Set(prev.map((p: any) => p.id));
            const fresh = mapped.filter((p: any) => !existingIds.has(p.id));
            return [...prev, ...fresh];
          });
          
          if (page === 0) {
            lastProfilesFetchTime = Date.now();
            try {
              localStorage.setItem('cached_marketplace_profiles', JSON.stringify(mapped));
            } catch (e) {}
          }
        }
      });
    } catch (e: any) {
      console.warn("Nexus: Erro ao buscar vitrine pública.", e);
      if (page === 0) {
        toast.error("Erro ao carregar lojas em destaque. Exibindo dados em cache.");
        try {
          const saved = localStorage.getItem('cached_marketplace_profiles');
          if (saved) setProfiles(JSON.parse(saved));
        } catch {}
      }
    } finally {
      if (page === 0) setLoading(false);
    }
  }, [mapProfile, profiles.length]);

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

  const getMyProfile = useCallback(async (workspaceId: string) => {
    if (!workspaceId) return null;
    try {
      // Reduced retries and timeout for fetch
      return await withTimeout(withRetry(async () => {
        const { data, error } = await supabase
          .from('store_profiles')
          .select('*')
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        
        if (error) throw error;
        return data ? mapProfile(data) : null;
      }, 2, 2000), 10000); 
    } catch (e: any) {
      console.warn("Nexus: Falha ao recuperar perfil da loja.");
      return null;
    }
  }, [mapProfile]);

  const saveProfile = useCallback(async (profile: Partial<StoreProfile> & { workspaceId: string }) => {
    try {
      const payload: any = {
        workspace_id: profile.workspaceId,
      };

      // Only add fields if they are defined, allowing partial updates.
      // If the component passes undefined, these lines skip, and upsert (on existing row) keeps old values.
      if (profile.name !== undefined) payload.name = (profile.name || '').trim().substring(0, 100);
      if (profile.description !== undefined) payload.description = (profile.description || '').trim().substring(0, 500);
      if (profile.address !== undefined) payload.address = (profile.address || '').trim().substring(0, 255);
      if (profile.whatsapp !== undefined) payload.whatsapp = (profile.whatsapp || '').replace(/\D/g, '');
      if (profile.cnpj !== undefined) payload.cnpj = (profile.cnpj || '').replace(/\D/g, '');
      if (profile.instagram !== undefined) payload.instagram = (profile.instagram || '').replace('@', '').trim();
      if (profile.facebook !== undefined) payload.facebook = (profile.facebook || '').trim();
      
      // Explicitly check for undefined to allow omitting the field (to keep existing) 
      if (profile.logoUrl !== undefined) payload.logo_url = profile.logoUrl || null;
      if (profile.bannerUrl !== undefined) payload.banner_url = profile.bannerUrl || null;
      
      if (profile.latitude !== undefined) payload.latitude = Number(profile.latitude) || 0;
      if (profile.longitude !== undefined) payload.longitude = Number(profile.longitude) || 0;
      if (profile.active !== undefined) payload.active = Boolean(profile.active);
      if (profile.fulfillmentMode !== undefined) payload.fulfillment_mode = profile.fulfillmentMode;
      if (profile.pixKey !== undefined) payload.pix_key = (profile.pixKey || '').trim();
      if (profile.deliveryConfig !== undefined) payload.delivery_config = profile.deliveryConfig;
      
      // Optimization: Only send portfolio if it was actually included in the update object
      if (profile.portfolio !== undefined) {
        payload.portfolio = Array.isArray(profile.portfolio) ? profile.portfolio : [];
      }

      // Reduced retry count to 1 for save operations to fail fast if payload is too big or server is erroring
      console.log("Nexus: Saving payload to Supabase:", payload);
      const result = await withTimeout(withRetry(async () => {
        const { data, error } = await supabase
          .from('store_profiles')
          .upsert(payload, { onConflict: 'workspace_id' })
          .select();

        if (error) throw error;
        return data;
      }, 1, 2000), 30000); // 30s max timeout for saving

      if (result && result[0]) return mapProfile(result[0]);
      return null;
    } catch (e) {
      throw new Error(safeStringifyError(e));
    }
  }, [mapProfile]);

  return { profiles, loading, hasMore, fetchPublicProfiles, getMyProfile, saveProfile };
};
