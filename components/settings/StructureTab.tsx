
import React, { useState, useMemo } from 'react';
import { Plus, Layout, Edit3, Trash2, Package, Store, Factory, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { AppSection } from '../../types';
import { toast } from 'sonner';

interface StructureTabProps {
  sections: AppSection[];
  setShowSectionModal: (show: boolean) => void;
  setEditingSection: (section: AppSection) => void;
  deleteSection: (id: string) => Promise<void>;
  saveConfig?: (input: AppSection[] | ((prev: AppSection[]) => AppSection[])) => Promise<boolean>;
}

export const StructureTab: React.FC<StructureTabProps> = ({ 
  sections, setShowSectionModal, setEditingSection, deleteSection, saveConfig 
}) => {
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const visibleSections = useMemo(() => {
    return sections
      .filter(s => s.type !== 'SYSTEM_SETTINGS')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [sections]);

  const handleMoveSection = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= visibleSections.length || isReordering || !saveConfig) return;

    setIsReordering(true);
    try {
      const reordered = [...visibleSections];
      const movedItem = reordered[index];
      reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, movedItem);

      // Reatribui ordem sequencial (0, 1, 2...)
      const updatedVisible = reordered.map((sec, idx) => ({
        ...sec,
        order: idx
      }));

      // Preserva repartições ocultas/sistema
      const otherSections = sections.filter(s => s.type === 'SYSTEM_SETTINGS');
      const allSections = [...updatedVisible, ...otherSections];

      const success = await saveConfig(allSections);
      if (success) {
        toast.success(`Ordem de "${movedItem.name}" atualizada!`);
      }
    } catch (err) {
      console.error("Erro ao reordenar repartições:", err);
      toast.error("Erro ao sincronizar nova ordem.");
    } finally {
      setIsReordering(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'FACTORY_STYLE': return <Factory size={24} className="text-orange-600" />;
      case 'STOCK_STYLE': return <Package size={24} className="text-slate-600" />;
      default: return <Store size={24} className="text-blue-600" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'FACTORY_STYLE': return 'bg-orange-100';
      case 'STOCK_STYLE': return 'bg-slate-100';
      default: return 'bg-blue-100';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between px-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Minhas Abas</h3>
          <p className="text-xs font-bold text-slate-400">Organize a ordem de exibição das repartições</p>
        </div>
        <button 
          onClick={() => setShowSectionModal(true)}
          className="w-12 h-12 bg-indigo-600 text-white rounded-2xl shadow-xl hover:scale-110 active:scale-90 transition-all flex items-center justify-center"
          title="Nova Aba"
        >
          <Plus size={28} strokeWidth={3} />
        </button>
      </div>

      <div className="space-y-4 px-2">
        {visibleSections.map((section, index) => (
          <div 
            key={section.id} 
            className="bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-50 flex items-center justify-between group hover:border-indigo-100 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
            onClick={() => setEditingSection(section)}
          >
            <div className="flex items-center gap-3 sm:gap-6 min-w-0 pr-2">
              <div className={`w-12 h-12 sm:w-16 sm:h-16 ${getBgColor(section.type)} rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0`}>
                {getIcon(section.type)}
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-slate-800 text-base sm:text-lg uppercase tracking-tight leading-tight mb-1 truncate">{section.name}</h4>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {section.type === 'FACTORY_STYLE' ? 'FÁBRICA' : section.type === 'STOCK_STYLE' ? 'ESTOQUE' : 'BARRACA'}
                  </p>
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                    #{index + 1}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" onClick={e => e.stopPropagation()}>
               {/* Botões Verticais de Ordenação ↑ e ↓ */}
               {saveConfig && visibleSections.length > 1 && (
                 <div className="flex flex-col gap-1 mr-1">
                   <button 
                     onClick={() => handleMoveSection(index, 'UP')}
                     disabled={index === 0 || isReordering}
                     className="p-1.5 sm:p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100/80 hover:border-indigo-200 disabled:opacity-20 disabled:hover:bg-slate-50 disabled:hover:text-slate-400 disabled:cursor-not-allowed active:scale-90"
                     title="Subir posição"
                     aria-label="Subir posição"
                   >
                     <ArrowUp size={14} strokeWidth={2.5} />
                   </button>
                   <button 
                     onClick={() => handleMoveSection(index, 'DOWN')}
                     disabled={index === visibleSections.length - 1 || isReordering}
                     className="p-1.5 sm:p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100/80 hover:border-indigo-200 disabled:opacity-20 disabled:hover:bg-slate-50 disabled:hover:text-slate-400 disabled:cursor-not-allowed active:scale-90"
                     title="Descer posição"
                     aria-label="Descer posição"
                   >
                     <ArrowDown size={14} strokeWidth={2.5} />
                   </button>
                 </div>
               )}

               <button 
                 onClick={() => setEditingSection(section)}
                 className="p-2.5 sm:p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100 active:scale-95"
                 title="Editar repartição"
               >
                 <Edit3 size={16} className="sm:w-[18px] sm:h-[18px]" />
               </button>
               <button 
                 onClick={() => setConfirmDeleteSectionId(section.id)}
                 className="p-2.5 sm:p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 active:scale-95"
                 title="Excluir repartição"
               >
                 <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
               </button>
            </div>
          </div>
        ))}

        {sections.length === 0 && (
          <div className="py-20 text-center space-y-4">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Store className="text-slate-200" size={40} />
             </div>
             <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Nenhuma aba configurada</p>
          </div>
        )}
      </div>

      {confirmDeleteSectionId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300 text-center">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Excluir Repartição</h3>
            <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">
              Certeza que deseja apagar esta seção? O histórico nela pode ser comprometido.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteSectionId(null)} 
                className="flex-1 py-4 text-slate-400 bg-slate-50 hover:bg-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  setIsDeleting(true);
                  await deleteSection(confirmDeleteSectionId);
                  setIsDeleting(false);
                  setConfirmDeleteSectionId(null);
                }}
                disabled={isDeleting}
                className="flex-1 py-4 text-white bg-rose-600 hover:bg-rose-700 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center shadow-lg shadow-rose-600/20 disabled:animate-pulse"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
