import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SubTabStall, Transaction, AppSection, User, PeriodTotals, LocalStock, EntryState, ExpenseCalc } from '../types';
import { useNotes } from '../hooks/useNotes';
import { NoteComposer } from './NotesModals';
import { StatsCard } from './StatsCard';
import { 
  Loader2, Check, DollarSign, MoreVertical, X, Save, 
  Calculator, Edit3, Trash2, Plus, EyeOff, Clock, Truck, ArrowRightLeft, 
  ChevronUp, ChevronDown, Package, MessageSquarePlus 
} from 'lucide-react';

interface StallProps {
  section: AppSection;
  user: User;
  transactions: Transaction[];
  addTransactions: (ts: Omit<Transaction, 'id' | 'date'>[]) => Promise<Transaction[] | null>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  calculateTotals: (category: string, subCategory?: string) => PeriodTotals;
  saveConfig: (sections: AppSection[]) => Promise<void>;
  sections: AppSection[];
}

const DEFAULT_STALL_TABS: SubTabStall[] = ['VENDAS', 'GASTOS'];

export const Stall: React.FC<StallProps> = ({ 
  section, user, transactions, addTransactions, updateTransaction, calculateTotals, saveConfig, sections
}) => {
  const { addNote } = useNotes(user.workspaceId);
  const [tabOrder, setTabOrder] = useState<SubTabStall[]>(() => {
    try {
      const saved = localStorage.getItem(`stall_tabs_${section.id}`);
      return saved ? JSON.parse(saved) : DEFAULT_STALL_TABS;
    } catch {
      return DEFAULT_STALL_TABS;
    }
  });
  const [activeTab, setActiveTab] = useState<SubTabStall>(tabOrder[0]);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [tempTabOrder, setTempTabOrder] = useState<SubTabStall[]>(tabOrder);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [localStock, setLocalStock] = useState<Record<string, LocalStock>>({});
  const [expenseEntries, setExpenseEntries] = useState<Record<string, EntryState>>({});
  const [expenseCalcs, setExpenseCalcs] = useState<Record<string, ExpenseCalc>>({});
  const [expenseMethod, setExpenseMethod] = useState<'A_VISTA' | 'A_PRAZO'>('A_VISTA');
  const [supplierName, setSupplierName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCalc, setExpandedCalc] = useState<string | null>(null);
  const [editingDefaultQty, setEditingDefaultQty] = useState<{itemId: string, name: string, currentDefault: string} | null>(null);

  const hideMoney = user.hideSalesValues && user.role !== 'OWNER';
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const KACHING_URL = 'https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3';

  const playCashSound = () => {
    if (user.enableSounds) {
      const audio = new Audio(KACHING_URL);
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

  const initializeStockFromDefaults = useCallback((forceReset = false) => {
    setLocalStock(prev => {
      // Se for reset forçado, descarta o estado anterior
      const next = forceReset ? {} : { ...prev };
      
      section.items.forEach(item => {
        // Verifica se existe um padrão válido (> 0)
        const hasValidDefault = item.defaultQty && item.defaultQty > 0;
        const defaultStr = hasValidDefault ? item.defaultQty!.toString() : '';

        // Se o item ainda não existe no estado ou se é um reset forçado
        if (!next[item.name] || forceReset) {
          next[item.name] = { 
            initialStock: defaultStr, 
            leftoverStock: forceReset ? '' : (next[item.name]?.leftoverStock || '') 
          };
        }
      });
      return next;
    });
  }, [section.items]);

  useEffect(() => {
    if (activeTab === 'VENDAS') {
      initializeStockFromDefaults();
    }
  }, [activeTab, initializeStockFromDefaults]);

  const handleLocalStockChange = (itemName: string, field: keyof LocalStock, val: string) => {
    setLocalStock(prev => {
      const currentItem = prev[itemName] || { initialStock: '', leftoverStock: '' };
      return { ...prev, [itemName]: { ...currentItem, [field]: val } };
    });
  };

  const handleSaveDefaultQty = async () => {
    if (!editingDefaultQty) return;
    setIsSaving(true);
    try {
      const newQty = parseFloat(editingDefaultQty.currentDefault.replace(',', '.')) || 0;
      const updatedSections = sections.map(s => {
        if (s.id !== section.id) return s;
        return {
          ...s,
          items: s.items.map(item => 
            item.id === editingDefaultQty.itemId ? { ...item, defaultQty: newQty } : item
          )
        };
      });
      await saveConfig(updatedSections);
      
      // Atualiza o estado local imediatamente
      setLocalStock(prev => ({
        ...prev,
        [editingDefaultQty.name]: {
          ...(prev[editingDefaultQty.name] || { leftoverStock: '' }),
          initialStock: newQty > 0 ? newQty.toString() : ''
        }
      }));

      setEditingDefaultQty(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const saveAllStock = async () => {
    const transactionsToCreate = section.items
      .map(item => {
        const local = localStock[item.name] || { initialStock: '', leftoverStock: '' };
        
        // Permite salvar se tiver pelo menos o Initial Stock para itens sem default
        // Ou se tiver Leftover Stock para itens com default
        if (local.initialStock === '') return null;

        const initial = parseFloat(String(local.initialStock).replace(',', '.')) || 0;
        const leftover = parseFloat(String(local.leftoverStock).replace(',', '.')) || 0;
        
        const sold = Math.max(0, initial - leftover);
        const price = item.defaultPrice || 0;
        
        // Evita salvar se nada aconteceu (tudo zero)
        if (sold === 0 && initial === 0 && leftover === 0) return null;

        return {
          workspaceId: user.workspaceId,
          category: section.id,
          subCategory: 'VENDAS',
          item: item.name,
          value: sold * price,
          quantity: sold,
          initialStock: initial,
          leftoverStock: leftover,
          unitPrice: price,
          createdBy: user.name,
          paymentMethod: 'A_VISTA',
          isPending: false
        };
      })
      .filter(t => t !== null) as Omit<Transaction, 'id' | 'date'>[];

    if (transactionsToCreate.length === 0) return;
    setIsSaving(true);
    try {
      await addTransactions(transactionsToCreate);
      let updatedSections = [...sections];
      let stockChanged = false;
      const linkedSectionId = section.linkedSectionId;
      const linkedSectionIndex = linkedSectionId ? updatedSections.findIndex(s => s.id === linkedSectionId) : -1;
      const globalStockIndex = updatedSections.findIndex(s => s.type === 'STOCK_STYLE' && s.globalStockMode === 'GLOBAL');

      transactionsToCreate.forEach(t => {
        const qtySold = t.quantity || 0;
        let deducted = false;
        if (globalStockIndex > -1) {
            const stockItemIndex = updatedSections[globalStockIndex].items.findIndex(i => i.name === t.item);
            if (stockItemIndex > -1) {
              const current = updatedSections[globalStockIndex].items[stockItemIndex].currentStock || 0;
              updatedSections[globalStockIndex].items[stockItemIndex].currentStock = Math.max(0, current - qtySold);
              deducted = true;
              stockChanged = true;
            }
        } 
        if (!deducted && linkedSectionIndex > -1) {
          const stockItemIndex = updatedSections[linkedSectionIndex].items.findIndex(i => i.name === t.item);
          if (stockItemIndex > -1) {
            const current = updatedSections[linkedSectionIndex].items[stockItemIndex].currentStock || 0;
            updatedSections[linkedSectionIndex].items[stockItemIndex].currentStock = Math.max(0, current - qtySold);
            stockChanged = true;
          }
        }
      });

      if (stockChanged) {
        await saveConfig(updatedSections);
      }
      
      playCashSound();
      initializeStockFromDefaults(true);
      alert("Caixa fechado com sucesso! Vendas registradas.");
    } catch (e) {
      console.error(e);
      alert("Erro ao fechar caixa.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExpenseEntryChange = (item: string, field: keyof EntryState, value: string) => {
    setExpenseEntries(prev => {
      const current = prev[item] || { quantity: '', value: '' };
      return { ...prev, [item]: { ...current, [field]: value } };
    });
  };

  const handleExpenseCalcChange = (itemName: string, field: keyof ExpenseCalc, val: string) => {
    setExpenseCalcs(prev => {
      const current = prev[itemName] || { qty: '', unit: '' };
      const next = { ...current, [field]: val };
      const q = parseFloat(next.qty.replace(',', '.')) || 0;
      const u = parseFloat(next.unit.replace(',', '.')) || 0;
      if (q > 0 && u > 0) {
        setExpenseEntries(ePrev => ({ ...ePrev, [itemName]: { quantity: q.toString(), value: (q * u).toFixed(2) } }));
      }
      return { ...prev, [itemName]: next };
    });
  };

  const confirmExpenses = async () => {
    const valid = (Object.entries(expenseEntries) as [string, EntryState][])
      .filter(([_, e]) => parseFloat(e.value) > 0)
      .map(([item, e]) => ({
        workspaceId: user.workspaceId,
        category: section.id,
        subCategory: 'GASTOS',
        item,
        value: parseFloat(e.value.replace(',', '.')) || 0,
        quantity: parseFloat(e.quantity.replace(',', '.')) || undefined,
        paymentMethod: expenseMethod,
        customerName: expenseMethod === 'A_PRAZO' ? supplierName : undefined,
        isPending: expenseMethod === 'A_PRAZO',
        createdBy: user.name,
      }));

    if (valid.length === 0) return;
    if (expenseMethod === 'A_PRAZO' && !supplierName.trim()) {
      alert("Informe o nome do fornecedor.");
      return;
    }

    setIsSaving(true);
    try {
      await addTransactions(valid);
      setExpenseEntries({});
      setExpenseCalcs({});
      setSupplierName('');
      setExpenseMethod('A_VISTA');
    } catch (e) {
      console.error("Erro ao salvar gastos:", e);
    } finally {
      setIsSaving(false);
    }
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
    localStorage.setItem(`stall_tabs_${section.id}`, JSON.stringify(tempTabOrder));
    setIsReorderModalOpen(false);
  };

  // Cálculo do total atual da venda (para exibir no botão)
  const currentTotal = useMemo(() => {
    return section.items.reduce((acc, item) => {
      const stock = localStock[item.name];
      if (!stock) return acc;

      const initial = parseFloat(stock.initialStock.replace(',', '.')) || 0;
      const leftover = parseFloat(stock.leftoverStock.replace(',', '.')) || 0;
      
      const sold = Math.max(0, initial - leftover);
      return acc + (sold * (item.defaultPrice || 0));
    }, 0);
  }, [section.items, localStock]);

  // Lógica rigorosa para o botão Confirmar
  const canShowConfirmButton = useMemo(() => {
    return section.items.some(item => {
      const stock = localStock[item.name];
      if (!stock) return false;

      // 1. Um item só é considerado "Padrão" se tiver quantidade definida MAIOR que 0.
      const hasDefault = (item.defaultQty || 0) > 0;
      
      const initialFilled = String(stock.initialStock).trim().length > 0;
      const leftoverFilled = String(stock.leftoverStock).trim().length > 0;

      if (hasDefault) {
        // Se tem fixo (Padrão), só libera se preencher o "Sobrou"
        return leftoverFilled;
      } else {
        // Se não tem fixo, libera assim que preencher o "Levei"
        return initialFilled;
      }
    });
  }, [section.items, localStock]);

  return (
    <div className="space-y-6 pb-40 animate-in fade-in duration-500">
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
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              activeTab === tab ? 'bg-white shadow-md text-indigo-600' : 'text-slate-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {!hideMoney && <StatsCard 
        title={activeTab === 'VENDAS' ? 'Vendas Barraca' : 'Gastos Barraca'} 
        totals={calculateTotals(section.id, activeTab)} 
        type={activeTab === 'VENDAS' ? 'income' : 'expense'} 
      />}

      {activeTab === 'VENDAS' && (
        <div className="space-y-4">
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
            {section.items.map(item => {
              const stock = localStock[item.name] || { initialStock: '', leftoverStock: '' };
              const initial = parseFloat(stock.initialStock.replace(',', '.')) || 0;
              const leftover = parseFloat(stock.leftoverStock.replace(',', '.')) || 0;
              const sold = Math.max(0, initial - leftover);
              const total = sold * (item.defaultPrice || 0);

              return (
                <div key={item.id} className="p-6 border-b border-slate-50 last:border-0">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-800 text-lg block leading-tight">{item.name}</span>
                      <button 
                        onClick={() => setEditingDefaultQty({ itemId: item.id, name: item.name, currentDefault: (item.defaultQty || 0).toString() })}
                        className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-indigo-50 hover:text-indigo-500 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                    {!hideMoney && <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Unit: {formatCurrency(item.defaultPrice || 0)}</span>}
                  </div>

                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                       <label className="block text-[8px] font-black uppercase text-indigo-400 mb-1 ml-2">Levei (Início)</label>
                       <input 
                         type="text" 
                         inputMode="decimal" 
                         value={stock.initialStock} 
                         onChange={e => handleLocalStockChange(item.name, 'initialStock', e.target.value)}
                         className="w-full p-4 bg-indigo-50 border border-indigo-100 rounded-2xl font-black text-lg text-indigo-900 outline-none focus:border-indigo-500 text-center" 
                         placeholder="0"
                       />
                    </div>
                    <div className="flex-1">
                       <label className="block text-[8px] font-black uppercase text-rose-400 mb-1 ml-2">Sobrou (Fim)</label>
                       <input 
                         type="text" 
                         inputMode="decimal" 
                         value={stock.leftoverStock} 
                         onChange={e => handleLocalStockChange(item.name, 'leftoverStock', e.target.value)}
                         className="w-full p-4 bg-rose-50 border border-rose-100 rounded-2xl font-black text-lg text-rose-900 outline-none focus:border-rose-500 text-center" 
                         placeholder="0"
                       />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                     <span className="text-[9px] font-black text-slate-400 uppercase">Vendido: <strong className="text-slate-800 text-sm">{sold}</strong></span>
                     {!hideMoney && <span className="text-sm font-black text-emerald-600">{formatCurrency(total)}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {canShowConfirmButton && (
            <div className="fixed bottom-28 left-1/2 -translate-x-1/2 p-1 bg-slate-900/90 backdrop-blur-xl rounded-full shadow-2xl z-[100] animate-in slide-in-from-bottom-5">
              <button onClick={saveAllStock} disabled={isSaving} className="px-8 py-4 rounded-full font-black text-[10px] uppercase tracking-widest text-white flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-4 h-4" />} 
                {hideMoney ? 'FECHAR CAIXA' : `FECHAR CAIXA ${currentTotal > 0 ? formatCurrency(currentTotal) : ''}`}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'GASTOS' && (
        <div className="space-y-4">
           <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 flex gap-2">
            <button onClick={() => setExpenseMethod('A_VISTA')} className={`flex-1 py-4 rounded-[1.6rem] flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${expenseMethod === 'A_VISTA' ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}><DollarSign className="w-4 h-4" /> À Vista</button>
            <button onClick={() => setExpenseMethod('A_PRAZO')} className={`flex-1 py-4 rounded-[1.6rem] flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${expenseMethod === 'A_PRAZO' ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}><Clock className="w-4 h-4" /> À Prazo</button>
          </div>

          {expenseMethod === 'A_PRAZO' && (
            <div className="relative animate-in zoom-in-95 z-30">
               <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-red-300" />
               <input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="NOME DO FORNECEDOR" className="w-full p-5 pl-12 bg-red-50 border-2 border-red-100 rounded-[1.8rem] font-black text-xs uppercase text-red-900 outline-none focus:border-red-500 placeholder:text-red-200" />
            </div>
          )}

          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
             {section.expenses.map(item => {
               const entry = expenseEntries[item.name] || { quantity: '', value: '' };
               const calc = expenseCalcs[item.name] || { qty: '', unit: '' };
               const isCalcOpen = expandedCalc === item.name;

               return (
                 <div key={item.id} className="p-6 border-b border-slate-50 last:border-0">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-black text-slate-800 text-lg">{item.name}</span>
                      <button onClick={() => setExpandedCalc(isCalcOpen ? null : item.name)} className={`p-2 rounded-xl transition-all ${isCalcOpen ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}><Calculator className="w-4 h-4" /></button>
                    </div>
                    {isCalcOpen && (
                       <div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-indigo-50/50 rounded-2xl animate-in slide-in-from-top-1">
                          <div className="space-y-1"><label className="text-[8px] font-black text-indigo-400 uppercase ml-2">Qtd</label><input type="text" inputMode="decimal" value={calc.qty} onChange={e => handleExpenseCalcChange(item.name, 'qty', e.target.value)} placeholder="0" className="w-full p-3 bg-white border border-indigo-100 rounded-xl font-black text-center text-xs outline-none" /></div>
                          <div className="space-y-1"><label className="text-[8px] font-black text-indigo-400 uppercase ml-2">Unit.</label><input type="text" inputMode="decimal" value={calc.unit} onChange={e => handleExpenseCalcChange(item.name, 'unit', e.target.value)} placeholder="0,00" className="w-full p-3 bg-white border border-indigo-100 rounded-xl font-black text-center text-xs outline-none" /></div>
                       </div>
                    )}
                    <div className="flex gap-4">
                      <div className="flex-1"><label className="block text-[8px] font-black uppercase text-slate-400 mb-1 ml-4">Valor Total (R$)</label><input type="text" inputMode="decimal" value={entry.value} onChange={e => handleExpenseEntryChange(item.name, 'value', e.target.value)} placeholder="0,00" className="w-full p-4 bg-slate-200 rounded-2xl font-black text-lg outline-none focus:bg-white focus:border-2 focus:border-red-500 transition-all text-slate-800" /></div>
                    </div>
                 </div>
               );
             })}
          </div>

          <div className="fixed bottom-28 left-1/2 -translate-x-1/2 p-1 bg-slate-900/90 backdrop-blur-xl rounded-full shadow-2xl z-[100] animate-in slide-in-from-bottom-5">
            <button onClick={confirmExpenses} disabled={isSaving} className="px-8 py-4 rounded-full font-black text-[10px] uppercase tracking-widest text-white flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 transition-all active:scale-95 disabled:opacity-50">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4" />} REGISTRAR GASTOS
            </button>
          </div>
        </div>
      )}

      {editingDefaultQty && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl">
             <h3 className="text-xl font-black text-slate-800 uppercase mb-2">Ajuste Padrão</h3>
             <p className="text-sm text-slate-500 mb-6">Defina a quantidade que você costuma levar de <strong>{editingDefaultQty.name}</strong>.</p>
             <input autoFocus type="number" value={editingDefaultQty.currentDefault} onChange={e => setEditingDefaultQty({...editingDefaultQty, currentDefault: e.target.value})} className="w-full p-4 bg-slate-100 rounded-2xl font-black text-center text-2xl outline-none mb-6 border-2 border-indigo-500" />
             <div className="flex gap-3">
               <button onClick={() => setEditingDefaultQty(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
               <button onClick={handleSaveDefaultQty} disabled={isSaving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">{isSaving ? <Loader2 className="animate-spin" /> : 'Salvar'}</button>
             </div>
          </div>
        </div>
      )}

      {isReorderModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3"><ArrowRightLeft className="text-blue-600" /> Reordenar Abas</h3>
            <div className="space-y-3 mb-8">
              {tempTabOrder.map((tab, idx) => (
                <div key={tab} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-600">{tab}</span>
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

      {showNoteModal && (
        <NoteComposer 
          onClose={() => setShowNoteModal(false)}
          onSend={handleSendNote}
          userName={user.name}
        />
      )}
    </div>
  );
};
