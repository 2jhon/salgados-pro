
import React, { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Bell, ShoppingBag, TrendingUp } from 'lucide-react';

interface RealtimeBrokerProps {
  workspaceId: string;
  onNewTransaction?: (tx: any) => void;
  onNewNote?: (note: any) => void;
  enabledSounds?: boolean;
}

export const RealtimeBroker: React.FC<RealtimeBrokerProps> = ({ 
  workspaceId, 
  onNewTransaction, 
  onNewNote,
  enabledSounds = true 
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const onNewTransactionRef = useRef(onNewTransaction);
  const onNewNoteRef = useRef(onNewNote);

  useEffect(() => {
    onNewTransactionRef.current = onNewTransaction;
  }, [onNewTransaction]);

  useEffect(() => {
    onNewNoteRef.current = onNewNote;
  }, [onNewNote]);

  const playNotificationSound = () => {
    if (!enabledSounds) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); // A4

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn("Falha ao tocar som de notificação:", e);
    }
  };

  useEffect(() => {
    if (!workspaceId) return;

    console.log(`[RealtimeBroker] Iniciando monitoramento para workspace: ${workspaceId}`);

    const channel = supabase
      .channel(`global_realtime_${workspaceId}`)
      // Monitora Notas (Pedidos/Alertas)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notes', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[RealtimeBroker] Nova Nota:', payload.new);
          playNotificationSound();
          
          const note = payload.new;
          toast.info(
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <Bell className="text-indigo-600" size={18} />
              </div>
              <div>
                <p className="font-bold text-xs uppercase tracking-tight">Nova Notificação</p>
                <p className="text-[10px] text-slate-500 line-clamp-1">{note.content}</p>
              </div>
            </div>,
            { duration: 5000 }
          );

          if (onNewNoteRef.current) onNewNoteRef.current(note);
        }
      )
      // Monitora Transações (Vendas/Gastos)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[RealtimeBroker] Nova Transação:', payload.new);
          
          // Se for uma venda externa (do Marketplace) ou feita por outro usuário
          // No momento não temos 'userId' na transação mas temos 'created_by'
          playNotificationSound();
          
          const tx = payload.new;
          const isVenda = tx.sub_category === 'VENDAS' || tx.sub_category === 'A_RECEBER';
          
          toast.success(
            <div className="flex items-center gap-3">
              <div className={isVenda ? "bg-emerald-100 p-2 rounded-lg" : "bg-rose-100 p-2 rounded-lg"}>
                {isVenda ? <ShoppingBag className="text-emerald-600" size={18} /> : <TrendingUp className="text-rose-600" size={18} />}
              </div>
              <div>
                <p className="font-bold text-xs uppercase tracking-tight">
                  {isVenda ? 'Novo Pedido / Venda' : 'Novo Lançamento'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {tx.item} - R$ {Number(tx.value).toFixed(2)}
                </p>
              </div>
            </div>,
            { duration: 5000 }
          );

          if (onNewTransactionRef.current) onNewTransactionRef.current(tx);
        }
      )
      .subscribe((status) => {
        console.log(`[RealtimeBroker] Status: ${status}`);
      });

    return () => {
      console.log('[RealtimeBroker] Encerrando canais...');
      supabase.removeChannel(channel);
    };
  }, [workspaceId, enabledSounds]);

  return null; // Componente "invisível"
};
