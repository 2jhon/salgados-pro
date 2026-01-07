
import React, { useState, useMemo } from 'react';
import { Transaction, User, PeriodTotals } from '../types';
import { HistoryTable } from './HistoryTable';
import { 
  UserCircle, 
  ChevronRight, 
  ChevronDown, 
  Filter, 
  Calendar, 
  Briefcase, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Search
} from 'lucide-react';

interface ManagerActivityProps {
  transactions: Transaction[];
  users: User[];
  deleteTransaction: (id: string) => Promise<void>;
}

type PeriodType = 'day' | 'week' | 'month' | 'all';

export const ManagerActivity: React.FC<ManagerActivityProps> = ({ transactions, users, deleteTransaction }) => {
  const [expandedManager, setExpandedManager] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<PeriodType>('day');
  const [searchTerm, setSearchTerm] = useState('');

  // Agrupar transações por quem criou
  const managerGroups = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      const author = t.createdBy || 'Sistema/Admin';
      if (!groups[author]) groups[author] = [];
      groups[author].push(t);
    });
    return groups;
  }, [transactions]);

  // Encontrar metadados do usuário (cargo/área) baseado no nome do criadoBy
  const getManagerMeta = (name: string) => {
    const user = users.find(u => u.name === name);
    if (!user) return { role: 'Admin/Externo', area: 'Geral' };
    
    const roleMap: Record<string, string> = {
      'OWNER': 'Proprietário',
      'MANAGER_FACTORY': 'Gerente Fábrica',
      'MANAGER_STALL': 'Gerente Barraca'
    };

    const areaMap: Record<string, string> = {
      'OWNER': 'Toda Empresa',
      'MANAGER_FACTORY': 'Fábrica',
      'MANAGER_STALL': 'Barraca'
    };

    return { 
      role: roleMap[user.role] || user.role, 
      area: areaMap[user.role] || 'Geral'
    };
  };

  const filterByPeriod = (data: Transaction[], period: PeriodType) => {
    const now = new Date();
    if (period === 'all') return data;

    let startTime = 0;
    if (period === 'day') {
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(now.getDate() - now.getDay());
      d.setHours(0,0,0,0);
      startTime = d.getTime();
    } else if (period === 'month') {
      startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    return data.filter(t => new Date(t.date).getTime() >= startTime);
  };

  const filteredManagerNames = Object.keys(managerGroups).filter(name => 
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6">
      {/* Barra de Busca de Gerentes */}
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
          <Search className="w-5 h-5" />
        </div>
        <input 
          type="text"
          placeholder="Buscar gerente ou colaborador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-4 pl-12 bg-white rounded-2xl shadow-sm border border-slate-100 outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-200 transition-all font-bold text-slate-700"
        />
      </div>

      {/* Lista de Gerentes */}
      <div className="grid gap-4">
        {filteredManagerNames.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
            <UserCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhuma atividade registrada ainda.</p>
          </div>
        ) : filteredManagerNames.map(name => {
          const isExpanded = expandedManager === name;
          const meta = getManagerMeta(name);
          const allManagerData = managerGroups[name];
          
          // Calculos rápidos para o cabeçalho do card
          const todayData = filterByPeriod(allManagerData, 'day');
          const todayTotal = todayData.reduce((acc, t) => acc + (t.subCategory === 'GASTOS' ? 0 : t.value), 0);
          const todayExpenses = todayData.reduce((acc, t) => acc + (t.subCategory === 'GASTOS' ? t.value : 0), 0);

          return (
            <div 
              key={name}
              className={`bg-white rounded-[2.5rem] shadow-xl border transition-all duration-500 overflow-hidden ${
                isExpanded ? 'border-blue-200 ring-8 ring-blue-50/50' : 'border-slate-50'
              }`}
            >
              <button 
                onClick={() => setExpandedManager(isExpanded ? null : name)}
                className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-xl shadow-inner transition-all ${
                    isExpanded ? 'bg-blue-600 text-white scale-110 rotate-3' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-lg leading-tight">{name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        meta.area === 'Fábrica' ? 'bg-orange-100 text-orange-600' : 
                        meta.area === 'Barraca' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {meta.area}
                      </span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">• {meta.role}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-6">
                  <div className="hidden sm:block">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Vendas Hoje</p>
                    <p className="font-black text-green-600">{formatCurrency(todayTotal)}</p>
                  </div>
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-blue-500" /> : <ChevronRight className="w-5 h-5 text-slate-300" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-8 animate-in slide-in-from-top-4 duration-500">
                  <div className="h-px bg-slate-100 mb-6" />
                  
                  {/* Seletor de Período Interno */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl mb-8">
                    {(['day', 'week', 'month', 'all'] as PeriodType[]).map(p => (
                      <button
                        key={p}
                        onClick={() => setActivePeriod(p)}
                        className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                          activePeriod === p ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {p === 'day' ? 'Hoje' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Tudo'}
                      </button>
                    ))}
                  </div>

                  {/* Estatísticas do Período */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-green-50/50 border border-green-100 p-4 rounded-2xl">
                      <div className="flex items-center gap-2 text-green-600 mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase">Entradas</span>
                      </div>
                      <p className="text-xl font-black text-slate-800">
                        {formatCurrency(filterByPeriod(allManagerData, activePeriod).filter(t => t.subCategory !== 'GASTOS').reduce((acc, t) => acc + t.value, 0))}
                      </p>
                    </div>
                    <div className="bg-red-50/50 border border-red-100 p-4 rounded-2xl">
                      <div className="flex items-center gap-2 text-red-600 mb-1">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase">Saídas</span>
                      </div>
                      <p className="text-xl font-black text-slate-800">
                        {formatCurrency(filterByPeriod(allManagerData, activePeriod).filter(t => t.subCategory === 'GASTOS').reduce((acc, t) => acc + t.value, 0))}
                      </p>
                    </div>
                  </div>

                  <HistoryTable 
                    transactions={filterByPeriod(allManagerData, activePeriod)} 
                    onDelete={(id) => deleteTransaction(id)}
                    title={`Lançamentos de ${name}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
