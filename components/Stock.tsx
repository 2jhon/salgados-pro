
import React, { useState, useMemo, useEffect } from 'react';
import { AppSection, ConfigItem, StockMode } from '../types';
import { 
  Package, Search, AlertCircle, TrendingDown, 
  ArrowRightLeft, Settings2, Check, X, Plus, Minus,
  Globe, Layout, ShoppingCart, Box, Info, ChevronRight,
  PlusCircle, Save, Loader2, Link as LinkIcon
} from 'lucide-react';

interface StockProps {
  sections: AppSection[];
  saveConfig: (s: AppSection[]) => Promise<void>;
  /* Fix: Add workspaceId to props */
  workspaceId: string;
}

export const Stock: React.FC<StockProps> = ({ sections, saveConfig, workspaceId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', currentStock: '', minStock: '' });

  // Seções de venda disponíveis para vincular
  const salesSections = useMemo(() => sections.filter(s => s.type !== 'STOCK_STYLE'), [sections]);
  
  const allStockSections = useMemo(() => sections.filter(s => s.type === 'STOCK_STYLE'), [sections]);
  const firstStockSection = allStockSections[0];
  const globalMode = firstStockSection?.globalStockMode || 'GLOBAL';
  
  const [activeStockSectionId, setActiveStockSectionId] = useState<string>(firstStockSection?.id || '');

  useEffect(() => {
    if (allStockSections.length > 0 && !activeStockSectionId) {
      setActiveStockSectionId(allStockSections[0].id);
    }
  }, [allStockSections, activeStockSectionId]);

  const stockItems = useMemo(() => {
    const items: { sectionName: string; sectionId: string; item: ConfigItem; linkedTo?: string }[] = [];
    
    sections.forEach(s => {
      if (s.type === 'STOCK_STYLE') {
        // No modo global, mostra tudo. No modo local, mostra apenas da seção ativa.
        if (globalMode === 'GLOBAL' || s.id === activeStockSectionId) {
          const sectionItems = s.items || [];
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
        /* Fix: Include workspaceId */
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
        /* Fix: Include workspaceId */
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
      saveConfig(updatedSections);
    } catch (err) {
      console.error("Estoque: Erro ao processar novo item:", err);
    }
  };

  const updateItemStock = async (sectionId: string, itemId: string, updates: Partial<ConfigItem>) => {
    const updatedSections = sections.map(s => {
      if (s.id !== sectionId) return s;
      const currentItems = s.items || [];
      const newItems = currentItems.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      );
      return { ...s, items: newItems };
    });

    saveConfig(updatedSections);
    setIsEditing(null);
  };

  const quickAdjustment = async (sectionId: string, itemId: string, current: number, amount: number) => {
    await updateItemStock(sectionId, itemId, { currentStock: Math.max(0, current + amount) });
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
      <div className="flex gap-2 px-2">
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

      {/* Grid de Itens */}
      <div className="grid gap-4 px-2">
        {stockItems.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <Box className="w-16 h-16 text-slate-100 mx-auto mb-6" />
            <h3 className="text-slate-800 font-black text-lg mb-2">Estoque Vazio</h3>
            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest max-w-[200px] mx-auto leading-relaxed">
              Adicione produtos para começar o controle de inventário.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {stockItems.map(({ sectionName, sectionId, item, linkedTo }) => {
              const current = item.currentStock ?? 0;
              const min = item.minStock ?? 0;
              const isLow = current <= min && min > 0;

              return (
                <div key={`${sectionId}-${item.id}`} className={`bg-white p-6 rounded-[2.5rem] shadow-xl border transition-all duration-300 ${isLow ? 'border-red-200 ring-8 ring-red-50/50' : 'border-slate-50'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl ${isLow ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-lg leading-tight">{item.name}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full">{sectionName}</span>
                          {globalMode === 'LOCAL' && linkedTo && (
                            <span className="text-[8px] font-black text-indigo-500 uppercase px-2 py-0.5 bg-indigo-50 rounded-full flex items-center gap-1">
                              <LinkIcon className="w-2 h-2" /> {linkedTo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-6">
                    <div className="flex-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Saldo Atual</p>
                      {isEditing === item.id ? (
                        <div className="flex items-center gap-2 animate-in zoom-in-95">
                          <input 
                            autoFocus
                            type="number" 
                            value={editValue} 
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full p-4 bg-slate-200 rounded-2xl font-black text-2xl text-center outline-none border-2 border-indigo-500"
                          />
                          <div className="flex flex-col gap-1">
                            <button onClick={() => updateItemStock(sectionId, item.id, { currentStock: parseFloat(editValue.replace(',', '.')) || 0 })} className="p-3 bg-green-600 text-white rounded-xl shadow-lg"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setIsEditing(null)} className="p-3 bg-slate-200 text-slate-500 rounded-xl"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => { setIsEditing(item.id); setEditValue(current.toString()); }}
                          className={`p-5 rounded-3xl flex items-center justify-center cursor-pointer transition-all ${isLow ? 'bg-red-50 border-2 border-red-100' : 'bg-slate-50 hover:bg-indigo-50 hover:scale-[1.02]'}`}
                        >
                          <span className={`text-4xl font-black ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                            {current}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                       <button onClick={() => quickAdjustment(sectionId, item.id, current, 10)} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-[10px] active:scale-90 transition-all hover:bg-indigo-600 hover:text-white">+10</button>
                       <button onClick={() => quickAdjustment(sectionId, item.id, current, -10)} className="p-3 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] active:scale-90 transition-all hover:bg-red-600 hover:text-white">-10</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <AlertCircle className={`w-3 h-3 ${isLow ? 'text-red-600' : 'text-slate-300'}`} />
                      <span className="text-[9px] font-black text-slate-400 uppercase">Aviso Mínimo:</span>
                      <input 
                        type="number"
                        defaultValue={min}
                        onBlur={(e) => updateItemStock(sectionId, item.id, { minStock: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                        className="w-10 bg-transparent font-black text-slate-800 text-[10px] outline-none border-b border-transparent focus:border-indigo-200"
                      />
                    </div>
                    {isLow && (
                      <span className="text-[8px] font-black text-red-600 uppercase tracking-widest animate-pulse">Reabastecer</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                  className="w-full p-4 bg-slate-200 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" 
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
                    className="w-full p-4 bg-slate-200 rounded-2xl font-black text-center text-xl outline-none focus:bg-white transition-all" 
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
                    className="w-full p-4 bg-slate-200 rounded-2xl font-black text-center text-xl outline-none focus:bg-white transition-all" 
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
    </div>
  );
};
