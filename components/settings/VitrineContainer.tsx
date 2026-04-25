import React, { useState } from 'react';
import { AppSection, User, StoreProfile } from '../../types';
import { MarketplaceManager } from '../MarketplaceManager';
import { StoreInsights } from '../StoreInsights';

interface VitrineContainerProps {
  profile: StoreProfile | null;
  onSaveProfile: (profile: Partial<StoreProfile> & { workspaceId: string }) => Promise<StoreProfile | null>;
  user: User;
  onUpdateUser: (data: Partial<User>) => Promise<void>;
  workspaceId: string;
  isOwner: boolean;
  hasProPlan: boolean;
  transactions: any[];
  sections: AppSection[];
  setIsMarketplaceDirty?: (dirty: boolean) => void;
}

export const VitrineContainer: React.FC<VitrineContainerProps> = (props) => {
  const [subTab, setSubTab] = useState<'GERENCIAR' | 'INSIGHTS'>('GERENCIAR');

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex bg-slate-50 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setSubTab('GERENCIAR')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${subTab === 'GERENCIAR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Gerenciar
        </button>
        <button 
          onClick={() => setSubTab('INSIGHTS')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${subTab === 'INSIGHTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Inteligência / BI
        </button>
      </div>

      {subTab === 'GERENCIAR' ? (
        <MarketplaceManager 
          profile={props.profile} 
          onSave={props.onSaveProfile} 
          user={props.user}
          workspaceId={props.workspaceId}
          sections={props.sections}
          onDirtyChange={props.setIsMarketplaceDirty}
        />
      ) : (
        <StoreInsights 
          workspaceId={props.workspaceId}
          transactions={props.transactions}
          profile={props.profile}
        />
      )}
    </div>
  );
};
