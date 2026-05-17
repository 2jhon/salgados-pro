
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
  enabledSounds = true,
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

  const showSystemNotification = async (title: string, body: string) => {
    if (!('Notification' in window)) return;
    
    try {
      if (Notification.permission === 'granted') {
        const icon = '/icon-192x192.png';
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            body,
            icon,
            badge: icon,
            vibrate: [200, 100, 200]
          } as any);
        } else {
          new Notification(title, { body, icon });
        }
      } else if (Notification.permission === 'default') {
        // Tenta solicitar permissão (browsers podem bloquear se não houver interação)
        Notification.requestPermission();
      }
    } catch (e) {
      console.warn("System Notification error:", e);
    }
  };

  useEffect(() => {
    // Solicita permissão inicial se estiver default
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.warn);
    }
  }, []);

  useEffect(() => {
    if (!workspaceId) return;

    console.log(`[RealtimeBroker] Iniciando monitoramento para workspace: ${workspaceId}`);

    const channel = supabase
      .channel(`global_realtime_${workspaceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notes', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[RealtimeBroker] Nova Nota:', payload.new);
          
          const note = payload.new;
          
          if (note.type === 'MONEY') {
            playNotificationSound('ORDERS');
          }
          
          showSystemNotification('Nova Notificação', note.content);
          
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[RealtimeBroker] Nova Transação:', payload.new);
          
          const tx = payload.new;
          const isSelfMade = currentUserName && tx.created_by && (String(tx.created_by).trim() === String(currentUserName).trim());
          
          if (!isSelfMade) {
            playNotificationSound('SALES');
            
            const isVenda = tx.sub_category === 'VENDAS' || tx.sub_category === 'A_RECEBER';
            const title = isVenda ? 'Novo Pedido / Venda' : 'Novo Lançamento';
            const body = `${tx.item} - R$ ${Number(tx.value).toFixed(2)}`;
            
            showSystemNotification(title, body);
            
            toast.success(
              <div className="flex items-center gap-3">
                <div className={isVenda ? "bg-emerald-100 p-2 rounded-lg" : "bg-rose-100 p-2 rounded-lg"}>
                  {isVenda ? <ShoppingBag className="text-emerald-600" size={18} /> : <TrendingUp className="text-rose-600" size={18} />}
                </div>
                <div>
                  <p className="font-bold text-xs uppercase tracking-tight">
                    {title}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {body}
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

          if (oldTx && oldTx.is_pending === true && tx.is_pending === false) {
             const title = 'Nota Paga';
             const body = tx.customer_name ? `Pagamento recebido de ${tx.customer_name}` : 'A sua nota foi quitada via MP';
             
             showSystemNotification(title, body);
             
             toast.success(
               <div className="flex items-center gap-3">
                 <div className="bg-emerald-100 p-2 rounded-lg">
                   <ShoppingBag className="text-emerald-600" size={18} />
                 </div>
                 <div>
                   <p className="font-bold text-xs uppercase tracking-tight">{title}</p>
                   <p className="text-[10px] text-slate-500 line-clamp-1">{body}</p>
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
  }, [workspaceId, enabledSounds, currentUserName]);

  return null;
};
