
import { useState, useEffect, useCallback, useRef } from 'react';
import { Ad } from '../types';
import { supabase, safeStringifyError } from '../lib/supabase';

const LS_ADS_KEY = 'salgados_ads_v1';

export const useAds = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef<any>(null);

  const nexusReport = (msg: string, status: 'START' | 'DONE' | 'FAIL', type: 'PROCESS' | 'NETWORK' = 'PROCESS', taskId?: string) => {
    if ((window as any).Nexus) (window as any).Nexus.report(msg, status, type, taskId);
  };

  const mapAd = useCallback((ad: any): Ad => ({
    id: ad.id,
    workspaceId: ad.workspace_id,
    ownerId: ad.owner_id,
    ownerName: ad.owner_name,
    title: ad.title,
    description: ad.description,
    longDescription: ad.long_description,
    link: ad.link,
    backgroundColor: ad.background_color,
    mediaUrl: ad.media_url,
    mediaType: ad.media_type,
    active: ad.active,
    clicks: ad.clicks || 0,
    expiresAt: ad.expires_at
  }), []);

  const fetchAds = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ads')
        .select('*');
      
      if (error) throw error;

      if (data) {
        const mapped = data.map(mapAd);
        setAds(mapped);
      }
    } catch (e: any) {
      console.warn("Aviso useAds:", e.message);
    } finally {
      setLoading(false);
    }
  }, [mapAd]);

  useEffect(() => {
    fetchAds();

    if (!subscriptionRef.current) {
      subscriptionRef.current = supabase
        .channel('ads_realtime_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ads' },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newAd = mapAd(payload.new);
              setAds(prev => {
                const others = prev.filter(a => String(a.id) !== String(newAd.id));
                return [...others, newAd];
              });
            } else if (payload.eventType === 'DELETE') {
              setAds(prev => prev.filter(a => String(a.id) !== String(payload.old.id)));
            }
          }
        )
        .subscribe();
    }

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [fetchAds, mapAd]);

  const saveAd = async (ad: Partial<Ad> & { ownerId: string, workspaceId: string }) => {
    const taskId = `SAVE_AD_${Date.now()}`;
    nexusReport(`Processando solicitação de anúncio: ${ad.title}`, 'START', 'NETWORK', taskId);
    
    try {
      const payload: any = {
        workspace_id: ad.workspaceId,
        owner_id: ad.ownerId,
        owner_name: ad.ownerName,
        title: ad.title,
        description: ad.description,
        long_description: ad.longDescription,
        link: ad.link,
        background_color: ad.backgroundColor,
        media_url: ad.mediaUrl,
        media_type: ad.mediaType,
        active: false // Sempre inativo até que o admin aprove via WhatsApp
      };

      if (ad.id) {
        payload.id = ad.id;
      }

      const { data, error } = await supabase
        .from('ads')
        .upsert(payload)
        .select();
      
      if (error) throw error;

      if (data && data[0]) {
        const result = mapAd(data[0]);
        nexusReport("Anúncio salvo. Aguardando ativação.", 'DONE', 'NETWORK', taskId);
        return result;
      }
    } catch (err: any) {
      const errorMsg = safeStringifyError(err);
      console.error("Erro ao salvar anúncio:", errorMsg);
      nexusReport(`Falha: ${errorMsg}`, 'FAIL', 'NETWORK', taskId);
    }
    return null;
  };

  const deleteAd = async (adId: string) => {
    const taskId = `DEL_AD_${adId}`;
    try {
      const { error } = await supabase.from('ads').delete().eq('id', adId);
      if (error) throw error;
      setAds(prev => prev.filter(a => String(a.id) !== String(adId)));
      return true;
    } catch (e: any) {
      return false;
    }
  };

  const incrementClick = async (ad_id: string) => {
    try {
      await supabase.rpc('increment_ad_clicks', { ad_id });
    } catch (e) {}
  };

  return { ads, loading, saveAd, deleteAd, incrementClick, fetchAds };
};
