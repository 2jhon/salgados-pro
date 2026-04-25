
import React, { useState } from 'react';
import { Database, Trash2, Calendar, Clock, AlertTriangle, FileText, ArrowRight, Printer, Bluetooth, Download, Archive, Music, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction } from '../../types';

interface SystemTabProps {
  transactions: Transaction[];
  sysPeriod: 'day' | 'week' | 'month' | 'all' | 'custom';
  setSysPeriod: (p: any) => void;
  sysScope: 'ALL' | 'FACTORY' | 'STALL';
  setSysScope: (s: any) => void;
  customDateStart: string;
  setCustomDateStart: (d: string) => void;
  customDateEnd: string;
  setCustomDateEnd: (d: string) => void;
  clearTransactions: (period: any, wid: string, range?: any) => Promise<void>;
  archiveYear: (wid: string, year: number) => Promise<number>;
  workspaceId: string;
  onUnlockGodMode?: () => void;
}

export const SystemTab: React.FC<SystemTabProps> = ({
  transactions, sysPeriod, setSysPeriod, sysScope, setSysScope,
  customDateStart, setCustomDateStart, customDateEnd, setCustomDateEnd,
  clearTransactions, archiveYear, workspaceId, onUnlockGodMode
}) => {
  const [soundMode, setSoundMode] = useState('PADRÃO');
  const [rootClicks, setRootClicks] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRootClick = () => {
     const newClicks = rootClicks + 1;
     setRootClicks(newClicks);
     if (newClicks >= 5) { // Reduzir pra 5 cliques
        if (onUnlockGodMode) onUnlockGodMode();
        setRootClicks(0);
     }
  };

  const handleClear = async (isFactoryReset = false) => {
     try {
       setIsProcessing(true);
       if (isFactoryReset) {
          const confirm = window.confirm("ATENÇÃO: Você está prestes a apagar TODOS os dados desta loja. Deseja continuar?");
          if (!confirm) return;
          await clearTransactions('all', workspaceId);
          showToast("Dados resetados com sucesso.");
       } else {
          await clearTransactions(
             sysPeriod, 
             workspaceId, 
             sysPeriod === 'custom' ? { start: customDateStart, end: customDateEnd } : undefined
          );
          showToast("Histórico limpo com sucesso.");
       }
     } catch (err) {
       console.error(err);
       alert("Erro ao limpar histórico.");
     } finally {
       setIsProcessing(false);
     }
  };

  const handleDownloadReport = () => {
     let filtered = [...transactions];
     
     // 1. Filtrar pelo escopo (se aplicável futuramente, pois transações geralmente não distinguem FÁBRICA VS BARRACA no modelo atual, 
     // a não ser que tenha o campo 'local'). Aqui usaremos o filtro de Data como principal.
     const now = new Date();
     if (sysPeriod === 'day') {
        const startOfDay = new Date(now.setHours(0,0,0,0)).getTime();
        filtered = filtered.filter(t => new Date(t.date).getTime() >= startOfDay);
     } else if (sysPeriod === 'week') {
        const pastWeek = new Date();
        pastWeek.setDate(pastWeek.getDate() - 7);
        pastWeek.setHours(0,0,0,0);
        filtered = filtered.filter(t => new Date(t.date).getTime() >= pastWeek.getTime());
     } else if (sysPeriod === 'month') {
        const pastMonth = new Date();
        pastMonth.setMonth(pastMonth.getMonth() - 1);
        pastMonth.setHours(0,0,0,0);
        filtered = filtered.filter(t => new Date(t.date).getTime() >= pastMonth.getTime());
     } else if (sysPeriod === 'custom' && customDateStart) {
        const start = new Date(customDateStart).getTime();
        const end = customDateEnd ? new Date(customDateEnd + 'T23:59:59').getTime() : Date.now();
        filtered = filtered.filter(t => {
           const d = new Date(t.date).getTime();
           return d >= start && d <= end;
        });
     }

     if (filtered.length === 0) {
        showToast("Nenhum dado encontrado para exportar.");
        return;
     }

     const doc = new jsPDF();
     
     doc.setFontSize(18);
     let reportTitle = "Relatório de Histórico - ";
          if (sysScope === 'ALL') reportTitle += "Geral";
          if (sysScope === 'FACTORY') reportTitle += "Fábrica";
          if (sysScope === 'STALL') reportTitle += "Barraca";
          doc.text(reportTitle, 14, 22);
          
          doc.setFontSize(11);
          doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
          
          const incomeData = filtered.filter(t => t.subCategory !== 'GASTOS' && (t.category || '').toUpperCase() !== 'AUDITORIA');
          const expenseData = filtered.filter(t => t.subCategory === 'GASTOS' && (t.category || '').toUpperCase() !== 'AUDITORIA');
          
          let currentY = 40;

          const formatCurrency = (val: number) => {
             return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
          };

          if (incomeData.length > 0) {
             doc.setFontSize(14);
             doc.setTextColor(21, 128, 61); // green-700
             doc.text("Entradas / Vendas", 14, currentY);
             doc.setTextColor(0, 0, 0);

             const incomeTableData = incomeData.map(t => [
                new Date(t.date).toLocaleDateString('pt-BR'),
                (t.category || '').toUpperCase() || 'BARRACA',
                t.item || t.subCategory || '-',
                t.quantity || 1,
                formatCurrency(t.value),
                t.customerName || '-',
                t.isPending ? 'Pendente' : 'Pago'
             ]);

             autoTable(doc, {
                startY: currentY + 5,
                head: [['Data', 'Origem', 'Descrição', 'Qtd', 'Valor', 'Cliente', 'Status']],
                body: incomeTableData,
                theme: 'striped',
                headStyles: { fillColor: [34, 139, 34] }, // dark green
                styles: { fontSize: 8 },
             });

             currentY = (doc as any).lastAutoTable.finalY + 10;
             const totalIncome = incomeData.reduce((acc, t) => acc + t.value, 0);
             doc.setFontSize(12);
             doc.text(`Total Entradas: ${formatCurrency(totalIncome)}`, 14, currentY);
             currentY += 15;
          }

          if (expenseData.length > 0) {
             if (currentY > 250) {
                 doc.addPage();
                 currentY = 20;
             }
             doc.setFontSize(14);
             doc.setTextColor(220, 38, 38); // red-600
             doc.text("Saídas / Despesas", 14, currentY);
             doc.setTextColor(0, 0, 0);

             const expenseTableData = expenseData.map(t => [
                new Date(t.date).toLocaleDateString('pt-BR'),
                (t.category || '').toUpperCase() || 'BARRACA',
                t.item || t.subCategory || '-',
                t.quantity || 1,
                formatCurrency(t.value),
                t.customerName || '-',
                t.isPending ? 'Pendente' : 'Pago'
             ]);

             autoTable(doc, {
                startY: currentY + 5,
                head: [['Data', 'Origem', 'Descrição', 'Qtd', 'Valor', 'Fornecedor', 'Status']],
                body: expenseTableData,
                theme: 'striped',
                headStyles: { fillColor: [220, 38, 38] }, // red
                styles: { fontSize: 8 },
             });

             currentY = (doc as any).lastAutoTable.finalY + 10;
             const totalExpense = expenseData.reduce((acc, t) => acc + t.value, 0);
             doc.setFontSize(12);
             doc.text(`Total Saídas: ${formatCurrency(totalExpense)}`, 14, currentY);
          }

     doc.save(`relatorio_caixa_${sysPeriod}.pdf`);
     showToast("Relatório PDF baixado com sucesso.");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* IMPRESSORA TÉRMICA */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <Printer className="text-slate-500 w-6 h-6" />
          <h4 className="font-black text-slate-800 uppercase tracking-tight text-lg">IMPRESSORA TÉRMICA</h4>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed mb-6 tracking-widest">
          CONECTE SUA IMPRESSORA TÉRMICA BLUETOOTH (58MM OU 80MM) PARA IMPRIMIR RECIBOS DIRETAMENTE DO APLICATIVO.
        </p>
        <button className="w-full py-5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all">
          <Bluetooth size={16} /> CONECTAR IMPRESSORA
        </button>
      </div>

      {/* SONS DO SISTEMA */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <Music className="text-slate-500 w-6 h-6" />
          <h4 className="font-black text-slate-800 uppercase tracking-tight text-lg">SONS DO SISTEMA</h4>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          {['PADRÃO', 'SUAVE', 'MEC.', 'OFF'].map(mode => (
            <button 
              key={mode}
              onClick={() => setSoundMode(mode)}
              className={`min-w-[80px] flex-1 py-4 px-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${soundMode === mode ? 'bg-indigo-50 border-2 border-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* GERENCIAR DADOS */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <Database className="text-slate-500 w-6 h-6" />
          <h4 className="font-black text-slate-800 uppercase tracking-tight text-lg">GERENCIAR DADOS</h4>
        </div>

        <div className="space-y-8">
          {/* 1. ÁREA */}
          <div>
            <p className="text-[10px] font-black tracking-widest text-slate-400 mb-3 px-2">1. ÁREA</p>
            <div className="flex bg-slate-50 p-1.5 rounded-3xl overflow-x-auto no-scrollbar">
               <button onClick={() => setSysScope('ALL')} className={`min-w-fit px-4 flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${sysScope === 'ALL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>TUDO</button>
               <button onClick={() => setSysScope('FACTORY')} className={`min-w-fit px-4 flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${sysScope === 'FACTORY' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>FÁBRICA</button>
               <button onClick={() => setSysScope('STALL')} className={`min-w-fit px-4 flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${sysScope === 'STALL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>BARRACA</button>
            </div>
          </div>

          {/* 2. PERÍODO */}
          <div>
            <p className="text-[10px] font-black tracking-widest text-slate-400 mb-3 px-2">2. PERÍODO</p>
            <div className="flex bg-slate-50 p-1.5 rounded-3xl overflow-x-auto no-scrollbar gap-1">
               <button onClick={() => setSysPeriod('day')} className={`shrink-0 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${sysPeriod === 'day' ? 'bg-indigo-50 border-2 border-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}>HOJE</button>
               <button onClick={() => setSysPeriod('week')} className={`shrink-0 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${sysPeriod === 'week' ? 'bg-indigo-50 border-2 border-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}>SEMANA</button>
               <button onClick={() => setSysPeriod('month')} className={`shrink-0 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${sysPeriod === 'month' ? 'bg-indigo-50 border-2 border-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}>MÊS</button>
               <button onClick={() => setSysPeriod('custom')} className={`shrink-0 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${sysPeriod === 'custom' ? 'bg-indigo-50 border-2 border-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}>SELECIONAR</button>
               <button onClick={() => setSysPeriod('all')} className={`shrink-0 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${sysPeriod === 'all' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>TUDO</button>
            </div>
            
            {sysPeriod === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-4 animate-in zoom-in-95 px-2">
                <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Início</label>
                    <input type="date" value={customDateStart} onChange={e => setCustomDateStart(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl text-xs font-bold text-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-100" />
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Fim</label>
                    <input type="date" value={customDateEnd} onChange={e => setCustomDateEnd(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl text-xs font-bold text-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-100" />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-4 pt-2">
            <button 
               onClick={handleDownloadReport}
               className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
            >
               <Download size={18} /> BAIXAR RELATÓRIO
            </button>
            <button 
              onClick={() => handleClear(false)}
              disabled={isProcessing}
              className={`flex-1 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${isProcessing ? 'bg-slate-100 text-slate-400' : 'bg-rose-100 hover:bg-rose-200 text-rose-600'}`}
            >
               <Trash2 size={18} /> {isProcessing ? 'PROCESSANDO...' : 'LIMPAR HISTÓRICO'}
            </button>
          </div>
          
          <div className="pt-4 border-t border-slate-50">
            <button 
              onClick={async () => {
                 setIsProcessing(true);
                 await archiveYear(workspaceId, new Date().getFullYear());
                 setIsProcessing(false);
                 showToast("Ano arquivado com sucesso!");
              }}
              disabled={isProcessing}
              className="w-full py-5 bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-600 rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 transition-all"
            >
               <Database size={18} /> CONSOLIDAR E ARQUIVAR ANO
            </button>
            <p className="text-[9px] font-bold text-slate-400 mt-4 text-center px-4 leading-relaxed tracking-wider">
              Esta opção soma todas as vendas e gastos de um ano, salva um resumo e apaga os detalhes para liberar espaço no banco de dados.
            </p>
          </div>
        </div>
      </div>

      {/* ZONA DE PERIGO */}
      <div className="bg-white p-8 sm:p-10 rounded-[3rem] shadow-sm flex flex-col items-center text-center mt-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-rose-50/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        <AlertTriangle size={56} className="text-orange-500 mb-6 stroke-[2] relative z-10" />
        <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight relative z-10">ZONA DE PERIGO</h4>
        <button 
          onClick={() => handleClear(true)}
          disabled={isProcessing}
          className="mt-8 w-full py-5 sm:py-6 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black uppercase text-xs sm:text-sm tracking-widest shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition-all relative z-10"
        >
          {isProcessing ? 'APAGANDO...' : 'RESETAR FÁBRICA (APAGAR TUDO)'}
        </button>
      </div>

      {/* ACESSO ROOT AT BOTTOM */}
      <div className="text-center pt-8 relative z-50">
        <button 
          onClick={handleRootClick} 
          className="text-[10px] font-black text-slate-200 uppercase tracking-[0.6em] hover:text-slate-400 transition-colors bg-transparent border-none py-4 px-10 cursor-pointer"
        >
          A C E S S O  R O O T
        </button>
      </div>
      
      {/* TOAST SYSTEM */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in zoom-in-95 font-bold text-xs tracking-wider z-[9999]">
          <CheckCircle2 size={18} className="text-emerald-400" />
          {toastMessage}
        </div>
      )}
    </div>
  );
};

