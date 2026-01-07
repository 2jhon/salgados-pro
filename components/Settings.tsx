import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppSection, User, Transaction, Ad, SectionType, UserRole, ConfigItem, Customer, StoreProfile } from '../types';
import { useCustomers } from '../hooks/useCustomers';
import { MarketplaceManager } from './MarketplaceManager';
import { GoogleGenAI } from "@google/genai";
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Layout, Users, Megaphone, Settings as SettingsIcon, CreditCard, 
  Plus, Trash2, ArrowUp, ArrowDown, Save, Edit3, EyeOff, DollarSign, 
  Check, X, AlertTriangle, Loader2, Store, Package, UserCircle, Phone, Search,
  ShieldCheck, ShoppingBag, Truck, Calendar, Zap, ShieldAlert, ArrowRight, Info, Box,
  UserPlus, Square, CheckSquare, ShoppingCart, Mail, Image as ImageIcon, Sparkles, Upload,
  Clock, Wallet, MessageSquare, FileDown, Printer, CheckCircle, Eye, Crown, Rocket, Star
} from 'lucide-react';

const ADMIN_EMAILS = [
  'brasilanonymous66@gmail.com',
  'anonymousx484@gmail.com',
  'lillysilva345@gmail.com'
];

interface SettingsProps {
  sections: AppSection[];
  saveConfig: (sections: AppSection[]) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  users: User[];
  addUser: (user: Omit<User, 'id'>) => Promise<User | null>;
  removeUser: (id: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  transactions: Transaction[];
  clearTransactions: (period: 'day' | 'week' | 'month' | 'all', wid: string) => Promise<void>;
  currentUser: User;
  companyProfile: StoreProfile | null;
  onSaveProfile: (profile: Omit<StoreProfile, 'id'>) => Promise<StoreProfile | null>;
  ads: Ad[];
  saveAd: (ad: Partial<Ad> & { ownerId: string, workspaceId: string }) => Promise<Ad | null>;
  deleteAd: (id: string) => Promise<boolean>;
  onNavigate: (tab: string) => void;
  isGodModeUnlocked?: boolean;
  onUnlockGodMode: () => void;
}

// Componente visual para o Timer do Plano
const PlanCountDown: React.FC<{ expiresAt?: string; light?: boolean }> = ({ expiresAt, light }) => {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number } | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = new Date(expiresAt).getTime() - new Date().getTime();
      if (diff <= 0) { setTimeLeft(null); return; }
      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      });
    };
    update();
    const interval = setInterval(update, 60000); // Atualiza a cada minuto
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!timeLeft) return <span className="text-[10px] font-black uppercase text-rose-500">Expirado</span>;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${light ? 'bg-white/20 border-white/20 text-white' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
      <Clock size={12} className={light ? "animate-pulse" : ""} />
      <span className="font-mono text-xs font-black tracking-widest">
        {timeLeft.d}d {timeLeft.h}h {timeLeft.m}m
      </span>
    </div>
  );
};

export const Settings: React.FC<SettingsProps> = ({
  sections, saveConfig, deleteSection, users, addUser, removeUser, updateUser,
  transactions, clearTransactions, currentUser, companyProfile, onSaveProfile, 
  ads, saveAd, deleteAd, onNavigate,
  isGodModeUnlocked, onUnlockGodMode
}) => {
  const [activeTab, setActiveTab] = useState<'ESTRUTURA' | 'CLIENTES' | 'EQUIPE' | 'VITRINE' | 'ANUNCIO' | 'SISTEMA' | 'PLANOS'>(() => {
    const pending = localStorage.getItem('settings_pending_tab');
    if (pending) {
      localStorage.removeItem('settings_pending_tab');
      return pending as any;
    }
    return 'ESTRUTURA';
  });
  const { customers, addCustomer, removeCustomer, updateCustomer } = useCustomers(currentUser.workspaceId);
  const [systemTabClicks, setSystemTabClicks] = useState(0);

  // Verificação rigorosa do e-mail para Super Admin
  const isSuperAdmin = useMemo(() => {
    const email = currentUser?.email?.toLowerCase()?.trim() || '';
    if (!email) return false;
    return ADMIN_EMAILS.includes(email);
  }, [currentUser?.email]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'USER' | 'SECTION' | 'AD' | 'CUSTOMER', id: string, name: string } | null>(null);
  
  // State para Confirmação de Limpeza
  const [clearConfirm, setClearConfirm] = useState<{ period: 'day' | 'week' | 'month' | 'all', label: string } | null>(null);

  // States Estrutura
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionType, setNewSectionType] = useState<SectionType>('FACTORY_STYLE');
  const [editingSection, setEditingSection] = useState<AppSection | null>(null);
  const [sectionEditTab, setSectionEditTab] = useState<'ITEMS' | 'EXPENSES'>('ITEMS');
  const [newItem, setNewItem] = useState({ name: '', priceVista: '', pricePrazo: '' });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // States Equipe
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<{name: string, email: string, phone: string, pin: string, role: UserRole, assignedSectionIds: string[], hideSalesValues: boolean}>({ 
    name: '', email: '', phone: '', pin: '', role: 'MANAGER_FACTORY', assignedSectionIds: [], hideSalesValues: false 
  });
  const [editUserData, setEditUserData] = useState<{name: string, email: string, phone: string, pin: string, role: string, assignedSectionIds: string[], hideSalesValues: boolean}>({ 
    name: '', email: '', phone: '', pin: '', role: '', assignedSectionIds: [], hideSalesValues: false 
  });

  // States Clientes
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerFormData, setCustomerFormData] = useState({ name: '', phone: '' });

  // States Anúncio
  const [adForm, setAdForm] = useState({ title: '', description: '', link: '', mediaUrl: '', days: 7 });
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);
  const [supportPhone, setSupportPhone] = useState('21999999999');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSupport = async () => {
      try {
        const { data } = await supabase.from('app_config').select('items').eq('id', 'GLOBAL_SYSTEM_SETTINGS').maybeSingle();
        if (data && Array.isArray(data.items) && data.items[0]?.support_phone) {
          setSupportPhone(data.items[0].support_phone);
        }
      } catch (e) {
        console.warn("Kernel: Falha ao carregar config global.");
      }
    };
    fetchSupport();
  }, []);

  // Lógica de manipulação de cliques na aba
  const handleTabClick = (tab: string) => {
    if (tab === 'SISTEMA') {
      const newCount = systemTabClicks + 1;
      setSystemTabClicks(newCount);
      console.log(`[DEBUG] Cliques Sistema: ${newCount}/7`);
      
      if (newCount >= 7) {
        // Verifica estritamente se é Super Admin (baseado na lista de emails permitidos)
        if (isSuperAdmin) {
          alert("Painel Master Ativado com Sucesso!");
          onUnlockGodMode();
        } else {
          const emailDebug = currentUser?.email || "Email não identificado";
          alert(`ACESSO NEGADO\nVocê atingiu os 7 toques, mas seu e-mail não tem permissão Master.\n\nE-mail: ${emailDebug}`);
        }
        setSystemTabClicks(0);
      }
    } else {
      setSystemTabClicks(0);
    }
    setActiveTab(tab as any);
  };

  const handleSubscribe = (planName: string, price: string) => {
    const msg = `Olá! Gostaria de assinar o *${planName}* (${price}) para minha empresa: *${currentUser.name}*.`;
    window.open(`https://wa.me/55${supportPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleDownloadReport = (period: 'day' | 'week' | 'month' | 'all') => {
    const doc = new jsPDF();
    const now = new Date();
    let startTime = 0;
    let periodLabel = "TUDO";

    if (period === 'day') {
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      periodLabel = "HOJE";
    } else if (period === 'week') {
      startTime = now.getTime() - (7 * 24 * 60 * 60 * 1000);
      periodLabel = "7 DIAS";
    } else if (period === 'month') {
      startTime = now.getTime() - (30 * 24 * 60 * 60 * 1000);
      periodLabel = "30 DIAS";
    }

    const filtered = transactions.filter(t => 
      new Date(t.date).getTime() >= startTime && 
      !t.isPending &&
      t.workspaceId === currentUser.workspaceId
    );

    doc.setFillColor(249, 115, 22); 
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO FINANCEIRO", 105, 15, { align: "center" });
    
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.text(`Período: ${periodLabel}`, 14, 35);
    doc.text(`Empresa: ${currentUser.name}`, 14, 41);

    const tableData = filtered.map(t => [
      new Date(t.date).toLocaleDateString('pt-BR'),
      t.item.toUpperCase(),
      t.subCategory === 'GASTOS' ? 'DESPESA' : 'VENDA',
      t.quantity ? t.quantity.toString() : '-',
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.value)
    ]);

    autoTable(doc, {
      head: [['Data', 'Item', 'Tipo', 'Qtd', 'Valor']],
      body: tableData,
      startY: 48,
      theme: 'striped',
      headStyles: { fillColor: [40, 40, 40] },
      styles: { fontSize: 8 },
    });

    const totalVendas = filtered.filter(t => t.subCategory !== 'GASTOS').reduce((acc, t) => acc + t.value, 0);
    const totalGastos = filtered.filter(t => t.subCategory === 'GASTOS').reduce((acc, t) => acc + t.value, 0);
    const finalY = (doc as any).lastAutoTable.finalY || 60;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Vendas: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVendas)}`, 14, finalY + 15);
    doc.setTextColor(220, 38, 38); 
    doc.text(`Total Gastos: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGastos)}`, 14, finalY + 22);
    doc.setTextColor(30, 64, 175); 
    doc.text(`Saldo: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVendas - totalGastos)}`, 14, finalY + 29);

    doc.save(`Relatorio_${periodLabel.replace(/\s/g, '_')}.pdf`);
  };

  const handleAddSection = async () => {
    if (!newSectionName) return;
    setIsProcessing(true);
    const newSec: AppSection = {
      id: `sec_${Date.now()}`,
      workspaceId: currentUser.workspaceId,
      name: newSectionName,
      type: newSectionType,
      order: sections.length,
      items: [],
      expenses: [],
      globalStockMode: 'GLOBAL'
    };
    try {
      await saveConfig([...sections, newSec]);
      setNewSectionName('');
    } catch(e) { console.error(e); }
    finally { setIsProcessing(false); }
  };

  const handleAddItemToSection = async () => {
    if (!editingSection || !newItem.name) return;
    const priceV = parseFloat(newItem.priceVista.replace(',', '.')) || 0;
    const priceP = parseFloat(newItem.pricePrazo.replace(',', '.')) || 0;
    const updatedSection = { ...editingSection };
    if (editingItemId) {
      const mapper = (i: ConfigItem) => i.id === editingItemId ? { ...i, name: newItem.name.toUpperCase(), defaultPriceAVista: priceV, defaultPriceAPrazo: priceP, defaultPrice: priceV } : i;
      if (sectionEditTab === 'ITEMS') updatedSection.items = updatedSection.items.map(mapper);
      else updatedSection.expenses = updatedSection.expenses.map(mapper);
    } else {
      const item: ConfigItem = { id: `item_${Date.now()}`, name: newItem.name.toUpperCase(), defaultPriceAVista: priceV, defaultPriceAPrazo: priceP, defaultPrice: priceV, currentStock: 0, minStock: 0 };
      if (sectionEditTab === 'ITEMS') updatedSection.items = [...(updatedSection.items || []), item];
      else updatedSection.expenses = [...(updatedSection.expenses || []), item];
    }
    setEditingSection(updatedSection);
    const allSections = sections.map(s => s.id === updatedSection.id ? updatedSection : s);
    await saveConfig(allSections);
    setNewItem({ name: '', priceVista: '', pricePrazo: '' });
    setEditingItemId(null);
  };

  const startEditItem = (item: ConfigItem) => {
    setEditingItemId(item.id);
    setNewItem({ name: item.name, priceVista: (item.defaultPriceAVista || 0).toString(), pricePrazo: (item.defaultPriceAPrazo || 0).toString() });
  };

  const handleRemoveItemFromSection = async (itemId: string) => {
    if (!editingSection) return;
    const updatedSection = { ...editingSection };
    if (sectionEditTab === 'ITEMS') updatedSection.items = updatedSection.items.filter(i => i.id !== itemId);
    else updatedSection.expenses = updatedSection.expenses.filter(i => i.id !== itemId);
    setEditingSection(updatedSection);
    const allSections = sections.map(s => s.id === updatedSection.id ? updatedSection : s);
    await saveConfig(allSections);
  };

  const moveSection = async (index: number, direction: 'UP' | 'DOWN') => {
    const newOrder = [...sections];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const tempOrder = newOrder[index].order;
    newOrder[index].order = newOrder[targetIndex].order;
    newOrder[targetIndex].order = tempOrder;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    await saveConfig(newOrder);
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.pin) { alert("Nome e PIN obrigatórios"); return; }
    setIsProcessing(true);
    try {
      await addUser({
        workspaceId: currentUser.workspaceId,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        accessCode: newUser.pin,
        isAdFree: false,
        isAdvertiser: false,
        hideSalesValues: newUser.hideSalesValues,
        enableSounds: true,
        assignedSectionIds: newUser.role === 'OWNER' ? [] : newUser.assignedSectionIds
      });
      setShowAddUser(false);
      setNewUser({ name: '', email: '', phone: '', pin: '', role: 'MANAGER_FACTORY', assignedSectionIds: [], hideSalesValues: false });
    } catch (e: any) { alert("Erro ao criar colaborador"); }
    finally { setIsProcessing(false); }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setIsProcessing(true);
    try {
      await updateUser(editingUser.id, {
        name: editUserData.name,
        email: editUserData.email,
        phone: editUserData.phone,
        role: editUserData.role as UserRole,
        accessCode: editUserData.pin,
        hideSalesValues: editUserData.hideSalesValues,
        assignedSectionIds: editUserData.role === 'OWNER' ? [] : editUserData.assignedSectionIds
      });
      setEditingUser(null);
    } catch (e) { alert("Erro ao atualizar dados"); }
    finally { setIsProcessing(false); }
  };

  const toggleSectionPermission = (sectionId: string) => {
    if (editingUser) {
      const currentIds = editUserData.assignedSectionIds || [];
      const newIds = currentIds.includes(sectionId)
        ? currentIds.filter(id => id !== sectionId)
        : [...currentIds, sectionId];
      setEditUserData({ ...editUserData, assignedSectionIds: newIds });
    } else {
      const currentIds = newUser.assignedSectionIds || [];
      const newIds = currentIds.includes(sectionId)
        ? currentIds.filter(id => id !== sectionId)
        : [...currentIds, sectionId];
      setNewUser({ ...newUser, assignedSectionIds: newIds });
    }
  };

  const handleSaveCustomer = async () => {
    if (!customerFormData.name) return;
    setIsProcessing(true);
    try {
      if (editingCustomer) await updateCustomer(editingCustomer.id, { name: customerFormData.name, phone: customerFormData.phone });
      else await addCustomer(customerFormData.name, customerFormData.phone);
      setShowCustomerModal(false);
      setEditingCustomer(null);
      setCustomerFormData({ name: '', phone: '' });
      alert("Cliente salvo!");
    } catch (e) { alert("Erro ao salvar."); }
    finally { setIsProcessing(false); }
  };

  const startEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerFormData({ name: c.name, phone: c.phone || '' });
    setShowCustomerModal(true);
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAdForm({ ...adForm, mediaUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateIA = async () => {
    if (!adForm.title || !adForm.description) {
      alert("Título e Descrição necessários.");
      return;
    }
    setIsGeneratingIA(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Professional food advertising commercial photography of ${adForm.title}. Style: appetizing, warm lighting, 4k, bokeh background. Description: ${adForm.description}`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });

      if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        setAdForm(prev => ({ ...prev, mediaUrl: `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}` }));
      }
    } catch (e: any) { alert("IA ocupada no momento."); }
    finally { setIsGeneratingIA(false); }
  };

  const handleRequestAdPublication = async () => {
    if (!adForm.title || !adForm.mediaUrl) {
      alert("Título e Arte são obrigatórios.");
      return;
    }
    setIsProcessing(true);
    try {
      const newAd = await saveAd({
        id: editingAdId || undefined, // Support for updating
        workspaceId: currentUser.workspaceId,
        ownerId: currentUser.id,
        ownerName: currentUser.name,
        title: adForm.title,
        description: adForm.description,
        link: adForm.link || `https://wa.me/55${currentUser.phone}`,
        backgroundColor: '#4f46e5',
        mediaUrl: adForm.mediaUrl,
        mediaType: 'image',
        active: false // Reset to pending approval on edit
      });

      if (newAd) {
        if (!editingAdId) {
          const msg = `Olá! Solicito publicação de anúncio: ${adForm.title}. Valor: R$ ${(adForm.days * 5).toFixed(2)}. ID: ${newAd.id}`;
          window.open(`https://wa.me/55${supportPhone}?text=${encodeURIComponent(msg)}`, '_blank');
          alert("Solicitação enviada!");
        } else {
          alert("Anúncio atualizado! Aguardando nova aprovação.");
        }
        setAdForm({ title: '', description: '', link: '', mediaUrl: '', days: 7 });
        setEditingAdId(null);
      }
    } catch (e) { alert("Erro ao solicitar."); }
    finally { setIsProcessing(false); }
  };

  const requestClear = (period: 'day' | 'week' | 'month' | 'all', label: string) => {
    setClearConfirm({ period, label });
  };

  const executeClear = async () => {
    if (!clearConfirm) return;
    setIsProcessing(true);
    try {
      await clearTransactions(clearConfirm.period, currentUser.workspaceId);
      setClearConfirm(null);
      alert("Limpeza concluída com sucesso.");
    } catch (e) {
      alert("Erro ao limpar registros.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmation) return;
    setIsProcessing(true);
    try {
      if (deleteConfirmation.type === 'USER') await removeUser(deleteConfirmation.id);
      else if (deleteConfirmation.type === 'SECTION') await deleteSection(deleteConfirmation.id);
      else if (deleteConfirmation.type === 'AD') await deleteAd(deleteConfirmation.id);
      else if (deleteConfirmation.type === 'CUSTOMER') await removeCustomer(deleteConfirmation.id);
      setDeleteConfirmation(null);
    } catch(e) { console.error(e); }
    finally { setIsProcessing(false); }
  };

  const startEditAd = (ad: Ad) => {
    setAdForm({
      title: ad.title,
      description: ad.description,
      link: ad.link,
      mediaUrl: ad.mediaUrl || '',
      days: 7 
    });
    setEditingAdId(ad.id);
    formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEditAd = () => {
    setAdForm({ title: '', description: '', link: '', mediaUrl: '', days: 7 });
    setEditingAdId(null);
  };

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex bg-slate-200 p-1 rounded-2xl shadow-inner overflow-x-auto no-scrollbar">
        {['ESTRUTURA', 'CLIENTES', 'EQUIPE', 'VITRINE', 'ANUNCIO', 'SISTEMA', 'PLANOS'].map(tab => (
          <button 
            key={tab} 
            onClick={() => handleTabClick(tab)}
            className={`flex-1 py-3 px-5 min-w-fit rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'ESTRUTURA' && (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-6">
          <div className="flex justify-between items-center px-2">
             <div><h3 className="font-black text-slate-800 text-sm uppercase tracking-widest leading-none">Minha Estrutura</h3><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Fábrica, Barracas e Estoque</p></div>
          </div>
          <div className="flex gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100">
             <input value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="Nome..." className="flex-1 bg-transparent p-2 font-bold text-xs outline-none uppercase" />
             <select value={newSectionType} onChange={e => setNewSectionType(e.target.value as SectionType)} className="bg-white px-3 py-2 rounded-xl text-[9px] font-black uppercase outline-none border border-slate-200">
                <option value="FACTORY_STYLE">Fábrica</option>
                <option value="STALL_STYLE">Barraca</option>
                <option value="STOCK_STYLE">Estoque</option>
             </select>
             <button onClick={handleAddSection} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg"><Plus size={16} /></button>
          </div>
          <div className="space-y-3">
             {sections.map((s, idx) => (
               <div key={s.id} className="p-5 bg-slate-50 rounded-[1.8rem] flex items-center justify-between border border-transparent hover:border-slate-100 hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                     <div className={`p-3 rounded-xl shadow-sm ${s.type === 'FACTORY_STYLE' ? 'bg-slate-800 text-white' : s.type === 'STOCK_STYLE' ? 'bg-indigo-600 text-white' : 'bg-orange-500 text-white'}`}>{s.type === 'STOCK_STYLE' ? <Box size={20} /> : <Store size={20} />}</div>
                     <div><p className="font-black text-slate-800 text-xs uppercase">{s.name}</p><p className="text-[8px] font-bold text-slate-400 uppercase">{s.type.replace('_STYLE', '')}</p></div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => setEditingSection(s)} className="p-3 bg-white text-blue-500 rounded-xl shadow-sm"><Edit3 size={16} /></button>
                     <div className="flex flex-col gap-1">
                        <button onClick={() => moveSection(idx, 'UP')} disabled={idx === 0} className="p-1 bg-white rounded shadow-sm text-slate-300 disabled:opacity-20"><ArrowUp size={12} /></button>
                        <button onClick={() => moveSection(idx, 'DOWN')} disabled={idx === sections.length - 1} className="p-1 bg-white rounded shadow-sm text-slate-300 disabled:opacity-20"><ArrowDown size={12} /></button>
                     </div>
                     <button onClick={() => setDeleteConfirmation({ type: 'SECTION', id: s.id, name: s.name })} className="p-3 bg-white text-rose-500 rounded-xl shadow-sm"><Trash2 size={16} /></button>
                  </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {activeTab === 'VITRINE' && (
        <MarketplaceManager 
          profile={companyProfile}
          onSave={onSaveProfile}
          workspaceId={currentUser.workspaceId}
          user={currentUser}
        />
      )}

      {activeTab === 'CLIENTES' && (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-6">
           <div className="flex justify-between items-center px-2">
             <div><h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Meus Clientes</h3><p className="text-[9px] font-bold text-slate-400 uppercase">Gestão da Carteira</p></div>
             <button onClick={() => { setEditingCustomer(null); setCustomerFormData({ name: '', phone: '' }); setShowCustomerModal(true); }} className="p-3 bg-emerald-600 text-white rounded-[1.2rem] shadow-lg"><UserPlus size={20} /></button>
           </div>
           <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="LOCALIZAR CLIENTE..." className="w-full p-4 pl-12 bg-slate-50 rounded-2xl font-bold text-xs uppercase outline-none shadow-inner" /></div>
           <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredCustomers.map(c => (
                 <div key={c.id} className="p-4 bg-slate-50 rounded-[1.5rem] flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                    <div className="flex items-center gap-3"><div className="p-2 bg-slate-200 text-slate-500 rounded-xl"><UserCircle size={16} /></div><div><p className="font-black text-slate-700 text-xs uppercase leading-tight">{c.name}</p>{c.phone && <p className="text-[8px] font-bold text-slate-400 mt-0.5">{c.phone}</p>}</div></div>
                    <div className="flex gap-2"><button onClick={() => startEditCustomer(c)} className="p-2 text-slate-300 hover:text-blue-500"><Edit3 size={16} /></button><button onClick={() => setDeleteConfirmation({ type: 'CUSTOMER', id: c.id, name: c.name })} className="p-2 text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button></div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'EQUIPE' && (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-6">
           <div className="flex justify-between items-center px-2">
             <div><h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Sua Equipe</h3><p className="text-[9px] font-bold text-slate-400 uppercase">Colaboradores e Gerentes</p></div>
             <button onClick={() => setShowAddUser(true)} className="p-3 bg-indigo-600 text-white rounded-[1.2rem] shadow-lg"><UserPlus size={20} /></button>
           </div>
           <div className="grid gap-4">
              {users.map(u => (
                 <div key={u.id} className="p-5 bg-slate-50 rounded-[1.8rem] flex items-center justify-between border border-transparent hover:border-slate-100 hover:bg-white hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-slate-400 shadow-sm overflow-hidden">
                          {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : u.name.charAt(0).toUpperCase()}
                       </div>
                       <div>
                          <p className="font-black text-slate-800 text-xs uppercase leading-tight">{u.name}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                            {u.role === 'OWNER' ? 'Proprietário' : u.role === 'MANAGER_FACTORY' ? 'Gerente Fábrica' : 'Gerente Barraca'}
                          </p>
                       </div>
                    </div>
                    <div className="flex gap-1">
                       <button onClick={() => { 
                         setEditingUser(u); 
                         setEditUserData({ 
                           name: u.name, 
                           email: u.email || '', 
                           phone: u.phone || '', 
                           pin: u.accessCode, 
                           role: u.role, 
                           assignedSectionIds: u.assignedSectionIds || [],
                           hideSalesValues: !!u.hideSalesValues
                         }); 
                       }} className="p-3 text-blue-500 rounded-xl"><Edit3 size={16} /></button>
                       {u.id !== currentUser.id && (
                         <button onClick={() => setDeleteConfirmation({ type: 'USER', id: u.id, name: u.name })} className="p-3 text-rose-500 rounded-xl"><Trash2 size={16} /></button>
                       )}
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'ANUNCIO' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-50" ref={formTopRef}>
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl"><Megaphone size={24} /></div>
                  <div><h3 className="text-xl font-black text-slate-800 uppercase">{editingAdId ? 'Editar Anúncio' : 'Solicitar Anúncio'}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{editingAdId ? 'Atualizar conteúdo' : 'Apareça no Marketplace'}</p></div>
               </div>
               {editingAdId && (
                 <button onClick={cancelEditAd} className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all"><X size={20} /></button>
               )}
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="relative aspect-square rounded-[2rem] bg-slate-100 border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
                   {adForm.mediaUrl ? <img src={adForm.mediaUrl} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-200" size={40} />}
                   {isGeneratingIA && <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white text-[10px] font-black uppercase"><Loader2 className="animate-spin mb-2" /> Gerando...</div>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => fileInputRef.current?.click()} className="py-3 bg-slate-100 rounded-xl font-black text-[9px] uppercase flex items-center justify-center gap-2"><Upload size={14} /> Galeria</button>
                   <button onClick={handleGenerateIA} disabled={isGeneratingIA} className="py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[9px] uppercase flex items-center justify-center gap-2 border border-indigo-100"><Sparkles size={14} /> Criar IA</button>
                   <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleGalleryUpload} />
                </div>
              </div>
              <div className="space-y-4">
                <input value={adForm.title} onChange={e => setAdForm({...adForm, title: e.target.value})} placeholder="TÍTULO" className="w-full p-4 bg-slate-50 rounded-xl font-black text-xs outline-none" />
                <textarea value={adForm.description} onChange={e => setAdForm({...adForm, description: e.target.value})} placeholder="DESCRIÇÃO" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-[10px] h-24 resize-none outline-none" />
                <div className="p-5 bg-slate-900 rounded-2xl text-white space-y-4">
                   {!editingAdId && (
                     <>
                       <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-400">Duração</span><span className="text-xl font-black">R$ {(adForm.days * 5).toFixed(2)}</span></div>
                       <div className="grid grid-cols-3 gap-2">
                          {[7, 15, 30].map(d => (
                            <button key={d} onClick={() => setAdForm({...adForm, days: d})} className={`py-3 rounded-lg font-black text-[10px] transition-all ${adForm.days === d ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/40'}`}>{d} DIAS</button>
                          ))}
                       </div>
                     </>
                   )}
                   <button onClick={handleRequestAdPublication} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 mt-4"><CheckCircle size={16} /> {editingAdId ? 'Salvar Alterações' : 'Solicitar Publicação'}</button>
                </div>
              </div>
            </div>
          </div>

          {/* LISTA DE ANÚNCIOS DO USUÁRIO */}
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50 space-y-6">
             <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest px-2">Seus Anúncios</h3>
             <div className="grid gap-4">
                {ads.filter(a => a.ownerId === currentUser.id).length === 0 ? (
                  <p className="text-[9px] font-bold text-slate-300 text-center py-4 uppercase">Nenhum anúncio solicitado.</p>
                ) : (
                  ads.filter(a => a.ownerId === currentUser.id).map(ad => (
                    <div key={ad.id} className="p-4 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white overflow-hidden shadow-inner flex items-center justify-center flex-shrink-0">
                              {ad.mediaUrl ? <img src={ad.mediaUrl} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-200" />}
                          </div>
                          <div>
                              <p className="font-black text-slate-800 text-xs uppercase truncate max-w-[150px]">{ad.title}</p>
                              <div className="flex flex-col items-start gap-1">
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full mt-1 inline-block ${ad.active ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                  {ad.active ? 'Publicado' : 'Aguardando Aprovação'}
                                </span>
                                {ad.active && ad.expiresAt && (
                                  <div className="scale-75 origin-left">
                                    <PlanCountDown expiresAt={ad.expiresAt} />
                                  </div>
                                )}
                              </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => startEditAd(ad)} className="p-3 text-blue-500 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-blue-50 transition-colors"><Edit3 size={16} /></button>
                           <button onClick={() => setDeleteConfirmation({ type: 'AD', id: ad.id, name: ad.title })} className="p-3 text-rose-500 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-rose-50 transition-colors"><Trash2 size={16} /></button>
                        </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'PLANOS' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
           {/* Cabeçalho Planos */}
           <div className="flex justify-between items-end px-2 mb-4">
              <div>
                 <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Assinaturas</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Evolua seu negócio com recursos premium</p>
              </div>
              <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-2 rounded-xl shadow-lg">
                 <Rocket className="text-white w-6 h-6" />
              </div>
           </div>

           {/* PLANO COMPLETO (PRO) */}
           <div className={`p-8 rounded-[3rem] shadow-2xl relative overflow-hidden transition-all duration-500 ${currentUser.hasProPlan ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 border border-slate-100'}`}>
              {currentUser.hasProPlan && (
                 <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
              )}
              <div className="relative z-10">
                 <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                       <div className={`p-3 rounded-2xl ${currentUser.hasProPlan ? 'bg-amber-500 text-slate-900' : 'bg-slate-100 text-slate-400'}`}>
                          <Crown size={24} />
                       </div>
                       <div>
                          <h4 className="text-xl font-black uppercase tracking-tight">Plano Profissional</h4>
                          <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full ${currentUser.hasProPlan ? 'bg-white/10 text-emerald-400' : 'bg-slate-100 text-slate-400'}`}>
                             {currentUser.hasProPlan ? 'ASSINATURA ATIVA' : 'MENSAL'}
                          </span>
                       </div>
                    </div>
                    {currentUser.hasProPlan ? (
                       <PlanCountDown expiresAt={currentUser.proExpiresAt} light={true} />
                    ) : (
                       <p className="text-2xl font-black text-slate-800">R$ 34,90</p>
                    )}
                 </div>

                 <ul className="space-y-3 mb-8">
                    {[
                       'Vitrine Online (Link da Loja)',
                       'Loja Destacada no Marketplace',
                       'Prioridade no Suporte (24h)',
                       'Remoção Total de Anúncios'
                    ].map((feature, i) => (
                       <li key={i} className="flex items-center gap-3 text-xs font-bold uppercase tracking-tight opacity-90">
                          <CheckCircle className={`w-4 h-4 ${currentUser.hasProPlan ? 'text-emerald-400' : 'text-indigo-600'}`} />
                          {feature}
                       </li>
                    ))}
                 </ul>

                 {currentUser.hasProPlan ? (
                    <div className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center gap-2 text-emerald-400 font-black uppercase text-[10px] tracking-widest">
                       <Check size={16} /> Você é PRO Master
                    </div>
                 ) : (
                    <button 
                       onClick={() => handleSubscribe('Plano Profissional', 'R$ 34,90/mês')}
                       className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-900/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                       <Star className="w-4 h-4 fill-white" /> Quero ser PRO
                    </button>
                 )}
              </div>
           </div>

           {/* PLANO REMOVER ADS */}
           <div className={`p-8 rounded-[3rem] shadow-xl relative overflow-hidden transition-all duration-500 ${currentUser.isAdFree && !currentUser.hasProPlan ? 'bg-blue-600 text-white' : 'bg-white text-slate-800 border border-slate-100'}`}>
              <div className="relative z-10">
                 <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                       <div className={`p-3 rounded-2xl ${currentUser.isAdFree ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                          <EyeOff size={24} />
                       </div>
                       <div>
                          <h4 className="text-xl font-black uppercase tracking-tight">Remover Anúncios</h4>
                          <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full ${currentUser.isAdFree ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                             {currentUser.isAdFree ? 'ATIVO' : 'MENSAL'}
                          </span>
                       </div>
                    </div>
                    {currentUser.isAdFree ? (
                       <PlanCountDown expiresAt={currentUser.adFreeExpiresAt} light={true} />
                    ) : (
                       <p className="text-2xl font-black text-slate-800">R$ 9,90</p>
                    )}
                 </div>

                 <p className={`text-[10px] font-bold uppercase leading-relaxed mb-8 ${currentUser.isAdFree ? 'opacity-90' : 'text-slate-500'}`}>
                    Navegue com mais foco e velocidade removendo todas as publicidades do aplicativo.
                 </p>

                 {currentUser.isAdFree ? (
                    <div className="w-full py-4 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center gap-2 text-white font-black uppercase text-[10px] tracking-widest">
                       <Check size={16} /> Anúncios Removidos
                    </div>
                 ) : (
                    <button 
                       onClick={() => handleSubscribe('Remover Anúncios', 'R$ 9,90/mês')}
                       className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                       <Zap className="w-4 h-4" /> Assinar Remoção
                    </button>
                 )}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'SISTEMA' && (
        <div className="space-y-6">
           {isGodModeUnlocked && isSuperAdmin && (
              <div className="bg-slate-950 p-8 rounded-[3rem] shadow-2xl border-2 border-amber-500/50 text-white relative overflow-hidden group animate-pulse hover:animate-none transition-all">
                 <div className="relative z-10 flex justify-between items-center">
                    <div>
                       <div className="flex items-center gap-2 mb-2 text-amber-500"><ShieldAlert size={20} /><span className="text-[9px] font-black uppercase tracking-[0.4em]">ADMIN MASTER ATIVO</span></div>
                       <h3 className="text-3xl font-black mb-1 tracking-tighter">Painel Kernel</h3>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gestão Global da Rede</p>
                    </div>
                    <button onClick={() => onNavigate('GOD_MODE')} className="p-6 bg-amber-500 text-slate-950 rounded-[2rem] shadow-2xl shadow-amber-500/20 hover:scale-110 active:scale-90 transition-all flex items-center gap-3">
                       <span className="text-xs font-black uppercase">Entrar</span>
                       <ArrowRight size={28} />
                    </button>
                 </div>
                 <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] -mr-32 -mt-32" />
              </div>
           )}

           <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-3"><div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><FileDown size={16} /></div> Relatórios (PDF)</h3>
              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => handleDownloadReport('day')} className="p-5 bg-slate-50 text-slate-700 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-orange-50 hover:text-orange-600 transition-all border border-transparent hover:border-orange-100 flex flex-col items-center gap-2"><Printer size={16} /> Relatório Hoje</button>
                 <button onClick={() => handleDownloadReport('week')} className="p-5 bg-slate-50 text-slate-700 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-orange-50 hover:text-orange-600 transition-all border border-transparent hover:border-orange-100 flex flex-col items-center gap-2"><Printer size={16} /> Últimos 7 Dias</button>
                 <button onClick={() => handleDownloadReport('month')} className="p-5 bg-slate-50 text-slate-700 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-orange-50 hover:text-orange-600 transition-all border border-transparent hover:border-orange-100 flex flex-col items-center gap-2"><Printer size={16} /> Últimos 30 Dias</button>
                 <button onClick={() => handleDownloadReport('all')} className="p-5 bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg flex flex-col items-center gap-2"><Printer size={16} /> Baixar Tudo</button>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-3"><div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><Trash2 size={16} /></div> Manutenção</h3>
              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => requestClear('day', 'Hoje')} className="p-5 bg-slate-50 text-slate-600 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100">Limpar Hoje</button>
                 <button onClick={() => requestClear('week', 'Semana')} className="p-5 bg-slate-50 text-slate-600 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100">Limpar Semana</button>
                 <button onClick={() => requestClear('month', 'Mês')} className="p-5 bg-slate-50 text-slate-600 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100">Limpar Mês</button>
                 <button onClick={() => requestClear('all', 'Tudo')} className="p-5 bg-slate-50 text-rose-600 rounded-2xl font-black uppercase text-[9px] shadow-sm border border-rose-100 hover:bg-rose-600 hover:text-white transition-all">ZERAR TUDO</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAIS (MANTIDOS) */}
      {editingSection && (
        <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-3xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-8 shrink-0">
                 <div><h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Gerenciar Seção</h3><p className="text-[10px] font-black text-indigo-600 uppercase mt-2">{editingSection.name}</p></div>
                 <button onClick={() => { setEditingSection(null); setEditingItemId(null); }} className="p-3 bg-slate-100 rounded-full"><X size={20} /></button>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-2xl mb-8 shrink-0">
                 <button onClick={() => { setSectionEditTab('ITEMS'); setEditingItemId(null); }} className={`flex-1 py-3.5 text-[10px] font-black uppercase rounded-xl transition-all ${sectionEditTab === 'ITEMS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Produtos</button>
                 <button onClick={() => { setSectionEditTab('EXPENSES'); setEditingItemId(null); }} className={`flex-1 py-3.5 text-[10px] font-black uppercase rounded-xl transition-all ${sectionEditTab === 'EXPENSES' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>Despesas</button>
              </div>
              <div className="space-y-4 mb-8 shrink-0 bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                 <input autoFocus value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="NOME DO ITEM" className="w-full p-4 bg-white border border-slate-200 rounded-xl font-black text-xs uppercase outline-none" />
                 <div className="flex gap-2">
                    <input value={newItem.priceVista} onChange={e => setNewItem({...newItem, priceVista: e.target.value})} placeholder="R$ VISTA" className="flex-1 p-4 bg-white border border-slate-200 rounded-xl font-black text-xs text-center outline-none" />
                    <input value={newItem.pricePrazo} onChange={e => setNewItem({...newItem, pricePrazo: e.target.value})} placeholder="R$ PRAZO" className="flex-1 p-4 bg-white border border-slate-200 rounded-xl font-black text-xs text-center outline-none" />
                 </div>
                 <button onClick={handleAddItemToSection} className="w-full py-4 bg-indigo-600 text-white rounded-xl shadow-lg font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">{editingItemId ? 'Salvar Edição' : 'Adicionar Item'}</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                 {(sectionEditTab === 'ITEMS' ? editingSection.items : editingSection.expenses).map(item => (
                    <div key={item.id} className="flex justify-between items-center p-4 rounded-2xl border bg-white border-slate-100 shadow-sm group hover:border-indigo-200">
                       <div><p className="font-black text-slate-800 text-xs uppercase leading-tight">{item.name}</p><div className="flex items-center gap-3 mt-1"><span className="text-[8px] font-bold text-slate-400 uppercase">VISTA: R${item.defaultPriceAVista?.toFixed(2)}</span><span className="text-[8px] font-bold text-slate-400 uppercase">PRAZO: R${item.defaultPriceAPrazo?.toFixed(2)}</span></div></div>
                       <div className="flex gap-1"><button onClick={() => startEditItem(item)} className="p-3 text-blue-500 rounded-xl"><Edit3 size={16} /></button><button onClick={() => handleRemoveItemFromSection(item.id)} className="p-3 text-slate-200 hover:text-rose-500 rounded-xl"><Trash2 size={16} /></button></div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl animate-in zoom-in-95">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter">{editingCustomer ? 'Editar' : 'Novo'} Cliente</h3>
              <div className="space-y-4">
                 <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">Nome</label><div className="relative"><UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input autoFocus value={customerFormData.name} onChange={e => setCustomerFormData({...customerFormData, name: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border-2 border-transparent rounded-2xl font-bold uppercase text-xs outline-none focus:border-emerald-500" placeholder="EX: JOÃO SILVA" /></div></div>
                 <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">Telefone/WhatsApp</label><div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input value={customerFormData.phone} onChange={e => setCustomerFormData({...customerFormData, phone: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 border-2 border-transparent rounded-2xl font-bold uppercase text-xs outline-none focus:border-emerald-500" placeholder="EX: 21999999999" /></div></div>
              </div>
              <div className="flex gap-3 mt-10"><button onClick={() => { setShowCustomerModal(false); setEditingCustomer(null); }} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button><button onClick={handleSaveCustomer} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all">Salvar Cliente</button></div>
           </div>
        </div>
      )}

      {(showAddUser || editingUser) && (
        <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-3xl overflow-y-auto max-h-[90vh] no-scrollbar">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter">{editingUser ? 'Editar' : 'Novo'} Colaborador</h3>
              <div className="space-y-4">
                 <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">Nome</label><input value={editingUser ? editUserData.name : newUser.name} onChange={e => editingUser ? setEditUserData({...editUserData, name: e.target.value}) : setNewUser({...newUser, name: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase text-xs outline-none" /></div>
                 <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">E-mail</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input type="email" value={editingUser ? editUserData.email : newUser.email} onChange={e => editingUser ? setEditUserData({...editUserData, email: e.target.value}) : setNewUser({...newUser, email: e.target.value})} className="w-full p-4 pl-12 bg-slate-50 rounded-2xl font-bold text-xs outline-none" /></div></div>
                 <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">Função</label><select value={editingUser ? editUserData.role : newUser.role} onChange={e => { const val = e.target.value as UserRole; editingUser ? setEditUserData({...editUserData, role: val}) : setNewUser({...newUser, role: val}); }} className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase text-xs outline-none"><option value="MANAGER_FACTORY">Gerente Fábrica</option><option value="MANAGER_STALL">Gerente Barraca</option><option value="OWNER">Proprietário</option></select></div>
                 <div className="space-y-1 mt-4"><label className="text-[9px] font-black uppercase text-slate-400 ml-4 text-center block">PIN Acesso (6 dígitos)</label><input type="number" maxLength={6} value={editingUser ? editUserData.pin : newUser.pin} onChange={e => editingUser ? setEditUserData({...editUserData, pin: e.target.value}) : setNewUser({...newUser, pin: e.target.value})} className="w-full p-5 bg-slate-100 border-2 border-indigo-200 rounded-2xl font-black text-center text-2xl outline-none tracking-[0.5em]" placeholder="000000" /></div>
                 
                 {/* Seleção de Abas */}
                 <div className="pt-6 border-t border-slate-100">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-2 block">Permissões de Acesso</label>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                       {sections.map(section => {
                          const currentIds = editingUser ? editUserData.assignedSectionIds : newUser.assignedSectionIds;
                          const isSelected = currentIds.includes(section.id);
                          return (
                             <button 
                                key={section.id} 
                                onClick={() => toggleSectionPermission(section.id)}
                                className={`p-3 rounded-xl border flex items-center gap-2 transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}
                             >
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                   {isSelected && <Check size={10} className="text-white" />}
                                </div>
                                <span className="text-[9px] font-black uppercase">{section.name}</span>
                             </button>
                          );
                       })}
                    </div>
                    
                    <button 
                       onClick={() => editingUser ? setEditUserData({...editUserData, hideSalesValues: !editUserData.hideSalesValues}) : setNewUser({...newUser, hideSalesValues: !newUser.hideSalesValues})}
                       className={`w-full p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${
                          (editingUser ? editUserData.hideSalesValues : newUser.hideSalesValues) ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-100 text-slate-400'
                       }`}
                    >
                       <div className="flex items-center gap-3">
                          {(editingUser ? editUserData.hideSalesValues : newUser.hideSalesValues) ? <EyeOff size={18} /> : <Eye size={18} />}
                          <div className="text-left">
                             <p className="text-[10px] font-black uppercase">Ocultar Financeiro</p>
                             <p className="text-[8px] font-bold opacity-60">Esconder totais e valores</p>
                          </div>
                       </div>
                       <div className={`w-10 h-6 rounded-full relative transition-all ${(editingUser ? editUserData.hideSalesValues : newUser.hideSalesValues) ? 'bg-rose-500' : 'bg-slate-300'}`}>
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${(editingUser ? editUserData.hideSalesValues : newUser.hideSalesValues) ? 'left-5' : 'left-1'}`} />
                       </div>
                    </button>
                 </div>
              </div>
              <div className="flex gap-3 mt-10"><button onClick={() => { setShowAddUser(false); setEditingUser(null); }} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button><button onClick={editingUser ? handleUpdateUser : handleAddUser} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all">Salvar Acesso</button></div>
           </div>
        </div>
      )}

      {/* CONFIRMAÇÃO DE LIMPEZA */}
      {clearConfirm && (
        <div className="fixed inset-0 z-[250] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-3xl text-center">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner"><AlertTriangle className="w-10 h-10 text-rose-500" /></div>
              <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tighter">Limpar Histórico?</h3>
              <p className="text-slate-500 text-xs mb-10 leading-relaxed uppercase font-bold px-4">
                Você está prestes a apagar os registros de: <span className="text-rose-600">"{clearConfirm.label}"</span>.
                <br/><br/>
                Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setClearConfirm(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] bg-slate-50 rounded-2xl">Cancelar</button>
                <button onClick={executeClear} disabled={isProcessing} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                  {isProcessing ? <Loader2 className="animate-spin" /> : <Trash2 size={16} />} Confirmar
                </button>
              </div>
            </div>
        </div>
      )}

      {deleteConfirmation && (
        <div className="fixed inset-0 z-[250] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-3xl text-center">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner"><AlertTriangle className="w-10 h-10 text-rose-500" /></div>
              <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tighter">Remover Item?</h3>
              <p className="text-slate-500 text-xs mb-10 leading-relaxed uppercase font-bold px-4">Deseja realmente excluir <span className="text-rose-600">"{deleteConfirmation.name}"</span>? Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3"><button onClick={() => setDeleteConfirmation(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] bg-slate-50 rounded-2xl">Cancelar</button><button onClick={handleDelete} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all">Confirmar</button></div>
           </div>
        </div>
      )}
    </div>
  );
};