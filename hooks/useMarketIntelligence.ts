import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface TrendingItem {
  item_id: string;
  workspace_id: string;
  engine_score: number;
  total_interactions: number;
}

export interface HotKeyword {
  keyword: string;
  search_volume: number;
}

export interface AffinityScore {
  identity_ref: string;
  workspace_id: string;
  interaction_count: number;
}

export const useMarketIntelligence = () => {
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([]);
  const [hotKeywords, setHotKeywords] = useState<HotKeyword[]>([]);
  const [userAffinity, setUserAffinity] = useState<AffinityScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Busca o ranking de produtos com maior score nas view agregada
  const fetchTrendingItems = useCallback(async (limit: number = 10) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('vw_trending_market_items')
        .select('*')
        .order('engine_score', { ascending: false })
        .limit(limit);

      if (!error && data) {
        setTrendingItems(data);
      }
    } catch (e) {
      console.error('Erro ao buscar trendings:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Busca os termos mais pesquisados globalmente para usar nas tags e recomendações
  const fetchHotKeywords = useCallback(async (limit: number = 5) => {
    try {
      const { data, error } = await supabase
        .from('vw_hot_search_keywords')
        .select('*')
        .order('search_volume', { ascending: false })
        .limit(limit);

      if (!error && data) {
        setHotKeywords(data);
      }
    } catch (e) {
      console.error('Erro ao buscar keywords:', e);
    }
  }, []);

  // Busca as lojas que este usuário/sessão mais interage
  const fetchUserAffinity = useCallback(async (identityRef: string, limit: number = 5) => {
    try {
      const { data, error } = await supabase
        .from('vw_customer_affinity')
        .select('*')
        .eq('identity_ref', identityRef)
        .order('interaction_count', { ascending: false })
        .limit(limit);

      if (!error && data) {
        setUserAffinity(data);
      }
    } catch (e) {
      console.error('Erro ao buscar afinidades:', e);
    }
  }, []);

  return {
    trendingItems,
    hotKeywords,
    userAffinity,
    isLoading,
    fetchTrendingItems,
    fetchHotKeywords,
    fetchUserAffinity
  };
};
