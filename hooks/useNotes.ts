import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Note } from '../types';

export const useNotes = (workspaceId?: string) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const mapNote = (n: any): Note => ({
    id: n.id,
    workspaceId: n.workspace_id,
    createdById: n.created_by_id,
    createdByName: n.created_by_name,
    content: n.content,
    type: n.type,
    amount: n.amount,
    isRead: n.is_read,
    createdAt: n.created_at
  });

  const fetchNotes = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // Ignora erro se a tabela não existir para evitar crash
        console.warn("Tabela 'notes' não acessível ou inexistente:", error.message);
        return;
      }
      
      if (data) setNotes(data.map(mapNote));
    } catch (e) {
      console.warn("Erro ao buscar notas:", e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    fetchNotes();

    try {
      const channel = supabase
        .channel(`notes_realtime_${workspaceId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotes(prev => [mapNote(payload.new), ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setNotes(prev => prev.map(n => n.id === payload.new.id ? mapNote(payload.new) : n));
          } else if (payload.eventType === 'DELETE') {
            setNotes(prev => prev.filter(n => n.id !== payload.old.id));
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    } catch(e) {
      console.warn("Erro ao subscrever realtime notes:", e);
    }
  }, [workspaceId, fetchNotes]);

  const addNote = async (note: Omit<Note, 'id' | 'createdAt' | 'isRead'>) => {
    try {
      const { error } = await supabase.from('notes').insert({
        workspace_id: note.workspaceId,
        created_by_id: note.createdById,
        created_by_name: note.createdByName,
        content: note.content,
        type: note.type,
        amount: note.amount,
        is_read: false
      });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error("Erro ao enviar nota:", e);
      return false;
    }
  };

  const markAsRead = async (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    try {
      await supabase.from('notes').update({ is_read: true }).eq('id', id);
    } catch (e) {}
  };

  const deleteNote = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    try {
      await supabase.from('notes').delete().eq('id', id);
    } catch (e) {
      console.error("Erro ao deletar nota:", e);
    }
  };

  const clearReadNotes = async () => {
    setNotes(prev => prev.filter(n => !n.isRead));
    try {
      await supabase.from('notes').delete().eq('workspace_id', workspaceId).eq('is_read', true);
    } catch (e) {
      console.error("Erro ao limpar notas lidas:", e);
    }
  };

  const unreadCount = notes.filter(n => !n.isRead).length;

  return { notes, loading, addNote, markAsRead, deleteNote, clearReadNotes, unreadCount };
};