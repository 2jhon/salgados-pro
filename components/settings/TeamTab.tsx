
import React, { useState } from 'react';
import { UserPlus, Trash2, Edit3, Loader2 } from 'lucide-react';
import { User } from '../../types';

interface TeamTabProps {
  users: User[];
  setShowUserModal: (show: boolean) => void;
  setEditingUser: (u: User) => void;
  setUserForm: (form: any) => void;
  removeUser: (id: string) => Promise<void>;
  currentUser: User;
}

export const TeamTab: React.FC<TeamTabProps> = ({
  users, setShowUserModal, setEditingUser, setUserForm, removeUser, currentUser
}) => {
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER': return 'Proprietário';
      case 'MANAGER_FACTORY': return 'Gerente Fábrica';
      case 'MANAGER_STALL': return 'Gerente Barraca';
      default: return 'Colaborador';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-2">
        <div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Sua Equipe</h3>
        </div>
        <button 
          onClick={() => {
            setEditingUser(null);
            setUserForm({ name: '', phone: '', email: '', accessCode: '', role: 'MANAGER_FACTORY', hideSalesValues: false, assignedSectionIds: [] });
            setShowUserModal(true);
          }}
          className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all"
        >
          <UserPlus size={24} />
        </button>
      </div>

      <div className="space-y-4">
        {users.map(user => (
          <div key={user.id} className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-50 flex items-center justify-between group hover:border-indigo-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm">
                 {user.avatarUrl ? (
                   <img src={user.avatarUrl} className="w-full h-full object-cover" />
                 ) : (
                   <div className="text-xl font-black text-slate-300 uppercase">{user.name.charAt(0)}</div>
                 )}
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-slate-800 uppercase tracking-tight truncate">
                  {user.name} {user.id === currentUser.id && '(VOCÊ)'}
                </h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getRoleLabel(user.role)}</p>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">PIN: {user.accessCode || '****'}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setEditingUser(user);
                  setUserForm({ 
                      name: user.name, 
                      phone: user.phone || '', 
                      email: user.email || '',
                      accessCode: user.accessCode, 
                      role: user.role, 
                      hideSalesValues: user.hideSalesValues,
                      assignedSectionIds: user.assignedSectionIds || [] 
                  });
                  setShowUserModal(true);
                }}
                className="p-3 text-indigo-500 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all border border-indigo-100 shadow-sm"
              >
                <Edit3 size={18} />
              </button>
              <button 
                onClick={() => user.id !== currentUser.id && setConfirmDeleteUserId(user.id)}
                disabled={user.id === currentUser.id}
                className="p-3 text-rose-500 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-2xl transition-all border border-rose-100 shadow-sm disabled:opacity-0"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmDeleteUserId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300 text-center">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Excluir Membro</h3>
            <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">
              Certeza absoluta que deseja revogar o acesso deste membro?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteUserId(null)} 
                className="flex-1 py-4 text-slate-400 bg-slate-50 hover:bg-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  setIsDeleting(true);
                  await removeUser(confirmDeleteUserId);
                  setIsDeleting(false);
                  setConfirmDeleteUserId(null);
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
