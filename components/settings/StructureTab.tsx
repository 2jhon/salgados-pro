
import React, { useState } from 'react';
import { Plus, Layout, Edit3, Trash2, Package, Store, Factory, Loader2 } from 'lucide-react';
import { AppSection } from '../../types';

interface StructureTabProps {
  sections: AppSection[];
  setShowSectionModal: (show: boolean) => void;
  setEditingSection: (section: AppSection) => void;
  deleteSection: (id: string) => Promise<void>;
}

export const StructureTab: React.FC<StructureTabProps> = ({ 
  sections, setShowSectionModal, setEditingSection, deleteSection 
}) => {
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
        <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Minhas Abas</h3>
        <button 
          onClick={() => setShowSectionModal(true)}
          className="w-12 h-12 bg-indigo-600 text-white rounded-2xl shadow-xl hover:scale-110 active:scale-90 transition-all flex items-center justify-center"
        >
          <Plus size={28} strokeWidth={3} />
        </button>
      </div>

      <div className="space-y-4 px-2">
        {sections.map((section) => (
          <div 
            key={section.id} 
            className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 flex items-center justify-between group hover:border-indigo-100 hover:shadow-md transition-all active:scale-[0.98]"
            onClick={() => setEditingSection(section)}
          >
            <div className="flex items-center gap-6">
              <div className={`w-16 h-16 ${getBgColor(section.type)} rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                {getIcon(section.type)}
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight leading-none mb-1">{section.name}</h4>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {section.type === 'FACTORY_STYLE' ? 'FÁBRICA' : section.type === 'STOCK_STYLE' ? 'ESTOQUE' : 'BARRACA'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
               <button 
                 onClick={() => setEditingSection(section)}
                 className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100"
               >
                 <Edit3 size={18} />
               </button>
               <button 
                 onClick={() => setConfirmDeleteSectionId(section.id)}
                 className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
               >
                 <Trash2 size={18} />
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
