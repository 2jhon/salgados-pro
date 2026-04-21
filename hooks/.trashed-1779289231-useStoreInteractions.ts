import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { StoreInteraction, StoreRating } from '../types';
import { toast } from 'sonner';

export const useStoreInteractions = (userId?: string) => {
  const [isLoading, setIsLoading] = useState(false);

  const toggleInteraction = useCallback(async (workspaceId: string, type: 'FOLLOW' | 'FAVORITE') => {
    if (!userId) {
      toast.error("Você precisa estar logado para interagir.");
      return false;
    }
    setIsLoading(true);
    try {
      // Check if exists
      const { data: existing, error: fetchError } = await supabase
        .from('store_interactions')
        .select('id')
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .eq('type', type)
        .maybeSingle();

      if (fetchError) {
        if (fetchError.code === '42P01') {
           toast.error("Tabela não encontrada. Execute o script SQL de Engajamento no Supabase.");
        } else {
           toast.error("Erro de permissão ou conexão ao buscar interação.");
        }
        throw fetchError;
      }

      if (existing) {
        // Remove
        const { error } = await supabase.from('store_interactions').delete().eq('id', existing.id);
        if (error) throw error;
        return false; // Not interacting anymore
      } else {
        // Add
        const { error } = await supabase.from('store_interactions').insert([{
          user_id: userId,
          workspace_id: workspaceId,
          type
        }]);
        if (error) {
           if (error.code === '42501') {
               toast.error("Erro de permissão (RLS). Execute o script SQL atualizado.");
           }
           throw error;
        }
        return true; // Interacting now
      }
    } catch (e: any) {
      console.error(`Error toggling ${type}:`, e);
      if (e.code !== '42P01' && e.code !== '42501') {
          toast.error("Ocorreu um erro ao processar sua ação.");
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const submitRating = useCallback(async (workspaceId: string, stars: number, comment?: string) => {
    if (!userId) {
      toast.error("Você precisa estar logado para avaliar.");
      return false;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('store_ratings')
        .upsert({
          user_id: userId,
          workspace_id: workspaceId,
          stars,
          comment,
          created_at: new Date().toISOString()
        }, { onConflict: 'user_id, workspace_id' });

      if (error) {
         if (error.code === '42P01') {
            toast.error("Tabela não encontrada. Execute o script SQL de Engajamento no Supabase.");
         } else if (error.code === '42501') {
            toast.error("Erro de permissão (RLS). Execute o script SQL atualizado.");
         }
         throw error;
      }
      return true;
    } catch (e: any) {
      console.error('Error submitting rating:', e);
      if (e.code !== '42P01' && e.code !== '42501') {
          toast.error("Ocorreu um erro ao enviar sua avaliação.");
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const getStoreAverageRating = useCallback(async (workspaceId: string) => {
    try {
      const { data, error } = await supabase
        .from('store_ratings')
        .select('stars')
        .eq('workspace_id', workspaceId);

      if (error) throw error;
      if (!data || data.length === 0) return { average: 0, count: 0 };

      const total = data.reduce((acc, curr) => acc + curr.stars, 0);
      return {
        average: total / data.length,
        count: data.length
      };
    } catch (e) {
      console.error('Error getting average rating:', e);
      return { average: 0, count: 0 };
    }
  }, []);

  const getUserInteractions = useCallback(async () => {
    if (!userId) return { follows: [], favorites: [], ratings: [] };
    try {
      const [interactionsRes, ratingsRes] = await Promise.all([
        supabase.from('store_interactions').select('*').eq('user_id', userId),
        supabase.from('store_ratings').select('*').eq('user_id', userId)
      ]);

      return {
        follows: interactionsRes.data?.filter(i => i.type === 'FOLLOW').map(i => i.workspace_id) || [],
        favorites: interactionsRes.data?.filter(i => i.type === 'FAVORITE').map(i => i.workspace_id) || [],
        ratings: ratingsRes.data || []
      };
    } catch (e) {
      console.error('Error fetching user interactions:', e);
      return { follows: [], favorites: [], ratings: [] };
    }
  }, [userId]);

  return {
    isLoading,
    toggleInteraction,
    submitRating,
    getStoreAverageRating,
    getUserInteractions
  };
};
