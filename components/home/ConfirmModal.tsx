
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ title, message, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl text-center border-4 border-rose-100">
        <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse">
          <AlertTriangle className="w-10 h-10 text-rose-600" />
        </div>
        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">{title}</h3>
        <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel} 
            className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm} 
            className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-900/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
