
import React, { useState, useMemo, useEffect } from 'react';
import { AppSection, User, Transaction, PeriodTotals, Customer, ConfigItem } from '../types';
import { printer } from '../lib/printer';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Package, DollarSign, Clock, Users, Save, 
  Loader2, CheckCircle2, AlertCircle, TrendingDown,
  ChevronRight, Search, Wallet, Check, X, Calendar, Receipt,
  MoreVertical, Scissors, Edit3, Trash2, Square, CheckSquare,
  AlertTriangle, FileText, Printer, Calculator, Truck, Image as ImageIcon,
  ArrowUpCircle, ArrowDownCircle, ExternalLink, RefreshCw, Link as LinkIcon, Link2Off, Lock,
  Phone, Bluetooth, MessageCircle, Share2, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { shareReceipt } from '../lib/share';
import { safeStringifyError } from '../lib/supabase';
import { normalizeString, formatCurrency } from '../lib/utils';
import { ProductInsights } from './ProductInsights';

import { registerStockMovement } from '../lib/supabase';

interface FactoryProps {
  section: AppSection;
  user: User;
  transactions: Transaction[];
  addTransactions: (ts: Omit<Transaction, 'id' | 'date'>[]) => Promise<any>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  settleCustomerDebt: (name: string, ids: string[]) => Promise<void>;
  partialSettleTransaction: (t: Transaction, amount: number) => Promise<boolean>;
  calculateTotals: (cat: string, sub?: string) => PeriodTotals;
  saveConfig: (s: AppSection[]) => Promise<boolean>;
  updateSingleSection?: (s: AppSection) => Promise<boolean>;
  updateStockAtomic: (sectionId: string, itemUpdates: { id: string, quantity: number }[]) => Promise<boolean>;
  sections: AppSection[];
  deleteTransaction?: (id: string) => Promise<void>;
  customers: Customer[];
  addCustomer?: (name: string, phone?: string, type?: 'CLIENT' | 'SUPPLIER') => Promise<Customer | null>;
  onRefreshData?: () => Promise<void>;
  addNote?: (note: any) => Promise<boolean>;
}

export const Factory: React.FC<FactoryProps> = ({ 
  section, user, addTransactions, 
  transactions, settleCustomerDebt, updateTransaction, partialSettleTransaction, deleteTransaction,
  customers, addCustomer, saveConfig, updateSingleSection, updateStockAtomic, sections, onRefreshData, addNote
}) => {
  const [activeTab, setActiveTab] = useState<'VENDAS' | 'GASTOS' | 'A_RECEBER' | 'PRODUTOS'>('VENDAS');
  const [billsTab, setBillsTab] = useState<'RECEIVABLES' | 'PAYABLES'>('RECEIVABLES');
  const [globalMethod, setGlobalMethod] = useState<'A_VISTA' | 'A_PRAZO'>('A_VISTA');
  const [customerName, setCustomerName] = useState('');
  const [isUnregistered, setIsUnregistered] = useState(false);
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [batchQuantities, setBatchQuantities] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  
  const [expenseMethod, setExpenseMethod] = useState<'A_VISTA' | 'A_PRAZO'>('A_VISTA');
  const [supplierName, setSupplierName] = useState('');
  const [expenseEntries, setExpenseEntries] = useState<Record<string, string>>({});
  const [expenseCalcs, setExpenseCalcs] = useState<Record<string, {qty: string, unit: string}>>({});
  const [expandedCalc, setExpandedCalc] = useState<string | null>(null);
  
  const [viewingCustomer, setViewingCustomer] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  
  const [partialPayId, setPartialPayId] = useState<string | null>(null);
  const [partialGroupSettleInfo, setPartialGroupSettleInfo] = useState<{ items: Transaction[], total: number } | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [showCustomerHistory, setShowCustomerHistory] = useState<Customer | null>(null);
  const [successModal, setSuccessModal] = useState<{ show: boolean, total: number, items: any[], customer?: string } | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ item: '', value: '' });

  const [validationError, setValidationError] = useState<{ 
    title: string, 
    message: string, 
    type: 'MISSING_ID' | 'NEW_CUSTOMER_NO_PHONE' | 'GENERIC' | 'NEGATIVE_STOCK'
  } | null>(null);

  const [confirmAction, setConfirmAction] = useState<{ 
    type: 'SETTLE_ALL' | 'SETTLE_SELECTED' | 'DELETE' | 'SETTLE_NOTE', 
    id?: string,
    ids?: string[]
  } | null>(null);

  const hideMoney = user.hideSalesValues;

  const handleQtyChange = (itemId: string, val: string) => {
    setBatchQuantities(prev => ({ ...prev, [itemId]: val }));
  };

  const handleExpenseEntryChange = (name: string, field: 'value', val: string) => {
    setExpenseEntries(prev => ({ ...prev, [name]: val }));
  };

  const handleExpenseCalcChange = (itemName: string, field: 'qty' | 'unit', val: string) => {
     const newCalcs = { ...expenseCalcs, [itemName]: { ...expenseCalcs[itemName], [field]: val } };
     setExpenseCalcs(newCalcs);
     
     const q = parseFloat(newCalcs[itemName]?.qty?.replace(',', '.') || '0');
     const u = parseFloat(newCalcs[itemName]?.unit?.replace(',', '.') || '0');
     if (q > 0 && u > 0) {
        setExpenseEntries(prev => ({ ...prev, [itemName]: (q * u).toFixed(2).replace('.', ',') }));
     }
  };

  const handleToggleCalc = (item: ConfigItem) => {
    if (expandedCalc === item.name) {
      setExpandedCalc(null);
    } else {
      setExpandedCalc(item.name);
      const currentCalc = expenseCalcs[item.name];
      if (!currentCalc?.unit) {
         const defPrice = item.defaultPriceAVista || item.defaultPrice || 0;
         if (defPrice > 0) {
            setExpenseCalcs(prev => ({
               ...prev,
               [item.name]: { qty: currentCalc?.qty || '', unit: defPrice.toFixed(2).replace('.', ',') }
            }));
         }
      }
    }
  };

  const filteredItems = useMemo(() => {
    return (section.items || []).filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [section.items, searchTerm]);

  const filteredExpenses = useMemo(() => {
    return (section.expenses || []).filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [section.expenses, searchTerm]);

  const customerSuggestions = useMemo(() => {
    if (!customerName || customerName.length < 1) return [];
    const term = normalizeString(customerName);
    return customers
      .filter(c => (c.type === 'CLIENT' || !c.type) && normalizeString(c.name).includes(term))
      .slice(0, 5);
  }, [customers, customerName]);

  const matchedCustomer = useMemo(() => {
    if (!customerName) return null;
    return customers.find(c => normalizeString(c.name) === normalizeString(customerName));
  }, [customers, customerName]);

  const supplierSuggestions = useMemo(() => {
    if (!supplierName || supplierName.length < 1) return [];
    const term = normalizeString(supplierName);
    return customers
      .filter(c => c.type === 'SUPPLIER' && normalizeString(c.name).includes(term))
      .slice(0, 5);
  }, [customers, supplierName]);

  const pendingTransactions = useMemo(() => {
    const targetWorkspaceId = String(section.workspaceId || '').trim().toLowerCase();
    return transactions.filter(t => {
      const tWid = String(t.workspaceId || '').trim().toLowerCase();
      const isMyWorkspace = tWid === targetWorkspaceId;
      const isExternalDebt = t.isExternal === true;
      const isNotePending = !!t.isPending;
      return isNotePending && (isMyWorkspace || isExternalDebt);
    });
  }, [transactions, section.workspaceId]);

  const pendingByCustomer = useMemo(() => {
    const groups: Record<string, { total: number, ids: string[], count: number, items: Transaction[], type: 'RECEIVABLE' | 'PAYABLE', isExternal?: boolean, displayName: string }> = {};
    
    pendingTransactions.forEach(t => {
      const isExpense = String(t.subCategory).toUpperCase() === 'GASTOS';
      const isExt = t.isExternal === true;
      
      let groupKey = '';
      let displayName = '';
      let type: 'RECEIVABLE' | 'PAYABLE' = 'RECEIVABLE';

      if (isExt) {
         if (isExpense) {
            type = 'RECEIVABLE';
            const debtorName = t.createdBy ? t.createdBy.trim() : 'Empresa Parceira';
            groupKey = `REC_EXT_${debtorName.toLowerCase()}_${t.workspaceId}`; 
            displayName = `${debtorName}`;
         } else {
            type = 'PAYABLE';
            const creditorName = t.createdBy ? t.createdBy.trim() : 'Empresa Parceira';
            groupKey = `PAY_EXT_${creditorName.toLowerCase()}_${t.workspaceId}`; 
            displayName = `${creditorName}`;
         }
      } else if (isExpense) {
         type = 'PAYABLE';
         const supplier = t.customerName ? t.customerName.trim() : 'Fornecedor Geral';
         groupKey = `PAY_INT_${supplier.toLowerCase()}`;
         displayName = supplier;
      } else {
         type = 'RECEIVABLE';
         const client = t.customerName ? t.customerName.trim() : 'Cliente Balcão';
         groupKey = `REC_${client.toLowerCase()}`;
         displayName = client;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { 
          total: 0, 
          ids: [], 
          count: 0, 
          items: [], 
          type,
          isExternal: isExt,
          displayName
        };
      }
      
      groups[groupKey].total += t.value;
      groups[groupKey].ids.push(String(t.id));
      groups[groupKey].count += 1;
      groups[groupKey].items.push(t);
    });
    return groups;
  }, [pendingTransactions]);

  const receivablesCount = useMemo(() => Object.values(pendingByCustomer).filter((d: any) => d.type === 'RECEIVABLE').length, [pendingByCustomer]);
  const payablesCount = useMemo(() => Object.values(pendingByCustomer).filter((d: any) => d.type === 'PAYABLE').length, [pendingByCustomer]);

  const filteredPendingList = useMemo(() => {
    return Object.entries(pendingByCustomer).filter(([_, data]) => {
      const d = data as any;
      if (billsTab === 'RECEIVABLES') {
        return d.type === 'RECEIVABLE';
      } else {
        return d.type === 'PAYABLE';
      }
    });
  }, [pendingByCustomer, billsTab]);

  useEffect(() => {
    if (!viewingCustomer) {
      setSelectedIds(new Set());
      setMenuOpenId(null);
      setMainMenuOpen(false);
      setPartialPayId(null);
      setPartialGroupSettleInfo(null);
      setEditingId(null);
      setConfirmAction(null);
    }
  }, [viewingCustomer]);

  const handleManualRefresh = async () => {
    if (onRefreshData) {
      setIsRefreshing(true);
      await onRefreshData();
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  const getEffectiveConfigPrice = (item: ConfigItem, method: 'A_VISTA' | 'A_PRAZO') => {
    const isPromoActive = item.promoEndsAt ? new Date(item.promoEndsAt).getTime() > Date.now() : true;
    if (method === 'A_VISTA') {
      if (item.promotionalPriceAVista && isPromoActive) return item.promotionalPriceAVista;
      return item.defaultPriceAVista || item.defaultPrice || 0;
    } else {
      if (item.promotionalPriceAPrazo && isPromoActive) return item.promotionalPriceAPrazo;
      return item.defaultPriceAPrazo || item.defaultPrice || 0;
    }
  };

  const productionTotal = useMemo(() => {
    return section.items.reduce((acc, item) => {
      const qtyStr = batchQuantities[item.id] || '0';
      const qty = parseFloat(qtyStr.replace(',', '.')) || 0;
      const price = getEffectiveConfigPrice(item, globalMethod);
      return acc + (qty * price);
    }, 0);
  }, [batchQuantities, section.items, globalMethod]);

  const expensesTotal = useMemo(() => {
     return Object.values(expenseEntries).reduce((acc: number, val: any) => acc + (parseFloat(String(val).replace(',', '.')) || 0), 0);
  }, [expenseEntries]);

  const confirmProduction = async (forceNegativeStock: boolean = false, forceUnregistered: boolean = false) => {
    if (productionTotal <= 0) return;
    const cleanCustomerName = customerName.trim();
    const effectiveIsUnregistered = isUnregistered || forceUnregistered;

    // VALIDAÇÃO RIGOROSA DE IDENTIFICAÇÃO
    if (globalMethod === 'A_PRAZO' && effectiveIsUnregistered) {
      setIsUnregistered(false);
      setValidationError({
        title: "Venda a Prazo Requer Cliente",
        message: "Não é permitida a venda a prazo para clientes avulsos. Você precisa identificar o cliente para registrar essa dívida perfeitamente.",
        type: 'MISSING_ID'
      });
      return;
    }

    if (!effectiveIsUnregistered) {
      // Se NÃO for venda avulsa, a identificação é obrigatória
      if (!cleanCustomerName) {
        setValidationError({
          title: "Identificação Necessária",
          message: "Como deseja registrar esta venda? Você pode identificar o cliente para manter o histórico ou seguir com uma venda avulsa.",
          type: 'MISSING_ID'
        });
        return;
      }

      // Se houver nome mas não existir no banco, exige telefone para cadastro ou modo avulso
      const found = customers.find(c => normalizeString(c.name) === normalizeString(cleanCustomerName));
      if (!found && !newCustomerPhone) {
        setValidationError({
          title: "Cliente não Cadastrado",
          message: `O cliente "${cleanCustomerName}" não foi encontrado. Deseja informar o telefone para cadastro rápido ou registrar como venda avulsa?`,
          type: 'NEW_CUSTOMER_NO_PHONE'
        });
        return;
      }
    }

    // AVISO DE ESTOQUE NEGATIVO
    if (!forceNegativeStock) {
      const negativeItems: string[] = [];
      Object.entries(batchQuantities).forEach(([itemId, qtyStr]) => {
        const qty = parseFloat(String(qtyStr).replace(',', '.'));
        if (qty > 0) {
          const item = section.items.find(i => i.id === itemId);
          if (item) {
            const normalize = (s: string) => s.trim().toLowerCase();
            const targetName = normalize(item.name);
            const isStrictlyLocal = sections.some(s => s.type === 'STOCK_STYLE' && s.globalStockMode === 'LOCAL');
            
            let stockSection: AppSection | undefined;

            // PRIORIDADE 1: Busca vínculo LOCAL
            stockSection = sections.find(s => 
              s.type === 'STOCK_STYLE' && 
              s.globalStockMode === 'LOCAL' && 
              s.linkedSectionId === section.id && 
              s.items.some(i => normalize(i.name) === targetName)
            );

            // PRIORIDADE 2: Fallback para GLOBAL apenas se não houver modo estritamente local ativo
            if (!stockSection && !isStrictlyLocal) {
                stockSection = sections.find(s => 
                  s.type === 'STOCK_STYLE' && 
                  s.globalStockMode === 'GLOBAL' && 
                  s.items.some(i => normalize(i.name) === targetName)
                );
            }

            if (stockSection) {
                const stockItem = stockSection.items.find(i => normalize(i.name) === targetName);
                if (stockItem && (stockItem.currentStock || 0) < qty) {
                    negativeItems.push(item.name);
                }
            }
          }
        }
      });

      if (negativeItems.length > 0) {
        setValidationError({
          title: "Estoque Insuficiente",
          message: `A venda vai negativar o estoque de: ${negativeItems.join(', ')}. Deseja vender mesmo assim?`,
          type: 'NEGATIVE_STOCK'
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      let selectedCustomerPhone: string | undefined = undefined;
      let finalCustomerName = cleanCustomerName || undefined;

      // Se não for venda avulsa e houver um nome, tentamos vincular ou cadastrar
      if (!effectiveIsUnregistered && cleanCustomerName) {
        let foundCustomer = customers.find(c => normalizeString(c.name) === normalizeString(cleanCustomerName));
        
        // Se não encontrou e tem telefone preenchido para cadastro rápido
        if (!foundCustomer && newCustomerPhone && addCustomer) {
          setIsRegistering(true);
          const newC = await addCustomer(cleanCustomerName, newCustomerPhone, 'CLIENT');
          if (newC) {
            foundCustomer = newC;
          }
          setIsRegistering(false);
        }

        if (foundCustomer) {
          selectedCustomerPhone = foundCustomer.phone;
          finalCustomerName = foundCustomer.name;
        }
      }

      const newTx: Omit<Transaction, 'id' | 'date'>[] = [];
      const soldItems: { name: string; qty: number }[] = [];

      Object.entries(batchQuantities).forEach(([itemId, qtyStr]) => {
        const qty = parseFloat(String(qtyStr).replace(',', '.'));
        if (qty > 0) {
          const item = section.items.find(i => i.id === itemId);
          if (item) {
            const price = getEffectiveConfigPrice(item, globalMethod);
            newTx.push({
              workspaceId: section.workspaceId,
              category: section.name,
              subCategory: 'VENDAS',
              item: item.name,
              value: qty * price,
              quantity: qty,
              paymentMethod: globalMethod,
              customerName: finalCustomerName,
              customerPhone: selectedCustomerPhone,
              isPending: globalMethod === 'A_PRAZO',
              createdBy: user.name,
              unitPrice: price
            });
            soldItems.push({ name: item.name, qty });
          }
        }
      });

      // 1. Vincular e descontar do estoque Central (Kardex) se configurado
      const stockUpdates: Record<string, { id: string, quantity: number }[]> = {};
      const isStrictlyLocal = sections.some(s => s.type === 'STOCK_STYLE' && s.globalStockMode === 'LOCAL');

      soldItems.forEach(({ name, qty }) => {
          const normalize = (s: string) => s.trim().toLowerCase();
          const targetName = normalize(name);
          
          let stockSection: AppSection | undefined;

          // PRIORIDADE 1: Busca vínculo LOCAL (Apenas se a aba de estoque estiver vinculada a esta aba da fábrica)
          stockSection = sections.find(s => 
            s.type === 'STOCK_STYLE' && 
            s.globalStockMode === 'LOCAL' && 
            s.linkedSectionId === section.id && 
            s.items.some(i => normalize(i.name) === targetName)
          );

          // PRIORIDADE 2: Fallback para GLOBAL apenas se o sistema NÃO estiver operando em modo estritamente LOCAL
          // Ou se não encontramos um vínculo local mas existe um estoque marcado como GLOBAL (bucket único)
          if (!stockSection && !isStrictlyLocal) {
              stockSection = sections.find(s => 
                s.type === 'STOCK_STYLE' && 
                s.globalStockMode === 'GLOBAL' && 
                s.items.some(i => normalize(i.name) === targetName)
              );
          }

          if (stockSection) {
              const item = stockSection.items.find(i => normalize(i.name) === targetName);
              if (item) {
                  if (!stockUpdates[stockSection.id]) stockUpdates[stockSection.id] = [];
                  stockUpdates[stockSection.id].push({ id: item.id, quantity: qty });
                  
                  // Low Stock Notification (Predictive)
                  const currentStock = item.currentStock || 0;
                  const newStock = Math.max(0, currentStock - qty);
                  if (addNote && item.minStock !== undefined && newStock <= item.minStock) {
                    addNote({
                      workspaceId: section.workspaceId,
                      createdById: 'system',
                      createdByName: 'Estoque',
                      content: `Estoque baixo: ${item.name} (${newStock} un). Mínimo: ${item.minStock} un.`,
                      type: 'STOCK_LOW'
                    });
                  }
              }
          }
      });

      // Execute atomic updates and register movements
      for (const [sId, updates] of Object.entries(stockUpdates)) {
        const success = await updateStockAtomic(sId, updates);
        if (!success) {
          toast.error("Erro ao atualizar estoque atômico. A venda foi registrada, mas o estoque pode estar desatualizado.");
        } else {
          // Register stock movements
          const stockSection = sections.find(s => s.id === sId);
          if (stockSection) {
            for (const update of updates) {
              const item = stockSection.items.find(i => i.id === update.id);
              if (item) {
                const currentStock = item.currentStock || 0;
                const newStock = Math.max(0, currentStock - update.quantity);
                await registerStockMovement({
                  workspace_id: section.workspaceId,
                  item_id: item.id,
                  item_name: item.name,
                  movement_type: 'OUT',
                  reason: 'SALE',
                  quantity: update.quantity,
                  previous_balance: currentStock,
                  new_balance: newStock,
                  created_by: user.name
                });
              }
            }
          }
        }
      }

      const result = await addTransactions(newTx);
      if (result) {
        const total = newTx.reduce((acc, t) => acc + t.value, 0);
        const items = newTx.map(t => ({ name: t.item, value: t.value, quantity: t.quantity }));
        setSuccessModal({ show: true, total, items, customer: finalCustomerName });
        
        setBatchQuantities({});
        setCustomerName('');
        setNewCustomerPhone('');
        setIsUnregistered(false);
        toast.success("Venda registrada com sucesso!");
      } else {
        throw new Error("Não foi possível salvar os registros.");
      }
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${safeStringifyError(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmExpenses = async () => {
    if (expensesTotal <= 0) return;
    const cleanSupplier = supplierName.trim();
    if (expenseMethod === 'A_PRAZO' && !cleanSupplier) { 
      toast.error("Digite o nome do fornecedor."); 
      return; 
    }
    setIsSaving(true);
    try {
       const newTx: Omit<Transaction, 'id' | 'date'>[] = [];
       Object.entries(expenseEntries).forEach(([itemName, valStr]) => {
          const val = parseFloat(String(valStr).replace(',', '.'));
          if (val > 0) {
             const calc = expenseCalcs[itemName];
             const qty = calc?.qty ? parseFloat(calc.qty.replace(',', '.')) : undefined;
             newTx.push({
                workspaceId: section.workspaceId, category: section.name, subCategory: 'GASTOS',
                item: itemName, value: val, quantity: qty, paymentMethod: expenseMethod,
                isPending: expenseMethod === 'A_PRAZO', customerName: expenseMethod === 'A_PRAZO' ? cleanSupplier : undefined,
                createdBy: user.name
             });
          }
       });
       await addTransactions(newTx);
       setExpenseEntries({}); setSupplierName(''); setExpenseCalcs({});
       toast.success("Despesas registradas!");
    } catch (e) { 
      toast.error(`Erro ao salvar despesas: ${safeStringifyError(e)}`); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleSettle = async (ids: string[]) => {
    if (ids.length === 0 || !viewingCustomer) return;
    setIsSaving(true);
    try {
      const externalItems: Transaction[] = [];
      const internalIds: string[] = [];
      ids.forEach(id => {
         const tx = transactions.find(t => String(t.id) === id);
         if (tx) {
            if (tx.isExternal) externalItems.push(tx);
            else internalIds.push(id);
         }
      });

      const groupData = pendingByCustomer[viewingCustomer];
      const realNameForSettle = groupData.displayName;

      if (internalIds.length > 0) await settleCustomerDebt(realNameForSettle, internalIds);
      if (externalItems.length > 0) {
         // NOTA: Em tese, essa função não deve ser chamada para externos devido ao bloqueio de UI,
         // mas mantemos a lógica de fallback seguro.
         const externalIds = externalItems.map(t => t.id);
         await settleCustomerDebt(realNameForSettle, externalIds);
         
         const expensesToCreate = externalItems.map(t => ({
            workspaceId: section.workspaceId, category: section.name, 
            subCategory: t.subCategory === 'GASTOS' ? 'VENDAS' : 'GASTOS',
            item: `Pgto Dívida Externa: ${t.item}`, value: t.value, quantity: t.quantity, paymentMethod: 'A_VISTA',
            isPending: false, customerName: t.createdBy, createdBy: user.name
         }));
         await addTransactions(expensesToCreate);
      }
      setSelectedIds(new Set());
      setConfirmAction(null);
      toast.success("Dívida quitada com sucesso!");
    } catch(e: any) { 
      toast.error(`Falha na conexão: Tente novamente.`); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleWhatsAppBilling = (customerName: string, total: number) => {
    const message = `Olá ${customerName}, você tem um saldo pendente de ${formatCurrency(total)} na ${section.name}.`;
    const customer = customers.find(c => normalizeString(c.name) === normalizeString(customerName));
    const phone = customer?.phone;
    
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    } else {
      toast.error("Telefone do cliente não encontrado para cobrança.");
    }
  };

  const handlePartialGroupSettleExecute = async () => {
    if (!partialGroupSettleInfo || !viewingCustomer) return;
    const amountToApply = parseFloat(partialAmount.replace(',', '.'));
    if (isNaN(amountToApply) || amountToApply <= 0 || amountToApply >= partialGroupSettleInfo.total) {
      toast.error("Valor de pagamento inválido.");
      return;
    }

    setIsSaving(true);
    try {
      let remainingPayment = amountToApply;
      const sortedItems = [...partialGroupSettleInfo.items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const item of sortedItems) {
        if (remainingPayment <= 0) break;
        if (remainingPayment >= item.value) {
          await handleSettle([item.id]);
          remainingPayment -= item.value;
        } else {
          const targetSub = item.isExternal ? (item.subCategory === 'GASTOS' ? 'VENDAS' : 'GASTOS') : item.subCategory;
          await partialSettleTransaction(item, remainingPayment, targetSub);
          remainingPayment = 0;
        }
      }
      setPartialGroupSettleInfo(null);
      setPartialAmount('');
      setMainMenuOpen(false);
      toast.success("Pagamento parcial registrado!");
    } catch (e) {
      toast.error("Erro ao processar quitação parcial.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleGroupSelection = (ids: string[]) => {
    const allSelected = ids.every(id => selectedIds.has(id));
    const newSet = new Set(selectedIds);
    if (allSelected) ids.forEach(id => newSet.delete(id));
    else ids.forEach(id => newSet.add(id));
    setSelectedIds(newSet);
  };

  const toggleSelectAll = (ids: string[]) => {
    if (selectedIds.size === ids.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(ids));
  };

  const getItemsByTimestamp = (items: Transaction[]) => {
    const groups: Record<string, Transaction[]> = {};
    items.forEach(item => {
      const key = item.date; 
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  };

  const executePartialPay = async (t: Transaction) => {
    const val = parseFloat(partialAmount.replace(',', '.'));
    if (!val || val <= 0 || val >= t.value) { 
      toast.error("Valor inválido."); 
      return; 
    }
    setIsSaving(true);
    try {
      await partialSettleTransaction(t, val);
      if (t.isExternal) {
         await addTransactions([{
            workspaceId: section.workspaceId, category: section.name, subCategory: 'GASTOS',
            item: `Pgto Parcial Ext: ${t.item}`, value: val, paymentMethod: 'A_VISTA',
            isPending: false, customerName: t.createdBy, createdBy: user.name
         }]);
      }
      setPartialPayId(null); setPartialAmount(''); setMenuOpenId(null);
      toast.success("Pagamento parcial registrado!");
    } catch (e) { 
      toast.error(`Erro: ${safeStringifyError(e)}`); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const executeEdit = async (id: string) => {
    const val = parseFloat(editForm.value.replace(',', '.'));
    if (!editForm.item || isNaN(val)) return;
    setIsSaving(true);
    try {
      await updateTransaction(id, { item: editForm.item, value: val });
      setEditingId(null); setMenuOpenId(null);
      toast.success("Lançamento atualizado!");
    } catch (e) {
      toast.error("Erro ao atualizar lançamento.");
    } finally { 
      setIsSaving(false); 
    }
  };

  const executeDelete = async (id: string) => {
    if (!deleteTransaction) return;
    setIsSaving(true);
    try {
      await deleteTransaction(id);
      setConfirmAction(null); setMenuOpenId(null);
      toast.success("Lançamento excluído.");
    } catch (e) { 
      toast.error("Erro ao excluir."); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const generatePDF = (items: Transaction[], groupKey: string) => {
    toast.info("Gerando PDF para download...");
    const data = pendingByCustomer[groupKey];
    const customerName = data.displayName;
    const doc = new jsPDF();
    doc.setFillColor(249, 115, 22); doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text("EXTRATO DE PENDÊNCIAS", 105, 15, { align: "center" });
    doc.setTextColor(60, 60, 60); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`${data.type === 'PAYABLE' ? 'Fornecedor/Parceiro' : 'Cliente'}: ${customerName}`, 14, 32);
    doc.setTextColor(150, 150, 150); const now = new Date();
    doc.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`, 196, 32, { align: 'right' });
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const groups: Record<string, Transaction[]> = {};
    items.forEach(t => { const key = t.date; if (!groups[key]) groups[key] = []; groups[key].push(t); });
    const sortedKeys = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    let currentY = 40;
    sortedKeys.forEach((dateKey) => {
      const groupItems = groups[dateKey];
      const dateObj = new Date(dateKey);
      const dateLabel = `${dateObj.toLocaleDateString('pt-BR')} - ${dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      const groupTotal = groupItems.reduce((acc, t) => acc + t.value, 0);
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      doc.setFillColor(240, 240, 240); doc.rect(14, currentY, 182, 8, 'F');
      doc.setTextColor(60, 60, 60); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(`Pedido: ${dateLabel}`, 16, currentY + 5.5);
      currentY += 8;
      const tableBody = groupItems.map(t => {
        const unitPrice = t.unitPrice || (t.quantity && t.quantity > 0 ? t.value / t.quantity : t.value);
        return [t.item.toUpperCase(), t.quantity ? t.quantity.toString() : '1', fmt(unitPrice), fmt(t.value)];
      });
      autoTable(doc, {
        startY: currentY, head: [['Item', 'Qtd', 'V. Unit', 'V. Total']], body: tableBody, theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2, textColor: [50, 50, 50] },
        headStyles: { fillColor: [255, 255, 255], textColor: [150, 150, 150], fontStyle: 'bold', lineWidth: { bottom: 0.1 }, lineColor: [200, 200, 200] },
        columnStyles: { 
          0: { cellWidth: 'auto', halign: 'left' }, 
          1: { cellWidth: 15, halign: 'center' }, 
          2: { cellWidth: 35, halign: 'right' }, 
          3: { cellWidth: 35, halign: 'right' } 
        },
        margin: { left: 14, right: 14 }, didDrawPage: (data) => { currentY = (data as any).cursor?.y || currentY; }
      });
      currentY = (doc as any).lastAutoTable.finalY;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
      doc.text(`Total Pedido: ${fmt(groupTotal)}`, 196, currentY + 5, { align: 'right' });
      currentY += 12; 
    });
    const grandTotal = items.reduce((acc, t) => acc + t.value, 0);
    if (currentY > 260) { doc.addPage(); currentY = 20; }
    doc.setDrawColor(249, 115, 22); doc.setLineWidth(0.5); doc.line(14, currentY, 196, currentY); currentY += 8;
    doc.setFontSize(14); doc.setTextColor(249, 115, 22); doc.text(`TOTAL A PAGAR: ${fmt(grandTotal)}`, 196, currentY, { align: 'right' });
    doc.save(`Extrato_${customerName.replace(/\s+/g, '_')}.pdf`);
    toast.success("Download iniciado!");
  };

  return (
    <React.Fragment>
      {/* Success Modal with Print Option */}
      {successModal && successModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Venda Registrada!</h3>
                <p className="text-slate-500 text-sm mt-2">O que deseja fazer agora?</p>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={async () => {
                    const toastId = toast.loading("Conectando à impressora...");
                    try {
                      await printer.printReceipt(section.name, successModal.items, successModal.total, successModal.customer, section.workspaceId);
                      toast.success("Recibo impresso!", { id: toastId });
                    } catch (e: any) {
                      if (e.message === 'USER_CANCELLED') {
                        toast.dismiss(toastId);
                      } else if (e.message === 'IOS_NOT_SUPPORTED') {
                        toast.dismiss(toastId);
                        toast.error(
                          <div className="flex flex-col gap-2">
                            <p className="font-bold">Impressão Bluetooth não suportada no iPhone (Safari/Chrome).</p>
                            <p className="text-xs">Para imprimir, baixe o navegador gratuito <b>Bluefy</b> na App Store ou use a opção de compartilhar nota.</p>
                          </div>,
                          { duration: 8000 }
                        );
                      } else {
                        toast.error(`Erro ao imprimir: ${e.message || 'Verifique a conexão'}`, { id: toastId });
                      }
                    }
                  }}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
                >
                  <Printer size={16} /> Imprimir Recibo
                </button>
                <button 
                  onClick={() => shareReceipt(section.name, successModal.items, successModal.total, successModal.customer, section.workspaceId)}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                >
                  <Share2 size={16} /> Compartilhar Nota
                </button>
                <button 
                  onClick={() => setSuccessModal(null)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer History Modal */}
      {showCustomerHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">{showCustomerHistory.name}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{showCustomerHistory.phone || 'Sem telefone'}</p>
                </div>
              </div>
              <button onClick={() => setShowCustomerHistory(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Comprado</p>
                  <p className="text-2xl font-black text-emerald-700">
                    {formatCurrency(transactions
                      .filter(t => t.customerName === showCustomerHistory.name && t.category === section.name && !t.isPending)
                      .reduce((acc, t) => acc + t.value, 0))}
                  </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Total Pendente</p>
                  <p className="text-2xl font-black text-amber-700">
                    {formatCurrency(transactions
                      .filter(t => t.customerName === showCustomerHistory.name && t.category === section.name && t.isPending)
                      .reduce((acc, t) => acc + t.value, 0))}
                  </p>
                </div>
              </div>

              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock size={16} className="text-indigo-500" />
                Últimas Compras
              </h4>

              <div className="space-y-3">
                {transactions
                  .filter(t => t.customerName === showCustomerHistory.name && t.category === section.name)
                  .slice(0, 10)
                  .map(t => (
                    <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-700">{t.item}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(t.date).toLocaleDateString()} • {t.paymentMethod}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${t.isPending ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {formatCurrency(t.value)}
                        </p>
                        {t.isPending && <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Pendente</span>}
                      </div>
                    </div>
                  ))}
                
                {transactions.filter(t => t.customerName === showCustomerHistory.name && t.category === section.name).length === 0 && (
                  <div className="text-center py-12">
                    <Package size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold">Nenhuma compra registrada.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={() => {
                  const msg = `Olá ${showCustomerHistory.name}! Notamos que faz um tempo que você não pede conosco. Temos novidades hoje!`;
                  window.open(`https://wa.me/${showCustomerHistory.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
              >
                <Phone size={20} />
                Enviar Promoção WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

    <div className="space-y-6 pb-24 animate-in fade-in">
      <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 flex overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('VENDAS')} className={`flex-1 py-4 px-4 rounded-[1.6rem] flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'VENDAS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><Package className="w-4 h-4" /> Produção</button>
        <button onClick={() => setActiveTab('PRODUTOS')} className={`flex-1 py-4 px-4 rounded-[1.6rem] flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'PRODUTOS' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><BarChart3 className="w-4 h-4" /> Produtos</button>
        <button onClick={() => setActiveTab('A_RECEBER')} className={`flex-1 py-4 px-4 rounded-[1.6rem] flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'A_RECEBER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
          <Wallet className="w-4 h-4" /> Contas
          {(receivablesCount + payablesCount) > 0 && <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-md text-[8px]">{receivablesCount + payablesCount}</span>}
        </button>
        <button onClick={() => setActiveTab('GASTOS')} className={`flex-1 py-4 px-4 rounded-[1.6rem] flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'GASTOS' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><TrendingDown className="w-4 h-4" /> Despesas</button>
      </div>

      {activeTab === 'A_RECEBER' && (
        <div className="space-y-4 animate-in slide-in-from-right-4">
           <div className="flex bg-slate-100 p-1 rounded-2xl mb-2">
              <button onClick={() => setBillsTab('RECEIVABLES')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 relative ${billsTab === 'RECEIVABLES' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                <ArrowDownCircle size={14} /> A Receber
                {receivablesCount > 0 && <span className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[8px] font-black shadow-lg ${billsTab === 'RECEIVABLES' ? 'bg-white text-emerald-600' : 'bg-emerald-500 text-white'}`}>{receivablesCount}</span>}
              </button>
              <button onClick={() => setBillsTab('PAYABLES')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 relative ${billsTab === 'PAYABLES' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                <ArrowUpCircle size={14} /> A Pagar
                {payablesCount > 0 && <span className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[8px] font-black shadow-lg ${billsTab === 'PAYABLES' ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'}`}>{payablesCount}</span>}
              </button>
           </div>
           
           <div className="flex justify-end mb-2">
              <button 
                onClick={handleManualRefresh} 
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100 text-[9px] font-black uppercase text-slate-500 hover:text-indigo-600 transition-all active:scale-95"
              >
                <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
                Atualizar Dados
              </button>
           </div>

           {filteredPendingList.length === 0 ? (
             <div className="p-12 text-center bg-white rounded-[2.5rem] border border-slate-100"><CheckCircle2 className={`w-12 h-12 mx-auto mb-4 ${billsTab === 'RECEIVABLES' ? 'text-emerald-200' : 'text-rose-200'}`} /><p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{billsTab === 'RECEIVABLES' ? 'Nada a receber' : 'Nada a pagar'}</p></div>
           ) : (
             filteredPendingList.map(([key, data]: [string, any]) => (
               <div key={key} onClick={() => setViewingCustomer(key)} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center justify-between cursor-pointer hover:border-indigo-100 hover:shadow-md transition-all active:scale-[0.98]">
                 <div><div className="flex items-center gap-2 mb-1"><h4 className="font-black text-slate-800 text-sm uppercase">{data.displayName}</h4>{data.type === 'PAYABLE' && <span className="text-[7px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black uppercase">A Pagar</span>}{data.type === 'RECEIVABLE' && <span className="text-[7px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-black uppercase">A Receber</span>}{data.isExternal && <span className="text-[7px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1"><ExternalLink size={8} /> Externo</span>}</div><p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Receipt size={10} /> {data.count} itens pendentes</p></div>
                 <div className="flex items-center gap-4"><span className={`font-black text-lg ${data.type === 'PAYABLE' ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(data.total)}</span><div className="p-3 bg-slate-100 text-slate-400 rounded-xl"><ChevronRight className="w-5 h-5" /></div></div>
               </div>
             ))
           )}
        </div>
      )}

      {/* ... Rest of tabs ... */}
      {activeTab === 'VENDAS' && (
        <>
          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-4">
            <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar item..." className="w-full p-4 pl-12 bg-slate-50 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all" /></div>
            <div className="flex gap-2">
              <button onClick={() => setGlobalMethod('A_VISTA')} className={`flex-1 py-4 flex items-center justify-center gap-2 rounded-2xl border-2 font-black text-[11px] uppercase transition-all active:scale-95 ${globalMethod === 'A_VISTA' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}>
                <DollarSign className="w-4 h-4" /> À Vista
              </button>
              <button onClick={() => setGlobalMethod('A_PRAZO')} className={`flex-1 py-4 flex items-center justify-center gap-2 rounded-2xl border-2 font-black text-[11px] uppercase transition-all active:scale-95 ${globalMethod === 'A_PRAZO' ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}>
                <Clock className="w-4 h-4" /> À Prazo
              </button>
            </div>
            
            <div className="animate-in slide-in-from-top-2 relative space-y-3">
              <div className="flex items-center justify-between px-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Users size={12} /> Identificar Cliente
                </label>
                <button 
                  onClick={() => setIsUnregistered(!isUnregistered)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all ${isUnregistered ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                >
                  {isUnregistered ? <CheckSquare size={10} /> : <Square size={10} />}
                  Venda Avulsa
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                <input 
                  value={customerName} 
                  onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }} 
                  onFocus={() => setShowSuggestions(true)} 
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} 
                  placeholder={isUnregistered ? "NOME PARA A NOTA (OPCIONAL)" : "BUSCAR OU DIGITAR NOME"} 
                  className={`w-full p-4 pl-12 rounded-2xl font-bold text-xs uppercase outline-none transition-all ${isUnregistered ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-orange-50 border border-orange-100 text-orange-800 focus:ring-2 focus:ring-orange-200'}`} 
                />
              </div>
              
              {!isUnregistered && (
                <>
                  {matchedCustomer && (
                    <div className="flex items-center gap-2 px-2 animate-in fade-in slide-in-from-top-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <button 
                        onClick={() => setShowCustomerHistory(matchedCustomer)}
                        className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline"
                      >
                        <FileText size={10} /> Ver Ficha de {matchedCustomer.name}
                      </button>
                    </div>
                  )}

                  {/* Feedback Visual de Vínculo */}
                  {matchedCustomer ? (
                     matchedCustomer.phone ? (
                        <div className="flex items-center gap-2 px-2 animate-in fade-in slide-in-from-top-1">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                              <LinkIcon size={10} /> Vínculo Ativo: {matchedCustomer.phone}
                           </span>
                        </div>
                     ) : (
                        <div className="flex items-center gap-2 px-2 animate-in fade-in slide-in-from-top-1">
                           <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                           <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1">
                              <Link2Off size={10} /> Sem Telefone (Apenas Local)
                           </span>
                        </div>
                     )
                  ) : customerName.length > 2 ? (
                     <div className="animate-in slide-in-from-top-2 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                           <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Novo Cliente: Cadastro Rápido</span>
                        </div>
                        <div className="flex gap-2">
                           <div className="relative flex-1">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300 w-4 h-4" />
                              <input 
                                 value={newCustomerPhone}
                                 onChange={e => setNewCustomerPhone(e.target.value)}
                                 placeholder="TELEFONE (OPCIONAL)"
                                 className="w-full p-3 pl-9 bg-white border border-indigo-100 rounded-xl font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                           </div>
                           <div className="flex items-center px-2 text-[8px] font-bold text-indigo-400 uppercase leading-tight">
                              O cliente será salvo<br/>ao confirmar a venda
                           </div>
                        </div>
                     </div>
                  ) : null}

                  {showSuggestions && customerSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-orange-100 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                      {customerSuggestions.map(c => (
                        <button key={c.id} onClick={() => { setCustomerName(c.name); setShowSuggestions(false); }} className="w-full text-left p-4 hover:bg-orange-50 font-bold text-xs uppercase text-slate-700 border-b border-slate-50 last:border-0 flex items-center justify-between">
                          {c.name}
                          <span className="text-[9px] text-slate-400 font-normal">{c.phone || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="space-y-3">{filteredItems.map(item => {
               const qty = batchQuantities[item.id] || '';
               const price = getEffectiveConfigPrice(item, globalMethod);
               const isPromoActive = item.promoEndsAt ? new Date(item.promoEndsAt).getTime() > Date.now() : true;
               const hasPromo = globalMethod === 'A_VISTA' ? !!item.promotionalPriceAVista : !!item.promotionalPriceAPrazo;
               const originalPrice = globalMethod === 'A_VISTA' ? (item.defaultPriceAVista || 0) : (item.defaultPriceAPrazo || 0);
               
               return (<div key={item.id} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4 relative overflow-hidden">
                 {hasPromo && isPromoActive && (
                   <div className="absolute top-0 left-0 bg-rose-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-br-xl z-10">
                     Oferta
                   </div>
                 )}
                 <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">{item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover rounded-2xl" /> : <Package className="text-slate-300" />}</div><div className="flex-1 min-w-0"><h4 className="font-black text-slate-700 text-xs uppercase truncate">{item.name}</h4>
                 {hasPromo && isPromoActive ? (
                   <div className="flex items-center gap-1">
                     <p className="text-[10px] font-bold text-emerald-600">Unit: {formatCurrency(price)}</p>
                     <p className="text-[8px] font-bold text-slate-400 line-through">{formatCurrency(originalPrice)}</p>
                   </div>
                 ) : (
                   <p className="text-[10px] font-bold text-slate-400">Unit: {formatCurrency(price)}</p>
                 )}
                 </div><div className="w-24"><input type="number" inputMode="decimal" value={qty} onChange={e => handleQtyChange(item.id, e.target.value)} placeholder="Qtd" className={`w-full p-3 rounded-xl font-black text-center outline-none transition-all ${qty ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-800 border-2 border-slate-200 focus:border-indigo-300 focus:bg-white'}`} /></div></div>);
            })}</div>
          {productionTotal > 0 && (<div className="fixed bottom-28 left-4 right-4 z-[100] animate-in slide-in-from-bottom-5"><button onClick={confirmProduction} disabled={isSaving} className={`w-full py-5 rounded-[1.8rem] font-black text-[13px] uppercase tracking-widest text-white flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl disabled:opacity-50 ${globalMethod === 'A_PRAZO' ? 'bg-orange-600 shadow-orange-500/30' : 'bg-emerald-600 shadow-emerald-500/30'}`}>{isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : globalMethod === 'A_PRAZO' ? <Clock className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}{hideMoney ? 'CONFIRMAR' : globalMethod === 'A_PRAZO' ? `LANÇAR DÍVIDA — ${formatCurrency(productionTotal)}` : `RECEBER (À VISTA) — ${formatCurrency(productionTotal)}`}</button></div>)}
        </>
      )}

      {activeTab === 'GASTOS' && (
        <div className="space-y-4">
           <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50"><div className="relative mb-4"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar despesa..." className="w-full p-4 pl-12 bg-slate-50 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-rose-100 transition-all" /></div><div className="flex gap-2"><button onClick={() => setExpenseMethod('A_VISTA')} className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${expenseMethod === 'A_VISTA' ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}><DollarSign className="w-4 h-4 inline mr-1" /> À Vista</button><button onClick={() => setExpenseMethod('A_PRAZO')} className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${expenseMethod === 'A_PRAZO' ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}><Clock className="w-4 h-4 inline mr-1" /> À Prazo</button></div></div>
           {expenseMethod === 'A_PRAZO' && (<div className="relative animate-in zoom-in-95 z-30"><Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-red-300" /><input value={supplierName} onChange={e => { setSupplierName(e.target.value); setShowSupplierSuggestions(true); }} onFocus={() => setShowSupplierSuggestions(true)} onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)} placeholder="NOME DO FORNECEDOR" className="w-full p-5 pl-12 bg-red-50 border-2 border-red-100 rounded-[1.8rem] font-black text-xs uppercase text-red-900 outline-none focus:border-red-500 placeholder:text-red-200" />{showSupplierSuggestions && supplierSuggestions.length > 0 && (<div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-red-100 z-50 overflow-hidden animate-in fade-in zoom-in-95">{supplierSuggestions.map(c => (<button key={c.id} onClick={() => { setSupplierName(c.name); setShowSupplierSuggestions(false); }} className="w-full text-left p-4 hover:bg-red-50 font-bold text-xs uppercase text-slate-700 border-b border-slate-50 last:border-0 flex items-center justify-between">{c.name}<span className="text-[9px] text-slate-400 font-normal">{c.phone || ''}</span></button>))}</div>)}</div>)}
           <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">{!section.expenses || section.expenses.length === 0 ? (<div className="p-20 text-center flex flex-col items-center gap-4"><AlertCircle size={40} className="text-slate-200" /><div><p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Nenhuma Despesa Configurada</p><p className="text-slate-300 text-[8px] uppercase mt-1">Vá em Painel para adicionar despesas.</p></div></div>) : filteredExpenses.map(item => {
               const entry = expenseEntries[item.name] || ''; const calc = expenseCalcs[item.name] || { qty: '', unit: '' }; const isCalcOpen = expandedCalc === item.name;
               return (<div key={item.id} className="p-6 border-b border-slate-50 last:border-0"><div className="flex justify-between items-center mb-4"><div className="flex items-center gap-3">{item.imageUrl ? <img src={item.imageUrl} className="w-10 h-10 rounded-lg object-cover bg-slate-100" /> : <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300"><DollarSign /></div>}<span className="font-black text-slate-800 text-lg">{item.name}</span></div><button onClick={() => handleToggleCalc(item)} className={`p-2 rounded-xl transition-all ${isCalcOpen ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}><Calculator className="w-4 h-4" /></button></div>{isCalcOpen && (<div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-indigo-50/50 rounded-2xl animate-in slide-in-from-top-1"><div className="space-y-1"><label className="text-[8px] font-black text-indigo-400 uppercase ml-2">Qtd</label><input type="text" inputMode="decimal" value={calc.qty} onChange={e => handleExpenseCalcChange(item.name, 'qty', e.target.value)} placeholder="0" className="w-full p-3 bg-slate-100 border-2 border-slate-200 rounded-xl font-black text-center text-xs outline-none focus:bg-white focus:border-indigo-300 transition-all" /></div><div className="space-y-1"><label className="text-[8px] font-black text-indigo-400 uppercase ml-2">Unit.</label><input type="text" inputMode="decimal" value={calc.unit} onChange={e => handleExpenseCalcChange(item.name, 'unit', e.target.value)} placeholder="0,00" className="w-full p-3 bg-slate-100 border-2 border-slate-200 rounded-xl font-black text-center text-xs outline-none focus:bg-white focus:border-indigo-300 transition-all" /></div></div>)}<div className="flex gap-4"><div className="flex-1"><label className="block text-[8px] font-black uppercase text-slate-400 mb-1 ml-4">Valor Total (R$)</label><input type="text" inputMode="decimal" value={entry} onChange={e => handleExpenseEntryChange(item.name, 'value', e.target.value)} placeholder="0,00" className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-2xl font-black text-lg outline-none focus:bg-white focus:border-red-400 transition-all text-slate-800" /></div></div></div>);
             })}</div>
           {expensesTotal > 0 && (<div className="fixed bottom-28 left-4 right-4 z-[100] animate-in slide-in-from-bottom-5"><button onClick={confirmExpenses} disabled={isSaving} className="w-full py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-widest text-white flex items-center justify-center gap-3 bg-rose-600 hover:bg-rose-500 transition-all active:scale-95 disabled:opacity-50 shadow-2xl">{isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} REGISTRAR GASTOS</button></div>)}
        </div>
      )}

      {viewingCustomer && pendingByCustomer[viewingCustomer] && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-sm h-[90vh] sm:h-auto sm:max-h-[90vh] rounded-t-[3rem] sm:rounded-[3rem] shadow-3xl flex flex-col animate-in slide-in-from-bottom-10 relative">
              <header className="p-8 pb-4 flex justify-between items-center border-b border-slate-100 shrink-0">
                 <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase leading-tight">{pendingByCustomer[viewingCustomer].displayName}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       {pendingByCustomer[viewingCustomer].type === 'PAYABLE' ? 'Contas a Pagar' : 'Contas a Receber'}
                    </p>
                 </div>
                 <div className="flex items-center gap-2">
                    {/* Se não for dívida externa, mostra menu de ações em lote */}
                    {!pendingByCustomer[viewingCustomer].isExternal && (
                      <div className="relative">
                         <button onClick={() => setMainMenuOpen(!mainMenuOpen)} className="p-3 bg-slate-100 text-slate-600 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                            <MoreVertical size={20} />
                         </button>
                         {mainMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 z-[100] bg-white rounded-2xl shadow-3xl border border-slate-100 min-w-[180px] overflow-hidden animate-in zoom-in-95 origin-top-right">
                               <button onClick={() => { setConfirmAction({ type: 'SETTLE_ALL' }); setMainMenuOpen(false); }} className="w-full p-4 text-left flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50">
                                  <CheckCircle2 size={16} /> Quitar Tudo
                               </button>
                               <button onClick={() => { setPartialGroupSettleInfo({ items: pendingByCustomer[viewingCustomer!].items, total: pendingByCustomer[viewingCustomer!].total }); setMainMenuOpen(false); }} className="w-full p-4 text-left flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50">
                                  <Scissors size={16} /> Pgto Parcial
                               </button>
                            </div>
                         )}
                      </div>
                    )}
                    <button onClick={() => setViewingCustomer(null)} className="p-2 bg-slate-100 text-slate-400 rounded-full"><X size={20} /></button>
                 </div>
              </header>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                 {getItemsByTimestamp(pendingByCustomer[viewingCustomer].items).map(([timestamp, items]) => {
                    const noteTotal = items.reduce((acc, i) => acc + i.value, 0);
                    const noteIds = items.map(i => String(i.id));
                    const isNoteSelected = noteIds.every(id => selectedIds.has(id));
                    const d = new Date(timestamp);
                    const isExpenseGroup = pendingByCustomer[viewingCustomer!].type === 'PAYABLE';
                    const isExternalGroup = pendingByCustomer[viewingCustomer!].isExternal;

                    return (
                      <div key={timestamp} className={`rounded-[2rem] border transition-all overflow-hidden ${isNoteSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                         <div className="p-4 border-b border-slate-50/50 flex items-center justify-between bg-white/50 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                               {/* Só permite selecionar se NÃO for dívida externa */}
                               <button onClick={() => toggleGroupSelection(noteIds)} className="text-slate-300 hover:text-indigo-600">{isNoteSelected ? <CheckSquare className="text-indigo-600 w-5 h-5" /> : <Square className="w-5 h-5" />}</button>
                               <div>
                                  <div className="flex items-center gap-2">
                                     <Calendar size={12} className="text-slate-400" />
                                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        {d.toLocaleDateString('pt-BR')} <span className="opacity-40">{d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                                     </span>
                                  </div>
                                  <span className={`text-xs font-black block mt-0.5 ${isExpenseGroup ? 'text-red-600' : 'text-slate-800'}`}>
                                     {isExpenseGroup ? '- ' : ''}{formatCurrency(noteTotal)}
                                  </span>
                               </div>
                            </div>
                            <div className="flex items-center gap-1">
                               {/* Se for dívida externa, mostra Lock ao invés de Quitar */}
                               <button 
                                 onClick={() => { setConfirmAction({ type: 'SETTLE_NOTE', ids: noteIds }); }} 
                                 className={`p-2 rounded-xl transition-all ${isExternalGroup ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                 title={isExternalGroup ? "Quitar Nota Externa" : "Quitar Nota"}
                               >
                                 <CheckCircle2 size={20} />
                               </button>
                            </div>
                         </div>
                         <div className="p-2 space-y-1 bg-slate-50/30">
                           {items.map(item => {
                              const itemId = String(item.id);
                              const isItemExpense = isExpenseGroup;
                              return (
                                <div key={itemId} className="p-3 flex items-center justify-between rounded-xl hover:bg-slate-50 transition-colors">
                                   <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-1">
                                            <p className="font-bold text-slate-700 text-xs uppercase truncate">{item.item}</p>
                                            {item.isExternal && <ExternalLink size={10} className="text-indigo-400" />}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {item.quantity && <span className="text-[9px] font-bold text-slate-400">Qtd: {item.quantity}</span>}
                                            <span className={`text-[9px] font-bold ${isItemExpense ? 'text-red-400' : 'text-slate-400'}`}>{formatCurrency(item.value)}</span>
                                        </div>
                                      </div>
                                   </div>
                                   {/* Ações individuais: Bloqueadas se for externo */}
                                   {!item.isExternal && (
                                     <div className="relative">
                                        <button onClick={() => setMenuOpenId(menuOpenId === itemId ? null : itemId)} className="p-2 text-slate-300 hover:bg-white hover:text-slate-500 rounded-lg"><MoreVertical size={14} /></button>
                                        {menuOpenId === itemId && (
                                           <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-100 min-w-[140px] overflow-hidden animate-in zoom-in-95 origin-top-right">
                                              <button onClick={() => { setPartialPayId(itemId); setMenuOpenId(null); }} className="w-full p-3 text-left flex items-center gap-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50"><Scissors size={14} /> Pagar Parcial</button>
                                              <button onClick={() => { setEditingId(itemId); setEditForm({item: item.item, value: item.value.toString()}); setMenuOpenId(null); }} className="w-full p-3 text-left flex items-center gap-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50"><Edit3 size={14} /> Editar</button>
                                              <button onClick={() => { setConfirmAction({ type: 'DELETE', id: itemId }); setMenuOpenId(null); }} className="w-full p-3 text-left flex items-center gap-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50"><Trash2 size={14} /> Excluir</button>
                                           </div>
                                        )}
                                     </div>
                                   )}
                                </div>
                              );
                           })}
                         </div>
                      </div>
                    );
                 })}
              </div>

              <div className="p-6 bg-white border-t border-slate-100 rounded-b-[3rem] shrink-0">
                 {/* Footer muda conforme se é dívida externa ou interna */}
                 {pendingByCustomer[viewingCustomer].isExternal ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center space-y-2 opacity-60">
                       <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                          <Lock size={24} />
                       </div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase max-w-[200px]">
                          {pendingByCustomer[viewingCustomer].type === 'PAYABLE' 
                            ? 'Esta nota foi lançada pela empresa credora. Apenas eles podem dar a baixa no sistema.'
                            : 'Esta nota foi lançada pela empresa devedora. Apenas eles podem dar a baixa no sistema.'}
                       </p>
                    </div>
                 ) : (
                    <>
                       <div className="flex justify-between items-center mb-4"><button onClick={() => toggleSelectAll(pendingByCustomer[viewingCustomer].ids)} className="text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600">{selectedIds.size === pendingByCustomer[viewingCustomer].ids.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}</button><span className="text-xl font-black text-rose-600">{selectedIds.size > 0 ? formatCurrency(pendingByCustomer[viewingCustomer].items.filter(i => selectedIds.has(String(i.id))).reduce((a,b) => a + b.value, 0)) : formatCurrency(pendingByCustomer[viewingCustomer].total)}</span></div>
                       <div className="flex gap-3">
                        {selectedIds.size > 0 ? (
                           <>
                              <button onClick={() => { const its = pendingByCustomer[viewingCustomer].items.filter(i => selectedIds.has(String(i.id))); generatePDF(its, viewingCustomer); }} className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"><Printer size={18} /> PDF</button>
                              <button onClick={() => handleSettle(Array.from(selectedIds))} disabled={isSaving} className="flex-[2] py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">{isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />} Quitar ({selectedIds.size})</button>
                           </>
                        ) : (
                           <>
                              <button onClick={() => generatePDF(pendingByCustomer[viewingCustomer].items, viewingCustomer)} className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"><Printer size={18} /> PDF</button>
                              <button onClick={() => setConfirmAction({ type: 'SETTLE_ALL' })} disabled={isSaving} className="flex-[2] py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">{isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />} Quitar Saldo Total</button>
                           </>
                        )}
                     </div>
                    </>
                 )}
              </div>

              {(confirmAction || partialPayId || partialGroupSettleInfo) && (
                <div className="absolute inset-0 z-[250] bg-white/95 backdrop-blur-sm rounded-[3rem] flex flex-col items-center justify-center p-8 animate-in fade-in">
                   {partialPayId ? (
                     <div className="w-full max-w-xs space-y-4">
                        <div className="text-center"><Scissors className="w-10 h-10 text-indigo-600 mx-auto mb-2" /><h4 className="font-black text-slate-800 text-lg uppercase">Pagamento Parcial</h4></div>
                        <input autoFocus type="number" inputMode="decimal" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} className="w-full p-4 bg-slate-100 rounded-2xl text-center text-2xl font-black outline-none border-2 border-transparent focus:border-indigo-500" placeholder="0,00" />
                        <div className="flex gap-3"><button onClick={() => setPartialPayId(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button><button onClick={() => { const item = transactions.find(t => String(t.id) === partialPayId); if(item) executePartialPay(item); }} disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Confirmar</button></div>
                     </div>
                   ) : partialGroupSettleInfo ? (
                     <div className="w-full max-w-xs space-y-4">
                        <div className="text-center"><Wallet className="w-10 h-10 text-indigo-600 mx-auto mb-2" /><h4 className="font-black text-slate-800 text-lg uppercase">Abater Valor (Saldo)</h4><p className="text-[10px] font-bold text-slate-400 uppercase">Dívida Total: {formatCurrency(partialGroupSettleInfo.total)}</p></div>
                        <input autoFocus type="number" inputMode="decimal" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} className="w-full p-4 bg-slate-100 rounded-2xl text-center text-2xl font-black outline-none border-2 border-transparent focus:border-indigo-500" placeholder="0,00" />
                        <div className="flex gap-3"><button onClick={() => { setPartialGroupSettleInfo(null); setPartialAmount(''); }} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button><button onClick={handlePartialGroupSettleExecute} disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Abater Agora</button></div>
                     </div>
                   ) : (
                     <div className="w-full max-w-xs text-center space-y-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${confirmAction?.type === 'DELETE' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>{confirmAction?.type === 'DELETE' ? <Trash2 size={32} /> : <CheckCircle2 size={32} />}</div>
                        <div><h4 className="font-black text-slate-800 text-lg uppercase">Confirmar Ação?</h4><p className="text-xs text-slate-400">{confirmAction?.type === 'DELETE' ? 'Isso removerá o registro permanentemente.' : 'Deseja dar baixa nos itens selecionados?'}</p></div>
                        <div className="flex gap-3 pt-4"><button onClick={() => setConfirmAction(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button><button onClick={() => { if (confirmAction?.type === 'DELETE') executeDelete(confirmAction.id!); else if (confirmAction?.type === 'SETTLE_NOTE') handleSettle(confirmAction.ids!); else if (confirmAction?.type === 'SETTLE_ALL') handleSettle(pendingByCustomer[viewingCustomer!].ids); }} disabled={isSaving} className={`flex-[2] py-4 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg ${confirmAction?.type === 'DELETE' ? 'bg-rose-600' : 'bg-emerald-600'}`}>{isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'Confirmar'}</button></div>
                     </div>
                   )}
                </div>
              )}
           </div>
        </div>
      )}

      {validationError && (
        <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl text-center border-4 border-indigo-50 animate-in zoom-in-95">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                 <Users className="w-10 h-10 text-indigo-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">{validationError.title}</h3>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">{validationError.message}</p>
              
              <div className="grid gap-3">
                 {validationError.type === 'MISSING_ID' && (
                    <>
                       <button 
                          onClick={() => { setIsUnregistered(true); setValidationError(null); setTimeout(() => confirmProduction(false, true), 100); }} 
                          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                       >
                          Seguir como Venda Avulsa
                       </button>
                       <button 
                          onClick={() => setValidationError(null)} 
                          className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-100 transition-colors"
                       >
                          Identificar Cliente
                       </button>
                    </>
                 )}

                 {validationError.type === 'NEW_CUSTOMER_NO_PHONE' && (
                    <>
                       <button 
                          onClick={() => setValidationError(null)} 
                          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                       >
                          Informar Telefone
                       </button>
                       <button 
                          onClick={() => { setIsUnregistered(true); setValidationError(null); setTimeout(() => confirmProduction(false, true), 100); }} 
                          className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors"
                       >
                          Usar apenas como Venda Avulsa
                       </button>
                    </>
                 )}

                 {validationError.type === 'NEGATIVE_STOCK' && (
                    <>
                       <button 
                          onClick={() => { setValidationError(null); setTimeout(() => confirmProduction(true), 100); }} 
                          className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                       >
                          Vender Mesmo Assim
                       </button>
                       <button 
                          onClick={() => setValidationError(null)} 
                          className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors"
                       >
                          Cancelar
                       </button>
                    </>
                 )}

                 {validationError.type === 'GENERIC' && (
                    <button onClick={() => setValidationError(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Entendido</button>
                 )}
              </div>
           </div>
        </div>
      )}
      {activeTab === 'PRODUTOS' && (
        <ProductInsights transactions={transactions} title={"Vendas: " + section.name} sectionName={section.name} />
      )}
      </div>
    </React.Fragment>
  );
};
