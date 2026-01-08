
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SubTabFactory, Transaction, AppSection, User, PeriodTotals, EntryState, ExpenseCalc } from '../types';
import { useCustomers } from '../hooks/useCustomers';
import { useNotes } from '../hooks/useNotes';
import { NoteComposer } from './NotesModals';
import { StatsCard } from './StatsCard';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Check, UserCircle, Loader2, X, AlertTriangle, 
  MoreVertical, ArrowUp, ArrowDown, Settings2, Plus, 
  UserPlus, ChevronDown, FileDown, 
  Square, CheckSquare, Receipt, ShoppingCart, ArrowRightLeft,
  Calculator, Edit3, Trash2, Save,
  MessageCircle, Share2, EyeOff, DollarSign, Clock, Phone,
  Truck, Wallet, ChevronUp, Printer, FileText, MessageSquarePlus, Scissors, Pencil
} from 'lucide-react';

interface FactoryProps {
  section: AppSection;
  user: User;
  transactions: Transaction[];
  addTransactions: (ts: Omit<Transaction, 'id' | 'date'>[]) => Promise<Transaction[] | null>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  settleCustomerDebt: (customerName: string, transactionIds: string[]) => Promise<void>;
  partialSettleTransaction: (originalTx: Transaction, amountPaid: number) => Promise<boolean>;
  calculateTotals: (category: string, subCategory?: string) => PeriodTotals;
  saveConfig: (sections: AppSection[]) => Promise<void>;
  sections: AppSection[];
}

const DEFAULT_TAB_ORDER: SubTabFactory[] = ['VENDAS', 'A_RECEBER', 'GASTOS'];

export const Factory: React.FC<FactoryProps> = ({ 
  section, user, transactions, addTransactions, updateTransaction, settleCustomerDebt, partialSettleTransaction, calculateTotals, saveConfig, sections 
}) => {
  const { customers, addCustomer } = useCustomers(user.workspaceId);
  const { addNote } = useNotes(user.workspaceId);
  
  const [tabOrder, setTabOrder] = useState<SubTabFactory[]>(() => {
    try {
      const saved = localStorage.getItem(`factory_tabs_${section.id}`);
      return saved ? JSON.parse(saved) : DEFAULT_TAB_ORDER;
    } catch {
      return DEFAULT_TAB_ORDER;
    }
  });
  const [activeTab, setActiveTab] = useState<SubTabFactory>(tabOrder[0]);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [tempTabOrder, setTempTabOrder] = useState<SubTabFactory[]>(tabOrder);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [entries, setEntries] = useState<Record<string, EntryState>>({});
  const [expenseCalcs, setExpenseCalcs] = useState<Record<string, ExpenseCalc>>({});
  const [expandedCalc, setExpandedCalc] = useState<string | null>(null);
  const [globalMethod, setGlobalMethod] = useState<'A_VISTA' | 'A_PRAZO'>('A_VISTA');
  const [entityName, setEntityName] = useState(''); 
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [settleConfirm, setSettleConfirm] = useState<{customerName: string, txIds: string[], type: 'RECEBIMENTO' | 'PAGAMENTO'} | null>(null);
  const [shakeField, setShakeField] = useState(false);
  
  // States for Partial Payment & Editing
  const [partialPayModal, setPartialPayModal] = useState<{ isOpen: boolean, tx: Transaction | null }>({ isOpen: false, tx: null });
  const [partialAmount, setPartialAmount] = useState('');
  
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState({ quantity: '', value: '' });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [expandedCustomer, expandedSupplier]);

  const hideMoney = user.hideSalesValues && user.role !== 'OWNER';
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const KACHING_URL = 'https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3';

  const playCashSound = (audioObj?: HTMLAudioElement) => {
    if (user.enableSounds) {
      const audio = audioObj || new Audio(KACHING_URL);
      audio.volume = 0.5;
      audio.play().catch(e => console.warn("Erro ao reproduzir áudio:", e));
    }
  };

  const handleSendNote = async (content: string, type: 'INFO' | 'ALERT' | 'MONEY', amount?: number) => {
    await addNote({
      workspaceId: user.workspaceId,
      createdById: user.id,
      createdByName: user.name,
      content,
      type,
      amount
    });

    if (type === 'MONEY' && amount) {
      await addTransactions([{
        workspaceId: user.workspaceId,
        category: section.id,
        subCategory: 'GASTOS',
        item: `AVISO: ${content}`,
        value: amount,
        paymentMethod: 'A_VISTA',
        createdBy: user.name,
        isPending: false
      }]);
    }
  };

  const customerSuggestions = useMemo(() => {
    if (!entityName.trim()) return [];
    return customers.filter(c => c.name.toLowerCase().includes(entityName.toLowerCase())).slice(0, 5);
  }, [customers, entityName]);

  const exactMatch = useMemo(() => customers.find(c => c.name.toLowerCase() === entityName.toLowerCase().trim()), [customers, entityName]);

  const pendingByCustomer = useMemo(() => {
    const pending = transactions.filter(t => String(t.category) === String(section.id) && t.isPending && t.subCategory !== 'GASTOS');
    const groups: Record<string, Transaction[]> = {};
    pending.forEach(t => {
      const name = t.customerName || "Consumidor";
      if (!groups[name]) groups[name] = [];
      groups[name].push(t);
    });
    return groups;
  }, [transactions, section.id]);

  const pendingBySupplier = useMemo(() => {
    const pending = transactions.filter(t => String(t.category) === String(section.id) && t.isPending && t.subCategory === 'GASTOS');
    const groups: Record<string, Transaction[]> = {};
    pending.forEach(t => {
      const name = t.customerName || "Fornecedor";
      if (!groups[name]) groups[name] = [];
      groups[name].push(t);
    });
    return groups;
  }, [transactions, section.id]);

  const groupTransactionsByNote = (txs: Transaction[]) => {
    const notes: Record<string, Transaction[]> = {};
    txs.forEach(t => {
      const dateObj = new Date(t.date);
      const dateStr = dateObj.toLocaleDateString('pt-BR');
      const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const key = `${dateStr} às ${timeStr}`;
      
      if (!notes[key]) notes[key] = [];
      notes[key].push(t);
    });
    return Object.entries(notes).sort((a, b) => {
      const dateA = new Date(a[1][0].date).getTime();
      const dateB = new Date(b[1][0].date).getTime();
      return dateB - dateA;
    });
  };

  const totalPendingReceivable = useMemo(() => 
    transactions.filter(t => String(t.category) === String(section.id) && t.isPending && t.subCategory !== 'GASTOS')
      .reduce((acc, t) => acc + (t.value || 0), 0)
  , [transactions, section.id]);

  const totalPendingPayable = useMemo(() => 
    transactions.filter(t => String(t.category) === String(section.id) && t.isPending && t.subCategory === 'GASTOS')
      .reduce((acc, t) => acc + (t.value || 0), 0)
  , [transactions, section.id]);

  const calculateSingleValue = useCallback((itemName: string, qtyStr: string, method: 'A_VISTA' | 'A_PRAZO') => {
    const configItem = section.items.find(i => i.name === itemName);
    const qty = parseFloat(qtyStr.replace(',', '.')) || 0;
    if (qty <= 0) return '';
    const price = method === 'A_VISTA' ? (configItem?.defaultPriceAVista || 0) : (configItem?.defaultPriceAPrazo || 0);
    return (qty * price).toFixed(2);
  }, [section.items]);

  useEffect(() => {
    if (activeTab === 'VENDAS') {
      setEntries(prev => {
        const next = { ...prev };
        (Object.keys(next) as string[]).forEach(item => {
          const entry = next[item];
          if (entry && entry.quantity) {
             entry.value = calculateSingleValue(item, entry.quantity, globalMethod);
          }
        });
        return next;
      });
    }
  }, [globalMethod, activeTab, calculateSingleValue]);

  const handleEntryChange = (item: string, field: keyof EntryState, value: string) => {
    setEntries(prev => {
      const current = prev[item] || { quantity: '', value: '' };
      const next = { ...current, [field]: value };
      if (activeTab === 'VENDAS' && field === 'quantity') next.value = calculateSingleValue(item, next.quantity, globalMethod);
      return { ...prev, [item]: next };
    });
  };

  const handleExpenseCalcChange = (itemName: string, field: keyof ExpenseCalc, val: string) => {
    setExpenseCalcs(prev => {
      const current = prev[itemName] || { qty: '', unit: '' };
      const next = { ...current, [field]: val };
      const q = parseFloat(next.qty.replace(',', '.')) || 0;
      const u = parseFloat(next.unit.replace(',', '.')) || 0;
      if (q > 0 && u > 0) {
        setEntries(ePrev => ({ ...ePrev, [itemName]: { quantity: q.toString(), value: (q * u).toFixed(2) } }));
      }
      return { ...prev, [itemName]: next };
    });
  };

  const handleCreateCustomer = async () => {
    if (!entityName.trim() || isAddingCustomer) return;
    setIsAddingCustomer(true);
    try {
      const newCust = await addCustomer(entityName.trim(), newCustomerPhone.trim());
      if (newCust) { setEntityName(newCust.name); setNewCustomerPhone(''); setShowSuggestions(false); }
    } catch (e) { console.error("Erro ao cadastrar cliente."); }
    finally { setIsAddingCustomer(false); }
  };

  const handleSettleRequest = (customerName: string, txIds: string[], type: 'RECEBIMENTO' | 'PAGAMENTO') => 
    setSettleConfirm({ customerName, txIds, type });

  const executeSettle = async () => {
    if (!settleConfirm || isSaving) return;
    setIsSaving(true);
    try {
      await settleCustomerDebt(settleConfirm.customerName, settleConfirm.txIds);
      if (settleConfirm.type === 'RECEBIMENTO') playCashSound();
      setSettleConfirm(null);
      setSelectedIds([]);
    } catch (e) { console.error("Erro ao quitar."); }
    finally { setIsSaving(false); }
  };

  const handleOpenPartialPay = (tx: Transaction) => {
    setPartialPayModal({ isOpen: true, tx });
    setPartialAmount('');
  };

  const submitPartialPay = async () => {
    const tx = partialPayModal.tx;
    if (!tx) return;
    
    const amount = parseFloat(partialAmount.replace(',', '.')) || 0;
    if (amount <= 0) {
      alert("Digite um valor válido.");
      return;
    }
    if (amount >= tx.value) {
      // Se for maior ou igual, é quitação total
      handleSettleRequest(tx.customerName || 'Cliente', [tx.id], 'RECEBIMENTO');
      setPartialPayModal({ isOpen: false, tx: null });
      return;
    }

    setIsSaving(true);
    try {
      const success = await partialSettleTransaction(tx, amount);
      if (success) {
        playCashSound();
        setPartialPayModal({ isOpen: false, tx: null });
      } else {
        alert("Erro ao processar pagamento parcial.");
      }
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditForm({ 
      quantity: tx.quantity ? tx.quantity.toString() : '', 
      value: tx.value.toFixed(2).replace('.', ',') 
    });
  };

  const saveEdit = async () => {
    if (!editingTx) return;
    setIsSaving(true);
    try {
      const newVal = parseFloat(editForm.value.replace(',', '.')) || 0;
      const newQty = parseFloat(editForm.quantity.replace(',', '.')) || 0;
      
      const oldQty = editingTx.quantity || 0;
      const oldVal = editingTx.value;

      // 1. Atualiza a transação original
      // Adiciona * no nome se não tiver, para marcar visualmente
      const newItemName = editingTx.item.endsWith('*') ? editingTx.item : `${editingTx.item} *`;
      
      await updateTransaction(editingTx.id, {
        value: newVal,
        quantity: newQty,
        item: newItemName
      });

      // 2. Cria registro de auditoria
      await addTransactions([{
        workspaceId: user.workspaceId,
        category: 'AUDITORIA',
        subCategory: 'EDICAO',
        item: `LOG: ${editingTx.item.replace(' *', '')}`,
        customerName: `Antes: ${oldQty}x (${formatCurrency(oldVal)}) | Depois: ${newQty}x (${formatCurrency(newVal)}) por ${user.name}`,
        value: 0, // Valor zero pois é informativo
        quantity: 1,
        createdBy: user.name,
        paymentMethod: 'SISTEMA',
        isPending: false
      }]);

      setEditingTx(null);
    } catch (e) {
      console.error("Erro ao editar:", e);
      alert("Erro ao salvar edição.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmBatch = async () => {
    const valid = (Object.entries(entries) as [string, EntryState][])
      .filter(([_, e]) => parseFloat(e.value) > 0)
      .map(([item, e]) => ({
        workspaceId: user.workspaceId,
        category: section.id,
        subCategory: activeTab === 'GASTOS' ? 'GASTOS' : (globalMethod === 'A_VISTA' ? 'VENDAS' : 'A_RECEBER'),
        item, 
        value: parseFloat(e.value.replace(',', '.')) || 0, 
        quantity: parseFloat(e.quantity.replace(',', '.')) || undefined, 
        paymentMethod: globalMethod,
        customerName: globalMethod === 'A_PRAZO' ? entityName : undefined,
        isPending: globalMethod === 'A_PRAZO',
        createdBy: user.name,
      }));

    if (valid.length === 0) return;

    if (globalMethod === 'A_PRAZO' && !entityName.trim()) {
      setShakeField(true);
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => setShakeField(false), 500);
      return;
    }

    setIsSaving(true);
    try {
      await addTransactions(valid);
      
      if (activeTab !== 'GASTOS') {
        let updatedSections = [...sections];
        let stockChanged = false;

        const currentSectionIndex = updatedSections.findIndex(s => s.id === section.id);
        const linkedSectionId = section.linkedSectionId;
        const linkedSectionIndex = linkedSectionId ? updatedSections.findIndex(s => s.id === linkedSectionId) : -1;
        const globalStockIndex = updatedSections.findIndex(s => s.type === 'STOCK_STYLE' && s.globalStockMode === 'GLOBAL');

        valid.forEach(tx => {
          const qty = tx.quantity || 0;
          if (qty > 0) {
            let deducted = false;
            if (globalStockIndex > -1) {
              const stockItemIndex = updatedSections[globalStockIndex].items.findIndex(i => i.name === tx.item);
              if (stockItemIndex > -1) {
                const current = updatedSections[globalStockIndex].items[stockItemIndex].currentStock || 0;
                updatedSections[globalStockIndex].items[stockItemIndex].currentStock = Math.max(0, current - qty);
                deducted = true;
                stockChanged = true;
              }
            }
            if (!deducted && linkedSectionIndex > -1) {
              const stockItemIndex = updatedSections[linkedSectionIndex].items.findIndex(i => i.name === tx.item);
              if (stockItemIndex > -1) {
                const current = updatedSections[linkedSectionIndex].items[stockItemIndex].currentStock || 0;
                updatedSections[linkedSectionIndex].items[stockItemIndex].currentStock = Math.max(0, current - qty);
                deducted = true;
                stockChanged = true;
              }
            } 
            if (!deducted && currentSectionIndex > -1) {
              const localItemIndex = updatedSections[currentSectionIndex].items.findIndex(i => i.name === tx.item);
              if (localItemIndex > -1) {
                const current = updatedSections[currentSectionIndex].items[localItemIndex].currentStock || 0;
                updatedSections[currentSectionIndex].items[localItemIndex].currentStock = Math.max(0, current - qty);
                stockChanged = true;
              }
            }
          }
        });

        if (stockChanged) {
          await saveConfig(updatedSections);
        }
      }
      
      if (activeTab === 'VENDAS') playCashSound();
      setEntries({}); setExpenseCalcs({}); setEntityName(''); setNewCustomerPhone(''); setShowSuggestions(false);
    } catch (err) { console.error("Erro ao registrar batch.", err); }
    finally { setIsSaving(false); }
  };

  const moveTab = (index: number, direction: 'UP' | 'DOWN') => {
    const newOrder = [...tempTabOrder];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setTempTabOrder(newOrder);
  };

  const saveTabOrder = () => {
    setTabOrder(tempTabOrder);
    localStorage.setItem(`factory_tabs_${section.id}`, JSON.stringify(tempTabOrder));
    setIsReorderModalOpen(false);
  };

  const toggleSelection = (ids: string[]) => {
    const allSelected = ids.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedIds(prev => {
        const newSet = new Set([...prev, ...ids]);
        return Array.from(newSet);
      });
    }
  };

  const toggleSelectAll = (items: Transaction[]) => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const handleDownloadPDF = (customerName: string, items: Transaction[]) => {
    if (items.length === 0) return;
    
    const doc = new jsPDF();
    
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE ENTREGA", 105, 13, { align: "center" });
    
    doc.setTextColor(33, 33, 33);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Cliente: ${customerName}`, 14, 30);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 36);
    
    const tableData = items.map(t => [
      new Date(t.date).toLocaleDateString('pt-BR'),
      t.item,
      t.quantity ? t.quantity.toString() : '-',
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.value)
    ]);

    autoTable(doc, {
      head: [['Data', 'Item', 'Qtd', 'Valor']],
      body: tableData,
      startY: 42,
      theme: 'grid',
      headStyles: { fillColor: [60, 60, 60] },
      styles: { fontSize: 9 },
    });

    const total = items.reduce((acc, t) => acc + t.value, 0);
    const finalY = (doc as any).lastAutoTable.finalY || 45;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Total a Pagar: ${formatCurrency(total)}`, 14, finalY + 10);
    
    doc.setLineWidth(0.5);
    doc.line(14, finalY + 40, 90, finalY + 40);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Assinatura do Responsável", 14, finalY + 45);

    doc.save(`pedido_${customerName.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
  };

  const batchTotal = (Object.values(entries) as EntryState[]).reduce((acc: number, e: EntryState) => acc + (parseFloat(e.value) || 0), 0);

  return (
    <div className={`space-y-6 animate-in fade-in duration-500 relative ${batchTotal > 0 ? 'pb-40' : 'pb-24'}`}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
          75% { transform: translateX(-8px); }
        }
        .shake-animation { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>

      {/* ... Header e Tabs ... */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-black text-slate-800">{section.name}</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowNoteModal(true)} 
            className="p-3 bg-blue-100 text-blue-600 rounded-2xl hover:bg-blue-200 transition-all shadow-sm"
            title="Enviar Aviso/Mensagem"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
          <button 
            onClick={() => { setTempTabOrder(tabOrder); setIsReorderModalOpen(true); }} 
            className="p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-orange-50 hover:text-orange-600 transition-all shadow-sm"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex bg-slate-200 p-1 rounded-2xl shadow-inner">
        {tabOrder.map((tab) => (
          <button key={tab} onClick={() => { setActiveTab(tab); setExpandedCalc(null); setGlobalMethod('A_VISTA'); setEntityName(''); setSelectedIds([]); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-white shadow-md text-blue-600' : 'text-slate-600'}`}>
            {tab === 'A_RECEBER' ? 'PENDENTES' : tab}
          </button>
        ))}
      </div>
      
      {activeTab === 'VENDAS' && !hideMoney && <StatsCard title="Produção / Vendas" totals={calculateTotals(section.id, 'VENDAS')} type="income" />}
      {activeTab === 'GASTOS' && !hideMoney && <StatsCard title="Gastos Fábrica" totals={calculateTotals(section.id, 'GASTOS')} type="expense" />}
      
      {activeTab === 'A_RECEBER' && !hideMoney && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-orange-50 border border-orange-100 p-6 rounded-[2.5rem] shadow-sm flex flex-col justify-center">
             <h3 className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-1">A Receber</h3>
             <p className="text-xl font-black text-slate-800">{formatCurrency(totalPendingReceivable)}</p>
          </div>
          <div className="bg-red-50 border border-red-100 p-6 rounded-[2.5rem] shadow-sm flex flex-col justify-center">
             <h3 className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1">A Pagar</h3>
             <p className="text-xl font-black text-slate-800">{formatCurrency(totalPendingPayable)}</p>
          </div>
        </div>
      )}

      {(activeTab === 'VENDAS' || activeTab === 'GASTOS') && (
        <div className="space-y-4 animate-in slide-in-from-top-2">
          {/* ... Botões Vendas/Gastos ... */}
          <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 flex gap-2">
            <button onClick={() => setGlobalMethod('A_VISTA')} className={`flex-1 py-4 rounded-[1.6rem] flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${globalMethod === 'A_VISTA' ? (activeTab === 'VENDAS' ? 'bg-green-600' : 'bg-slate-800') + ' text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}><DollarSign className="w-4 h-4" /> À Vista</button>
            <button onClick={() => setGlobalMethod('A_PRAZO')} className={`flex-1 py-4 rounded-[1.6rem] flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${globalMethod === 'A_PRAZO' ? (activeTab === 'VENDAS' ? 'bg-orange-600' : 'bg-red-600') + ' text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}><Clock className="w-4 h-4" /> À Prazo</button>
          </div>

          {globalMethod === 'A_PRAZO' && (
            <div className={`relative animate-in zoom-in-95 z-30 ${shakeField ? 'shake-animation' : ''}`}>
              <div className="relative">
                {activeTab === 'GASTOS' ? <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-red-300" /> : <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-300" />}
                <input 
                  value={entityName} 
                  onFocus={() => setShowSuggestions(activeTab === 'VENDAS')} 
                  onChange={e => { setEntityName(e.target.value); setShowSuggestions(activeTab === 'VENDAS'); }} 
                  placeholder={activeTab === 'GASTOS' ? "NOME DO FORNECEDOR / EMPRESA" : "NOME DO CLIENTE (OBRIGATÓRIO)"} 
                  className={`w-full p-5 pl-12 border-2 rounded-[1.8rem] font-black text-xs uppercase outline-none transition-all ${activeTab === 'GASTOS' ? 'bg-red-50 border-red-100 text-red-900 focus:border-red-500 placeholder:text-red-200' : 'bg-orange-50 border-orange-100 text-orange-900 focus:border-orange-500 placeholder:text-orange-200'} ${shakeField ? 'border-red-500' : ''}`} 
                />
              </div>
              
              {showSuggestions && activeTab === 'VENDAS' && (entityName.trim().length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[1.8rem] shadow-2xl border border-slate-100 overflow-hidden z-40 animate-in slide-in-from-top-2 duration-200">
                  {!exactMatch && (
                    <div className="p-5 bg-blue-50 border-b-2 border-blue-100 space-y-4">
                      <div className="flex items-center gap-3"><div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg"><UserPlus className="w-4 h-4" /></div><div><p className="font-black text-blue-700 text-[10px] uppercase tracking-tight">Novo Cliente Detectado</p><p className="text-[8px] font-bold text-blue-400 uppercase">"{entityName.toUpperCase()}"</p></div></div>
                      <div className="flex gap-2"><div className="relative flex-1"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-300" /><input value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} placeholder="WHATSAPP (OPCIONAL)" className="w-full p-3 pl-8 bg-white border border-blue-100 rounded-xl font-bold text-[10px] uppercase outline-none" /></div><button type="button" onClick={handleCreateCustomer} disabled={isAddingCustomer} className="px-5 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md flex items-center justify-center min-w-[100px]">{isAddingCustomer ? <Loader2 className="w-3 h-3 animate-spin" /> : 'CADASTRAR'}</button></div>
                    </div>
                  )}
                  {customerSuggestions.map(customer => (
                    <button key={customer.id} type="button" onClick={() => { setEntityName(customer.name); setShowSuggestions(false); }} className="w-full p-4 text-left hover:bg-orange-50 flex items-center gap-4 border-b border-slate-50 last:border-0 transition-colors"><div className="p-2 bg-orange-100 text-orange-600 rounded-xl"><UserCircle className="w-4 h-4" /></div><div><p className="font-black text-slate-800 text-[10px] uppercase tracking-tight">{customer.name}</p>{customer.phone && <p className="text-[8px] font-bold text-slate-400 uppercase">{customer.phone}</p>}</div></button>
                  ))}
                </div>
              )}
              {showSuggestions && <div className="fixed inset-0 z-[-1]" onClick={() => setShowSuggestions(false)} />}
            </div>
          )}
        </div>
      )}

      {activeTab !== 'A_RECEBER' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden relative z-10">
          {(activeTab === 'GASTOS' ? section.expenses : section.items).map(item => {
            const entry = entries[item.name] || { quantity: '', value: '' };
            const isCalcOpen = expandedCalc === item.name;
            const calc = expenseCalcs[item.name] || { qty: '', unit: '' };
            return (
              <div key={item.id} className="p-6 border-b border-slate-50 last:border-0">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-black text-slate-800 text-lg block leading-tight">{item.name}</span>
                  <div className="flex items-center gap-2">
                    {activeTab === 'VENDAS' && !hideMoney && <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Preço: {formatCurrency(globalMethod === 'A_VISTA' ? (item.defaultPriceAVista || 0) : (item.defaultPriceAPrazo || 0))}</span>}
                    {activeTab === 'GASTOS' && !hideMoney && <button onClick={() => setExpandedCalc(isCalcOpen ? null : item.name)} className={`p-2 rounded-xl transition-all ${isCalcOpen ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}><Calculator className="w-4 h-4" /></button>}
                  </div>
                </div>
                {activeTab === 'GASTOS' && isCalcOpen && (
                  <div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-indigo-50/50 rounded-2xl animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1"><label className="text-[8px] font-black text-indigo-400 uppercase ml-2">Qtd</label><input type="text" inputMode="decimal" value={calc.qty} onChange={e => handleExpenseCalcChange(item.name, 'qty', e.target.value)} placeholder="0" className="w-full p-3 bg-white border border-indigo-100 rounded-xl font-black text-center text-xs outline-none focus:border-indigo-500" /></div>
                    <div className="space-y-1"><label className="text-[8px] font-black text-indigo-400 uppercase ml-2">R$ Unit.</label><input type="text" inputMode="decimal" value={calc.unit} onChange={e => handleExpenseCalcChange(item.name, 'unit', e.target.value)} placeholder="0,00" className="w-full p-3 bg-white border border-indigo-100 rounded-xl font-black text-center text-xs outline-none focus:border-indigo-500" /></div>
                  </div>
                )}
                <div className="flex gap-4 items-end">
                  <div className="flex-1"><label className="block text-[8px] font-black uppercase text-slate-400 mb-1 ml-4">Quantidade</label><input type="text" inputMode="decimal" value={entry.quantity} onChange={e => handleEntryChange(item.name, 'quantity', e.target.value)} placeholder="0" className={`w-full p-4 border-2 border-transparent rounded-2xl font-black text-lg outline-none focus:bg-white transition-all ${activeTab === 'GASTOS' ? 'bg-red-100 text-red-900 placeholder:text-red-300 focus:border-red-500' : 'bg-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'}`} /></div>
                  {!hideMoney && <div className="flex-1"><label className="block text-[8px] font-black uppercase text-slate-400 mb-1 ml-4">Valor Total (R$)</label><input type="text" inputMode="decimal" value={entry.value} onChange={e => handleEntryChange(item.name, 'value', e.target.value)} placeholder="0,00" className={`w-full p-4 border-2 border-transparent rounded-2xl font-black text-lg outline-none focus:bg-white transition-all ${activeTab === 'GASTOS' ? 'bg-red-100 text-red-900 placeholder:text-red-300 focus:border-red-500' : 'bg-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'}`} /></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'A_RECEBER' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
          {/* ... Código A RECEBER (Mantido) ... */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 px-2"><h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">A Receber (Clientes)</h4><div className="h-px flex-1 bg-orange-100" /></div>
             {Object.keys(pendingByCustomer).length === 0 ? (
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 text-center"><p className="text-[9px] font-black text-slate-300 uppercase">Nenhum recebimento pendente</p></div>
             ) : (
               (Object.entries(pendingByCustomer) as [string, Transaction[]][]).map(([name, items]) => {
                 const total = items.reduce((acc: number, i: Transaction) => acc + (i.value || 0), 0);
                 const isExpanded = expandedCustomer === name;
                 const groupedNotes = groupTransactionsByNote(items);
                 const noteCount = groupedNotes.length;
                 const selectedCount = selectedIds.filter(id => items.some(i => i.id === id)).length;
                 const selectedTotal = items.filter(i => selectedIds.includes(i.id)).reduce((acc, t) => acc + t.value, 0);

                 return (
                   <div key={name} className={`bg-white rounded-[2.5rem] shadow-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-orange-200' : 'border-slate-50'}`}>
                      <button onClick={() => setExpandedCustomer(isExpanded ? null : name)} className="w-full p-6 flex items-center justify-between text-left"><div className="flex items-center gap-4"><div className={`p-4 rounded-2xl ${isExpanded ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-400'}`}><UserCircle className="w-6 h-6" /></div><div><h4 className="font-black text-slate-800 text-lg leading-tight">{name}</h4><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{noteCount} {noteCount === 1 ? 'nota' : 'notas'}</p></div></div><p className="font-black text-slate-800 text-xl">{formatCurrency(total)}</p></button>
                      {isExpanded && (
                        <div className="px-6 pb-6 animate-in slide-in-from-top-2">
                           {/* Selecionar Todos Header */}
                           <div className="flex justify-between items-center mb-4 px-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Detalhes da Conta</span>
                              <button 
                                onClick={() => toggleSelectAll(items)}
                                className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors"
                              >
                                {selectedCount === items.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                              </button>
                           </div>

                           <div className="mb-6 space-y-4">
                             {groupedNotes.map(([noteKey, noteItems]) => {
                               const noteTotal = noteItems.reduce((acc, t) => acc + (t.value || 0), 0);
                               const noteIds = noteItems.map(t => t.id);
                               const isNoteSelected = noteIds.every(id => selectedIds.includes(id));

                               return (
                                 <div key={noteKey} className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
                                   <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200/60">
                                     <div className="flex items-center gap-3">
                                        <div 
                                          onClick={() => toggleSelection(noteIds)}
                                          className="cursor-pointer text-slate-300 hover:text-blue-500 transition-colors"
                                        >
                                           {isNoteSelected ? <CheckSquare className="w-5 h-5 text-blue-600 fill-blue-50" /> : <Square className="w-5 h-5" />}
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-400">
                                          <Clock className="w-3 h-3" />
                                          <span className="text-[9px] font-black uppercase tracking-widest">{noteKey}</span>
                                        </div>
                                     </div>
                                     <span className="text-[10px] font-black text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-100">{formatCurrency(noteTotal)}</span>
                                   </div>
                                   <div className="space-y-3">
                                     {noteItems.map((t: Transaction) => (
                                         <div key={t.id} className="flex items-center gap-3 pl-1">
                                            <div className="flex-1 flex justify-between items-center text-xs">
                                              <div className="flex items-center gap-2">
                                                <span className="font-black text-slate-700 uppercase">{t.item}</span>
                                                {t.quantity && <span className="text-[8px] font-bold text-slate-400 bg-slate-200 px-1.5 rounded">x{t.quantity}</span>}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="font-black text-slate-400">{formatCurrency(t.value)}</span>
                                                <button 
                                                  onClick={() => handleOpenEdit(t)} 
                                                  className="p-1.5 bg-white text-blue-500 rounded-lg shadow-sm border border-slate-100 hover:bg-blue-50 transition-all"
                                                  title="Editar Item"
                                                >
                                                  <Pencil className="w-3 h-3" />
                                                </button>
                                                <button 
                                                  onClick={() => handleOpenPartialPay(t)}
                                                  className="p-1.5 bg-white text-indigo-500 rounded-lg shadow-sm border border-slate-100 hover:bg-indigo-50 transition-all"
                                                  title="Abater Valor"
                                                >
                                                  <Scissors className="w-3 h-3" />
                                                </button>
                                              </div>
                                            </div>
                                         </div>
                                     ))}
                                   </div>
                                 </div>
                               );
                             })}
                           </div>

                           {/* BARRA DE AÇÕES PARA SELEÇÃO */}
                           {selectedCount > 0 ? (
                             <div className="bg-slate-900 p-4 rounded-2xl flex items-center justify-between shadow-xl animate-in slide-in-from-bottom-2 sticky bottom-4 z-10 border border-white/10">
                                <div className="pl-2">
                                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Selecionado ({selectedCount})</p>
                                   <p className="text-white font-black text-lg">{formatCurrency(selectedTotal)}</p>
                                </div>
                                <div className="flex gap-2">
                                   <button 
                                     onClick={() => handleDownloadPDF(name, items.filter(i => selectedIds.includes(i.id)))}
                                     className="p-3 bg-white/10 text-white rounded-xl hover:bg-white/20 active:scale-95 transition-all"
                                     title="Baixar PDF"
                                   >
                                      <Printer className="w-5 h-5" />
                                   </button>
                                   <button 
                                     onClick={() => handleSettleRequest(name, items.filter(i => selectedIds.includes(i.id)).map(i => i.id), 'RECEBIMENTO')}
                                     className="px-4 py-3 bg-green-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg flex items-center gap-2 hover:bg-green-500 active:scale-95 transition-all"
                                   >
                                      <Check className="w-4 h-4" /> Quitar
                                   </button>
                                </div>
                             </div>
                           ) : (
                             <button onClick={() => handleSettleRequest(name, items.map((i: Transaction) => i.id), 'RECEBIMENTO')} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 hover:bg-green-500 active:scale-95 transition-all"><Check className="w-4 h-4" /> Receber Tudo</button>
                           )}
                        </div>
                      )}
                   </div>
                 );
               })
             )}
          </div>

          {/* ... Código A PAGAR (Mantido) ... */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 px-2"><h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest">A Pagar (Fornecedores)</h4><div className="h-px flex-1 bg-red-100" /></div>
             {Object.keys(pendingBySupplier).length === 0 ? (
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 text-center"><p className="text-[9px] font-black text-slate-300 uppercase">Nenhuma dívida pendente</p></div>
             ) : (
               (Object.entries(pendingBySupplier) as [string, Transaction[]][]).map(([name, items]) => {
                 const total = items.reduce((acc: number, i: Transaction) => acc + (i.value || 0), 0);
                 const isExpanded = expandedSupplier === name;
                 const groupedNotes = groupTransactionsByNote(items);
                 const noteCount = groupedNotes.length;

                 return (
                   <div key={name} className={`bg-white rounded-[2.5rem] shadow-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-red-200' : 'border-slate-50'}`}>
                      <button onClick={() => setExpandedSupplier(isExpanded ? null : name)} className="w-full p-6 flex items-center justify-between text-left"><div className="flex items-center gap-4"><div className={`p-4 rounded-2xl ${isExpanded ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Truck className="w-6 h-6" /></div><div><h4 className="font-black text-slate-800 text-lg leading-tight">{name}</h4><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{noteCount} {noteCount === 1 ? 'compra' : 'compras'}</p></div></div><p className="font-black text-red-600 text-xl">{formatCurrency(total)}</p></button>
                      {isExpanded && (
                        <div className="px-6 pb-6 animate-in slide-in-from-top-2">
                           <div className="mb-6 space-y-4">
                             {groupedNotes.map(([noteKey, noteItems]) => {
                               const noteTotal = noteItems.reduce((acc, t) => acc + (t.value || 0), 0);
                               return (
                                 <div key={noteKey} className="bg-red-50/50 rounded-3xl p-5 border border-red-100/50">
                                   <div className="flex justify-between items-center mb-3 pb-2 border-b border-red-100">
                                     <div className="flex items-center gap-2 text-red-400">
                                       <Clock className="w-3 h-3" />
                                       <span className="text-[9px] font-black uppercase tracking-widest">{noteKey}</span>
                                     </div>
                                     <span className="text-[10px] font-black text-red-700 bg-white px-2 py-0.5 rounded-lg border border-red-100">{formatCurrency(noteTotal)}</span>
                                   </div>
                                   <div className="space-y-2">
                                     {noteItems.map((t: Transaction) => (
                                       <div key={t.id} className="flex justify-between items-center text-xs">
                                          <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-300"></span>
                                            <span className="font-black text-slate-700">{t.item}</span>
                                            {t.quantity && <span className="text-[8px] font-bold text-slate-400 bg-white px-1.5 rounded border border-red-100">x{t.quantity}</span>}
                                          </div>
                                          <span className="font-black text-red-400">{formatCurrency(t.value)}</span>
                                       </div>
                                     ))}
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                           <button onClick={() => handleSettleRequest(name, items.map((i: Transaction) => i.id), 'PAGAMENTO')} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 hover:bg-red-500 active:scale-95 transition-all"><Wallet className="w-4 h-4" /> Quitar Dívida</button>
                        </div>
                      )}
                   </div>
                 );
               })
             )}
          </div>
        </div>
      )}

      {/* Modais Antigos */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3"><ArrowRightLeft className="text-blue-600" /> Reordenar Abas</h3>
            <div className="space-y-3 mb-8">
              {tempTabOrder.map((tab, idx) => (
                <div key={tab} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-600">{tab === 'A_RECEBER' ? 'PENDENTES' : tab}</span>
                  <div className="flex gap-2">
                    <button onClick={() => moveTab(idx, 'UP')} disabled={idx === 0} className="p-2 bg-white text-slate-400 rounded-lg shadow-sm disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => moveTab(idx, 'DOWN')} disabled={idx === tempTabOrder.length - 1} className="p-2 bg-white text-slate-400 rounded-lg shadow-sm disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsReorderModalOpen(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black uppercase text-[10px] rounded-2xl">Cancelar</button>
              <button onClick={saveTabOrder} className="flex-1 py-4 bg-blue-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-lg">Salvar Ordem</button>
            </div>
          </div>
        </div>
      )}

      {settleConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-3xl overflow-hidden p-8 text-center animate-in zoom-in-95 duration-200"><div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${settleConfirm.type === 'PAGAMENTO' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}><CheckSquare className="w-10 h-10" /></div><h3 className="text-xl font-black text-slate-800 mb-2">{settleConfirm.type === 'PAGAMENTO' ? 'Confirmar Pagamento?' : 'Confirmar Recebimento?'}</h3><p className="text-sm text-slate-500 mb-8 leading-relaxed">Deseja marcar {settleConfirm.txIds.length} lançamento(s) de <strong>{settleConfirm.customerName}</strong> como concluído(s)?</p><div className="flex gap-3"><button onClick={() => setSettleConfirm(null)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest rounded-2xl">Cancelar</button><button onClick={executeSettle} disabled={isSaving} className={`flex-1 py-4 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg flex items-center justify-center gap-2 ${settleConfirm.type === 'PAGAMENTO' ? 'bg-red-600' : 'bg-green-600'}`}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirmar</button></div></div>
        </div>
      )}

      {/* MODAL DE PAGAMENTO PARCIAL */}
      {partialPayModal.isOpen && partialPayModal.tx && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-3xl overflow-hidden p-8 animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800 uppercase">Abater Valor</h3>
                <button onClick={() => setPartialPayModal({isOpen: false, tx: null})}><X className="text-slate-400" /></button>
             </div>
             
             <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Item Original</p>
                <div className="flex justify-between items-center">
                   <span className="font-bold text-slate-700 uppercase text-xs">{partialPayModal.tx.item}</span>
                   <span className="font-black text-slate-800 text-sm">{formatCurrency(partialPayModal.tx.value)}</span>
                </div>
             </div>

             <div className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-indigo-500 ml-2">Quanto será pago?</label>
                   <input 
                     autoFocus
                     type="text" 
                     inputMode="decimal"
                     value={partialAmount}
                     onChange={e => setPartialAmount(e.target.value)}
                     placeholder="0,00"
                     className="w-full p-5 bg-indigo-50 border-2 border-indigo-100 rounded-2xl font-black text-2xl text-center outline-none focus:border-indigo-500 text-indigo-900"
                   />
                </div>
                <button 
                  onClick={submitPartialPay} 
                  disabled={isSaving} 
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />} 
                   Confirmar Baixa
                </button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {editingTx && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-3xl overflow-hidden p-8 animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800 uppercase">Editar Item</h3>
                <button onClick={() => setEditingTx(null)}><X className="text-slate-400" /></button>
             </div>
             
             <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Editando</p>
                <p className="font-bold text-slate-700 uppercase text-xs">{editingTx.item}</p>
             </div>

             <div className="space-y-4">
                <div className="flex gap-4">
                   <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-black uppercase text-blue-500 ml-2">Qtd</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={editForm.quantity}
                        onChange={e => setEditForm({...editForm, quantity: e.target.value})}
                        className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl font-black text-lg text-center outline-none focus:border-blue-500 text-blue-900"
                      />
                   </div>
                   <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-black uppercase text-blue-500 ml-2">Total (R$)</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={editForm.value}
                        onChange={e => setEditForm({...editForm, value: e.target.value})}
                        className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl font-black text-lg text-center outline-none focus:border-blue-500 text-blue-900"
                      />
                   </div>
                </div>
                
                <button 
                  onClick={saveEdit} 
                  disabled={isSaving} 
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                   Salvar Alteração
                </button>
             </div>
          </div>
        </div>
      )}

      {showNoteModal && (
        <NoteComposer 
          onClose={() => setShowNoteModal(false)}
          onSend={handleSendNote}
          userName={user.name}
        />
      )}

      {batchTotal > 0 && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 p-1 bg-slate-900/90 backdrop-blur-xl rounded-full shadow-2xl z-[100] animate-in slide-in-from-bottom-5">
          <button onClick={confirmBatch} disabled={isSaving} className={`px-8 py-4 rounded-full font-black text-[10px] uppercase tracking-widest text-white flex items-center justify-center gap-3 transition-all active:scale-95 ${activeTab === 'GASTOS' ? (globalMethod === 'A_PRAZO' ? 'bg-red-600' : 'bg-slate-700') : (globalMethod === 'A_VISTA' ? 'bg-orange-600' : 'bg-blue-600')} disabled:opacity-50`}>{isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : (globalMethod === 'A_PRAZO' ? <Clock className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />)}{hideMoney ? 'REGISTRAR LANÇAMENTO' : `CONFIRMAR ${formatCurrency(batchTotal)}`}</button>
        </div>
      )}
    </div>
  );
};