
import React, { useState, useMemo, useEffect } from 'react';
import { AppSection, ConfigItem, StockMode, StockMovement, User } from '../types';
import { ScrollContainer } from './ScrollContainer';
import { 
  Package, Search, AlertCircle, TrendingDown, 
  ArrowRightLeft, Settings2, Check, X, Plus, Minus,
  Globe, Layout, ShoppingCart, Box, Info, ChevronRight,
  PlusCircle, Save, Loader2, Link as LinkIcon, History, Filter, Trash2
} from 'lucide-react';
import { supabase, registerStockMovement, upsertInventory } from '../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

interface StockProps {
  sections: AppSection[];
  saveConfig: (s: AppSection[]) => Promise<boolean>;
  workspaceId: string;
  user: User;
  adjustStockItem: (sectionId: string, itemId: string, amount: number, reason: string, userName: string) => Promise<boolean>;
}

export const Stock: React.FC<StockProps> = ({ sections, saveConfig, workspaceId, user, adjustStockItem }) => {
  const [activeTab, setActiveTab] = useState<'CURRENT' | 'HISTORY'>('CURRENT');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Estado para armazenar ajustes pendentes antes de salvar
  const [stagedAdjustments, setStagedAdjustments] = useState<Record<string, { amount: number, sectionId: string }>>({});
  const [isSavingAdjustment, setIsSavingAdjustment] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', currentStock: '', minStock: '' });

  // Seções de venda disponíveis para vincular
  const salesSections = React.useMemo(() => sections.filter(s => s.type !== 'STOCK_STYLE'), [sections]);
  
  const allStockSections = React.useMemo(() => sections.filter(s => s.type === 'STOCK_STYLE'), [sections]);
  const firstStockSection = allStockSections[0];
  const globalMode = firstStockSection?.globalStockMode || 'GLOBAL';
  
  const [activeStockSectionId, setActiveStockSectionId] = useState<string>(firstStockSection?.id || '');

  useEffect(() => {
    if (allStockSections.length > 0 && !activeStockSectionId) {
      setActiveStockSectionId(allStockSections[0].id);
    }
  }, [allStockSections, activeStockSectionId]);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchMovements();
    }
  }, [activeTab, workspaceId]);

  const fetchMovements = async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMovements(data || []);
    } catch (err) {
      console.error('Error fetching stock movements:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const stockItems = React.useMemo(() => {
    const items: { sectionName: string; sectionId: string; item: ConfigItem; linkedTo?: string }[] = [];
    
    sections.forEach(s => {
      if (s.type === 'STOCK_STYLE') {
        // No modo global, mostra tudo. No modo local, mostra apenas da seção ativa.
        if (globalMode === 'GLOBAL' || s.id === activeStockSectionId) {
          const sectionItems = [...(s.items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
          sectionItems.forEach(i => {
            if (i.name.toLowerCase().includes(searchTerm.toLowerCase())) {
              const linkedSection = salesSections.find(ss => ss.id === s.linkedSectionId);
              items.push({ 
                sectionName: s.name, 
                sectionId: s.id, 
                item: i,
                linkedTo: linkedSection?.name
              });
            }
          });
        }
      }
    });
    return items;
  }, [sections, searchTerm, globalMode, activeStockSectionId, salesSections]);

  const toggleGlobalMode = async (mode: StockMode) => {
    let updatedSections = [...sections];
    
    // Se não existir nenhuma seção de estoque, cria uma padrão para poder salvar o modo
    if (allStockSections.length === 0) {
      const newStockSection: AppSection = {
        id: 'stock_' + Date.now(),
        workspaceId,
        name: 'Estoque Central',
        type: 'STOCK_STYLE',
        order: sections.length,
        items: [],
        expenses: [],
        globalStockMode: mode
      };
      updatedSections.push(newStockSection);
      setActiveStockSectionId(newStockSection.id);
    } else {
      // Se já existem seções, atualiza o modo em todas as seções de estoque
      updatedSections = sections.map(s => 
        s.type === 'STOCK_STYLE' ? { ...s, globalStockMode: mode } : s
      );
    }

    await saveConfig(updatedSections);
  };

  const handleLinkSection = async (stockSectionId: string, linkedId: string) => {
    const updatedSections = sections.map(s => 
      s.id === stockSectionId ? { ...s, linkedSectionId: linkedId } : s
    );
    await saveConfig(updatedSections);
  };

  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;

    let targetSectionId = globalMode === 'LOCAL' ? activeStockSectionId : allStockSections[0]?.id;
    let finalSections = [...sections];

    // Garantia de que existe uma seção alvo
    if (!targetSectionId) {
      const autoSection: AppSection = {
        id: 'stock_auto_' + Date.now(),
        workspaceId,
        name: 'Estoque Central',
        type: 'STOCK_STYLE',
        order: sections.length,
        items: [],
        expenses: [],
        globalStockMode: globalMode
      };
      finalSections.push(autoSection);
      targetSectionId = autoSection.id;
      setActiveStockSectionId(autoSection.id);
    }

    try {
      const stockVal = (newItem.currentStock || "").replace(',', '.');
      const minVal = (newItem.minStock || "").replace(',', '.');

      const itemData: ConfigItem = {
        id: `stock_${Date.now()}`,
        name: newItem.name.trim(),
        currentStock: parseFloat(stockVal) || 0,
        minStock: parseFloat(minVal) || 0,
        order: (finalSections.find(s => s.id === targetSectionId)?.items?.length || 0),
        trackStock: true
      };

      const updatedSections = finalSections.map(s => {
        if (s.id === targetSectionId) {
          const currentItems = s.items || [];
          return { ...s, items: [...currentItems, itemData] };
        }
        return s;
      });

      setIsAddModalOpen(false);
      setNewItem({ name: '', currentStock: '', minStock: '' });
      await saveConfig(updatedSections);
      
      // Upsert to inventory table
      await upsertInventory(workspaceId, targetSectionId, itemData.id, itemData.currentStock || 0, itemData.minStock);
    } catch (err) {
      console.error("Estoque: Erro ao processar novo item:", err);
    }
  };

  const updateItemStock = async (sectionId: string, itemId: string, updates: Partial<ConfigItem>, reason: 'MANUAL_ADJUSTMENT' | 'LOSS' = 'MANUAL_ADJUSTMENT') => {
    let oldStock = 0;
    let newStock = 0;
    let itemName = '';

    const updatedSections = sections.map(s => {
      if (s.id !== sectionId) return s;
      const currentItems = s.items || [];
      const newItems = currentItems.map(item => {
        if (item.id === itemId) {
          oldStock = item.currentStock || 0;
          newStock = updates.currentStock !== undefined ? updates.currentStock : oldStock;
          itemName = item.name;
          return { ...item, ...updates };
        }
        return item;
      });
      return { ...s, items: newItems };
    });

    await saveConfig(updatedSections);
    setIsEditing(null);

    // Upsert to inventory table
    if (updates.currentStock !== undefined || updates.minStock !== undefined) {
      await upsertInventory(
        workspaceId, 
        sectionId, 
        itemId, 
        newStock, 
        updates.minStock
      );
    }

    // Register movement if stock changed
    if (updates.currentStock !== undefined && oldStock !== newStock) {
      const quantity = Math.abs(newStock - oldStock);
      const type = newStock > oldStock ? 'IN' : 'OUT';
      await registerStockMovement({
        workspace_id: workspaceId,
        item_id: itemId,
        item_name: itemName,
        movement_type: type,
        reason: reason,
        quantity: quantity,
        previous_balance: oldStock,
        new_balance: newStock,
        created_by: user.name
      });
      if (activeTab === 'HISTORY') fetchMovements();
    }
  };

  const handleStageAdjustment = (itemId: string, amount: number, sectionId: string) => {
    console.log(`[STOCK_DEBUG] handleStageAdjustment - item: ${itemId}, amount: ${amount}`);
    setStagedAdjustments(prev => {
      const current = prev[itemId] || { amount: 0, sectionId };
      const nextAmount = current.amount + amount;
      console.log(`[STOCK_DEBUG] Staged update for ${itemId}: ${current.amount} -> ${nextAmount}`);
      if (nextAmount === 0) {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      }
      return {
        ...prev,
        [itemId]: { amount: nextAmount, sectionId }
      };
    });
  };

  const handleCommitAll = async () => {
    const itemsToCommit = Object.entries(stagedAdjustments);
    if (itemsToCommit.length === 0) return;

    setIsSavingAdjustment('ALL');
    try {
      // Agrupar por seção para maior eficiência se necessário, mas adjustStockItem resolve um a um com histórico correto
      for (const [itemId, data] of itemsToCommit) {
        const itemData = data as { amount: number, sectionId: string };
        await adjustStockItem(itemData.sectionId, itemId, itemData.amount, 'MANUAL_ADJUSTMENT', user.name);
      }
      
      setStagedAdjustments({});
      toast.success(`${itemsToCommit.length} itens atualizados com sucesso!`);
    } catch (err) {
      console.error("Erro ao salvar ajustes em lote:", err);
      toast.error("Erro ao salvar alguns ajustes.");
    } finally {
      setIsSavingAdjustment(null);
    }
  };

  const handleCommitAdjustment = async (sectionId: string, itemId: string) => {
    const data = stagedAdjustments[itemId];
    console.log(`[STOCK_DEBUG] handleCommitAdjustment clicked for ${itemId}. Data:`, data);
    if (!data || data.amount === 0) return;

    setIsSavingAdjustment(itemId);
    try {
      console.log(`[STOCK_DEBUG] Calling adjustStockItem for ${itemId} with amount ${data.amount}`);
      const success = await adjustStockItem(sectionId, itemId, data.amount, 'MANUAL_ADJUSTMENT', user.name);
      console.log(`[STOCK_DEBUG] adjustStockItem result for ${itemId}: ${success}`);
      if (success) {
        setStagedAdjustments(prev => {
          const newState = { ...prev };
          delete newState[itemId];
          return newState;
        });
      }
    } catch (err) {
      console.error("[STOCK_DEBUG] Erro ao salvar ajuste de estoque:", err);
    } finally {
      setIsSavingAdjustment(null);
    }
  };

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const handleClearHistory = async () => {
    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      // Auto cancel after 3 seconds if not clicked again
      setTimeout(() => setIsConfirmingClear(false), 3000);
      return;
    }

    try {
      setIsLoadingHistory(true);
      const { error } = await supabase
        .from('stock_movements')
        .delete()
        .eq('workspace_id', workspaceId);

      if (error) throw error;
      
      setMovements([]);
      setIsConfirmingClear(false);
      toast.success("Histórico de estoque limpo com sucesso!");
    } catch (err) {
      console.error("Erro ao limpar histórico:", err);
      toast.error("Falha ao limpar histórico.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const currentActiveSection = sections.find(s => s.id === activeStockSectionId);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Cabeçalho */}
      <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start gap-6">
          <div>
            <h2 className="text-2xl font-black mb-1">Central de Estoque</h2>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Controle de Inventário</p>
          </div>
          
          <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Como abater as vendas?</span>
            <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700 w-full sm:w-auto">
              <button 
                onClick={() => toggleGlobalMode('GLOBAL')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-tighter flex items-center justify-center gap-2 transition-all ${
                  globalMode === 'GLOBAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Globe className="w-3 h-3" /> Único (Tudo)
              </button>
              <button 
                onClick={() => toggleGlobalMode('LOCAL')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-tighter flex items-center justify-center gap-2 transition-all ${
                  globalMode === 'LOCAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Layout className="w-3 h-3" /> Separado (Aba)
              </button>
            </div>
          </div>
        </div>
        <Package className="w-32 h-32 absolute -right-8 -bottom-8 text-white opacity-5" />
      </div>

      {/* Tabs */}
      <ScrollContainer className="flex px-2 mb-6 no-scrollbar">
        <div className="flex bg-slate-200/50 p-1 rounded-2xl w-full sm:w-auto min-w-[300px]">
          <button
            onClick={() => setActiveTab('CURRENT')}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              activeTab === 'CURRENT' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Package className="w-4 h-4" /> Saldo Atual
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              activeTab === 'HISTORY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4" /> Histórico
          </button>
        </div>
      </ScrollContainer>

      {activeTab === 'CURRENT' ? (
        <>
          {/* Painel de Vínculo - Visível apenas no modo Separado */}
          {globalMode === 'LOCAL' && (
            <div className="px-2 animate-in slide-in-from-top-4 duration-500">
               <div className="bg-white p-6 rounded-[2.5rem] border-2 border-indigo-100 shadow-xl shadow-indigo-900/5">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                      <LinkIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">Vínculo de Aba</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Defina qual aba este estoque atende</p>
                    </div>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4 items-end">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase ml-2 flex items-center gap-1">
                        <Box className="w-3 h-3" /> Sua Área de Estoque
                      </label>
                      <select 
                        value={activeStockSectionId}
                        onChange={(e) => setActiveStockSectionId(e.target.value)}
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 text-xs outline-none focus:ring-4 focus:ring-indigo-50"
                      >
                        {allStockSections.length > 0 ? (
                          allStockSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                        ) : (
                          <option value="">Aguardando criação...</option>
                        )}
                      </select>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-indigo-600 uppercase ml-2 flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" /> Atende as vendas de:
                      </label>
                      <select 
                        value={currentActiveSection?.linkedSectionId || ''}
                        onChange={(e) => handleLinkSection(activeStockSectionId, e.target.value)}
                        className="w-full p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl font-black text-indigo-700 text-xs outline-none focus:bg-white transition-all shadow-inner"
                      >
                        <option value="">NENHUM VÍNCULO (NÃO ABATE)</option>
                        {salesSections.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name.toUpperCase()} ({s.type === 'FACTORY_STYLE' ? 'FÁBRICA' : 'BARRACA'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-6 flex items-start gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                     <Info className="w-4 h-4 text-indigo-500 mt-0.5" />
                     <p className="text-[9px] font-bold text-indigo-800 uppercase leading-relaxed tracking-tight">
                       Ao selecionar uma aba acima, todas as vendas registradas nela <span className="underline">reduzirão automaticamente</span> o saldo dos produtos desta lista.
                     </p>
                  </div>
               </div>
            </div>
          )}

          {/* Busca e Botão Adicionar */}
          <div className="flex gap-2 px-4 py-2 sticky top-0 z-40 bg-slate-50 -mx-2">
            <div className="relative flex-1 group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input 
                type="text"
                placeholder="Buscar no estoque..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-4 pl-14 bg-white rounded-2xl shadow-sm border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-50 font-bold text-slate-700 transition-all"
              />
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase hidden sm:inline">Adicionar</span>
            </button>
          </div>

          <ScrollContainer className="flex overflow-x-auto gap-4 pb-12 snap-x snap-mandatory px-4 -mx-4 no-scrollbar">
            {stockItems.length === 0 ? (
              <div className="p-16 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 w-full min-w-[300px]">
                <Box className="w-16 h-16 text-slate-100 mx-auto mb-6" />
                <h3 className="text-slate-800 font-black text-lg mb-2">Estoque Vazio</h3>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest max-w-[200px] mx-auto leading-relaxed">
                  Adicione produtos para começar o controle de inventário.
                </p>
              </div>
            ) : (
                stockItems.map(({ sectionName, sectionId, item, linkedTo }) => {
                  const current = item.currentStock ?? 0;
                  const min = item.minStock ?? 0;
                  const isLow = current <= min && min > 0;

                  return (
                    <div key={`${sectionId}-${item.id}`} className={`snap-start shrink-0 w-[300px] bg-white p-6 rounded-[2.5rem] shadow-xl border transition-all duration-300 ${isLow ? 'border-red-200 ring-8 ring-red-50/50' : 'border-slate-50'}`}>
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1 items-center">
                              {item.imageUrl ? (
                                <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                                  <img src={item.imageUrl} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className={`p-4 rounded-2xl ${isLow ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                                  <Package className="w-6 h-6" />
                                </div>
                              )}
                            </div>
                            
                            <div className="text-left">
                              <h4 className="font-black text-slate-800 text-lg leading-tight truncate w-32">{item.name}</h4>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full">{sectionName}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                      <div className="flex items-center justify-between gap-6">
                        <div className="flex-1 relative">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Saldo Atual</p>
                          {isEditing === item.id ? (
                            <div className="flex items-center gap-2 animate-in zoom-in-95">
                              <input 
                                autoFocus
                                type="number" 
                                value={editValue} 
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full p-4 bg-slate-100 rounded-2xl font-black text-2xl text-center outline-none border-2 border-indigo-500"
                              />
                            </div>
                          ) : (
                            <div className="relative">
                              <div 
                                onClick={() => { setIsEditing(item.id); setEditValue(current.toString()); }}
                                className={`p-5 rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all ${isLow ? 'bg-red-50 border-2 border-red-100' : 'bg-slate-50 hover:bg-indigo-50 hover:scale-[1.02]'}`}
                              >
                                <span className={`text-4xl font-black ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                                  {current}
                                </span>
                                {stagedAdjustments[item.id] !== undefined && stagedAdjustments[item.id].amount !== 0 && (
                                  <div className="absolute -top-1 -right-1 bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg animate-in zoom-in">
                                    {stagedAdjustments[item.id].amount > 0 ? '+' : ''}{stagedAdjustments[item.id].amount}
                                  </div>
                                )}
                              </div>

                              {/* Barra de Confirmação de Ajuste */}
                              {stagedAdjustments[item.id] !== undefined && stagedAdjustments[item.id].amount !== 0 && (
                                <div className="absolute -bottom-10 left-0 right-0 flex items-center gap-2 animate-in slide-in-from-top-2">
                                  <button 
                                    onClick={() => handleCommitAdjustment(sectionId, item.id)}
                                    disabled={isSavingAdjustment === item.id || isSavingAdjustment === 'ALL'}
                                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50"
                                  >
                                    {isSavingAdjustment === item.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Ok
                                  </button>
                                  <button 
                                    onClick={() => setStagedAdjustments(prev => { const n = {...prev}; delete n[item.id]; return n; })}
                                    className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className={`flex flex-col gap-2 transition-all ${stagedAdjustments[item.id] ? 'opacity-40 hover:opacity-100' : ''}`}>
                           <button onClick={() => handleStageAdjustment(item.id, 10, sectionId)} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-[9px] active:scale-90 transition-all hover:bg-indigo-600 hover:text-white">+10</button>
                           <button onClick={() => handleStageAdjustment(item.id, -10, sectionId)} className="p-3 bg-red-50 text-red-600 rounded-2xl font-black text-[9px] active:scale-90 transition-all hover:bg-red-600 hover:text-white">-10</button>
                           <button onClick={() => {
                             const lossAmount = window.prompt(`Registrar perda para ${item.name}:\nQuantos itens foram perdidos/estragaram?`);
                             if (lossAmount && !isNaN(parseFloat(lossAmount))) {
                               const amount = parseFloat(lossAmount);
                               if (amount > 0) {
                                 adjustStockItem(sectionId, item.id, -amount, 'LOSS', user.name);
                               }
                             }
                           }} className="p-3 bg-orange-50 text-orange-600 rounded-2xl font-black text-[8px] active:scale-90 transition-all hover:bg-orange-600 hover:text-white" title="Registrar Perda">
                             <TrendingDown className="w-4 h-4 mx-auto" />
                           </button>
                        </div>
                      </div>

                      <div className={`flex items-center justify-between mt-6 pt-4 border-t border-slate-50 transition-all ${stagedAdjustments[item.id] && stagedAdjustments[item.id].amount !== 0 ? 'mt-12' : ''}`}>
                        <div className="flex items-center gap-2">
                          <AlertCircle className={`w-3 h-3 ${isLow ? 'text-red-600' : 'text-slate-300'}`} />
                          <input 
                            type="number"
                            defaultValue={min}
                            onBlur={(e) => updateItemStock(sectionId, item.id, { minStock: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                            className="w-12 bg-slate-100 p-1 rounded font-black text-slate-800 text-[10px] text-center outline-none border border-slate-200 focus:border-indigo-300"
                          />
                        </div>
                        {isLow && (
                          <span className="text-[8px] font-black text-red-600 uppercase tracking-widest animate-pulse">Reabastecer</span>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </ScrollContainer>
        </>
      ) : (
        <div className="px-2 animate-in fade-in duration-500">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                Histórico de Movimentações
              </h3>
              <div className="flex items-center gap-2">
                {user.role === 'OWNER' && movements.length > 0 && (
                  <button 
                    onClick={handleClearHistory}
                    className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 border ${
                      isConfirmingClear 
                        ? "bg-red-600 text-white border-red-700 animate-pulse" 
                        : "bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white"
                    }`}
                  >
                    <Trash2 className="w-3 h-3" /> 
                    {isConfirmingClear ? "Certeza? Clique novamente" : "Limpar Histórico"}
                  </button>
                )}
                <button onClick={fetchMovements} className="p-2 text-slate-400 hover:text-indigo-600 bg-white rounded-xl shadow-sm border border-slate-100">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {isLoadingHistory ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : movements.length === 0 ? (
              <div className="p-16 text-center">
                <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 font-bold text-sm">Nenhuma movimentação registrada ainda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                      <th className="p-4 pl-6">Data</th>
                      <th className="p-4">Item</th>
                      <th className="p-4">Tipo</th>
                      <th className="p-4 text-right">Qtd</th>
                      <th className="p-4 text-center">Saldo</th>
                      <th className="p-4 pr-6">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium text-slate-700">
                    {movements.map((mov) => (
                      <tr key={mov.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 pl-6 whitespace-nowrap">
                          <div className="text-xs font-bold text-slate-800">
                            {mov.created_at ? format(new Date(mov.created_at), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {mov.created_at ? format(new Date(mov.created_at), "HH:mm", { locale: ptBR }) : '-'}
                          </div>
                        </td>
                        <td className="p-4 font-black text-slate-800">{mov.item_name}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {mov.movement_type === 'IN' ? (
                              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Plus className="w-3 h-3" /></span>
                            ) : (
                              <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center"><Minus className="w-3 h-3" /></span>
                            )}
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                              {mov.reason === 'PRODUCTION' ? 'Produção' : 
                               mov.reason === 'SALE' ? 'Venda' : 
                               mov.reason === 'LOSS' ? 'Perda' : 
                               mov.reason === 'RETURN' ? 'Devolução' : 'Ajuste'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-right font-black">
                          <span className={mov.movement_type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                            {mov.movement_type === 'IN' ? '+' : '-'}{mov.quantity}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400">
                            <span>{mov.previous_balance}</span>
                            <ArrowRightLeft className="w-3 h-3" />
                            <span className="text-slate-800">{mov.new_balance}</span>
                          </div>
                        </td>
                        <td className="p-4 pr-6 text-xs text-slate-500">{mov.created_by || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Adicionar Item */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><PlusCircle className="w-5 h-5" /></div>
                <h3 className="font-black text-slate-800 text-lg">Novo Item</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleAddNewItem} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-4">Nome do Produto</label>
                <input 
                  autoFocus
                  required
                  type="text"
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  placeholder="Ex: Massa de Coxinha"
                  className="w-full p-4 bg-slate-100 rounded-2xl font-bold outline-none border-2 border-slate-200 focus:border-indigo-500 transition-all" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-4">Saldo Inicial</label>
                  <input 
                    type="text"
                    inputMode="decimal"
                    value={newItem.currentStock}
                    onChange={e => setNewItem({...newItem, currentStock: e.target.value})}
                    placeholder="0"
                    className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-2xl font-black text-center text-xl outline-none focus:bg-white focus:border-indigo-300 transition-all" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-4">Estoque Mínimo</label>
                  <input 
                    type="text"
                    inputMode="decimal"
                    value={newItem.minStock}
                    onChange={e => setNewItem({...newItem, minStock: e.target.value})}
                    placeholder="10"
                    className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-2xl font-black text-center text-xl outline-none focus:bg-white focus:border-indigo-300 transition-all" 
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-6">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" />
                  Cadastrar Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Botão Flutuante de Salvar Tudo (Bulk Commit) */}
      {Object.keys(stagedAdjustments).length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10">
          <button 
            onClick={handleCommitAll}
            disabled={isSavingAdjustment === 'ALL'}
            className="bg-indigo-600 text-white px-8 py-4 rounded-full shadow-2xl shadow-indigo-200 border-4 border-white flex items-center gap-3 font-black uppercase text-xs tracking-widest hover:bg-indigo-700 active:scale-95 transition-all"
          >
            {isSavingAdjustment === 'ALL' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Salvar {Object.keys(stagedAdjustments).length} Alterações
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
