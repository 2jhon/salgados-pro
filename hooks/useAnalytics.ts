
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { StoreAnalyticsSummary, ProductClickDetail } from '../types';

export const useAnalytics = (userWorkspaceId?: string) => {
  
  const trackView = useCallback(async (workspaceId: string, customerId?: string) => {
    // Não conta views do próprio dono na sua loja para não inflar métricas
    if (userWorkspaceId === workspaceId) return;
    
    try {
      await supabase.from('store_analytics_views').insert({
        workspace_id: workspaceId,
        customer_id: customerId || null
      });
    } catch (e) {
      console.warn("[Analytics] Erro ao registrar view:", e);
    }
  }, [userWorkspaceId]);

  const trackProductClick = useCallback(async (workspaceId: string, productId: string, customerId?: string) => {
    if (userWorkspaceId === workspaceId) return;

    try {
      await supabase.from('store_analytics_clicks').insert({
        workspace_id: workspaceId,
        product_id: productId,
        customer_id: customerId || null
      });
    } catch (e) {
      console.warn("[Analytics] Erro ao registrar clique no produto:", e);
    }
  }, [userWorkspaceId]);

  const getStoreSummary = useCallback(async (workspaceId: string): Promise<StoreAnalyticsSummary | null> => {
    try {
      // 1. Fetch main summary view silently to prevent query panic
      const { data: viewData, error: viewError } = await supabase
        .from('vw_store_analytics_summary')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (viewError) {
        console.warn("[Analytics] Alerta de integracao da View. Realizando calculo manual retroativo...", viewError);
      }

      // 2. Extração à prova de falhas: buscando os IDs em vez de .count() para burlar configurações rígidas de PostgREST 
      const [followersRes, favoritesRes, ratingsRes, viewsRes, clicksRes] = await Promise.all([
        supabase.from('store_interactions').select('id').eq('workspace_id', workspaceId).eq('type', 'FOLLOW'),
        supabase.from('store_interactions').select('id').eq('workspace_id', workspaceId).eq('type', 'FAVORITE'),
        supabase.from('store_ratings').select('stars').eq('workspace_id', workspaceId),
        // Se a View falhou, puxa os clicks e views na mão também, garante total integridade.
        !viewData ? supabase.from('store_analytics_views').select('id').eq('workspace_id', workspaceId) : Promise.resolve({ data: null }),
        !viewData ? supabase.from('store_analytics_clicks').select('id').eq('workspace_id', workspaceId) : Promise.resolve({ data: null })
      ]);

      const followersCount = followersRes.data?.length || 0;
      const favoritesCount = favoritesRes.data?.length || 0;
      
      let avgRating = 0;
      let totalRatings = 0;
      if (ratingsRes.data && ratingsRes.data.length > 0) {
         totalRatings = ratingsRes.data.length;
         avgRating = Number((ratingsRes.data.reduce((acc, curr) => acc + curr.stars, 0) / totalRatings).toFixed(1));
      }

      return {
        workspaceId: workspaceId,
        totalViews: viewData ? viewData.total_views : (viewsRes.data?.length || 0),
        totalClicks: viewData ? viewData.total_clicks : (clicksRes.data?.length || 0),
        totalFollowers: followersCount,
        totalFavorites: favoritesCount,
        avgRating: avgRating,
        totalRatings: totalRatings,
        pendingReports: viewData?.pending_reports || 0
      };
    } catch (e) {
      console.error("[Analytics] Falha extrema ao calcular resumo:", e);
      return null;
    }
  }, []);

  const getTopProducts = useCallback(async (workspace_id: string): Promise<ProductClickDetail[]> => {
    try {
      // Busca os cliques agrupados por produto para este workspace
      const { data, error } = await supabase
        .from('store_analytics_clicks')
        .select('product_id')
        .eq('workspace_id', workspace_id);

      if (error) throw error;
      if (!data) return [];

      // Agregando localmente (poderia ser uma view, mas essa lógica de count 
      // é rápida para volumes médios e evita criar muitas views agora)
      const counts: Record<string, number> = {};
      data.forEach(row => {
        counts[row.product_id] = (counts[row.product_id] || 0) + 1;
      });

      // Nota: Esta função precisaria dos nomes dos produtos para ser 100% útil.
      // Em uma implementação real, cruzaríamos com os nomes salvos no portfolio.
      return Object.entries(counts).map(([productId, clicks]) => ({
        productId,
        productName: 'Produto', // Temporário, será resolvido no dashboard cruzando com o portfólio
        clicks
      })).sort((a, b) => b.clicks - a.clicks);

    } catch (e) {
      console.error("[Analytics] Erro ao buscar top produtos:", e);
      return [];
    }
  }, []);

  const getFinancialInsights = useCallback(async (workspaceId: string) => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
      
      const { data, error } = await supabase
        .from('transactions')
        .select('date, value, sub_category, is_pending')
        .eq('workspace_id', workspaceId)
        .gte('date', sevenDaysAgo);

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error("[Analytics] Erro ao buscar insights financeiros:", e);
      return [];
    }
  }, []);

  return { trackView, trackProductClick, getStoreSummary, getTopProducts, getFinancialInsights };
};
