
import React, { useState, useRef, useEffect } from 'react';
import { AppSection, User, Transaction, Ad, StoreProfile, Customer } from '../types';
import { useSettingsLogic } from '../hooks/useSettingsLogic';
import { StructureTab } from './settings/StructureTab';
import { VitrineContainer } from './settings/VitrineContainer';
import { CustomersTab } from './settings/CustomersTab';
import { TeamTab } from './settings/TeamTab';
import { AdsTab } from './settings/AdsTab';
import { SystemTab } from './settings/SystemTab';
import { PlansTab } from './settings/PlansTab';
import { StoreProfileSettings } from './StoreProfileSettings';
import { CouponManager } from './CouponManager';
import { AuditLog } from './AuditLog';
import { 
  Layout, Users, Megaphone, Settings as SettingsIcon,
  Trash2, Package, UserCircle, ShoppingBag, Truck, Calendar,
  Rocket, Database, Zap, BarChart3, History, X, Check, EyeOff, Loader2, Camera, Store,
  Fingerprint, Bell, LogOut, Edit3
} from 'lucide-react';

interface SettingsProps {
  sections: AppSection[];
  saveConfig: (sections: AppSection[]) => Promise<boolean>;
  deleteSection: (id: string) => Promise<void>;
  users: User[];
  addUser: (user: Omit<User, 'id'>) => Promise<User | null>;
  removeUser: (id: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  transactions: Transaction[];
  clearTransactions: (period: 'day' | 'week' | 'month' | 'all' | 'custom', wid: string, customRange?: { start: string, end: string }, categoryFilter?: string[]) => Promise<void>;
  archiveYear: (wid: string, year: number) => Promise<number>;
  currentUser: User;
  companyProfile: StoreProfile | null;
  onSaveProfile: (profile: Partial<StoreProfile> & { workspaceId: string }) => Promise<StoreProfile | null>;
  ads: Ad[];
  saveAd: (ad: Partial<Ad> & { ownerId: string, workspaceId: string }) => Promise<Ad | null>;
  deleteAd: (id: string) => Promise<boolean>;
  onNavigate: (tab: string) => void;
  isGodModeUnlocked?: boolean;
  onUnlockGodMode: () => void;
  addNote?: (note: any) => Promise<boolean>;
  onDirtyChange?: (isDirty: boolean) => void;
  customers: Customer[];
  addCustomer: (name: string, phone?: string, type?: 'CLIENT' | 'SUPPLIER') => Promise<Customer | null>;
  removeCustomer: (id: string) => Promise<void>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
}

export const Settings: React.FC<SettingsProps> = (props) => {
  const {
    activeTab, setActiveTab,
    isMarketplaceDirty, setIsMarketplaceDirty,
    isProcessing, isGeneratingAI,
    searchTerm, setSearchTerm,
    supportPhone, plans,
    isProActive, effectiveAdPrice, freeAdsRemaining,
    confirmModal, setConfirmModal,
    customers, removeCustomer, updateCustomer,
    showCustomerModal, setShowCustomerModal, showCustomerHistory, setShowCustomerHistory, editingCustomer, setEditingCustomer, customerForm, setCustomerForm, handleSaveCustomer,
    showUserModal, setShowUserModal, editingUser, setEditingUser, userForm, setUserForm, handleSaveUser,
    showSectionModal, setShowSectionModal, editingSection, setEditingSection, sectionForm, setSectionForm, handleCreateSection,
    manageTab, setManageTab, manageForm, setManageForm, editingItemId, setEditingItemId, handleSaveManageItem, handleDeleteManageItem, startEditManageItem,
    adForm, setAdForm, editingAdId, setEditingAdId, handleSaveAd, handleRetryAdPayment,
    handleGenerateAdText, handleGenerateAdImage, deleteAd,
    uploadToStorage
  } = useSettingsLogic(props);

  useEffect(() => {
    props.onDirtyChange?.(isMarketplaceDirty);
  }, [isMarketplaceDirty, props]);

  const [clientSubTab, setClientSubTab] = useState<'CLIENT' | 'SUPPLIER'>('CLIENT');
  const [sysPeriod, setSysPeriod] = useState<'day' | 'week' | 'month' | 'all' | 'custom'>('day');
  const [sysScope, setSysScope] = useState<'ALL' | 'FACTORY' | 'STALL'>('ALL');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  
  const adFileInputRef = useRef<HTMLInputElement>(null);

  const handleAdImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
         const base64 = reader.result as string;
         const url = await uploadToStorage(base64, 'ad');
         if (url) setAdForm({...adForm, mediaUrl: url});
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-32">
      <div className="flex overflow-x-auto gap-2 px-2 py-4 no-scrollbar mb-8 sticky top-0 bg-white/80 backdrop-blur-md z-40">
        {[
          { id: 'ESTRUTURA', label: 'Estrutura', icon: Layout },
          { id: 'CLIENTES', label: 'Parceiros', icon: Users },
          { id: 'EQUIPE', label: 'Equipe', icon: UserCircle },
          { id: 'VITRINE', label: 'Vitrine', icon: Store },
          { id: 'MARKETING', label: 'Marketing', icon: Rocket },
          { id: 'ANUNCIO', label: 'Anúncios', icon: Megaphone },
          { id: 'PLANOS', label: 'Planos', icon: Zap },
          { id: 'SISTEMA', label: 'Sistema', icon: Database },
          { id: 'AUDITORIA', label: 'Logs', icon: History }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
              activeTab === tab.id ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === 'ESTRUTURA' && (
          <StructureTab 
            sections={props.sections}
            setShowSectionModal={setShowSectionModal}
            setEditingSection={setEditingSection}
            deleteSection={props.deleteSection}
          />
        )}
        {activeTab === 'CLIENTES' && (
          <CustomersTab 
            customers={customers}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            clientSubTab={clientSubTab}
            setClientSubTab={setClientSubTab}
            showCustomerModal={showCustomerModal}
            setShowCustomerModal={setShowCustomerModal}
            editingCustomer={editingCustomer}
            setEditingCustomer={setEditingCustomer}
            removeCustomer={removeCustomer}
            showCustomerHistory={showCustomerHistory}
            setShowCustomerHistory={setShowCustomerHistory}
            customerForm={customerForm}
            setCustomerForm={setCustomerForm}
            handleSaveCustomer={handleSaveCustomer}
            isProcessing={isProcessing}
            transactions={props.transactions}
          />
        )}
        {activeTab === 'EQUIPE' && (
          <TeamTab 
            users={props.users}
            setShowUserModal={setShowUserModal}
            setEditingUser={setEditingUser}
            setUserForm={setUserForm}
            removeUser={props.removeUser}
            currentUser={props.currentUser}
          />
        )}
        {activeTab === 'ANUNCIO' && (
          <AdsTab 
            ads={props.ads}
            adForm={adForm}
            setAdForm={setAdForm}
            isProcessing={isProcessing}
            isGeneratingAI={isGeneratingAI}
            handleGenerateAdText={handleGenerateAdText} 
            handleGenerateAdImage={handleGenerateAdImage}
            handleSaveAd={handleSaveAd}
            handleRetryAdPayment={handleRetryAdPayment}
            deleteAd={deleteAd}
            editingAdId={editingAdId}
            setEditingAdId={setEditingAdId}
            effectiveAdPrice={effectiveAdPrice}
            freeAdsRemaining={freeAdsRemaining}
            adFileInputRef={adFileInputRef}
            handleAdImageUpload={handleAdImageUpload}
            currentUser={props.currentUser}
          />
        )}
        {activeTab === 'SISTEMA' && (
          <SystemTab 
            transactions={props.transactions}
            sysPeriod={sysPeriod}
            setSysPeriod={setSysPeriod}
            sysScope={sysScope}
            setSysScope={setSysScope}
            customDateStart={customDateStart}
            setCustomDateStart={setCustomDateStart}
            customDateEnd={customDateEnd}
            setCustomDateEnd={setCustomDateEnd}
            clearTransactions={props.clearTransactions}
            archiveYear={props.archiveYear}
            workspaceId={props.currentUser.workspaceId}
            onUnlockGodMode={props.onUnlockGodMode}
          />
        )}
        {activeTab === 'PLANOS' && (
          <PlansTab 
            plans={plans}
            currentUser={props.currentUser}
            isProActive={isProActive}
            supportPhone={supportPhone}
          />
        )}
        {activeTab === 'VITRINE' && (
          <VitrineContainer
            profile={props.companyProfile} 
            onSaveProfile={props.onSaveProfile} 
            user={props.currentUser}
            onUpdateUser={(data) => props.updateUser(props.currentUser.id, data)}
            workspaceId={props.currentUser.workspaceId}
            isOwner={props.currentUser.role === 'OWNER'}
            hasProPlan={isProActive}
            transactions={props.transactions}
            sections={props.sections}
            setIsMarketplaceDirty={setIsMarketplaceDirty}
          />
        )}
        {activeTab === 'MARKETING' && <CouponManager workspaceId={props.currentUser.workspaceId} />}
        {activeTab === 'AUDITORIA' && <AuditLog workspaceId={props.currentUser.workspaceId} />}
      </div>

      {confirmModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-4">{confirmModal.title}</h3>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-8">{confirmModal.message}</p>
             <div className="flex gap-4">
                <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }} 
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl"
                >
                  Confirmar
                </button>
             </div>
           </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-3xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                   {editingUser ? 'Editar Colaborador' : 'Novo Colaborador'}
                 </h3>
                 <button onClick={() => setShowUserModal(false)} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors">
                   <X size={20} />
                 </button>
              </div>

              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome</label>
                    <input 
                      type="text"
                      value={userForm.name}
                      onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                      placeholder="NOME COMPLETO"
                      className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-slate-700 uppercase outline-none focus:ring-2 focus:ring-indigo-500 transition-all border-none"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">E-mail</label>
                    <input 
                      type="email"
                      value={userForm.email}
                      onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                      placeholder="EMAIL DE ACESSO"
                      className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all border-none"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Função</label>
                    <select 
                      value={userForm.role}
                      onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-slate-700 uppercase outline-none focus:ring-2 focus:ring-indigo-500 transition-all border-none appearance-none"
                    >
                      <option value="MANAGER_FACTORY">Gerente de Fábrica</option>
                      <option value="MANAGER_STALL">Gerente de Barraca</option>
                      <option value="OWNER">Proprietário / Admin</option>
                    </select>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">PIN Acesso (6 Dígitos)</label>
                    <input 
                      type="text"
                      maxLength={6}
                      value={userForm.accessCode}
                      onChange={e => setUserForm({ ...userForm, accessCode: e.target.value.replace(/\D/g, '') })}
                      placeholder="123456"
                      className="w-full p-5 bg-slate-50 rounded-2xl font-black text-indigo-600 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-indigo-500 transition-all border-none"
                    />
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Abas Autorizadas</label>
                    <div className="grid grid-cols-2 gap-2">
                       {props.sections.map(section => (
                         <button 
                           key={section.id}
                           onClick={() => {
                             const ids = [...userForm.assignedSectionIds];
                             if (ids.includes(section.id)) {
                               setUserForm({ ...userForm, assignedSectionIds: ids.filter(id => id !== section.id) });
                             } else {
                               setUserForm({ ...userForm, assignedSectionIds: [...ids, section.id] });
                             }
                           }}
                           className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${userForm.assignedSectionIds.includes(section.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-400'}`}
                         >
                           <span className="text-[9px] font-black uppercase tracking-tight truncate mr-2">{section.name}</span>
                           <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${userForm.assignedSectionIds.includes(section.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200'}`}>
                             {userForm.assignedSectionIds.includes(section.id) && <Check size={10} className="text-white" />}
                           </div>
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                       <EyeOff size={20} className="text-slate-400" />
                       <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Ocultar Financeiro</span>
                    </div>
                    <button 
                      onClick={() => setUserForm({ ...userForm, hideSalesValues: !userForm.hideSalesValues })}
                      className={`w-12 h-6 rounded-full relative transition-all ${userForm.hideSalesValues ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${userForm.hideSalesValues ? 'left-7' : 'left-1'}`} />
                    </button>
                 </div>
              </div>

              <div className="flex gap-4 mt-8">
                 <button onClick={() => setShowUserModal(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                 <button 
                   onClick={handleSaveUser}
                   disabled={isProcessing}
                   className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                 >
                   {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                   Salvar
                 </button>
              </div>
           </div>
        </div>
      )}

      {showSectionModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-3xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Configurar Aba</h3>
                 <button onClick={() => setShowSectionModal(false)} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors">
                   <X size={20} />
                 </button>
              </div>

              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome da Aba</label>
                    <input 
                      type="text"
                      value={sectionForm.name}
                      onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })}
                      placeholder="EX: BARRACA, FÁBRICA"
                      className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-slate-700 uppercase outline-none focus:ring-2 focus:ring-indigo-500 transition-all border-none"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Tipo de Estilo</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-2xl">
                       <button 
                         onClick={() => setSectionForm({...sectionForm, type: 'STALL_STYLE'})}
                         className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${sectionForm.type === 'STALL_STYLE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                       >
                         Barraca
                       </button>
                       <button 
                         onClick={() => setSectionForm({...sectionForm, type: 'FACTORY_STYLE'})}
                         className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${sectionForm.type === 'FACTORY_STYLE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
                       >
                         Fábrica
                       </button>
                    </div>
                 </div>
              </div>

              <div className="flex gap-4 mt-10">
                 <button onClick={() => setShowSectionModal(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                 <button 
                   onClick={handleCreateSection}
                   disabled={isProcessing}
                   className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                 >
                   {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                   Confirmar
                 </button>
              </div>
           </div>
        </div>
      )}

      {editingSection && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] p-8 max-w-xl w-full shadow-3xl animate-in zoom-in-95 duration-300 max-h-[95vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Gerenciar Aba</h3>
                    <p className="text-sm font-black text-indigo-600 uppercase tracking-widest mt-1">{editingSection.name}</p>
                 </div>
                 <button onClick={() => { setEditingSection(null); setEditingItemId(null); }} className="p-3 bg-slate-50 text-slate-300 rounded-full hover:bg-slate-100 transition-colors">
                   <X size={24} />
                 </button>
              </div>

              <div className="flex bg-slate-50 p-2 rounded-2xl gap-2 mb-8">
                 <button 
                   onClick={() => setManageTab('PRODUCTS')}
                   className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${manageTab === 'PRODUCTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                 >
                   Produtos
                 </button>
                 <button 
                   onClick={() => setManageTab('EXPENSES')}
                   className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${manageTab === 'EXPENSES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                 >
                   Despesas
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
                 {/* FORM ADICIONAR/EDITAR */}
                 <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 space-y-4">
                    <div className="flex gap-4">
                       <div 
                         onClick={() => {
                           const input = document.createElement('input');
                           input.type = 'file';
                           input.accept = 'image/*';
                           input.onchange = (e: any) => {
                             const file = e.target.files[0];
                             if (file) {
                               const reader = new FileReader();
                               reader.onload = (re) => setManageForm({...manageForm, imageUrl: re.target?.result as string});
                               reader.readAsDataURL(file);
                             }
                           };
                           input.click();
                         }}
                         className="w-24 h-24 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-all overflow-hidden flex-shrink-0"
                       >
                         {manageForm.imageUrl ? (
                           <img src={manageForm.imageUrl} className="w-full h-full object-cover" />
                         ) : (
                           <Camera className="text-slate-200" size={24} />
                         )}
                       </div>
                       <div className="flex-1 grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                             <input 
                               value={manageForm.name} 
                               onChange={e => setManageForm({...manageForm, name: e.target.value})} 
                               placeholder="NOME DO ITEM" 
                               className="w-full p-4 bg-white rounded-xl font-bold uppercase text-[11px] outline-none border border-slate-100 focus:border-indigo-300"
                             />
                          </div>
                          <div className="col-span-2">
                             <input 
                               value={manageForm.category} 
                               onChange={e => setManageForm({...manageForm, category: e.target.value})} 
                               placeholder="CATEGORIA" 
                               className="w-full p-4 bg-white rounded-xl font-bold uppercase text-[11px] outline-none border border-slate-100 focus:border-indigo-300"
                             />
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">R$ Vista</label>
                          <input 
                            value={manageForm.priceVista} 
                            onChange={e => setManageForm({...manageForm, priceVista: e.target.value})} 
                            placeholder="0,00" 
                            className="w-full p-4 bg-white rounded-xl font-black text-slate-700 outline-none border border-slate-100"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">R$ Prazo</label>
                          <input 
                            value={manageForm.pricePrazo} 
                            onChange={e => setManageForm({...manageForm, pricePrazo: e.target.value})} 
                            placeholder="0,00" 
                            className="w-full p-4 bg-white rounded-xl font-black text-slate-700 outline-none border border-slate-100"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest ml-3">R$ Promo Vista</label>
                          <input 
                            value={manageForm.promoVista} 
                            onChange={e => setManageForm({...manageForm, promoVista: e.target.value})} 
                            placeholder="0,00" 
                            className="w-full p-4 bg-emerald-50 text-emerald-700 rounded-xl font-black outline-none border border-emerald-100"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest ml-3">R$ Promo Prazo</label>
                          <input 
                            value={manageForm.promoPrazo} 
                            onChange={e => setManageForm({...manageForm, promoPrazo: e.target.value})} 
                            placeholder="0,00" 
                            className="w-full p-4 bg-emerald-50 text-emerald-700 rounded-xl font-black outline-none border border-emerald-100"
                          />
                       </div>
                    </div>

                    <button 
                      onClick={handleSaveManageItem}
                      disabled={isProcessing}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {editingItemId ? 'Atualizar Item' : 'Adicionar Item'}
                    </button>
                    {editingItemId && (
                      <button onClick={() => { setEditingItemId(null); setManageForm({ name: '', category: '', priceVista: '', pricePrazo: '', imageUrl: '', promoVista: '', promoPrazo: '', promoEndsAt: '' }); }} className="w-full py-2 text-[9px] font-black text-rose-400 uppercase">Cancelar Edição</button>
                    )}
                 </div>

                 {/* LISTA DE ITENS */}
                 <div className="space-y-3 pb-8">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                      {manageTab === 'PRODUCTS' ? 'Produtos Cadastrados' : 'Despesas Cadastradas'}
                    </h4>
                    <div className="space-y-2">
                       {(manageTab === 'PRODUCTS' ? (editingSection.items || []) : (editingSection.expenses || [])).map(item => (
                         <div key={item.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-100 transition-all">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100">
                                  {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <Package className="text-slate-200" size={20} />}
                               </div>
                               <div>
                                  <p className="font-black text-slate-800 text-[11px] uppercase leading-none mb-1">{item.name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">R$ {item.defaultPriceAVista?.toFixed(2)} / R$ {item.defaultPriceAPrazo?.toFixed(2)}</p>
                               </div>
                            </div>
                            <div className="flex gap-1">
                               <button onClick={() => startEditManageItem(item)} className="p-2.5 text-indigo-400 hover:bg-indigo-50 rounded-xl transition-all"><Edit3 size={16} /></button>
                               <button onClick={() => handleDeleteManageItem(item.id)} className="p-2.5 text-rose-300 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
