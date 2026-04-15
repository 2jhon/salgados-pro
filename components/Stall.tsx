
import React, { useState, useMemo, useRef } from 'react';
import { AppSection, User, Transaction, PeriodTotals, ConfigItem, Customer } from '../types';
import { printer } from '../lib/printer';
import { 
  Store, DollarSign, Clock, Truck, Calculator, 
  Save, Loader2, Check, AlertCircle, Search, TrendingDown,
  ShoppingBag, Settings, Globe, MessageCircle, Bike, Store as StoreIcon, X,
  ArrowRight, Minus, Edit3, Camera, Image as ImageIcon, MapPin, Info,
  Printer, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

import { registerStockMovement } from '../lib/supabase';

interface StallProps {
  section: AppSection;
  user: User;
  transactions: Transaction[];
  addTransactions: (ts: Omit<Transaction, 'id' | 'date'>[]) => Promise<any>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  calculateTotals: (cat: string, sub?: string) => PeriodTotals;
  saveConfig: (s: AppSection[]) => Promise<boolean>;
  updateStockAtomic: (sectionId: string, itemUpdates: { id: string, quantity: number }[]) => Promise<boolean>;
  sections: AppSection[];
  customers: Customer[];
  addNote?: (note: any) => Promise<boolean>;
}

export const Stall: React.FC<StallProps> = ({ 
  section, user, addTransactions, 
  sections, saveConfig, updateStockAtomic, customers, addNote
}) => {
  const [activeTab, setActiveTab] = useState<'VENDAS' | 'GASTOS'>('VENDAS');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [stallData, setStallData] = useState<Record<string, { took: string; returned: string }>>({});
  
  const [itemToEditDefault, setItemToEditDefault] = useState<ConfigItem | null>(null);
  const [newDefaultQty, setNewDefaultQty] = useState('');

  const [showConfig, setShowConfig] = useState(false);
  const [localConfig, setLocalConfig] = useState({
    isPublic: section.isPublic,
    whatsappMode: section.whatsappMode || 'SYSTEM',
    manualWhatsapp: section.manualWhatsapp || '',
    fulfillmentMode: section.fulfillmentMode || 'PICKUP',
    imageUrl: section.imageUrl || '',
    description: section.description || '',
    openingHours: section.openingHours || '',
    address: section.address || ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expenseMethod, setExpenseMethod] = useState<'A_VISTA' | 'A_PRAZO'>('A_VISTA');
  const [supplierName, setSupplierName] = useState('');
  const [saleMethod, setSaleMethod] = useState<'A_VISTA' | 'A_PRAZO'>('A_VISTA');
  const [customerName, setCustomerName] = useState('');
  const [expenseEntries, setExpenseEntries] = useState<Record<string, string>>({});
  const [expenseCalcs, setExpenseCalcs] = useState<Record<string, {qty: string, unit: string}>>({});
  const [expandedCalc, setExpandedCalc] = useState<string | null>(null);
  
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [successModal, setSuccessModal] = useState<{ show: boolean, total: number, items: any[], customer?: string } | null>(null);
  const [validationError, setValidationError] = useState<{ 
    title: string, 
    message: string, 
    type: 'NEGATIVE_STOCK' 
  } | null>(null);

  const hideMoney = user.hideSalesValues;

  const filteredItems = useMemo(() => {
    return (section.items || []).filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [section.items, searchTerm]);

  const filteredExpenses = useMemo(() => {
    return (section.expenses || []).filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [section.expenses, searchTerm]);

  const supplierSuggestions = useMemo(() => {
    if (!supplierName || supplierName.length < 1) return [];
    const lowerTerm = supplierName.toLowerCase();
    return customers
      .filter(c => c.type === 'SUPPLIER' && c.name.toLowerCase().includes(lowerTerm))
      .slice(0, 5);
  }, [customers, supplierName]);

  const customerSuggestions = useMemo(() => {
    if (!customerName || customerName.length < 1) return [];
    const lowerTerm = customerName.toLowerCase();
    return customers
      .filter(c => c.type === 'CUSTOMER' && c.name.toLowerCase().includes(lowerTerm))
      .slice(0, 5);
  }, [customers, customerName]);

  const handleStallInput = (itemId: string, field: 'took' | 'returned', val: string) => {
    setStallData(prev => {
      const item = section.items.find(i => i.id === itemId);
      const defaultTook = item?.defaultQty ? String(item.defaultQty) : '';
      
      const existing = prev[itemId] || { took: defaultTook, returned: '' };
      
      return {
        ...prev,
        [itemId]: {
          ...existing,
          [field]: val
        }
      };
    });
  };

  const handleExpenseEntryChange = (name: string, field: 'value', val: string) => {
    setExpenseEntries(prev => ({ ...prev, [name]: val }));
  };

  const handleExpenseCalcChange = (itemName: string, field: 'qty' | 'unit', val: string) => {
     const newCalcs = { ...expenseCalcs, [itemName]: { ...expenseCalcs[itemName], [field]: val } };
     setExpenseCalcs(newCalcs);
     
     const q = parseFloat(newCalcs[itemName]?.qty || '0');
     const u = parseFloat(newCalcs[itemName]?.unit?.replace(',', '.') || '0');
     if (q > 0 && u > 0) {
        setExpenseEntries(prev => ({ ...prev, [itemName]: (q * u).toFixed(2) }));
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
               [item.name]: { qty: currentCalc?.qty || '', unit: defPrice.toFixed(2) }
            }));
         }
      }
    }
  };

  const handleOpenDefaultQty = (item: ConfigItem) => {
    setItemToEditDefault(item);
    setNewDefaultQty(item.defaultQty ? String(item.defaultQty) : '');
  };

  const handleSaveDefaultQty = async () => {
    if (!itemToEditDefault) return;
    setIsSaving(true);
    try {
        const qty = parseFloat(newDefaultQty.replace(',', '.'));
        const updatedSection = {
            ...section,
            items: section.items.map(i => i.id === itemToEditDefault.id ? { ...i, defaultQty: isNaN(qty) ? undefined : qty } : i)
        };
        
        const newSections = sections.map(s => s.id === section.id ? updatedSection : s);
        await saveConfig(newSections);
        
        if (!isNaN(qty)) {
             setStallData(prev => ({
                 ...prev,
                 [itemToEditDefault.id]: {
                     ...(prev[itemToEditDefault.id] || { took: '', returned: '' }),
                     took: String(qty)
                 }
             }));
        }

        setItemToEditDefault(null);
    } catch (e) {
        toast.error("Erro ao salvar padrão.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("A imagem é muito grande. Tente usar uma imagem menor que 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; 
          let width = img.width;
          let height = img.height;
          
          if (width > MAX_WIDTH) {
            height = (MAX_WIDTH / width) * height;
            width = MAX_WIDTH;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setLocalConfig(prev => ({ ...prev, imageUrl: dataUrl }));
        };
        img.src = readerEvent.target?.result as string;
      };
      reader.readAsDataURL(file);
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

  const currentTotal = useMemo(() => {
    if (activeTab === 'VENDAS') {
       return section.items.reduce((acc, item) => {
          const data = stallData[item.id] || {};
          
          const returnedStr = (data as any).returned;
          if (returnedStr === undefined || returnedStr === '') {
             return acc;
          }

          const defaultTook = item.defaultQty ? String(item.defaultQty) : '0';
          const tookStr = (data as any).took !== undefined ? (data as any).took : defaultTook;
          
          const took = parseFloat(tookStr || '0');
          const returned = parseFloat(returnedStr || '0');
          const sold = Math.max(0, took - returned);
          const price = getEffectiveConfigPrice(item, saleMethod);
          return acc + (sold * price);
       }, 0);
    } else {
       return Object.values(expenseEntries).reduce((acc: number, val: any) => acc + (parseFloat(val as string) || 0), 0);
    }
  }, [activeTab, stallData, expenseEntries, section.items]);

  const canShowConfirmButton = currentTotal > 0;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const saveAllStock = async (forceNegativeStock: boolean = false) => {
    if (!canShowConfirmButton) return;
    if (saleMethod === 'A_PRAZO' && !customerName) {
       toast.error("Digite o nome do cliente.");
       return;
    }

    // AVISO DE ESTOQUE NEGATIVO
    if (!forceNegativeStock) {
      const negativeItems: string[] = [];
      section.items.forEach((item) => {
        const data = stallData[item.id] || {};
        const returnedStr = (data as any).returned;
        if (returnedStr === undefined || returnedStr === '') return;

        const defaultTook = item.defaultQty ? String(item.defaultQty) : '0';
        const tookStr = (data as any).took !== undefined ? (data as any).took : defaultTook;
        
        const took = parseFloat(tookStr || '0');
        const returned = parseFloat(returnedStr || '0');
        const sold = Math.max(0, took - returned);

        if (sold > 0) {
          const normalize = (s: string) => s.trim().toLowerCase();
          const targetName = normalize(item.name);
          let stockSection = sections.find(s => s.type === 'STOCK_STYLE' && s.globalStockMode === 'LOCAL' && s.linkedSectionId === section.id && s.items.some(i => normalize(i.name) === targetName));
          if (!stockSection) {
              stockSection = sections.find(s => s.type === 'STOCK_STYLE' && s.globalStockMode === 'GLOBAL' && s.items.some(i => normalize(i.name) === targetName));
          }
          if (stockSection) {
              const stockItem = stockSection.items.find(i => normalize(i.name) === targetName);
              if (stockItem && (stockItem.currentStock || 0) < sold) {
                  negativeItems.push(item.name);
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
       const newTx: Omit<Transaction, 'id' | 'date'>[] = [];
       
       section.items.forEach((item) => {
          const data = stallData[item.id] || {};
          const returnedStr = (data as any).returned;
          
          if (returnedStr === undefined || returnedStr === '') return;

          const defaultTook = item.defaultQty ? String(item.defaultQty) : '0';
          const tookStr = (data as any).took !== undefined ? (data as any).took : defaultTook;
          
          const took = parseFloat(tookStr || '0');
          const returned = parseFloat(returnedStr || '0');
          const sold = Math.max(0, took - returned);

          if (sold > 0) {
             const price = getEffectiveConfigPrice(item, saleMethod);
             newTx.push({
                workspaceId: section.workspaceId,
                category: section.name,
                subCategory: 'VENDAS',
                item: item.name,
                value: sold * price,
                quantity: sold,
                initialStock: took,
                leftoverStock: returned,
                paymentMethod: saleMethod,
                isPending: saleMethod === 'A_PRAZO',
                customerName: saleMethod === 'A_PRAZO' ? customerName : undefined,
                createdBy: user.name,
                unitPrice: price
             });
          }
       });

       await addTransactions(newTx);
       toast.success("Venda registrada com sucesso!");
       
       // Update Stock in Sections and register movements
       const stockUpdates: { id: string, quantity: number }[] = [];
       
       for (const tx of newTx) {
         const item = section.items.find(i => i.name === tx.item);
         if (item) {
           stockUpdates.push({ id: item.id, quantity: tx.quantity || 0 });
           
           const currentStock = item.currentStock || 0;
           const newStock = Math.max(0, currentStock - (tx.quantity || 0));
           
           // Low Stock Notification
           if (addNote && item.minStock !== undefined && newStock <= item.minStock) {
             addNote({
               workspaceId: section.workspaceId,
               createdById: 'system',
               createdByName: 'Estoque',
               content: `Estoque baixo: ${item.name} (${newStock} un). Mínimo: ${item.minStock} un.`,
               type: 'STOCK_LOW'
             });
           }

           // Register stock movement
           await registerStockMovement({
             workspace_id: section.workspaceId,
             item_id: item.id,
             item_name: item.name,
             movement_type: 'OUT',
             reason: 'SALE',
             quantity: tx.quantity || 0,
             previous_balance: currentStock,
             new_balance: newStock,
             created_by: user.name
           });
         }
       }
       
       if (stockUpdates.length > 0) {
         await updateStockAtomic(section.id, stockUpdates);
       }

       setStallData({});
       setCustomerName('');
       setSaleMethod('A_VISTA');
       const total = newTx.reduce((acc, t) => acc + t.value, 0);
       const items = newTx.map(t => ({ name: t.item, value: t.value }));
       setSuccessModal({ show: true, total, items, customer: saleMethod === 'A_PRAZO' ? customerName : undefined });
    } catch (e) {
       toast.error("Erro ao salvar.");
    } finally {
       setIsSaving(false);
    }
  };

  const confirmExpenses = async () => {
    if (!canShowConfirmButton) return;
    if (expenseMethod === 'A_PRAZO' && !supplierName) {
       toast.error("Digite o nome do fornecedor.");
       return;
    }
    setIsSaving(true);
    try {
       const newTx: Omit<Transaction, 'id' | 'date'>[] = [];
       
       Object.entries(expenseEntries).forEach(([itemName, valStr]) => {
          const val = parseFloat(valStr as string);
          if (val > 0) {
             newTx.push({
                workspaceId: section.workspaceId,
                category: section.name,
                subCategory: 'GASTOS',
                item: itemName,
                value: val,
                paymentMethod: expenseMethod,
                isPending: expenseMethod === 'A_PRAZO',
                customerName: expenseMethod === 'A_PRAZO' ? supplierName : undefined,
                createdBy: user.name
             });
          }
       });

       await addTransactions(newTx);
       setExpenseEntries({});
       setSupplierName('');
       setExpenseCalcs({});
       toast.success("Despesas lançadas!");
    } catch (e) {
       toast.error("Erro ao salvar despesas.");
    } finally {
       setIsSaving(false);
    }
  };

  const handleUpdateSection = async () => {
    setIsSaving(true);
    try {
      const updatedSection = {
        ...section,
        isPublic: localConfig.isPublic,
        whatsappMode: localConfig.whatsappMode as 'SYSTEM' | 'MANUAL',
        manualWhatsapp: localConfig.manualWhatsapp,
        fulfillmentMode: localConfig.fulfillmentMode as any,
        imageUrl: localConfig.imageUrl,
        description: localConfig.description,
        openingHours: localConfig.openingHours,
        address: localConfig.address
      };
      
      const newSections = sections.map(s => s.id === section.id ? updatedSection : s);
      const success = await saveConfig(newSections);
      
      if (success) {
        setShowConfig(false);
        toast.success("Configurações salvas!");
      } else {
        toast.error("Não foi possível salvar as configurações. Tente novamente em instantes.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar configurações. Verifique sua conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Header Tabs */}
      <div className="flex gap-2 items-center">
        <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 flex flex-1">
          <button 
            onClick={() => setActiveTab('VENDAS')} 
            className={`flex-1 py-4 rounded-[1.6rem] flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'VENDAS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <ShoppingBag className="w-4 h-4" /> Vendas
          </button>
          <button 
            onClick={() => setActiveTab('GASTOS')} 
            className={`flex-1 py-4 rounded-[1.6rem] flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'GASTOS' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <TrendingDown className="w-4 h-4" /> Despesas
          </button>
        </div>
        <button 
          onClick={() => setShowConfig(true)}
          className="p-4 bg-white rounded-[1.6rem] shadow-sm border border-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50">
         <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
            <input 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               placeholder="Filtrar item..."
               className="w-full p-4 pl-12 bg-slate-50 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
            />
         </div>
      </div>

      {activeTab === 'VENDAS' && (
        <div className="space-y-3">
           {filteredItems.map(item => {
              const defaultTook = item.defaultQty ? String(item.defaultQty) : '';
              const data = stallData[item.id] || { took: defaultTook, returned: '' };
              
              const took = parseFloat((data as any).took || '0');
              const returnedStr = (data as any).returned;
              
              let sold = 0;
              if (returnedStr !== '' && returnedStr !== undefined) {
                 const returned = parseFloat(returnedStr);
                 sold = Math.max(0, took - returned);
              }
              
              const price = getEffectiveConfigPrice(item, saleMethod);
              const isPromoActive = item.promoEndsAt ? new Date(item.promoEndsAt).getTime() > Date.now() : true;
              const hasPromo = saleMethod === 'A_VISTA' ? !!item.promotionalPriceAVista : !!item.promotionalPriceAPrazo;
              const originalPrice = saleMethod === 'A_VISTA' ? (item.defaultPriceAVista || item.defaultPrice || 0) : (item.defaultPriceAPrazo || item.defaultPrice || 0);

              return (
                 <div key={item.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 relative overflow-hidden">
                    {hasPromo && isPromoActive && (
                      <div className="absolute top-0 left-0 bg-rose-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-br-xl z-10">
                        Oferta
                      </div>
                    )}
                    <div className="flex items-center gap-4 mb-6">
                       <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                          {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover rounded-2xl" /> : <Store className="text-slate-300" />}
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                             <h4 className="font-black text-slate-700 text-xs uppercase truncate">{item.name}</h4>
                             <button onClick={() => handleOpenDefaultQty(item)} className="text-slate-300 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-50 transition-all" title="Definir quantidade padrão">
                                <Edit3 size={12} />
                             </button>
                          </div>
                          {hasPromo && isPromoActive ? (
                            <div className="flex items-center gap-1">
                              <p className="text-[10px] font-bold text-emerald-600">Unit: {formatCurrency(price)}</p>
                              <p className="text-[8px] font-bold text-slate-400 line-through">{formatCurrency(originalPrice)}</p>
                            </div>
                          ) : (
                            <p className="text-[10px] font-bold text-slate-400">Unit: {formatCurrency(price)}</p>
                          )}
                       </div>
                       <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vendidos</p>
                          <p className={`text-2xl font-black ${sold > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{sold}</p>
                       </div>
                    </div>
                    
                    <div className="flex gap-3">
                       <div className="flex-1 bg-slate-100 rounded-2xl p-2 px-4 flex items-center justify-between border-2 border-slate-200 focus-within:border-indigo-300 focus-within:bg-indigo-50/30 transition-all">
                          <span className="text-[8px] font-black text-slate-400 uppercase mr-2 tracking-widest">Levou</span>
                          <input 
                             type="number" 
                             inputMode="decimal" 
                             value={(data as any).took} 
                             onChange={e => handleStallInput(item.id, 'took', e.target.value)} 
                             className="w-full bg-transparent font-black text-right text-lg outline-none text-slate-700 placeholder:text-slate-300" 
                             placeholder={item.defaultQty ? String(item.defaultQty) : "0"}
                          />
                       </div>
                       <div className="flex-1 bg-slate-100 rounded-2xl p-2 px-4 flex items-center justify-between border-2 border-slate-200 focus-within:border-orange-300 focus-within:bg-orange-50/30 transition-all">
                          <span className="text-[8px] font-black text-slate-400 uppercase mr-2 tracking-widest">Voltou</span>
                          <input 
                             type="number" 
                             inputMode="decimal" 
                             value={(data as any).returned} 
                             onChange={e => handleStallInput(item.id, 'returned', e.target.value)} 
                             className="w-full bg-transparent font-black text-right text-lg outline-none text-slate-700 placeholder:text-slate-300" 
                             placeholder="0" 
                          />
                       </div>
                    </div>
                 </div>
              );
           })}

           {canShowConfirmButton && (
             <div className="fixed bottom-28 left-4 right-4 z-[100] animate-in slide-in-from-bottom-5">
               <button onClick={saveAllStock} disabled={isSaving} className="w-full py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-widest text-white flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50 shadow-2xl">
                 {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} 
                 {hideMoney ? 'REGISTRAR VENDAS' : `REGISTRAR ${formatCurrency(currentTotal)}`}
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
               <input 
                 value={supplierName} 
                 onChange={e => { setSupplierName(e.target.value); setShowSupplierSuggestions(true); }}
                 onFocus={() => setShowSupplierSuggestions(true)}
                 onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)}
                 placeholder="NOME DO FORNECEDOR" 
                 className="w-full p-5 pl-12 bg-red-50 border-2 border-red-100 rounded-[1.8rem] font-black text-xs uppercase text-red-900 outline-none focus:border-red-500 placeholder:text-red-200" 
               />
               {showSupplierSuggestions && supplierSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-red-100 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                    {supplierSuggestions.map(c => (
                      <button key={c.id} onClick={() => { setSupplierName(c.name); setShowSupplierSuggestions(false); }} className="w-full text-left p-4 hover:bg-red-50 font-bold text-xs uppercase text-slate-700 border-b border-slate-50 last:border-0 flex items-center justify-between">
                        {c.name}
                        <span className="text-[9px] text-slate-400 font-normal">{c.phone || ''}</span>
                      </button>
                    ))}
                  </div>
               )}
            </div>
          )}

          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
             {!section.expenses || section.expenses.length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center gap-4">
                 <AlertCircle size={40} className="text-slate-200" />
                 <div>
                    <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Nenhuma Despesa Configurada</p>
                    <p className="text-slate-300 text-[8px] uppercase mt-1">Vá em Painel para adicionar despesas.</p>
                 </div>
              </div>
            ) : filteredExpenses.map(item => {
               const entry = expenseEntries[item.name] || '';
               const calc = expenseCalcs[item.name] || { qty: '', unit: '' };
               const isCalcOpen = expandedCalc === item.name;

               return (
                 <div key={item.id} className="p-6 border-b border-slate-50 last:border-0">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? <img src={item.imageUrl} className="w-10 h-10 rounded-lg object-cover bg-slate-100" /> : <div className="w-10 h-10 bg-slate-100 rounded-lg" />}
                        <span className="font-black text-slate-800 text-lg">{item.name}</span>
                      </div>
                      <button onClick={() => handleToggleCalc(item)} className={`p-2 rounded-xl transition-all ${isCalcOpen ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}><Calculator className="w-4 h-4" /></button>
                    </div>
                    {isCalcOpen && (
                       <div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-indigo-50/50 rounded-2xl animate-in slide-in-from-top-1">
                          <div className="space-y-1"><label className="text-[8px] font-black text-indigo-400 uppercase ml-2">Qtd</label><input type="text" inputMode="decimal" value={calc.qty} onChange={e => handleExpenseCalcChange(item.name, 'qty', e.target.value)} placeholder="0" className="w-full p-3 bg-slate-100 border-2 border-slate-200 rounded-xl font-black text-center text-xs outline-none focus:bg-white focus:border-indigo-300 transition-all" /></div>
                          <div className="space-y-1"><label className="text-[8px] font-black text-indigo-400 uppercase ml-2">Unit.</label><input type="text" inputMode="decimal" value={calc.unit} onChange={e => handleExpenseCalcChange(item.name, 'unit', e.target.value)} placeholder="0,00" className="w-full p-3 bg-slate-100 border-2 border-slate-200 rounded-xl font-black text-center text-xs outline-none focus:bg-white focus:border-indigo-300 transition-all" /></div>
                       </div>
                    )}
                    <div className="flex gap-4">
                      <div className="flex-1"><label className="block text-[8px] font-black uppercase text-slate-400 mb-1 ml-4">Valor Total (R$)</label><input type="text" inputMode="decimal" value={entry} onChange={e => handleExpenseEntryChange(item.name, 'value', e.target.value)} placeholder="0,00" className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-2xl font-black text-lg outline-none focus:bg-white focus:border-red-400 transition-all text-slate-800" /></div>
                    </div>
                 </div>
               );
             })}
          </div>

          {canShowConfirmButton && (
            <div className="fixed bottom-28 left-4 right-4 z-[100] animate-in slide-in-from-bottom-5">
              <button onClick={confirmExpenses} disabled={isSaving} className="w-full py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-widest text-white flex items-center justify-center gap-3 bg-rose-600 hover:bg-rose-500 transition-all active:scale-95 disabled:opacity-50 shadow-2xl">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} REGISTRAR GASTOS
              </button>
            </div>
          )}
        </div>
      )}

      {showConfig && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in slide-in-from-bottom-10">
           <div className="bg-white w-full max-w-sm rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-3xl overflow-y-auto max-h-[90vh]">
              {/* Config Content (Same as previous, using localConfig) */}
              <div className="flex justify-between items-center mb-8">
                 <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Globe size={24} /></div>
                    <div><h3 className="text-xl font-black text-slate-800 uppercase">Barraca Online</h3><p className="text-[9px] font-bold text-slate-400 uppercase">Visibilidade e Pedidos</p></div>
                 </div>
                 <button onClick={() => setShowConfig(false)} className="p-2 bg-slate-50 rounded-full"><X size={20} /></button>
              </div>

              {/* ... Rest of config UI ... */}
              <div className="mb-6">
                 <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Foto de Capa</label>
                 <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden relative group transition-all hover:border-indigo-300">
                    {localConfig.imageUrl ? <img src={localConfig.imageUrl} className="w-full h-full object-cover" /> : <div className="text-center text-slate-300"><ImageIcon className="w-8 h-8 mx-auto mb-2" /><span className="text-[8px] font-black uppercase">Toque para adicionar</span></div>}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera className="text-white w-8 h-8" /></div>
                 </div>
                 <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
              </div>

              <div className="space-y-6">
                 <button onClick={() => setLocalConfig(prev => ({...prev, isPublic: !prev.isPublic}))} className={`w-full p-5 rounded-[2rem] border-2 transition-all flex items-center justify-between ${localConfig.isPublic ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="text-left"><p className={`text-xs font-black uppercase ${localConfig.isPublic ? 'text-emerald-700' : 'text-slate-500'}`}>{localConfig.isPublic ? 'Visível no App' : 'Oculto'}</p><p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Status da Barraca</p></div>
                    <div className={`w-12 h-7 rounded-full relative transition-all ${localConfig.isPublic ? 'bg-emerald-500' : 'bg-slate-300'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${localConfig.isPublic ? 'left-6' : 'left-1'}`} /></div>
                 </button>

                 <div className="space-y-3 p-4 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Info size={12} /> Detalhes</h4>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2">Endereço / Local</label><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input value={localConfig.address} onChange={e => setLocalConfig(prev => ({...prev, address: e.target.value}))} placeholder="Ex: Praça Central, Coreto" className="w-full p-3 pl-10 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-300" /></div></div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2">Informações / Sobre</label><textarea value={localConfig.description} onChange={e => setLocalConfig(prev => ({...prev, description: e.target.value}))} placeholder="Fale sobre seus produtos..." className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-300 resize-none h-20" /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2">Horário e Dias</label><div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input value={localConfig.openingHours} onChange={e => setLocalConfig(prev => ({...prev, openingHours: e.target.value}))} placeholder="Ex: Seg a Sex das 18h às 23h" className="w-full p-3 pl-10 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-300" /></div></div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-4 flex items-center gap-1"><MessageCircle size={10} /> Receber Pedidos</label>
                    <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                       <button onClick={() => setLocalConfig(prev => ({...prev, whatsappMode: 'SYSTEM'}))} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${localConfig.whatsappMode === 'SYSTEM' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>Do Perfil (Geral)</button>
                       <button onClick={() => setLocalConfig(prev => ({...prev, whatsappMode: 'MANUAL'}))} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${localConfig.whatsappMode === 'MANUAL' ? 'bg-white shadow-md text-orange-600' : 'text-slate-400'}`}>Outro Número</button>
                    </div>
                    {localConfig.whatsappMode === 'MANUAL' && (
                       <input value={localConfig.manualWhatsapp} onChange={e => setLocalConfig(prev => ({...prev, manualWhatsapp: e.target.value}))} placeholder="21999999999" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none border-2 border-orange-100 focus:border-orange-300" />
                    )}
                 </div>

                 <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-4 flex items-center gap-1"><Bike size={10} /> Tipo de Venda</label>
                    <div className="grid grid-cols-3 gap-2">
                       <button onClick={() => setLocalConfig(prev => ({...prev, fulfillmentMode: 'PICKUP'}))} className={`py-3 rounded-xl flex flex-col items-center gap-1 border-2 transition-all ${localConfig.fulfillmentMode === 'PICKUP' ? 'bg-white border-orange-200 text-orange-600 shadow-md' : 'bg-slate-50 border-transparent text-slate-400'}`}><ShoppingBag size={14} /> <span className="text-[7px] font-black uppercase">Retirada</span></button>
                       <button onClick={() => setLocalConfig(prev => ({...prev, fulfillmentMode: 'DELIVERY'}))} className={`py-3 rounded-xl flex flex-col items-center gap-1 border-2 transition-all ${localConfig.fulfillmentMode === 'DELIVERY' ? 'bg-white border-blue-200 text-blue-600 shadow-md' : 'bg-slate-50 border-transparent text-slate-400'}`}><Bike size={14} /> <span className="text-[7px] font-black uppercase">Entrega</span></button>
                       <button onClick={() => setLocalConfig(prev => ({...prev, fulfillmentMode: 'BOTH'}))} className={`py-3 rounded-xl flex flex-col items-center gap-1 border-2 transition-all ${localConfig.fulfillmentMode === 'BOTH' ? 'bg-white border-emerald-200 text-emerald-600 shadow-md' : 'bg-slate-50 border-transparent text-slate-400'}`}><StoreIcon size={14} /> <span className="text-[7px] font-black uppercase">Ambos</span></button>
                    </div>
                 </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                 <button onClick={handleUpdateSection} disabled={isSaving} className="w-full py-5 bg-indigo-600 text-white rounded-[1.8rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />} Salvar Configuração
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Success Modal with Print Option */}
      {successModal && successModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4 animate-in fade-in">
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
                      await printer.printReceipt(section.name, successModal.items, successModal.total, successModal.customer);
                      toast.success("Recibo impresso!", { id: toastId });
                    } catch (e: any) {
                      if (e.message === "IOS_NOT_SUPPORTED") {
                        toast.dismiss(toastId);
                        toast.error(
                          <div className="flex flex-col gap-2">
                            <p className="font-bold">Impressão Bluetooth não suportada no iPhone (Safari/Chrome).</p>
                            <p className="text-xs">Para imprimir, baixe o navegador gratuito <b>Bluefy</b> na App Store ou use a opção de compartilhar nota (em breve).</p>
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

      {/* Validation Error Modal */}
      {validationError && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[220] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                 <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">{validationError.title}</h3>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">{validationError.message}</p>
              
              <div className="grid gap-3">
                 {validationError.type === 'NEGATIVE_STOCK' && (
                    <>
                       <button 
                          onClick={() => { setValidationError(null); setTimeout(() => saveAllStock(true), 100); }} 
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
              </div>
            </div>
          </div>
        </div>
      )}

      {itemToEditDefault && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 shadow-3xl">
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">Quantidade Padrão</h3>
              <p className="text-[10px] font-bold text-slate-400 mb-6">Define quanto o funcionário "leva" automaticamente ao abrir a barraca.</p>
              
              <div className="space-y-4">
                 <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-between">
                    <span className="font-black text-xs uppercase text-slate-500">{itemToEditDefault.name}</span>
                 </div>
                 <input 
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    value={newDefaultQty}
                    onChange={e => setNewDefaultQty(e.target.value)}
                    className="w-full p-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl font-black text-center text-2xl outline-none text-indigo-700 focus:border-indigo-500 transition-all"
                    placeholder="0"
                 />
              </div>
              
              <div className="flex gap-3 mt-8">
                 <button onClick={() => setItemToEditDefault(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                 <button onClick={handleSaveDefaultQty} disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />} Salvar
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
