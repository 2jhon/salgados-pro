import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { Package, Calendar, BarChart3, Clock, TrendingUp, TrendingDown, DollarSign, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProductInsightsProps {
  transactions: Transaction[];
  title?: string;
  sectionName?: string;
  isOwner?: boolean;
}

export const ProductInsights: React.FC<ProductInsightsProps> = ({ transactions, title = 'Desempenho de Produtos', sectionName, isOwner }) => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all'>('day');

  const { productStats, expenseStats, totalSales, totalExpenses } = React.useMemo(() => {
    const now = new Date();
    
    // Robust local timezone bounds
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    
    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

    let startTime = 0;
    if (period === 'day') {
      startTime = startOfToday.getTime();
    } else if (period === 'week') {
      startTime = startOfWeek.getTime();
    } else if (period === 'month') {
      startTime = startOfMonth.getTime();
    }

    let filtered = period === 'all' ? transactions : transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate.getTime() >= startTime;
    });

    if (sectionName) {
      filtered = filtered.filter(t => t.category && t.category.trim().toLowerCase() === sectionName.trim().toLowerCase());
    }

    const pStats: Record<string, { quantity: number; revenue: number }> = {};
    const eStats: Record<string, { quantity: number; revenue: number }> = {};
    let tSales = 0;
    let tExpenses = 0;

    filtered.forEach(t => {
      // Exclui auditorias
      if ((t.category || '').toUpperCase().trim() === 'AUDITORIA') return;
      
      // Conta apenas itens que foram de fato vendidos (receitas), incluindo pendentes ou pagas
      const itemName = t.item || 'Item Desconhecido';
      const itemUpper = itemName.toUpperCase();
      
      // Ignora recibos financeiros de contas a receber/pagar (já que o item original já foi contabilizado na data da respectiva venda)
      if (
        itemUpper.startsWith('RECEBIMENTO DE FIADO') ||
        itemUpper.startsWith('PGTO DE DÍVIDA') ||
        itemUpper.startsWith('PGTO DÍVIDA') ||
        itemUpper.startsWith('PGTO PARCIAL') ||
        itemUpper.startsWith('PAGAMENTO PARCIAL') ||
        itemUpper.includes('PAGAMENTO DE DIVIDA')
      ) {
        return;
      }

      if (t.subCategory === 'GASTOS') {
        if (!eStats[itemName]) eStats[itemName] = { quantity: 0, revenue: 0 };
        eStats[itemName].quantity += (t.quantity || 1);
        eStats[itemName].revenue += t.value;
        tExpenses += t.value;
      } else {
        if (!pStats[itemName]) pStats[itemName] = { quantity: 0, revenue: 0 };
        pStats[itemName].quantity += (t.quantity || 1);
        pStats[itemName].revenue += t.value;
        tSales += t.value;
      }
    });

    return {
      productStats: Object.entries(pStats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.quantity - a.quantity),
      expenseStats: Object.entries(eStats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.revenue - a.revenue),
      totalSales: tSales,
      totalExpenses: tExpenses
    };
  }, [transactions, period, sectionName]);

  const netProfit = totalSales - totalExpenses;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    
    // Configurações e cabeçalho
    doc.setFontSize(20);
    doc.text(`Relatório - ${title}`, 14, 22);
    
    doc.setFontSize(10);
    const periodName = {
      day: 'Hoje',
      week: 'Esta Semana',
      month: 'Este Mês',
      all: 'Todo o Período'
    }[period];
    doc.text(`Período: ${periodName}`, 14, 30);
    
    // Resumo Financeiro
    doc.text(`Total de Vendas: ${formatCurrency(totalSales)}`, 14, 40);
    doc.text(`Total de Gastos: ${formatCurrency(totalExpenses)}`, 14, 46);
    doc.text(`Líquido: ${formatCurrency(netProfit)}`, 14, 52);

    let startY = 60;

    // Tabela de Vendas
    if (productStats.length > 0) {
      doc.text('Detalhamento de Vendas', 14, startY);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Produto/Item', 'Unidades', 'Receita']],
        body: productStats.map(s => [s.name, s.quantity, formatCurrency(s.revenue)]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }, // emerald-500
      });
      startY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Tabela de Gastos
    if (expenseStats.length > 0) {
      if (startY > doc.internal.pageSize.height - 30) {
        doc.addPage();
        startY = 20;
      }
      doc.text('Detalhamento de Gastos', 14, startY);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Gasto/Item', 'Lançamentos', 'Valor']],
        body: expenseStats.map(s => [s.name, s.quantity, formatCurrency(s.revenue)]),
        theme: 'striped',
        headStyles: { fillColor: [244, 63, 94] }, // rose-500
      });
    }

    doc.save(`Relatorio_${title.replace(/\s+/g, '_')}_${periodName.replace(/\s+/g, '')}.pdf`);
  };

  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 leading-tight">{title}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo de Vendas</p>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
          {isOwner && (
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-slate-800 text-white rounded-xl shadow-md font-black text-[10px] sm:text-xs flex items-center gap-2 hover:bg-slate-700 transition"
              title="Baixar Relatório PDF"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          )}
          <div className="flex bg-slate-100 p-1 flex-wrap sm:flex-nowrap rounded-2xl">
            {(['day', 'week', 'month', 'all'] as const).map(p => (
              <button 
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all ${period === p ? 'bg-white text-slate-800 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {p === 'day' ? 'Hoje' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Tudo'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl mb-6">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" /> Vendas
          </span>
          <span className="text-lg font-black text-emerald-600">{formatCurrency(totalSales)}</span>
        </div>
        <div className="flex flex-col border-l border-slate-200 pl-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-rose-500" /> Gastos
          </span>
          <span className="text-lg font-black text-rose-600">{formatCurrency(totalExpenses)}</span>
        </div>
        <div className="flex flex-col border-l border-slate-200 pl-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-indigo-500" /> Líquido
          </span>
          <span className={`text-lg font-black ${netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {formatCurrency(netProfit)}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Detalhamento de Vendas
          </h3>
          {productStats.length === 0 ? (
            <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center bg-slate-50 rounded-2xl">
              <Package className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhuma Venda</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productStats.map((stat, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-slate-300 group-hover:text-emerald-500 transition-colors">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700 text-sm leading-tight">{stat.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {formatCurrency(stat.revenue)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-slate-800 tracking-tighter">
                      {stat.quantity}
                    </div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                      Unidades
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {expenseStats.length > 0 && (
          <div className="pt-2">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-500" /> Detalhamento de Gastos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expenseStats.map((stat, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-rose-50 bg-rose-50/30 hover:bg-rose-50/50 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-slate-300 group-hover:text-rose-500 transition-colors">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700 text-sm leading-tight">{stat.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-black text-rose-600 uppercase flex items-center gap-1">
                          {formatCurrency(stat.revenue)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-slate-800 tracking-tighter">
                      {stat.quantity}
                    </div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                      Lançamentos
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
