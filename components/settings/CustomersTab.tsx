
import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Phone, History, Trash2, Edit3, UserCircle, ShoppingBag, Truck, FileText, Plus, X, Loader2 } from 'lucide-react';
import { Customer, Transaction } from '../../types';
import { supabase } from '../../lib/supabase';

interface CustomersTabProps {
  customers: Customer[];
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  clientSubTab: 'CLIENT' | 'SUPPLIER';
  setClientSubTab: (tab: 'CLIENT' | 'SUPPLIER') => void;
  showCustomerModal: boolean;
  setShowCustomerModal: (show: boolean) => void;
  editingCustomer: Customer | null;
  setEditingCustomer: (c: Customer | null) => void;
  removeCustomer: (id: string) => Promise<void>;
  showCustomerHistory: Customer | null;
  setShowCustomerHistory: (c: Customer | null) => void;
  customerForm: any;
  setCustomerForm: (form: any) => void;
  handleSaveCustomer: () => Promise<void>;
  isProcessing: boolean;
  transactions?: Transaction[];
}

export const CustomersTab: React.FC<CustomersTabProps> = ({
  customers, searchTerm, setSearchTerm, clientSubTab, setClientSubTab,
  showCustomerModal, setShowCustomerModal, editingCustomer, setEditingCustomer, removeCustomer, showCustomerHistory, setShowCustomerHistory, customerForm, setCustomerForm, handleSaveCustomer, isProcessing, transactions = []
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [serverHistory, setServerHistory] = useState<Transaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const filtered = customers.filter(c => 
    c.type === clientSubTab &&
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     (c.phone && c.phone.includes(searchTerm)))
  );

  useEffect(() => {
    if (showCustomerHistory) {
      setIsLoadingHistory(true);
      const fetchHistory = async () => {
        try {
          const { data } = await supabase.from('transactions')
            .select('*')
            .eq('workspace_id', showCustomerHistory.workspaceId.trim().toLowerCase())
            .ilike('customer_name', showCustomerHistory.name.trim())
            .order('date', { ascending: false });

          if (data) {
             const mapped = data.map(t => ({
               id: String(t.id),
               workspaceId: t.workspace_id,
               date: t.date || t.created_at,
               category: t.category,
               subCategory: t.sub_category,
               item: t.item,
               value: t.value || 0,
               isPending: t.is_pending,
               customerName: t.customer_name
             })) as Transaction[];
             setServerHistory(mapped);
          }
        } catch (e) {}
        setIsLoadingHistory(false);
      };
      fetchHistory();
    } else {
      setServerHistory([]);
    }
  }, [showCustomerHistory]);

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* Pills Container */}
      <div className="flex bg-slate-50 p-1.5 rounded-[1.5rem] w-full mb-6 relative">
        <button 
          onClick={() => setClientSubTab('CLIENT')}
          className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${clientSubTab === 'CLIENT' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}
        >
          Meus Clientes
        </button>
        <button 
          onClick={() => setClientSubTab('SUPPLIER')}
          className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${clientSubTab === 'SUPPLIER' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}
        >
          Meus Fornecedores
        </button>
      </div>

      {/* Search and Add Button */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text"
            placeholder={clientSubTab === 'CLIENT' ? 'BUSCAR CLIENTE...' : 'BUSCAR FORNECEDOR...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white pl-12 pr-6 py-4 rounded-[1.2rem] border-none shadow-sm focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800 placeholder:text-slate-400 uppercase outline-none"
          />
        </div>
        <button 
          onClick={() => {
             setEditingCustomer(null);
             setCustomerForm({ name: '', phone: '', type: clientSubTab });
             setShowCustomerModal(true);
          }}
          className="w-14 h-14 bg-indigo-600 text-white rounded-[1.2rem] shadow-sm flex items-center justify-center shrink-0 hover:bg-indigo-700 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* List Items */}
      <div className="space-y-3">
        {filtered.map(customer => (
          <div key={customer.id} className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-50 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center font-black text-xl uppercase">
                {customer.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-black text-slate-700 uppercase tracking-tight text-xs">{customer.name}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">
                  {customer.phone || 'Sem telefone'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 pr-2">
              <button 
                onClick={() => setShowCustomerHistory(customer)}
                className="p-2.5 text-indigo-400 bg-indigo-50 rounded-xl hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
              >
                <FileText size={16} />
              </button>
              <button 
                onClick={() => {
                   setEditingCustomer(customer);
                   setCustomerForm({ name: customer.name, phone: customer.phone, type: customer.type });
                   setShowCustomerModal(true);
                }}
                className="p-2.5 text-blue-400 bg-blue-50 rounded-xl hover:bg-blue-100 hover:text-blue-600 transition-colors"
              >
                <Edit3 size={16} />
              </button>
              <button 
                onClick={() => setShowConfirmDelete(customer.id)} 
                className="p-2.5 text-rose-400 bg-rose-50 rounded-xl hover:bg-rose-100 hover:text-rose-600 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-20 text-center bg-white/50 rounded-[2.5rem] border border-dashed border-slate-200 backdrop-blur-sm">
             <UserCircle size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum {clientSubTab === 'CLIENT' ? 'cliente' : 'fornecedor'} encontrado</p>
          </div>
        )}
      </div>

      {/* Customer Modal overlay */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                  {editingCustomer ? 'Editar' : 'Novo'} {clientSubTab === 'CLIENT' ? 'Cliente' : 'Fornecedor'}
                </h3>
                <button onClick={() => setShowCustomerModal(false)} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                 <input 
                   autoFocus 
                   value={customerForm.name} 
                   onChange={e => setCustomerForm({...customerForm, name: e.target.value})} 
                   className="w-full p-4 bg-slate-50 rounded-2xl font-black text-slate-700 uppercase text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-300" 
                   placeholder={`NOME DO ${clientSubTab === 'CLIENT' ? 'CLIENTE' : 'FORNECEDOR'}`} 
                 />
                 <input 
                   value={customerForm.phone} 
                   onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} 
                   className="w-full p-4 bg-slate-50 rounded-2xl font-black text-slate-700 uppercase text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-300" 
                   placeholder="WHATSAPP (OPCIONAL)" 
                 />
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowCustomerModal(false)} 
                  className="flex-1 py-4 text-slate-400 bg-slate-50 hover:bg-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveCustomer} 
                  disabled={isProcessing}
                  className="flex-[2] py-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex justify-center items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : null}
                  Salvar
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Customer History Modal */}
      {showCustomerHistory && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6 shrink-0">
                 <div>
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Histórico</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{showCustomerHistory.name}</p>
                 </div>
                 <button onClick={() => setShowCustomerHistory(null)} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors shrink-0">
                   <X size={20} />
                 </button>
              </div>

              <div className="bg-indigo-50 p-5 rounded-3xl shrink-0 mb-6 flex justify-between items-center">
                 <div>
                    <p className="text-[9px] font-black tracking-widest text-indigo-400 uppercase">Total Movimentado</p>
                    <p className="text-2xl font-black text-indigo-700 mt-1">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(serverHistory.reduce((acc, t) => acc + t.value, 0))}
                    </p>
                 </div>
                 <History className="text-indigo-200 w-12 h-12" />
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                 {isLoadingHistory && (
                     <div className="flex justify-center p-4">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                     </div>
                 )}
                 {serverHistory.filter(t => !t.isPending).map(t => (
                    <div key={t.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-transparent hover:border-slate-100 transition-all">
                       <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl text-white ${t.subCategory !== 'GASTOS' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                             {t.subCategory !== 'GASTOS' ? <Plus size={16} /> : <Trash2 size={16} />}
                          </div>
                          <div>
                             <p className="font-black text-slate-700 text-xs uppercase">{t.item}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(t.date).toLocaleDateString('pt-BR')} • {new Date(t.date).toLocaleTimeString('pt-BR')}</p>
                          </div>
                      </div>
                      <p className={`font-black text-xs ${t.subCategory !== 'GASTOS' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {t.subCategory !== 'GASTOS' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.value)}
                      </p>
                    </div>
                 ))}

                 {!isLoadingHistory && serverHistory.filter(t => !t.isPending).length === 0 && (
                    <div className="text-center py-10 bg-white/50 border border-slate-100 rounded-2xl">
                       <History className="mx-auto text-slate-200 mb-2 w-8 h-8" />
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma transação registrada</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

       {showConfirmDelete && (
         <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300 text-center">
               <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Trash2 size={32} />
               </div>
               <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Excluir Parceiro</h3>
               <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">
                 Certeza absoluta que deseja excluir permanentemente este parceiro?
               </p>
               
               <div className="flex gap-3">
                 <button 
                   onClick={() => setShowConfirmDelete(null)} 
                   className="flex-1 py-4 text-slate-400 bg-slate-50 hover:bg-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                 >
                   Cancelar
                 </button>
                 <button 
                   onClick={() => {
                     removeCustomer(showConfirmDelete);
                     setShowConfirmDelete(null);
                   }} 
                   className="flex-[2] py-4 bg-rose-500 text-white hover:bg-rose-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-500/20 transition-all"
                 >
                   Sim, excluir
                 </button>
               </div>
            </div>
         </div>
       )}

    </div>
  );
};
