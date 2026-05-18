import React from 'react';
import { Flag, X } from 'lucide-react';

interface ReportModalProps {
  reportTarget: string | null;
  setReportTarget: React.Dispatch<React.SetStateAction<string | null>>;
  reportReason: string;
  setReportReason: React.Dispatch<React.SetStateAction<string>>;
  isReporting: boolean;
  handleReport: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  reportTarget,
  setReportTarget,
  reportReason,
  setReportReason,
  isReporting,
  handleReport
}) => {
  if (!reportTarget) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
        <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl text-center border-4 border-rose-100">
          <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2"><Flag className="text-rose-500" /> Denunciar</h3>
              <button onClick={() => setReportTarget(null)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200"><X size={20} /></button>
          </div>
          <p className="text-sm text-slate-500 font-medium mb-6 text-left">
              Por que você está denunciando esta empresa?
          </p>
          <textarea 
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Ex: Golpe, conteúdo impróprio, loja falsa..."
            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:border-rose-400 min-h-[100px] text-sm mb-6 resize-none"
          />
          <button 
            onClick={handleReport}
            disabled={isReporting || !reportReason.trim()}
            className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isReporting ? <span className="animate-spin">⏳</span> : 'Enviar Denúncia'}
          </button>
        </div>
    </div>
  );
};
