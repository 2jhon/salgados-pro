
import React, { useMemo, useCallback } from 'react';
import { 
  Factory, 
  Store, 
  Package, 
  Activity, 
  Settings as SettingsIcon, 
  Utensils, 
  ShoppingCart,
  Info
} from 'lucide-react';

import { AppSection, Transaction, User, Ad, StoreProfile, SubscriptionPlan } from '../types';
import { SystemPromoBanner } from './SystemPromoBanner';
import { QuickAccessModal } from './home/QuickAccessModal';
import { NoteDetailsModal } from './home/NoteDetailsModal';
import { StoreInsights } from './home/StoreInsights';
import { MyNotesModal } from './home/MyNotesModal';
import { AdBannerSlider } from './home/AdBannerSlider';
import { ReportModal } from './marketplace/ReportModal';
import { DebtSummaryCard } from './home/DebtSummaryCard';
import { FavoriteStoresSlider } from './home/FavoriteStoresSlider';
import { SuggestedStoresList } from './home/SuggestedStoresList';
import { ProPromoBanner } from './home/ProPromoBanner';
import { QuickAccessGrid } from './home/QuickAccessGrid';
import { ConfirmModal } from './home/ConfirmModal';
import { useHomeLogic } from '../hooks/useHomeLogic';

interface HomeProps {
  sections: AppSection[];
  archives: AppSection[];
  visibleSections: AppSection[]; 
  transactions: Transaction[];
  user: User;
  onNavigate: (tab: string) => void;
  ads: Ad[];
  incrementClick: (adId: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  plans: SubscriptionPlan[];
  stores: StoreProfile[];
  stalls?: AppSection[];
  hasMoreTransactions: boolean;
  fetchNextTransactions: () => Promise<void>;
  loadingTransactions: boolean;
  financialInsights?: any[];
  historicalSummaries?: any[];
}

export const Home: React.FC<HomeProps> = ({ 
  sections, archives, visibleSections, transactions, user, onNavigate, 
  ads, incrementClick, deleteTransaction, plans, stores, stalls = [],
  hasMoreTransactions, fetchNextTransactions, loadingTransactions,
  financialInsights = [],
  historicalSummaries = []
}) => {
  const {
    isOwner,
    showMyNotesModal, setShowMyNotesModal,
    activeNoteTab, setActiveNoteTab,
    selectedNoteGroup, setSelectedNoteGroup,
    noteStore, loadingNote,
    reportTarget, setReportTarget,
    reportReason, setReportReason,
    isReporting,
    confirmModal, setConfirmModal,
    showQuickAccessModal, setShowQuickAccessModal,
    quickAccess, setQuickAccess,
    saveQuickAccess,
    userInteractions, storeRatings,
    myDebts, myHistory, totalDebt,
    debtsByDate, historyByDate,
    handleOpenNote, handleReport,
    handleDeleteHistoryItem, handlePayNote,
    loadMoreHistoryRef, groupItemsByTime, calculateGroupTotal,
    getStoreDisplayName, availableOptions, visibleHistoryCount
  } = useHomeLogic({
    user, sections, transactions, stores, visibleSections, deleteTransaction, stalls,
    hasMoreTransactions, fetchNextTransactions, loadingTransactions
  });

  const isPro = !!user.hasProPlan;
  const isAdFree = !!user.isAdFree;
  const isAdvertiser = !!user.isAdvertiser;

  const getBigButtonData = useCallback((id: string) => {
    if (id === 'MARKETPLACE') return { label: 'Marketplace', icon: ShoppingCart, color: 'bg-emerald-600 shadow-emerald-900/10', desc: 'Ver Vitrine Pública' };
    if (id === 'ESTOQUE') return { label: 'Estoque', icon: Package, color: 'bg-amber-500 shadow-amber-900/10', desc: 'Controle de Inventário' };
    if (id === 'ACTIVITY') return { label: 'Log', icon: Activity, color: 'bg-cyan-600 shadow-cyan-900/10', desc: 'Histórico de Atividades' };
    if (id === 'CONFIG') return { label: 'Painel', icon: SettingsIcon, color: 'bg-indigo-600 shadow-indigo-900/10', desc: 'Configurações' };
    
    const section = sections.find(s => s.id === id);
    if (section) {
      return { 
        label: section.name, 
        icon: section.type === 'FACTORY_STYLE' ? Factory : Store, 
        color: section.type === 'FACTORY_STYLE' ? 'bg-slate-900 shadow-slate-900/10' : 'bg-orange-500 shadow-orange-900/10',
        desc: 'Acessar Operação'
      };
    }
    return { label: 'Opção', icon: Info, color: 'bg-slate-800', desc: '' };
  }, [sections]);

  const availableOptionsWithIcons = React.useMemo(() => {
    return availableOptions.map(opt => {
      let Icon: any = Info;
      if (opt.icon === 'ShoppingCart') Icon = ShoppingCart;
      if (opt.icon === 'Package') Icon = Package;
      if (opt.icon === 'Activity') Icon = Activity;
      if (opt.icon === 'SettingsIcon') Icon = SettingsIcon;
      if (opt.icon === 'Factory') Icon = Factory;
      if (opt.icon === 'Store') Icon = Store;
      return { ...opt, icon: Icon };
    });
  }, [availableOptions]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-32">
      <div className="flex items-center justify-between px-2">
         <div className="space-y-1">
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dashboard</p>
           <h2 className="text-3xl font-black tracking-tight text-slate-800">
             Olá, <span className="text-orange-500">{user.name || 'Usuário'}!</span>
           </h2>
         </div>
         <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
           <Utensils className="w-6 h-6" />
         </div>
      </div>

      {isOwner && <SystemPromoBanner plans={plans} user={user} onNavigate={onNavigate} />}

      {!isOwner && (
        <DebtSummaryCard 
          myDebts={myDebts}
          totalDebt={totalDebt}
          onOpenNotes={(tab) => { setActiveNoteTab(tab); setShowMyNotesModal(true); }}
        />
      )}

      {!isOwner && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
              <FavoriteStoresSlider 
                favorites={userInteractions.favorites}
                stores={stores}
                storeRatings={storeRatings}
                getStoreDisplayName={getStoreDisplayName}
                onNavigate={onNavigate}
              />

              <SuggestedStoresList 
                stores={stores}
                favorites={userInteractions.favorites}
                storeRatings={storeRatings}
                getStoreDisplayName={getStoreDisplayName}
                onNavigate={onNavigate}
              />
          </div>
      )}

      {isOwner && (
        <StoreInsights 
          transactions={transactions}
          sections={sections}
          archives={archives}
          user={user}
          financialInsights={financialInsights}
          historicalSummaries={historicalSummaries}
        />
      )}

      {!isPro && isOwner && (
        <ProPromoBanner onNavigate={onNavigate} />
      )}

      <AdBannerSlider 
        ads={ads}
        user={user}
        isPro={isPro}
        isAdFree={isAdFree}
        isAdvertiser={isAdvertiser}
        onNavigate={onNavigate}
        incrementClick={incrementClick}
        setReportTarget={setReportTarget}
      />

      <QuickAccessGrid 
        quickAccess={quickAccess}
        onNavigate={onNavigate}
        onOpenSelection={() => setShowQuickAccessModal(true)}
        getBigButtonData={getBigButtonData}
      />

      {showMyNotesModal && (
        <MyNotesModal 
          setShowMyNotesModal={setShowMyNotesModal}
          activeNoteTab={activeNoteTab}
          setActiveNoteTab={setActiveNoteTab}
          myDebts={myDebts}
          myHistory={myHistory}
          totalDebt={totalDebt}
          debtsByDate={debtsByDate}
          historyByDate={historyByDate}
          handleOpenNote={handleOpenNote}
          handleDeleteHistoryItem={handleDeleteHistoryItem}
          visibleHistoryCount={visibleHistoryCount}
          loadMoreHistoryRef={loadMoreHistoryRef}
          groupItemsByTime={groupItemsByTime}
          calculateGroupTotal={calculateGroupTotal}
          handlePayNote={handlePayNote}
          hasMoreTransactions={hasMoreTransactions}
          loadingTransactions={loadingTransactions}
        />
      )}

      {confirmModal && (
        <ConfirmModal 
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      <NoteDetailsModal 
        selectedNoteGroup={selectedNoteGroup}
        setSelectedNoteGroup={setSelectedNoteGroup}
        loadingNote={loadingNote}
        noteStore={noteStore}
        calculateGroupTotal={calculateGroupTotal}
      />
      
      <ReportModal 
        reportTarget={reportTarget}
        setReportTarget={setReportTarget}
        reportReason={reportReason}
        setReportReason={setReportReason}
        isReporting={isReporting}
        handleReport={handleReport}
      />

      {showQuickAccessModal && (
        <QuickAccessModal 
          quickAccess={quickAccess}
          setQuickAccess={setQuickAccess}
          availableOptions={availableOptionsWithIcons}
          setShowQuickAccessModal={setShowQuickAccessModal}
          saveQuickAccess={saveQuickAccess}
        />
      )}

    </div>
  );
};
