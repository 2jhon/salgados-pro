import React, { useState } from 'react';
import { Note } from '../types';
import { X, Send, AlertTriangle, Info, DollarSign, Check, Bell, Trash2 } from 'lucide-react';

interface NoteComposerProps {
  onClose: () => void;
  onSend: (content: string, type: 'INFO' | 'ALERT' | 'MONEY', amount?: number) => Promise<void>;
  userName: string;
}

export const NoteComposer: React.FC<NoteComposerProps> = ({ onClose, onSend, userName }) => {
  const [content, setContent] = useState('');
  const [type, setType] = useState<'INFO' | 'ALERT' | 'MONEY'>('INFO');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSending(true);
    await onSend(content, type, type === 'MONEY' ? parseFloat(amount.replace(',', '.')) || 0 : undefined);
    setIsSending(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-slate-800 uppercase">Novo Aviso</h3>
          <button onClick={onClose}><X className="text-slate-400" /></button>
        </div>
        
        <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-2xl">
          <button onClick={() => setType('INFO')} className={`flex-1 py-3 rounded-xl flex justify-center ${type === 'INFO' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}><Info size={20} /></button>
          <button onClick={() => setType('ALERT')} className={`flex-1 py-3 rounded-xl flex justify-center ${type === 'ALERT' ? 'bg-white shadow text-orange-500' : 'text-slate-400'}`}><AlertTriangle size={20} /></button>
          <button onClick={() => setType('MONEY')} className={`flex-1 py-3 rounded-xl flex justify-center ${type === 'MONEY' ? 'bg-white shadow text-green-600' : 'text-slate-400'}`}><DollarSign size={20} /></button>
        </div>

        <div className="space-y-4">
          <textarea 
            autoFocus
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={type === 'MONEY' ? "Descreva o gasto (Ex: Comprei gelo)" : "O que aconteceu?"}
            className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none resize-none h-32 focus:ring-2 focus:ring-blue-100 transition-all"
          />
          
          {type === 'MONEY' && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Valor (R$)</label>
              <input 
                type="text" 
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full p-4 bg-green-50 text-green-800 rounded-2xl font-black text-xl text-center outline-none border-2 border-transparent focus:border-green-500"
              />
              <p className="text-[9px] text-green-600 font-bold text-center mt-1 uppercase">Será lançado como GASTO automaticamente</p>
            </div>
          )}
        </div>

        <button 
          onClick={handleSubmit} 
          disabled={isSending || !content.trim() || (type === 'MONEY' && !amount)}
          className={`w-full mt-6 py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 text-white active:scale-95 transition-all ${
            type === 'ALERT' ? 'bg-orange-500' : type === 'MONEY' ? 'bg-green-600' : 'bg-blue-600'
          }`}
        >
          {isSending ? 'Enviando...' : <><Send size={16} /> Enviar Aviso</>}
        </button>
      </div>
    </div>
  );
};

interface NotesInboxProps {
  notes: Note[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onDelete?: (id: string) => void;
  onClearAll?: () => void;
}

export const NotesInbox: React.FC<NotesInboxProps> = ({ notes, onClose, onMarkAsRead, onDelete, onClearAll }) => {
  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
    } catch {
      return '';
    }
  };

  const hasReadNotes = notes.some(n => n.isRead);

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-[3rem] sm:rounded-[3rem] shadow-3xl flex flex-col animate-in slide-in-from-bottom-10">
        <header className="p-8 pb-4 flex justify-between items-center bg-white rounded-t-[3rem] border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
              <Bell size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase">Avisos</h3>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Central de Ocorrências</p>
                {hasReadNotes && onClearAll && (
                  <button 
                    onClick={onClearAll} 
                    className="ml-2 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={10} /> Limpar Lidas
                  </button>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200"><X size={20} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50">
          {notes.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Info className="mx-auto mb-4 w-12 h-12 opacity-30" />
              <p className="text-[10px] font-black uppercase tracking-widest">Nenhum aviso registrado</p>
            </div>
          ) : (
            notes.map(note => (
              <div 
                key={note.id} 
                className={`p-5 rounded-3xl border-2 transition-all relative overflow-hidden group ${
                  !note.isRead ? 'bg-white border-blue-200 shadow-md' : 'bg-slate-100 border-transparent opacity-80'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                      note.type === 'ALERT' ? 'bg-orange-100 text-orange-600' :
                      note.type === 'MONEY' ? 'bg-green-100 text-green-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {note.type === 'ALERT' ? 'Urgente' : note.type === 'MONEY' ? 'Financeiro' : 'Info'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">{formatDate(note.createdAt)}</span>
                  </div>
                  {!note.isRead ? (
                    <button onClick={() => onMarkAsRead(note.id)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100" title="Marcar como lido">
                      <Check size={14} />
                    </button>
                  ) : (
                    onDelete && (
                      <button onClick={() => onDelete(note.id)} className="p-2 bg-slate-200 text-slate-400 rounded-xl hover:bg-red-100 hover:text-red-500 transition-colors" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    )
                  )}
                </div>
                
                <p className="text-sm font-medium text-slate-700 leading-relaxed mb-3">{note.content}</p>
                
                <div className="flex justify-between items-end border-t border-slate-100 pt-3 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-[9px] font-black text-slate-500">
                      {(note.createdByName || '?').charAt(0)}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{note.createdByName || 'Usuário'}</span>
                  </div>
                  {note.amount && (
                    <div className="flex items-center gap-1 text-green-600 font-black text-sm bg-green-50 px-3 py-1 rounded-lg">
                      <DollarSign size={12} /> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(note.amount)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};