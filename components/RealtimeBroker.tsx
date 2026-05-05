
import React, { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Bell, ShoppingBag, TrendingUp } from 'lucide-react';
import { playSoundFromCategory } from '../lib/utils';

interface RealtimeBrokerProps {
  workspaceId: string;
  onNewTransaction?: (tx: any) => void;
  onTransactionUpdate?: (tx: any) => void;
  onNewNote?: (note: any) => void;
  enabledSounds?: boolean;
  currentUserName?: string;
}

export const RealtimeBroker: React.FC<RealtimeBrokerProps> = ({ 
  workspaceId, 
  onNewTransaction, 
  onTransactionUpdate,
  onNewNote,
  enabledSounds = true, // We still use this to disable entirely if needed
  currentUserName
}) => {
  const onNewTransactionRef = useRef(onNewTransaction);
  const onTransactionUpdateRef = useRef(onTransactionUpdate);
  const onNewNoteRef = useRef(onNewNote);

  useEffect(() => {
    onNewTransactionRef.current = onNewTransaction;
  }, [onNewTransaction]);

  useEffect(() => {
    onTransactionUpdateRef.current = onTransactionUpdate;
  }, [onTransactionUpdate]);

  useEffect(() => {
    onNewNoteRef.current = onNewNote;
  }, [onNewNote]);

  const playNotificationSound = (category: 'SALES' | 'ORDERS') => {
    if (!enabledSounds) return;
    playSoundFromCategory(category);
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
          
          const note = payload.new;
          
          // Play different sound based on note type
          // Apenas tocar som para PEDIDOS (MONEY) para evitar encavalar com o som de vendas!
          if (note.type === 'MONEY') {
            playNotificationSound('ORDERS');
          }
          
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
          
          const tx = payload.new;

          // Se a transação foi criada pelo próprio usuário nesta sessão/dispositivo, não toca som nem exibe toast
          const isSelfMade = currentUserName && tx.created_by && (String(tx.created_by).trim() === String(currentUserName).trim());
          
          if (!isSelfMade) {
            playNotificationSound('SALES');
            
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
          }

          if (onNewTransactionRef.current) onNewTransactionRef.current(tx);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[RealtimeBroker] Transação Atualizada:', payload.new);
          
          const tx = payload.new;
          const oldTx = payload.old;

          // Notify about payment if it was pending and now it's not (paid via MP)
          if (oldTx && oldTx.is_pending === true && tx.is_pending === false) {
             toast.success(
               <div className="flex items-center gap-3">
                 <div className="bg-emerald-100 p-2 rounded-lg">
                   <ShoppingBag className="text-emerald-600" size={18} />
                 </div>
                 <div>
                   <p className="font-bold text-xs uppercase tracking-tight">Nota Paga</p>
                   <p className="text-[10px] text-slate-500 line-clamp-1">{tx.customer_name ? `Pagamento recebido de ${tx.customer_name}` : 'A sua nota foi quitada via MP'}</p>
                 </div>
               </div>,
               { duration: 6000 }
             );
          }
          if (onTransactionUpdateRef.current) onTransactionUpdateRef.current(tx);
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
