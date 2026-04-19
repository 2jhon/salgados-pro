
import React, { useState, useMemo } from 'react';
import { Transaction, User, PeriodTotals } from '../types';
import { 
  UserCircle, 
  ChevronRight, 
  ChevronDown, 
  Filter, 
  Calendar, 
  Briefcase, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Search,
  Trash2,
  FileText,
  AlertTriangle,
  Download,
  X,
  CheckCircle2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ManagerActivityProps {
  transactions: Transaction[];
  users: User[];
  deleteTransaction: (id: string) => Promise<void>;
}

type PeriodType = 'day' | 'week' | 'month' | 'all';

export const ManagerActivity: React.FC<ManagerActivityProps> = ({ transactions, users, deleteTransaction }) => {
  const [expandedManager, setExpandedManager] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<PeriodType>('day');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [reportManager, setReportManager] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [ghostToDelete, setGhostToDelete] = useState<string | null>(null);
  const [isWiping, setIsWiping] = useState(false);

  const wipeGhostHistory = async (name: string) => {
    if (isWiping) return;
    setIsWiping(true);
    const txs = managerGroups[name];
    if (txs) {
      for (const t of txs) {
        await deleteTransaction(t.id);
      }
    }
    setIsWiping(false);
    setGhostToDelete(null);
    setExpandedManager(null);
  };

  // Agrupar transações por quem criou
  const managerGroups = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      const author = t.createdBy || 'Sistema/Admin';
      if (!groups[author]) groups[author] = [];
      groups[author].push(t);
    });
    return groups;
  }, [transactions]);

  // Encontrar metadados do usuário (cargo/área) baseado no nome do criadoBy
  const getManagerMeta = (name: string) => {
    const user = users.find(u => typeof u.name === 'string' && typeof name === 'string' && u.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!user) return { role: 'Admin/Externo', area: 'Geral' };
    
    const roleMap: Record<string, string> = {
      'OWNER': 'Proprietário',
      'MANAGER_FACTORY': 'Gerente Fábrica',
      'MANAGER_STALL': 'Gerente Barraca'
    };

    const areaMap: Record<string, string> = {
      'OWNER': 'Toda Empresa',
      'MANAGER_FACTORY': 'Fábrica',
      'MANAGER_STALL': 'Barraca'
    };

    return { 
      role: roleMap[user.role] || user.role, 
      area: areaMap[user.role] || 'Geral'
    };
  };

  const filterByPeriod = (data: Transaction[], period: PeriodType) => {
    const now = new Date();
    if (period === 'all') return data;

    let startTime = 0;
    if (period === 'day') {
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(now.getDate() - now.getDay());
      d.setHours(0,0,0,0);
      startTime = d.getTime();
    } else if (period === 'month') {
      startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    return data.filter(t => new Date(t.date).getTime() >= startTime);
  };

  const filteredManagerNames = Object.keys(managerGroups).filter(name => 
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number | undefined) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString('pt-BR'),
        time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
    } catch { return { date: '-', time: '-' }; }
  };

  const handleDelete = (id: string) => {
    deleteTransaction(id);
    setDeleteConfirm(null);
  };

  // Função para agrupar por data (YYYY-MM-DD) para exibição separada
  const groupTransactionsByDate = (items: Transaction[]) => {
    const groups: Record<string, { items: Transaction[], sales: number, expenses: number }> = {};
    
    items.forEach(t => {
      const dateKey = new Date(t.date).toLocaleDateString('pt-BR');
      if (!groups[dateKey]) {
        groups[dateKey] = { items: [], sales: 0, expenses: 0 };
      }
      groups[dateKey].items.push(t);
      
      if (t.subCategory === 'GASTOS') {
        groups[dateKey].expenses += t.value;
      } else {
        groups[dateKey].sales += t.value;
      }
    });

    // Ordenar datas (mais recente primeiro) e itens dentro da data
    return Object.entries(groups)
      .sort((a, b) => {
        // Converte DD/MM/YYYY para comparação
        const [dA, mA, yA] = a[0].split('/').map(Number);
        const [dB, mB, yB] = b[0].split('/').map(Number);
        return new Date(yB, mB - 1, dB).getTime() - new Date(yA, mA - 1, dA).getTime();
      })
      .map(([date, data]) => ({
        date,
        ...data,
        items: data.items.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
      }));
  };

  const generateDailyReport = (managerName: string, dateStr: string, items: Transaction[]) => {
    const doc = new jsPDF();
    const meta = getManagerMeta(managerName);

    // Header
    doc.setFontSize(18);
    doc.text('Relatório de Fechamento Diário', 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Gerente: ${managerName}`, 14, 30);
    doc.text(`Cargo/Área: ${meta.role} - ${meta.area}`, 14, 36);
    doc.text(`Data: ${dateStr}`, 14, 42);

    let totalSales = 0;
    let totalExpenses = 0;

    // Agrupar itens para o relatório detalhado (apenas vendas)
    const salesSummary: Record<string, {
      totalQuantity: number,
      totalValue: number,
      initialStock: number,
      leftoverStock: number,
      unitPrice: number
    }> = {};

    const tableData = items.map(t => {
      const { time } = formatDate(t.date);
      const isExpense = t.subCategory === 'GASTOS';
      const isAudit = (t.category || '').trim().toUpperCase() === 'AUDITORIA';
      
      if (!isAudit) {
        if (isExpense) {
          totalExpenses += t.value;
        } else {
          totalSales += t.value;
          
          // Agrupar para o sumário
          if (!salesSummary[t.item]) {
            salesSummary[t.item] = {
              totalQuantity: 0,
              totalValue: 0,
              initialStock: t.initialStock || 0,
              leftoverStock: t.leftoverStock || 0,
              unitPrice: t.unitPrice || 0
            };
          }
          salesSummary[t.item].totalQuantity += (t.quantity || 1);
          salesSummary[t.item].totalValue += t.value;
          
          // Se houver novos registros de estoque, atualiza para o mais recente (ou soma, dependendo da lógica do negócio, mas geralmente pega o último)
          if (t.initialStock !== undefined) salesSummary[t.item].initialStock = Math.max(salesSummary[t.item].initialStock, t.initialStock);
          if (t.leftoverStock !== undefined) salesSummary[t.item].leftoverStock = t.leftoverStock; // O último que sobrou
          if (t.unitPrice !== undefined) salesSummary[t.item].unitPrice = t.unitPrice;
        }
      }

      let desc = isAudit ? `[AUDITORIA] ${t.item}` : t.item;
      
      // Adiciona detalhes de quantidade na descrição se for venda
      if (!isExpense && !isAudit && t.quantity && t.quantity > 1) {
         desc += ` (${t.quantity}x)`;
      }

      return [
        time,
        desc,
        isAudit ? '-' : (isExpense ? 'Saída' : 'Entrada'),
        isAudit ? '-' : formatCurrency(t.value)
      ];
    });

    // Tabela de Logs (Cronológica)
    doc.setFontSize(14);
    doc.text('Histórico de Movimentações', 14, 55);
    
    autoTable(doc, {
      startY: 60,
      head: [['Hora', 'Descrição', 'Tipo', 'Valor']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
      styles: { fontSize: 9 },
      columnStyles: {
        3: { halign: 'right' }
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY || 60;

    // Tabela de Resumo de Vendas (Detalhada)
    const salesSummaryKeys = Object.keys(salesSummary);
    if (salesSummaryKeys.length > 0) {
      finalY += 15;
      
      // Verifica se precisa de nova página
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFontSize(14);
      doc.text('Resumo Detalhado de Vendas', 14, finalY);

      const summaryTableData = salesSummaryKeys.map(itemName => {
        const data = salesSummary[itemName];
        
        // Formata a string de quantidade dependendo se tem dados de estoque (Barraca) ou não (Fábrica)
        let qtyStr = `${data.totalQuantity}`;
        if (data.initialStock > 0 || data.leftoverStock > 0) {
           qtyStr = `Levou: ${data.initialStock} | Sobrou: ${data.leftoverStock} | Vendeu: ${data.totalQuantity}`;
        }

        return [
          itemName,
          qtyStr,
          formatCurrency(data.unitPrice),
          formatCurrency(data.totalValue)
        ];
      });

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Produto', 'Quantidades', 'Val. Unitário', 'Total']],
        body: summaryTableData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] }, // Slate 900
        styles: { fontSize: 8 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' }
        }
      });
      
      finalY = (doc as any).lastAutoTable.finalY;
    }

    // Totais Finais
    finalY += 15;
    if (finalY > 250) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(10);
    doc.text(`Total de Entradas: ${formatCurrency(totalSales)}`, 14, finalY);
    doc.text(`Total de Saídas: ${formatCurrency(totalExpenses)}`, 14, finalY + 6);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Saldo Líquido: ${formatCurrency(totalSales - totalExpenses)}`, 14, finalY + 14);

    // Signature
    doc.setLineWidth(0.5);
    doc.line(14, finalY + 40, 100, finalY + 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Assinatura do Gerente', 14, finalY + 45);

    doc.save(`Fechamento_${managerName.replace(/\s+/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`);
    
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Barra de Busca de Gerentes */}
      <div className="sticky top-0 z-40 bg-slate-50 py-2 -mx-2 px-2">
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <input 
            type="text"
            placeholder="Buscar gerente ou colaborador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-4 pl-12 bg-white rounded-2xl shadow-sm border border-slate-100 outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-200 transition-all font-bold text-slate-700"
          />
        </div>
      </div>

      {/* Lista de Gerentes */}
      <div className="grid gap-4">
        {filteredManagerNames.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
            <UserCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhuma atividade registrada ainda.</p>
          </div>
        ) : filteredManagerNames.map(name => {
          const isExpanded = expandedManager === name;
          const meta = getManagerMeta(name);
          const allManagerData = managerGroups[name];
          
          // Calculos rápidos para o cabeçalho do card
          const todayData = filterByPeriod(allManagerData, 'day');
          const todaySales = todayData.reduce((acc, t) => acc + (t.subCategory === 'GASTOS' ? 0 : t.value), 0);
          const todayExpenses = todayData.reduce((acc, t) => acc + (t.subCategory === 'GASTOS' ? t.value : 0), 0);

          // Dados filtrados para exibição expandida
          const displayData = filterByPeriod(allManagerData, activePeriod);
          const groupedData = groupTransactionsByDate(displayData);

          const periodSales = displayData.filter(t => t.subCategory !== 'GASTOS').reduce((acc, t) => acc + t.value, 0);
          const periodExpenses = displayData.filter(t => t.subCategory === 'GASTOS').reduce((acc, t) => acc + t.value, 0);

          return (
            <div 
              key={name}
              className={`bg-white rounded-[2.5rem] shadow-xl border transition-all duration-500 overflow-hidden ${
                isExpanded ? 'border-blue-200 ring-8 ring-blue-50/50' : 'border-slate-50'
              }`}
            >
              <div 
                onClick={() => setExpandedManager(isExpanded ? null : name)}
                className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-xl shadow-inner transition-all ${
                    isExpanded ? 'bg-blue-600 text-white scale-110 rotate-3' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-lg leading-tight">{name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        meta.area === 'Fábrica' ? 'bg-orange-100 text-orange-600' : 
                        meta.area === 'Barraca' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {meta.area}
                      </span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">• {meta.role}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-4 sm:gap-6">
                  <div className="hidden sm:block text-right">
                    <div className="flex items-center justify-end gap-2 mb-1">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Hoje</span>
                    </div>
                    <div className="flex gap-3">
                       <p className="font-black text-green-600 text-xs flex items-center gap-1"><TrendingUp size={10} /> {formatCurrency(todaySales)}</p>
                       <p className="font-black text-red-600 text-xs flex items-center gap-1"><TrendingDown size={10} /> {formatCurrency(todayExpenses)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setReportManager(name); }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Baixar Relatórios"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-blue-500" /> : <ChevronRight className="w-5 h-5 text-slate-300" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-6 pb-8 animate-in slide-in-from-top-4 duration-500">
                  <div className="h-px bg-slate-100 mb-6" />
                  
                  {/* ZONA DE PERIGO PARA CONTAS EXCLUÍDAS/FANTASMAS */}
                  {!users.some(u => typeof u.name === 'string' && typeof name === 'string' && u.name.trim().toLowerCase() === name.trim().toLowerCase()) 
                    && !['Sistema/Admin', 'Empresa Parceira', 'Estoque', 'Configurações', 'Segurança', 'Sistema'].includes(name) && (
                    <div className="mb-8 p-4 bg-rose-50/50 border border-rose-100 rounded-2xl animate-in fade-in">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-white shadow-sm rounded-full text-rose-500">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-black text-rose-800 uppercase tracking-tight mb-1">Conta Inativa (Fantasma)</h4>
                          <p className="text-[10px] uppercase font-bold text-rose-600/70 mb-4 leading-relaxed">
                            Este usuário não existe mais na configuração atual. Suas {managerGroups[name].length} ações antigas continuam no log histórico.
                          </p>
                          <button
                            onClick={() => setGhostToDelete(name)}
                            className="bg-white border text-[10px] border-rose-200 text-rose-600 px-4 py-2 rounded-xl font-black uppercase hover:bg-rose-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
                          >
                            <Trash2 className="w-3 h-3" /> Limpar Histórico Desta Conta
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Seletor de Período Interno */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl mb-8">
                    {(['day', 'week', 'month', 'all'] as PeriodType[]).map(p => (
                      <button
                        key={p}
                        onClick={() => setActivePeriod(p)}
                        className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                          activePeriod === p ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {p === 'day' ? 'Hoje' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Tudo'}
                      </button>
                    ))}
                  </div>

                  {/* Estatísticas do Período */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-green-50/50 border border-green-100 p-4 rounded-2xl">
                      <div className="flex items-center gap-2 text-green-600 mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase">Entradas</span>
                      </div>
                      <p className="text-xl font-black text-slate-800">
                        {formatCurrency(periodSales)}
                      </p>
                    </div>
                    <div className="bg-red-50/50 border border-red-100 p-4 rounded-2xl">
                      <div className="flex items-center gap-2 text-red-600 mb-1">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase">Saídas</span>
                      </div>
                      <p className="text-xl font-black text-slate-800">
                        {formatCurrency(periodExpenses)}
                      </p>
                    </div>
                  </div>

                  {/* Lista Agrupada por Data */}
                  <div className="space-y-8">
                    {groupedData.length === 0 ? (
                      <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-400 font-bold text-xs uppercase">Sem registros neste período</p>
                      </div>
                    ) : (
                      groupedData.map((group) => (
                        <div key={group.date} className="animate-in fade-in slide-in-from-bottom-2">
                           {/* Cabeçalho da Data com Resumo Lado a Lado */}
                           <div className="flex items-end justify-between mb-3 px-2">
                              <div className="flex items-center gap-2">
                                 <Calendar className="w-4 h-4 text-slate-400" />
                                 <h4 className="font-black text-slate-600 text-xs uppercase tracking-widest">{group.date}</h4>
                              </div>
                              <div className="flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-lg">
                                 <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] font-black text-slate-600">{formatCurrency(group.sales)}</span>
                                 </div>
                                 <div className="w-px h-3 bg-slate-300" />
                                 <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                                    <span className="text-[10px] font-black text-slate-600">{formatCurrency(group.expenses)}</span>
                                 </div>
                              </div>
                           </div>

                           {/* Tabela de Itens do Dia */}
                           <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                              <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
                                  <tr>
                                    <th className="px-4 py-2 font-black">Hora</th>
                                    <th className="px-4 py-2 font-black">Item</th>
                                    <th className="px-4 py-2 font-black text-right">Valor</th>
                                    <th className="px-4 py-2 text-center w-10"><Trash2 size={12} /></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {group.items.map((t) => {
                                    const { time } = formatDate(t.date);
                                    const isExpense = t.subCategory === 'GASTOS';
                                    const isAudit = (t.category || '').trim().toUpperCase() === 'AUDITORIA';

                                    return (
                                      <tr key={t.id} className={`hover:bg-slate-50/80 transition-colors ${isAudit ? 'bg-amber-50/30' : ''}`}>
                                        <td className="px-4 py-3 text-slate-400 text-xs font-medium tabular-nums">{time}</td>
                                        <td className="px-4 py-3">
                                           <div className="flex flex-col">
                                              <span className={`font-bold uppercase text-xs ${isExpense ? 'text-slate-600' : 'text-slate-700'}`}>
                                                {isAudit ? <span className="text-amber-600 flex items-center gap-1"><FileText size={10} /> {t.item}</span> : t.item}
                                              </span>
                                              {t.customerName && !isAudit && (
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{t.customerName}</span>
                                              )}
                                              {t.quantity && <span className="text-[9px] text-slate-400">Qtd: {t.quantity}</span>}
                                           </div>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-black text-xs whitespace-nowrap ${
                                          isAudit ? 'text-slate-400' : 
                                          isExpense ? 'text-rose-600' : 'text-emerald-600'
                                        }`}>
                                          {isAudit ? '-' : formatCurrency(t.value)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <button 
                                            onClick={() => setDeleteConfirm(String(t.id))}
                                            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="bg-red-100 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Excluir Registro?</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Esta ação é permanente e removerá este lançamento do banco de dados.
              </p>
            </div>
            <div className="flex p-4 gap-3 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-4 bg-white text-slate-400 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-slate-200"
              >
                Manter
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-4 bg-red-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg shadow-red-900/20"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {ghostToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="bg-rose-100 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 rotate-12">
                <Trash2 className="w-10 h-10 text-rose-600" />
              </div>
              <h3 className="text-xl font-black text-rose-600 uppercase tracking-tight mb-3">Apagar o Passado?</h3>
              <p className="text-sm font-medium text-slate-600 leading-relaxed mb-4">
                Você está prestes a excluir <b className="text-rose-600 font-black">{managerGroups[ghostToDelete]?.length || 0} registros</b> atribuídos a <b>{ghostToDelete}</b>.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Aviso Irreversível</p>
                <p className="text-xs text-amber-600/80 font-bold mt-1">O caixa total anterior não baterá mais se essas notas forem destruídas de vez. Ninguém poderá recuperar essa ação.</p>
              </div>
            </div>
            <div className="flex p-4 gap-3 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setGhostToDelete(null)}
                disabled={isWiping}
                className="flex-1 py-4 bg-white text-slate-500 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Manter Dados
              </button>
              <button 
                onClick={() => wipeGhostHistory(ghostToDelete)}
                disabled={isWiping}
                className="flex-1 py-4 bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg shadow-rose-900/20 hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isWiping ? 'Apagando... (Pode Levar Tempo)' : 'Destruir Registros'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Relatórios por Data */}
      {reportManager && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-800">Relatórios</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{reportManager}</p>
              </div>
              <button onClick={() => setReportManager(null)} className="p-2 hover:bg-slate-200 rounded-full transition-all">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto no-scrollbar space-y-3">
              {groupTransactionsByDate(managerGroups[reportManager] || []).map(group => (
                <div key={group.date} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-700 text-sm">{group.date}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{group.items.length} registros</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => generateDailyReport(reportManager, group.date, group.items)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-md hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    <Download className="w-4 h-4" /> PDF
                  </button>
                </div>
              ))}
              {groupTransactionsByDate(managerGroups[reportManager] || []).length === 0 && (
                <p className="text-center text-slate-400 text-xs font-bold py-4">Nenhum registro encontrado.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {downloadSuccess && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl font-black text-xs uppercase tracking-widest animate-in slide-in-from-bottom-4 fade-in z-[200] flex items-center gap-2">
          <CheckCircle2 size={16} />
          Relatório Baixado!
        </div>
      )}
    </div>
  );
};
