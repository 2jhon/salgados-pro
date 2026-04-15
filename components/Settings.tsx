
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useInterval } from '../hooks/useInterval';
import { AppSection, User, Transaction, Ad, StoreProfile, Customer, ConfigItem } from '../types';
import { useCustomers } from '../hooks/useCustomers';
import { normalizeString } from '../lib/utils';
import { MarketplaceManager } from './MarketplaceManager';
import { StoreProfileSettings } from './StoreProfileSettings';
import { CouponManager } from './CouponManager';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { GoogleGenAI } from "@google/genai";
import { supabase } from '../lib/supabase';
import { AuditLog } from './AuditLog';
import { 
  Layout, Users, Megaphone, Settings as SettingsIcon,
  Plus, Trash2, Save, Edit3, DollarSign, 
  Check, X, Loader2, Store, Package, UserCircle, Phone, Search,
  ShoppingBag, Truck, Calendar, ArrowRight,
  UserPlus, CheckCircle2, AlertTriangle, LogOut, CreditCard, ToggleLeft, ToggleRight, 
  Volume2, VolumeX, Eye, EyeOff, Download, Database, Music, FileText, Zap, MessageCircle,
  Image as ImageIcon, Upload, Camera, Wand2, Clock, Printer, Bluetooth, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { printer } from '../lib/printer';

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
}

const PlanTimer = ({ expiresAt }: { expiresAt?: string }) => {
  const [label, setLabel] = useState('');

  const update = useCallback(() => {
    const now = Date.now();
    const end = new Date(expiresAt).getTime();
    const diff = end - now;
    
    if (diff <= 0) {
      setLabel('Expirado');
      return;
    }
    
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    setLabel(`${d}d ${h}h restantes`);
  }, [expiresAt]);

  useEffect(() => {
    if (!expiresAt) return;
    update();
  }, [expiresAt, update]);

  useInterval(update, expiresAt ? 60000 : null);

  if (!label) return null;
  return <p className="text-[8px] font-bold uppercase tracking-widest opacity-80 mt-1">{label}</p>;
};

const PromoTimer = ({ expiresAt }: { expiresAt?: string }) => {
  const [label, setLabel] = useState('');

  const update = useCallback(() => {
    if (!expiresAt) return;
    const now = Date.now();
    const end = new Date(expiresAt).getTime();
    const diff = end - now;
    
    if (diff <= 0) {
      setLabel('');
      return;
    }
    
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    
    setLabel(`${d > 0 ? `${d}d ` : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
  }, [expiresAt]);

  useEffect(() => {
    if (!expiresAt) return;
    update();
  }, [expiresAt, update]);

  useInterval(update, expiresAt ? 1000 : null);

  if (!label) return null;
  return <span className="tabular-nums">{label}</span>;
};

export const Settings: React.FC<SettingsProps> = ({
  sections, saveConfig, deleteSection, users, addUser, removeUser, updateUser,
  transactions, clearTransactions, archiveYear, currentUser, companyProfile, onSaveProfile, 
  ads, saveAd, deleteAd, onNavigate,
  isGodModeUnlocked, onUnlockGodMode, addNote
}) => {
  const [activeTab, setActiveTab] = useState<'ESTRUTURA' | 'CLIENTES' | 'EQUIPE' | 'VITRINE' | 'MARKETING' | 'ANUNCIO' | 'SISTEMA' | 'PLANOS' | 'AUDITORIA'>('ESTRUTURA');

  useEffect(() => {
    const pendingTab = localStorage.getItem('settings_pending_tab');
    if (pendingTab) {
      const validTabs: any[] = ['ESTRUTURA', 'CLIENTES', 'EQUIPE', 'VITRINE', 'MARKETING', 'ANUNCIO', 'SISTEMA', 'PLANOS'];
      if (validTabs.includes(pendingTab)) {
        setActiveTab(pendingTab as any);
      }
      localStorage.removeItem('settings_pending_tab');
    }
  }, []);

  const [clientSubTab, setClientSubTab] = useState<'CLIENT' | 'SUPPLIER'>('CLIENT');
  
  const { customers, addCustomer, removeCustomer, updateCustomer } = useCustomers(currentUser.workspaceId);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [supportPhone, setSupportPhone] = useState('21999999999');
  const [adDailyPrice, setAdDailyPrice] = useState(5);
  const [promoAdPrice, setPromoAdPrice] = useState<number | null>(null);
  const [promoAdEndsAt, setPromoAdEndsAt] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        // Tenta ler da nova tabela system_settings
        const { data: newSettings } = await supabase.from('system_settings').select('*').eq('id', 'GLOBAL').maybeSingle();
        
        if (newSettings) {
          setSupportPhone(newSettings.support_phone);
          setAdDailyPrice(newSettings.ad_daily_price);
          setPromoAdPrice(newSettings.promo_ad_price);
          setPromoAdEndsAt(newSettings.promo_ad_ends_at);
        } else {
          // Fallback
          const { data } = await supabase.from('app_config').select('items').eq('id', 'GLOBAL_SYSTEM_SETTINGS').maybeSingle();
          if (data && Array.isArray(data.items) && data.items[0]?.support_phone) {
            setSupportPhone(data.items[0].support_phone);
          }
        }

        // Busca Planos (incluindo campos técnicos)
        const { data: plansData } = await supabase.from('subscription_plans').select('*').eq('active', true).order('sort_order', { ascending: true });
        if (plansData) setPlans(plansData);
      } catch (e) { console.warn("Kernel: Erro ao carregar configurações globais."); }
    };
    fetchGlobalSettings();
  }, []);

  // Benefícios Automatizados do Plano Ativo
  const activePlan = useMemo(() => {
    if (!currentUser.activePlanId) return null;
    return plans.find(p => p.id === currentUser.activePlanId);
  }, [currentUser.activePlanId, plans]);

  const now = Date.now();

  const isProActive = useMemo(() => {
    const manual = currentUser.hasProPlan && currentUser.proExpiresAt && new Date(currentUser.proExpiresAt).getTime() > now;
    const fromPlan = activePlan?.grants_pro && currentUser.proExpiresAt && new Date(currentUser.proExpiresAt).getTime() > now;
    return !!(manual || fromPlan);
  }, [currentUser, activePlan, now]);

  const isAdFreeActive = useMemo(() => {
    const manual = currentUser.isAdFree && currentUser.adFreeExpiresAt && new Date(currentUser.adFreeExpiresAt).getTime() > now;
    const fromPlan = activePlan?.grants_ad_free && currentUser.adFreeExpiresAt && new Date(currentUser.adFreeExpiresAt).getTime() > now;
    return !!(manual || fromPlan);
  }, [currentUser, activePlan, now]);

  const isAdvertiserActive = useMemo(() => {
    const manual = currentUser.isAdvertiser && currentUser.advertiserExpiresAt && new Date(currentUser.advertiserExpiresAt).getTime() > now;
    const fromPlan = activePlan?.grants_advertiser && currentUser.advertiserExpiresAt && new Date(currentUser.advertiserExpiresAt).getTime() > now;
    return !!(manual || fromPlan);
  }, [currentUser, activePlan, now]);

  const freeAdsRemaining = useMemo(() => {
    if (!activePlan) return 0;
    const limit = activePlan.free_ads_per_month || 0;
    const used = currentUser.freeAdsUsedThisMonth || 0;
    return Math.max(0, limit - used);
  }, [activePlan, currentUser.freeAdsUsedThisMonth]);

  const isFreeAdAvailable = freeAdsRemaining > 0;

  // Preço efetivo para o usuário atual (considera desconto customizado ou promoção global)
  const effectiveAdPrice = useMemo(() => {
    if (isFreeAdAvailable) return 0;
    if (currentUser.customAdPrice) return currentUser.customAdPrice;
    
    const nowTs = new Date().getTime();
    if (promoAdPrice && promoAdEndsAt && new Date(promoAdEndsAt).getTime() > nowTs) {
      return promoAdPrice;
    }
    
    return adDailyPrice;
  }, [currentUser.customAdPrice, adDailyPrice, promoAdPrice, promoAdEndsAt, isFreeAdAvailable]);

  const isAdPromoActive = promoAdPrice && promoAdEndsAt && new Date(promoAdEndsAt).getTime() > new Date().getTime();
  
  // System Tab States
  const [sysPeriod, setSysPeriod] = useState<'day' | 'week' | 'month' | 'all' | 'custom'>('day');
  const [sysScope, setSysScope] = useState<'ALL' | 'FACTORY' | 'STALL'>('ALL');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  
  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{ show: boolean, title: string, message: string, onConfirm: () => void } | null>(null);
  const [promptModal, setPromptModal] = useState<{ show: boolean, title: string, placeholder: string, value: string, onConfirm: (val: string) => void } | null>(null);
  const [successModal, setSuccessModal] = useState<{ show: boolean, title: string, message: string } | null>(null);
  
  // States for Customer Modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCustomerHistory, setShowCustomerHistory] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', type: 'CLIENT' as 'CLIENT' | 'SUPPLIER' });

  // States for Team Modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ 
    name: '', 
    phone: '', 
    email: '',
    accessCode: '', 
    role: 'MANAGER_FACTORY',
    hideSalesValues: false,
    assignedSectionIds: [] as string[]
  });

  // States for Section Modal
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<AppSection | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: '', type: 'FACTORY_STYLE' });

  // States for Manage Item (Modal Content)
  const [manageTab, setManageTab] = useState<'PRODUCTS' | 'EXPENSES'>('PRODUCTS');
  const [manageForm, setManageForm] = useState({ 
    name: '', 
    priceVista: '', 
    pricePrazo: '', 
    imageUrl: '',
    promoVista: '',
    promoPrazo: '',
    promoEndsAt: ''
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const manageFileInputRef = useRef<HTMLInputElement>(null);

  // States for Ad Tab
  const [adForm, setAdForm] = useState({ 
    title: '', 
    description: '', 
    whatsapp: '',
    duration: 7,
    mediaUrl: ''
  });
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const adFileInputRef = React.useRef<HTMLInputElement>(null);

  const isSuperAdmin = currentUser.role === 'OWNER';

  // --- HANDLERS ---

  const handleSaveCustomer = async () => {
    if (!customerForm.name) return;
    setIsProcessing(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, { 
          name: customerForm.name, 
          phone: customerForm.phone,
          type: customerForm.type 
        });
      } else {
        await addCustomer(customerForm.name, customerForm.phone, customerForm.type);
      }
      setShowCustomerModal(false);
      setCustomerForm({ name: '', phone: '', type: clientSubTab });
      setEditingCustomer(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveUser = async () => {
    if (!userForm.name || !userForm.accessCode) return;
    setIsProcessing(true);
    
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: userForm.name,
          phone: userForm.phone,
          email: userForm.email,
          accessCode: userForm.accessCode,
          role: userForm.role as any,
          hideSalesValues: userForm.hideSalesValues,
          assignedSectionIds: userForm.assignedSectionIds
        });
        
        if (addNote) {
          addNote({
            workspaceId: currentUser.workspaceId,
            createdById: 'system',
            createdByName: 'Segurança',
            content: `Usuário ${userForm.name} alterado por ${currentUser.name}.`,
            type: 'LOG'
          });
          
          if (editingUser.accessCode !== userForm.accessCode) {
            addNote({
              workspaceId: currentUser.workspaceId,
              createdById: 'system',
              createdByName: 'Segurança',
              content: `PIN de acesso do usuário ${userForm.name} foi alterado.`,
              type: 'SECURITY'
            });
          }
        }
      } else {
        await addUser({
          workspaceId: currentUser.workspaceId,
          name: userForm.name,
          phone: userForm.phone,
          email: userForm.email,
          accessCode: userForm.accessCode,
          role: userForm.role as any,
          isAdFree: false,
          isAdvertiser: false,
          hideSalesValues: userForm.hideSalesValues,
          enableSounds: true,
          hasProPlan: false,
          assignedSectionIds: userForm.assignedSectionIds
        });
        
        if (addNote) {
          addNote({
            workspaceId: currentUser.workspaceId,
            createdById: 'system',
            createdByName: 'Segurança',
            content: `Novo usuário ${userForm.name} criado por ${currentUser.name}.`,
            type: 'LOG'
          });
        }
      }
      setShowUserModal(false);
      setEditingUser(null);
      toast.success("Colaborador salvo com sucesso!");
    } catch(e) {
      toast.error("Erro ao salvar usuário.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler for creating NEW sections (Plus button)
  const handleCreateSection = async () => {
    if (!sectionForm.name) return;
    setIsProcessing(true);
    try {
      const updatedSections = [...sections];
      const newSection: AppSection = {
        id: `sec_${Date.now()}`,
        workspaceId: currentUser.workspaceId,
        name: sectionForm.name,
        type: sectionForm.type as any,
        order: sections.length,
        items: [],
        expenses: [],
        globalStockMode: 'GLOBAL'
      };
      updatedSections.push(newSection);
      
      await saveConfig(updatedSections);
      
      if (addNote) {
        addNote({
          workspaceId: currentUser.workspaceId,
          createdById: 'system',
          createdByName: 'Configurações',
          content: `Nova aba "${sectionForm.name}" criada por ${currentUser.name}.`,
          type: 'LOG'
        });
      }
      
      setShowSectionModal(false);
      setSectionForm({ name: '', type: 'FACTORY_STYLE' });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- MANAGE ITEMS HANDLERS (Inside Modal) ---

  const handleManageImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setManageForm(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveManageItem = async () => {
    if (!editingSection || !manageForm.name) return;
    setIsProcessing(true);
    try {
        const isProduct = manageTab === 'PRODUCTS';
        const priceV = parseFloat(manageForm.priceVista.replace(',', '.')) || 0;
        const priceP = parseFloat(manageForm.pricePrazo.replace(',', '.')) || 0;
        const promoV = manageForm.promoVista ? parseFloat(manageForm.promoVista.replace(',', '.')) : undefined;
        const promoP = manageForm.promoPrazo ? parseFloat(manageForm.promoPrazo.replace(',', '.')) : undefined;

        const newItem: ConfigItem = {
            id: editingItemId || `item_${Date.now()}`,
            name: manageForm.name,
            defaultPriceAVista: priceV,
            defaultPriceAPrazo: priceP,
            defaultPrice: priceV, // Fallback
            imageUrl: manageForm.imageUrl,
            promotionalPriceAVista: promoV,
            promotionalPriceAPrazo: promoP,
            promoEndsAt: manageForm.promoEndsAt || undefined,
            currentStock: 0,
            minStock: 0,
            trackStock: true
        };

        const updatedSection = { ...editingSection };
        // Ensure arrays exist
        if (!updatedSection.items) updatedSection.items = [];
        if (!updatedSection.expenses) updatedSection.expenses = [];

        const list = isProduct ? updatedSection.items : updatedSection.expenses;
        
        let newList;
        if (editingItemId) {
            newList = list.map(i => i.id === editingItemId ? { ...i, ...newItem } : i);
        } else {
            newList = [newItem, ...list];
        }

        if (isProduct) updatedSection.items = newList;
        else updatedSection.expenses = newList;

        setEditingSection(updatedSection); // Update local state for modal
        
        // Update global state
        const newSections = sections.map(s => s.id === updatedSection.id ? updatedSection : s);
        await saveConfig(newSections);

        // Reset form
        setManageForm({ name: '', priceVista: '', pricePrazo: '', imageUrl: '' });
        setEditingItemId(null);
        toast.success("Item salvo com sucesso!");
    } catch(e) {
        toast.error("Erro ao salvar item.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDeleteManageItem = async (itemId: string) => {
    if (!editingSection) return;
    
    setConfirmModal({
        show: true,
        title: "EXCLUIR ITEM",
        message: "Deseja realmente remover este item? Esta ação é irreversível.",
        onConfirm: async () => {
            setIsProcessing(true);
            try {
                const isProduct = manageTab === 'PRODUCTS';
                const updatedSection = { ...editingSection };
                const list = isProduct ? (updatedSection.items || []) : (updatedSection.expenses || []);
                const newList = list.filter(i => i.id !== itemId);

                if (isProduct) updatedSection.items = newList;
                else updatedSection.expenses = newList;

                setEditingSection(updatedSection);
                const newSections = sections.map(s => s.id === updatedSection.id ? updatedSection : s);
                await saveConfig(newSections);
            } finally {
                setIsProcessing(false);
                setConfirmModal(null);
            }
        }
    });
  };

  const startEditManageItem = (item: ConfigItem) => {
    setEditingItemId(item.id);
    setManageForm({
        name: item.name,
        priceVista: item.defaultPriceAVista ? String(item.defaultPriceAVista) : '',
        pricePrazo: item.defaultPriceAPrazo ? String(item.defaultPriceAPrazo) : '',
        imageUrl: item.imageUrl || '',
        promoVista: item.promotionalPriceAVista ? String(item.promotionalPriceAVista) : '',
        promoPrazo: item.promotionalPriceAPrazo ? String(item.promotionalPriceAPrazo) : '',
        promoEndsAt: item.promoEndsAt || ''
    });
  };

  // --- AD & AI HANDLERS ---

  const handleGenerateAdText = async () => {
    setPromptModal({
      show: true,
      title: "GERAR TEXTO COM IA",
      placeholder: "Sobre o que é o anúncio? (Ex: Promoção de Coxinha)",
      value: "",
      onConfirm: async (adPrompt) => {
        if (!adPrompt) return;
        setPromptModal(null);
        setIsGeneratingAI(true);
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Crie um título curto e uma descrição vendedora para um anúncio de: ${adPrompt}. Responda em JSON formato: { "title": "...", "description": "..." }`,
            config: { responseMimeType: "application/json" }
          });
          
          const json = JSON.parse(response.text || '{}');
          if (json.title && json.description) {
            setAdForm(prev => ({ ...prev, title: json.title, description: json.description }));
            toast.success("Texto gerado com sucesso!");
          }
        } catch (e) {
          toast.error("Erro ao gerar texto com IA.");
        } finally {
          setIsGeneratingAI(false);
        }
      }
    });
  };

  const uploadAdImage = async (fileOrBase64: File | string): Promise<string | null> => {
    try {
      const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      let fileBody: any;

      if (typeof fileOrBase64 === 'string') {
        // Converte Base64 para Blob
        const base64Data = fileOrBase64.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        fileBody = new Blob([byteArray], { type: 'image/png' });
      } else {
        fileBody = fileOrBase64;
      }

      const { data, error } = await supabase.storage
        .from('ads')
        .upload(fileName, fileBody, {
          contentType: 'image/png',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('ads')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (e) {
      console.error("Erro no upload:", e);
      return null;
    }
  };

  const handleGenerateAdImage = async () => {
    if (!adForm.title) {
      toast.error("Preencha o título primeiro ou use a IA de texto.");
      return;
    }
    
    setIsGeneratingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Using gemini-2.5-flash-image for generation as per instructions for image tasks
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: `Generate a delicious, professional food photography image for an ad about: ${adForm.title}. The image should be appetizing, high resolution, centered.`,
      });

      // Extract image from response parts
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64 = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            const base64Full = `data:${mimeType};base64,${base64}`;
            
            // ESTRUTURA DE PRODUÇÃO: Upload para Storage
            toast.loading("Otimizando e salvando imagem na nuvem...");
            const publicUrl = await uploadAdImage(base64Full);
            
            if (publicUrl) {
              setAdForm(prev => ({ ...prev, mediaUrl: publicUrl }));
              toast.success("Imagem gerada e salva com sucesso!");
            } else {
              // Fallback para base64 se o storage falhar (apenas para não quebrar o fluxo em dev)
              setAdForm(prev => ({ ...prev, mediaUrl: base64Full }));
              toast.warning("Imagem gerada, mas salva localmente (verifique o Storage).");
            }
            break;
          }
        }
      } else {
        toast.error("Nenhuma imagem gerada. Tente novamente.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar imagem. Tente novamente.");
    } finally {
      setIsGeneratingAI(false);
      toast.dismiss();
    }
  };

  const handleSaveAd = async () => {
    if (!adForm.title || !adForm.description || !adForm.whatsapp) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const whatsappLink = `https://wa.me/55${adForm.whatsapp.replace(/\D/g, '')}`;
      
      await saveAd({
        id: editingAdId || undefined,
        ownerId: currentUser.id,
        ownerName: currentUser.name,
        workspaceId: currentUser.workspaceId,
        title: adForm.title,
        description: adForm.description,
        link: whatsappLink,
        backgroundColor: '#f59e0b', // Default orange
        mediaUrl: adForm.mediaUrl,
        requestedDuration: adForm.duration
      });

      // Se usou um anúncio grátis, atualiza o contador do usuário
      if (isFreeAdAvailable && !editingAdId) {
        await supabase.from('users').update({
          free_ads_used_this_month: (currentUser.freeAdsUsedThisMonth || 0) + 1
        }).eq('id', currentUser.id);
      }
      
      // WhatsApp Redirect logic
      const msg = isFreeAdAvailable && !editingAdId 
        ? `Olá, acabei de criar um anúncio gratuito pelo meu plano: *${adForm.title}*. Aguardo aprovação.`
        : `Olá, acabei de ${editingAdId ? 'editar' : 'criar'} um anúncio: *${adForm.title}* (${adForm.duration} dias). Aguardo aprovação para pagamento.`;
      window.open(`https://wa.me/55${supportPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      
      setAdForm({ title: '', description: '', whatsapp: '', duration: 7, mediaUrl: '' });
      setEditingAdId(null);
      toast.success("Anúncio salvo e enviado para análise!");
    } catch (e) {
      toast.error("Erro ao salvar anúncio.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditAd = (ad: Ad) => {
    setEditingAdId(ad.id);
    // Extract phone from link if possible, else empty
    let phone = '';
    if (ad.link && ad.link.includes('wa.me/55')) {
      phone = ad.link.split('wa.me/55')[1];
    }

    setAdForm({
      title: ad.title,
      description: ad.description,
      whatsapp: phone,
      duration: ad.requestedDuration || 7,
      mediaUrl: ad.mediaUrl || ''
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true);
      toast.loading("Enviando imagem...");
      try {
        const publicUrl = await uploadAdImage(file);
        if (publicUrl) {
          setAdForm(prev => ({ ...prev, mediaUrl: publicUrl }));
          toast.success("Imagem enviada com sucesso!");
        } else {
          toast.error("Erro ao enviar imagem para o servidor.");
        }
      } catch (e) {
        toast.error("Erro no processamento da imagem.");
      } finally {
        setIsProcessing(false);
        toast.dismiss();
      }
    }
  };

  const handleHistoryExport = () => {
    // Coleta nomes e IDs atuais das seções para um filtro mais robusto
    const factoryNames = sections.filter(s => s.type === 'FACTORY_STYLE').map(s => normalizeString(s.name));
    const stallNames = sections.filter(s => s.type === 'STALL_STYLE').map(s => normalizeString(s.name));
    const factoryIds = sections.filter(s => s.type === 'FACTORY_STYLE').map(s => s.id);
    const stallIds = sections.filter(s => s.type === 'STALL_STYLE').map(s => s.id);

    const items = transactions.filter(t => {
      // Filtro por Área (Scope)
      if (sysScope !== 'ALL') {
         const txCat = normalizeString(t.category);
         const txId = t.category; // Caso o ID tenha sido salvo como categoria em versões anteriores
         
         if (sysScope === 'FACTORY') {
            // Verifica se pertence à fábrica por nome, ID ou palavra-chave (fallback para seções deletadas/renomeadas)
            const isFactory = factoryNames.includes(txCat) || 
                             factoryIds.includes(txId) || 
                             txCat.includes('fabrica') || 
                             txCat.includes('producao');
            if (!isFactory) return false;
         }
         
         if (sysScope === 'STALL') {
            // Verifica se pertence à barraca por nome, ID ou palavra-chave
            const isStall = stallNames.includes(txCat) || 
                           stallIds.includes(txId) || 
                           txCat.includes('barraca') || 
                           txCat.includes('venda') || 
                           txCat.includes('lanchonete');
            if (!isStall) return false;
         }
      }
      
      // Filtro por Período
      const d = new Date(t.date);
      const now = new Date();
      
      if (sysPeriod === 'day') return d.toDateString() === now.toDateString();
      if (sysPeriod === 'week') {
         const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
         return d >= weekAgo;
      }
      if (sysPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (sysPeriod === 'custom' && customDateStart && customDateEnd) {
         const s = new Date(customDateStart); s.setHours(0,0,0,0);
         const e = new Date(customDateEnd); e.setHours(23,59,59,999);
         return d >= s && d <= e;
      }
      
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (items.length === 0) {
      setConfirmModal({
        show: true,
        title: "RELATÓRIO VAZIO",
        message: "Não foram encontradas transações para os filtros selecionados (Área e Período). Verifique se há lançamentos nestas datas.",
        onConfirm: () => setConfirmModal(null)
      });
      return;
    }

    toast.info("Gerando PDF para download...");
    const doc = new jsPDF();
    const scopeLabel = sysScope === 'ALL' ? 'Geral' : sysScope === 'FACTORY' ? 'Fábrica' : 'Barraca';
    
    doc.setFontSize(18);
    doc.text(`Relatório de Histórico - ${scopeLabel}`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

    const vendas = items.filter(t => t.subCategory !== 'GASTOS');
    const gastos = items.filter(t => t.subCategory === 'GASTOS');

    let currentY = 35;

    if (vendas.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(22, 163, 74); // Green
      doc.text("Entradas / Vendas", 14, currentY);
      currentY += 5;

      const vendasBody = vendas.map(t => {
        const section = sections.find(s => s.id === t.category);
        const originName = section ? section.name : (t.category || 'Geral');
        return [
          new Date(t.date).toLocaleDateString('pt-BR'),
          originName.toUpperCase(),
          t.item,
          t.quantity ? t.quantity.toString() : '-',
          t.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          t.customerName || '-',
          t.isPending ? 'Pendente' : 'Pago'
        ];
      });

      autoTable(doc, {
        head: [['Data', 'Origem', 'Descrição', 'Qtd', 'Valor', 'Cliente', 'Status']],
        body: vendasBody,
        startY: currentY,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [22, 163, 74] },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 25, halign: 'left' },
          2: { cellWidth: 'auto', halign: 'left' },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 25, halign: 'left' },
          6: { cellWidth: 20, halign: 'center' }
        }
      });
      
      const totalVendas = vendas.reduce((acc, t) => acc + t.value, 0);
      currentY = (doc as any).lastAutoTable.finalY + 5;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Entradas: ${totalVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY);
      currentY += 15;
    }

    if (gastos.length > 0) {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(220, 38, 38); // Red
      doc.text("Saídas / Gastos", 14, currentY);
      currentY += 5;

      const gastosBody = gastos.map(t => {
        const section = sections.find(s => s.id === t.category);
        const originName = section ? section.name : (t.category || 'Geral');
        return [
          new Date(t.date).toLocaleDateString('pt-BR'),
          originName.toUpperCase(),
          t.item,
          t.quantity ? t.quantity.toString() : '-',
          t.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          t.customerName || '-',
          t.isPending ? 'Pendente' : 'Pago'
        ];
      });

      autoTable(doc, {
        head: [['Data', 'Origem', 'Descrição', 'Qtd', 'Valor', 'Fornecedor', 'Status']],
        body: gastosBody,
        startY: currentY,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [220, 38, 38] },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 25, halign: 'left' },
          2: { cellWidth: 'auto', halign: 'left' },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 25, halign: 'left' },
          6: { cellWidth: 20, halign: 'center' }
        }
      });
      
      const totalGastos = gastos.reduce((acc, t) => acc + t.value, 0);
      currentY = (doc as any).lastAutoTable.finalY + 5;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Saídas: ${totalGastos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY);
      currentY += 15;
    }

    if (vendas.length > 0 && gastos.length > 0) {
      const totalVendas = vendas.reduce((acc, t) => acc + t.value, 0);
      const totalGastos = gastos.reduce((acc, t) => acc + t.value, 0);
      const saldo = totalVendas - totalGastos;
      
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(saldo >= 0 ? 22 : 220, saldo >= 0 ? 163 : 38, saldo >= 0 ? 74 : 38);
      doc.text(`Saldo do Período: ${saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY);
    }

    doc.save(`historico_${sysScope.toLowerCase()}_${new Date().getTime()}.pdf`);
    toast.success("Download iniciado!");
    
    setSuccessModal({
      show: true,
      title: "DOWNLOAD CONCLUÍDO",
      message: `O relatório de histórico (${scopeLabel}) foi baixado com sucesso.`
    });
    
    if (addNote) {
      addNote({
        workspaceId: currentUser.workspaceId,
        createdById: 'system',
        content: `Relatório de histórico (${scopeLabel}) baixado com sucesso.`,
        type: 'system'
      });
    }
  };

  const handleHistoryClearRequest = () => {
    setConfirmModal({
      show: true,
      title: "ATENÇÃO: ZONA DE PERIGO",
      message: "Esta ação apagará permanentemente o histórico selecionado (apenas itens já PAGOS). As dívidas e pendências serão mantidas. Confirmar?",
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          let categories: string[] | undefined = undefined;
          
          if (sysScope === 'FACTORY') {
             categories = sections.filter(s => s.type === 'FACTORY_STYLE').map(s => s.name);
          } else if (sysScope === 'STALL') {
             categories = sections.filter(s => s.type === 'STALL_STYLE').map(s => s.name);
          }

          let customRange: { start: string, end: string } | undefined;
          if (sysPeriod === 'custom' && customDateStart && customDateEnd) {
             customRange = { start: customDateStart, end: customDateEnd };
          }

          await clearTransactions(sysPeriod, currentUser.workspaceId, customRange, categories);
          
          if (addNote) {
            addNote({
              workspaceId: currentUser.workspaceId,
              createdById: 'system',
              createdByName: 'Segurança',
              content: `Histórico de transações (${sysPeriod}) limpo por ${currentUser.name}.`,
              type: 'LOG'
            });
          }
          toast.success("Histórico limpo com sucesso!");
        } catch (e) {
          toast.error("Erro ao limpar histórico.");
        } finally {
          setIsProcessing(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleArchiveYearRequest = () => {
    const year = prompt("Digite o ano que deseja consolidar e arquivar (ex: 2024):");
    if (!year || isNaN(Number(year)) || year.length !== 4) return alert("Ano inválido.");
    
    setConfirmModal({
      show: true,
      title: `ARQUIVAR ANO ${year}?`,
      message: `Isso irá somar todas as vendas e gastos pagos de ${year}, salvar um resumo e APAGAR as transações individuais para liberar espaço. Deseja continuar?`,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const count = await archiveYear(currentUser.workspaceId, Number(year));
          if (count === 0) {
            toast.info(`Nenhuma transação paga encontrada em ${year}.`);
          } else {
            toast.success(`Ano ${year} arquivado com sucesso! ${count} registros consolidados.`);
          }
        } catch (e) {
          toast.error("Erro ao arquivar ano.");
        } finally {
          setIsProcessing(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const filteredCustomers = customers
    .filter(c => (c.type || 'CLIENT') === clientSubTab)
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // Sound Theme Selection
  const [soundTheme, setSoundTheme] = useState(() => {
     return localStorage.getItem('sound_theme') || (currentUser.enableSounds ? 'DEFAULT' : 'OFF');
  });

  const handleSoundChange = (theme: string) => {
     setSoundTheme(theme);
     localStorage.setItem('sound_theme', theme);
     updateUser(currentUser.id, { enableSounds: theme !== 'OFF' });
  };

  const openManageModal = (section: AppSection) => {
    setEditingSection(section);
    setManageForm({ name: '', priceVista: '', pricePrazo: '', imageUrl: '' });
    setEditingItemId(null);
    setManageTab('PRODUCTS');
    setShowSectionModal(true);
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Header Tabs */}
      <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 flex overflow-x-auto no-scrollbar gap-2">
        {[
          { id: 'ESTRUTURA', icon: Layout, label: 'Estrutura' },
          { id: 'CLIENTES', icon: Users, label: 'Parceiros' },
          { id: 'EQUIPE', icon: UserCircle, label: 'Equipe' },
          { id: 'VITRINE', icon: Store, label: 'Vitrine' },
          { id: 'MARKETING', icon: Sparkles, label: 'Marketing' },
          { id: 'ANUNCIO', icon: Megaphone, label: 'Anúncios' },
          { id: 'PLANOS', icon: CreditCard, label: 'Planos' },
          { id: 'SISTEMA', icon: SettingsIcon, label: 'Sistema' },
          { id: 'AUDITORIA', icon: FileText, label: 'Auditoria' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[80px] py-4 px-2 rounded-[1.6rem] flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={20} />
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      {activeTab === 'ESTRUTURA' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2 sticky top-0 z-40 bg-slate-50 py-2 -mx-2">
            <h3 className="text-xl font-black text-slate-800 ml-2">Minhas Abas</h3>
            <button onClick={() => { setEditingSection(null); setSectionForm({ name: '', type: 'FACTORY_STYLE' }); setShowSectionModal(true); }} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg mr-2">
              <Plus size={20} />
            </button>
          </div>
          <div className="grid gap-4">
            {sections.map(section => (
              <div key={section.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${section.type === 'FACTORY_STYLE' ? 'bg-orange-100 text-orange-600' : section.type === 'STALL_STYLE' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    {section.type === 'FACTORY_STYLE' ? <Package size={24} /> : section.type === 'STALL_STYLE' ? <Store size={24} /> : <Layout size={24} />}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-sm uppercase">{section.name}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {section.type === 'FACTORY_STYLE' ? 'Fábrica' : section.type === 'STALL_STYLE' ? 'Barraca' : 'Estoque'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openManageModal(section)} className="p-3 text-blue-400 hover:bg-blue-50 rounded-xl transition-all border border-blue-100">
                    <Edit3 size={20} />
                  </button>
                  <button 
                    onClick={() => {
                      setConfirmModal({
                        show: true,
                        title: "EXCLUIR ABA",
                        message: `Deseja realmente excluir a aba "${section.name}"? Esta ação é irreversível.`,
                        onConfirm: async () => {
                          await deleteSection(section.id);
                          if (addNote) {
                            addNote({
                              workspaceId: currentUser.workspaceId,
                              createdById: 'system',
                              createdByName: 'Configurações',
                              content: `Aba "${section.name}" excluída por ${currentUser.name}.`,
                              type: 'LOG'
                            });
                          }
                          setConfirmModal(null);
                        }
                      });
                    }} 
                    className="p-3 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-rose-100"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'CLIENTES' && (
        <div className="space-y-6">
          <div className="sticky top-0 z-40 bg-slate-50 pt-2 pb-4 -mx-4 px-4">
            <div className="bg-slate-100 p-1 rounded-2xl flex mb-4">
              <button onClick={() => { setClientSubTab('CLIENT'); setCustomerForm(prev => ({...prev, type: 'CLIENT'})); }} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${clientSubTab === 'CLIENT' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Meus Clientes</button>
              <button onClick={() => { setClientSubTab('SUPPLIER'); setCustomerForm(prev => ({...prev, type: 'SUPPLIER'})); }} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${clientSubTab === 'SUPPLIER' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Meus Fornecedores</button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={`Buscar ${clientSubTab === 'CLIENT' ? 'cliente' : 'fornecedor'}...`} className="w-full p-4 pl-12 bg-white rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-100 shadow-sm" />
              </div>
              <button onClick={() => { setEditingCustomer(null); setCustomerForm({ name: '', phone: '', type: clientSubTab }); setShowCustomerModal(true); }} className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg"><Plus size={20} /></button>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50">
            <div className="space-y-3">
              {filteredCustomers.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 font-black">{c.name.charAt(0)}</div>
                    <div><h4 className="font-black text-slate-700 text-xs uppercase">{c.name}</h4><p className="text-[9px] font-bold text-slate-400">{c.phone || 'Sem telefone'}</p></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowCustomerHistory(c)} className="p-2 text-indigo-500 bg-indigo-50 rounded-lg hover:bg-indigo-100"><FileText size={16} /></button>
                    <button onClick={() => { setEditingCustomer(c); setCustomerForm({ name: c.name, phone: c.phone || '', type: c.type || 'CLIENT' }); setShowCustomerModal(true); }} className="p-2 text-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100"><Edit3 size={16} /></button>
                    <button 
                      onClick={() => { 
                        setConfirmModal({
                          show: true,
                          title: "EXCLUIR CONTATO",
                          message: `Tem certeza que deseja remover ${c.name}?`,
                          onConfirm: async () => {
                            await removeCustomer(c.id);
                            setConfirmModal(null);
                          }
                        });
                      }} 
                      className="p-2 text-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {filteredCustomers.length === 0 && <div className="text-center py-10 text-slate-400"><Users className="w-12 h-12 mx-auto mb-2 opacity-20" /><p className="text-[10px] font-black uppercase tracking-widest">Nenhum registro encontrado</p></div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'EQUIPE' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2 sticky top-0 z-40 bg-slate-50 py-2 -mx-2">
            <h3 className="text-xl font-black text-slate-800 ml-2">Sua Equipe</h3>
            <button onClick={() => { setEditingUser(null); setUserForm({ name: '', phone: '', email: '', accessCode: '', role: 'MANAGER_FACTORY', hideSalesValues: false, assignedSectionIds: [] }); setShowUserModal(true); }} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg mr-2"><UserPlus size={20} /></button>
          </div>
          <div className="grid gap-4">
            {users.sort((a, b) => {
                if (a.id === currentUser.id) return -1;
                if (b.id === currentUser.id) return 1;
                return 0;
            }).map(u => (
              <div key={u.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-500 overflow-hidden relative">
                    {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : u.name.charAt(0)}
                    {u.lastSeen && (new Date().getTime() - new Date(u.lastSeen).getTime() < 5 * 60 * 1000) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-xs uppercase">{u.name} {u.id === currentUser.id ? '(Você)' : ''}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {u.role === 'OWNER' ? 'Proprietário' : u.role === 'MANAGER_FACTORY' ? 'Gerente Fábrica' : 'Gerente Barraca'}
                    </p>
                    <div className="flex gap-2"><p className="text-[9px] font-bold text-indigo-500">PIN: {u.accessCode}</p></div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingUser(u); setUserForm({ name: u.name, phone: u.phone || '', email: u.email || '', accessCode: u.accessCode, role: u.role, hideSalesValues: u.hideSalesValues, assignedSectionIds: u.assignedSectionIds || [] }); setShowUserModal(true); }} className="p-3 text-blue-400 hover:bg-blue-50 rounded-xl transition-all border border-blue-100"><Edit3 size={18} /></button>
                  <button onClick={() => {
                    setConfirmModal({
                      show: true,
                      title: "EXCLUIR COLABORADOR",
                      message: `Tem certeza que deseja remover ${u.name}?`,
                      onConfirm: async () => {
                        await removeUser(u.id);
                        setConfirmModal(null);
                      }
                    });
                  }} className="p-3 text-rose-400 hover:bg-rose-50 rounded-xl transition-all border border-rose-100"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'VITRINE' && <MarketplaceManager profile={companyProfile} onSave={onSaveProfile} workspaceId={currentUser.workspaceId} user={currentUser} sections={sections} />}

      {activeTab === 'MARKETING' && <CouponManager workspaceId={currentUser.workspaceId} />}

      {activeTab === 'ANUNCIO' && (
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50 space-y-6">
              <div className="flex justify-between items-start">
                 <div>
                    <h3 className="text-2xl font-black text-slate-800 uppercase leading-none mb-2">{editingAdId ? 'Editar Anúncio' : 'Divulgue Aqui'}</h3>
                    <p className="text-sm font-medium text-slate-600 max-w-[250px] leading-tight">Crie anúncios para alcançar outros usuários da plataforma. Ideal para fornecedores, serviços e parcerias.</p>
                     <div className="flex flex-wrap gap-2 mt-4">
                        <div className="flex flex-col">
                          {isFreeAdAvailable ? (
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-slate-400 line-through mb-0.5">R$ {adDailyPrice.toFixed(2).replace('.', ',')}</span>
                              <span className="px-3 py-1 bg-emerald-500 rounded-lg text-[9px] font-black text-white shadow-sm uppercase tracking-widest">Grátis pelo Plano</span>
                            </div>
                          ) : (
                            <>
                              {isAdPromoActive && !currentUser.customAdPrice && (
                                <span className="text-[8px] font-black text-slate-400 line-through mb-0.5">R$ {adDailyPrice.toFixed(2).replace('.', ',')}</span>
                              )}
                              <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-[9px] font-black text-orange-500 shadow-sm uppercase tracking-widest">R$ {effectiveAdPrice.toFixed(2).replace('.', ',')} / Dia</span>
                            </>
                          )}
                        </div>
                        {!isFreeAdAvailable && (
                          <span className="px-3 py-1 bg-orange-500 rounded-lg text-[9px] font-black text-white shadow-sm uppercase tracking-widest">Total: R$ {(adForm.duration * effectiveAdPrice).toFixed(2).replace('.', ',')}</span>
                        )}
                        <span className="px-3 py-1 bg-emerald-50 rounded-lg text-[9px] font-black text-emerald-600 uppercase tracking-widest">Pix</span>
                        {isAdPromoActive && !currentUser.customAdPrice && !isFreeAdAvailable && (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-600 rounded-lg text-[9px] font-black uppercase animate-pulse">
                            <Zap size={10} fill="currentColor" /> Oferta Relâmpago: <PromoTimer expiresAt={promoAdEndsAt!} />
                          </div>
                        )}
                        {isFreeAdAvailable && (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase">
                            <Check size={10} /> {freeAdsRemaining} Crédito(s) Restante(s)
                          </div>
                        )}
                     </div>
                 </div>
                 <div className="p-4 bg-orange-50 rounded-[2rem]"><Megaphone className="w-8 h-8 text-orange-500 transform -rotate-12" /></div>
              </div>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Título do Anúncio (Ex: Forneço Embalagens)</label>
                    <div className="flex gap-2">
                      <input value={adForm.title} onChange={e => setAdForm({...adForm, title: e.target.value})} className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold uppercase text-xs outline-none" />
                      <button onClick={handleGenerateAdText} disabled={isGeneratingAI} className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all" title="Gerar com IA">
                        {isGeneratingAI ? <Loader2 className="animate-spin w-5 h-5" /> : <Wand2 className="w-5 h-5" />}
                      </button>
                    </div>
                 </div>
                 <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Descrição Breve...</label><textarea value={adForm.description} onChange={e => setAdForm({...adForm, description: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none h-24 resize-none" /></div>
                 <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase ml-4">WhatsApp (DDD + Número)</label>
                       <input type="tel" value={adForm.whatsapp} onChange={e => setAdForm({...adForm, whatsapp: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none" placeholder="21999999999" />
                    </div>
                    <div className="flex-1 space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Duração (Dias)</label>
                       <div className="flex gap-1">
                          {[1, 7, 15, 30].map(d => (
                            <button 
                              key={d} 
                              onClick={() => setAdForm({...adForm, duration: d})}
                              className={`flex-1 py-4 rounded-2xl font-black text-[10px] transition-all ${adForm.duration === d ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                            >
                              {d}
                            </button>
                          ))}
                       </div>
                    </div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Imagem do Anúncio (Obrigatório)</label>
                    <div className="flex gap-2">
                      <div onClick={() => adFileInputRef.current?.click()} className="flex-1 h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center cursor-pointer hover:border-indigo-300 transition-all relative overflow-hidden group">
                        {adForm.mediaUrl ? <><img src={adForm.mediaUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" /><div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ImageIcon className="text-white w-8 h-8" /></div></> : <div className="text-center"><ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" /><span className="text-[9px] font-black text-slate-400 uppercase">Enviar Foto</span></div>}
                      </div>
                      <button onClick={handleGenerateAdImage} disabled={isGeneratingAI} className="w-16 h-40 bg-purple-50 border-2 border-dashed border-purple-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 hover:bg-purple-100 transition-all text-purple-600" title="Gerar Imagem IA">
                         {isGeneratingAI ? <Loader2 className="animate-spin w-6 h-6" /> : <><Zap size={24} /><span className="text-[8px] font-black uppercase">IA</span></>}
                      </button>
                    </div>
                    <input type="file" ref={adFileInputRef} hidden accept="image/*" onChange={handleAdImageUpload} />
                 </div>
              </div>
              <div className="flex gap-2 justify-end">
                 {editingAdId && (
                   <button onClick={() => { setEditingAdId(null); setAdForm({ title: '', description: '', whatsapp: '', duration: 7, mediaUrl: '' }); }} className="px-6 py-4 text-slate-400 font-black uppercase text-xs hover:text-slate-600">Cancelar</button>
                 )}
                 <button onClick={handleSaveAd} disabled={isProcessing} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                    {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />} {editingAdId ? 'Salvar Alterações' : 'Salvar e Enviar'}
                 </button>
              </div>
           </div>

           <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 uppercase ml-4">Meus Anúncios</h3>
              {ads.filter(a => a.ownerId === currentUser.id).map(ad => (
                <div key={ad.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden">
                         {ad.mediaUrl ? <img src={ad.mediaUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Megaphone /></div>}
                      </div>
                      <div>
                         <h4 className="font-black text-slate-800 text-xs uppercase">{ad.title}</h4>
                         <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${ad.active ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                               {ad.active ? 'Ativo' : 'Em Análise'}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">{ad.clicks} Cliques</span>
                         </div>
                      </div>
                   </div>
                   <div className="flex gap-1">
                      <button onClick={() => handleEditAd(ad)} className="p-3 text-blue-400 hover:bg-blue-50 rounded-xl transition-all border border-blue-100">
                         <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={() => { 
                          setConfirmModal({
                            show: true,
                            title: "EXCLUIR ANÚNCIO",
                            message: "Deseja remover este anúncio?",
                            onConfirm: async () => {
                              await deleteAd(ad.id);
                              setConfirmModal(null);
                            }
                          });
                        }} 
                        className="p-3 text-rose-400 hover:bg-rose-50 rounded-xl transition-all border border-rose-100"
                      >
                         <Trash2 size={18} />
                      </button>
                   </div>
                </div>
              ))}
              {ads.filter(a => a.ownerId === currentUser.id).length === 0 && (
                 <div className="text-center py-10 text-slate-400">
                    <Megaphone className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhum anúncio criado</p>
                 </div>
              )}
           </div>
        </div>
      )}

      {activeTab === 'PLANOS' && (
        <div className="space-y-6">
           <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white border-2 border-slate-800">
              <h3 className="text-2xl font-black mb-2">Plano Atual</h3>
              <div className="flex gap-2 mb-8">
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] ${isProActive ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {isProActive ? 'PRO ATIVO' : 'GRATUITO'}
                </span>
                {isProActive && currentUser.proExpiresAt && <span className="px-3 py-1 bg-emerald-900/50 text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-[0.2em]"><PlanTimer expiresAt={currentUser.proExpiresAt} /></span>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-2xl border ${isAdFreeActive ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                  <EyeOff className={`w-6 h-6 mb-2 ${isAdFreeActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Sem Ads</p>
                  {isAdFreeActive && <PlanTimer expiresAt={currentUser.adFreeExpiresAt} />}
                </div>
                <div className={`p-4 rounded-2xl border ${isAdvertiserActive ? 'bg-amber-900/20 border-amber-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                  <Megaphone className={`w-6 h-6 mb-2 ${isAdvertiserActive ? 'text-amber-400' : 'text-slate-500'}`} />
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Anunciante</p>
                  {isAdvertiserActive && <PlanTimer expiresAt={currentUser.advertiserExpiresAt} />}
                </div>
              </div>
           </div>
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50">
               <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 ml-2">Assinar ou Renovar</h4>
               <div className="space-y-3">
                 {plans.map(plan => {
                   const isPro = plan.name.toUpperCase().includes('PRO');
                   const now = new Date().getTime();
                   const isPromoActive = plan.promo_price && plan.promo_ends_at && new Date(plan.promo_ends_at).getTime() > now;
                   
                   let displayPrice = plan.price;
                   if (isPro && currentUser.customProPrice) {
                     displayPrice = currentUser.customProPrice;
                   } else if (isPromoActive) {
                     displayPrice = plan.promo_price;
                   }
                   
                   return (
                     <button 
                       key={plan.id}
                       onClick={() => window.open(`https://wa.me/55${supportPhone}?text=${encodeURIComponent(`Quero assinar o ${plan.name}!`)}`, '_blank')} 
                       className={`w-full p-5 rounded-[2rem] flex items-center justify-between group active:scale-95 transition-all relative overflow-hidden ${isPro ? 'bg-slate-900 text-white' : 'bg-white border-2 border-slate-100 hover:border-slate-200'}`}
                     >
                       {isPromoActive && !currentUser.customProPrice && (
                         <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[7px] font-black px-4 py-1 rotate-45 translate-x-3 -translate-y-1 uppercase tracking-tighter shadow-sm flex flex-col items-center pt-2">
                           <span>Oferta</span>
                           <span className="text-[6px] opacity-80"><PromoTimer expiresAt={plan.promo_ends_at} /></span>
                         </div>
                       )}
                       <div className="text-left">
                         <p className={`text-xs font-black uppercase flex items-center gap-2 ${isPro ? 'text-yellow-400' : 'text-slate-600'}`}>
                           {isPro ? <Zap size={14} fill="currentColor" /> : <EyeOff size={14} />} {plan.name}
                         </p>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{plan.description}</p>
                       </div>
                       <div className="text-right">
                         {isPromoActive && !currentUser.customProPrice && (
                           <p className="text-[9px] font-black text-slate-500 line-through uppercase tracking-widest leading-none mb-1">R$ {(plan.price || 0).toFixed(2).replace('.', ',')}</p>
                         )}
                         <span className={`text-lg font-black ${isPro ? 'text-white' : 'text-slate-700'}`}>
                           R$ {(displayPrice || 0).toFixed(2).replace('.', ',')}
                           <span className="text-[9px] font-medium text-slate-500 ml-1">/MÊS</span>
                         </span>
                       </div>
                     </button>
                   );
                 })}
                 {plans.length === 0 && (
                   <div className="py-6 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Carregando planos...</div>
                 )}
               </div>
               <button onClick={() => window.open(`https://wa.me/55${supportPhone}?text=Olá, preciso de suporte.`, '_blank')} className="w-full mt-6 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"><MessageCircle size={16} /> Falar com Suporte</button>
            </div>
        </div>
      )}

      {activeTab === 'SISTEMA' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50">
             <h3 className="text-lg font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><Printer size={20} className="text-slate-400" /> Impressora Térmica</h3>
             <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
                  Conecte sua impressora térmica Bluetooth (58mm ou 80mm) para imprimir recibos diretamente do aplicativo.
                </p>
                <button 
                  onClick={async () => {
                    const toastId = toast.loading("Conectando à impressora...");
                    try {
                      const success = await printer.connect();
                      if (success) {
                        toast.success("Impressora conectada com sucesso!", { id: toastId });
                      } else {
                        toast.error("Não foi possível conectar. Verifique se o Bluetooth está ligado.", { id: toastId });
                      }
                    } catch (e: any) {
                      toast.error(e.message || "Erro na conexão Bluetooth.", { id: toastId });
                    }
                  }}
                  className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 border-indigo-100 hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <Bluetooth size={18} /> Conectar Impressora
                </button>
             </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50">
             <h3 className="text-lg font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><Music size={20} className="text-slate-400" /> Sons do Sistema</h3>
             <div className="flex gap-2">{['DEFAULT', 'SOFT', 'MECHANICAL', 'OFF'].map(theme => { const labels: any = { 'DEFAULT': 'Padrão', 'SOFT': 'Suave', 'MECHANICAL': 'Mec.', 'OFF': 'Off' }; const isSelected = soundTheme === theme; return (<button key={theme} onClick={() => handleSoundChange(theme)} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase transition-all border-2 ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-400'}`}>{labels[theme]}</button>); })}</div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50">
             <h3 className="text-lg font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><Database size={20} className="text-slate-400" /> Gerenciar Dados</h3>
             <div className="space-y-6">
                <div><label className="text-[9px] font-black uppercase text-slate-400 ml-2 mb-2 block">1. Área</label><div className="flex bg-slate-50 p-1 rounded-xl">{[{ id: 'ALL', label: 'Tudo' }, { id: 'FACTORY', label: 'Fábrica' }, { id: 'STALL', label: 'Barraca' }].map(scope => (<button key={scope.id} onClick={() => setSysScope(scope.id as any)} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase transition-all ${sysScope === scope.id ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>{scope.label}</button>))}</div></div>
                <div><label className="text-[9px] font-black uppercase text-slate-400 ml-2 mb-2 block">2. Período</label><div className="flex flex-wrap gap-2">{['day', 'week', 'month', 'custom', 'all'].map(p => { const labels: any = { day: 'Hoje', week: 'Semana', month: 'Mês', custom: 'Selecionar', all: 'Tudo' }; return (<button key={p} onClick={() => setSysPeriod(p as any)} className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all border-2 ${sysPeriod === p ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-400'}`}>{labels[p]}</button>); })}</div>{sysPeriod === 'custom' && (<div className="flex gap-2 mt-2 animate-in slide-in-from-top-2"><input type="date" value={customDateStart} onChange={e => setCustomDateStart(e.target.value)} className="flex-1 p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-600 outline-none" /><input type="date" value={customDateEnd} onChange={e => setCustomDateEnd(e.target.value)} className="flex-1 p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-600 outline-none" /></div>)}</div>
                <div className="flex gap-3 pt-2"><button onClick={handleHistoryExport} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"><Download size={16} /> Baixar Relatório</button><button onClick={handleHistoryClearRequest} disabled={isProcessing} className="flex-1 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-[10px] hover:bg-rose-100 transition-all flex items-center justify-center gap-2">{isProcessing ? <Loader2 className="animate-spin" /> : <Trash2 size={16} />} Limpar Histórico</button></div>
                <div className="pt-2">
                  <button onClick={handleArchiveYearRequest} disabled={isProcessing} className="w-full py-4 bg-amber-50 text-amber-600 rounded-2xl font-black uppercase text-[10px] hover:bg-amber-100 transition-all flex items-center justify-center gap-2 border-2 border-amber-100">
                    {isProcessing ? <Loader2 className="animate-spin" /> : <Database size={16} />} Consolidar e Arquivar Ano
                  </button>
                  <p className="text-[9px] text-slate-400 text-center mt-2 font-medium px-4">Esta opção soma todas as vendas e gastos de um ano, salva um resumo e apaga os detalhes para liberar espaço no banco de dados.</p>
                </div>
             </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 text-center"><AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" /><h3 className="text-lg font-black text-slate-800 uppercase mb-2">Zona de Perigo</h3><div className="flex flex-col gap-3"><button onClick={() => { setConfirmModal({ show: true, title: "RESETAR TUDO", message: "ATENÇÃO: ISSO APAGARÁ TODAS AS VENDAS, DÍVIDAS, CLIENTES E CONFIGURAÇÕES. AÇÃO IRREVERSÍVEL. CONFIRMAR?", onConfirm: async () => { setIsProcessing(true); await clearTransactions('all', currentUser.workspaceId); if (addNote) { addNote({ workspaceId: currentUser.workspaceId, createdById: 'system', createdByName: 'Segurança', content: `RESET TOTAL da fábrica realizado por ${currentUser.name}.`, type: 'SECURITY' }); } setIsProcessing(false); setConfirmModal(null); window.location.reload(); } }); }} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-rose-700 transition-all shadow-xl shadow-rose-200">Resetar Fábrica (Apagar Tudo)</button></div></div>
          {(currentUser.email === 'hacker3d22@gmail.com' || currentUser.email === 'brasilanonymous66@gmail.com') && (
            <button onClick={onUnlockGodMode} className="w-full py-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.5em] text-center hover:text-slate-400">Acesso Root</button>
          )}
        </div>
      )}

      {activeTab === 'AUDITORIA' && (
        <div className="space-y-4">
          <h3 className="text-xl font-black text-slate-800 px-2">Logs do Sistema</h3>
          <AuditLog />
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl text-center border-4 border-rose-100">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse"><AlertTriangle className="w-10 h-10 text-rose-600" /></div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">{confirmModal.title}</h3>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">{confirmModal.message}</p>
              <div className="flex gap-3"><button onClick={() => setConfirmModal(null)} className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-colors">Cancelar</button><button onClick={confirmModal.onConfirm} disabled={isProcessing} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-900/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">{isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirmar</button></div>
           </div>
        </div>
      )}

      {successModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl text-center border-4 border-green-100">
              <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner"><CheckCircle2 className="w-10 h-10 text-green-600" /></div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">{successModal.title}</h3>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">{successModal.message}</p>
              <button onClick={() => setSuccessModal(null)} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-green-900/20 hover:scale-105 active:scale-95 transition-all">OK</button>
           </div>
        </div>
      )}

      {promptModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl border-4 border-indigo-100">
              <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner"><Sparkles className="w-10 h-10 text-indigo-600" /></div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase text-center">{promptModal.title}</h3>
              <div className="mb-8">
                <input 
                  autoFocus
                  value={promptModal.value}
                  onChange={e => setPromptModal({ ...promptModal, value: e.target.value })}
                  placeholder={promptModal.placeholder}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setPromptModal(null)} className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-colors">Cancelar</button>
                 <button onClick={() => promptModal.onConfirm(promptModal.value)} disabled={isProcessing || !promptModal.value} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-900/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">{isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirmar</button>
              </div>
           </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase">{editingCustomer ? 'Editar' : 'Novo'} {customerForm.type === 'CLIENT' ? 'Cliente' : 'Fornecedor'}</h3>
            <div className="space-y-4">
              <div className="bg-slate-100 p-1 rounded-xl flex mb-4"><button onClick={() => setCustomerForm({...customerForm, type: 'CLIENT'})} className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${customerForm.type === 'CLIENT' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Cliente</button><button onClick={() => setCustomerForm({...customerForm, type: 'SUPPLIER'})} className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${customerForm.type === 'SUPPLIER' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Fornecedor</button></div>
              <input autoFocus value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} placeholder="Nome Completo" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase text-xs outline-none" />
              <input type="tel" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} placeholder="WhatsApp (Opcional)" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-xs outline-none" />
            </div>
            <div className="flex gap-3 mt-8"><button onClick={() => setShowCustomerModal(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button><button onClick={handleSaveCustomer} disabled={isProcessing || !customerForm.name} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">{isProcessing ? <Loader2 className="animate-spin mx-auto" /> : 'Salvar'}</button></div>
          </div>
        </div>
      )}

      {/* Customer History Modal */}
      {showCustomerHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">{showCustomerHistory.name}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{showCustomerHistory.phone || 'Sem telefone'}</p>
                </div>
              </div>
              <button onClick={() => setShowCustomerHistory(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Comprado</p>
                  <p className="text-2xl font-black text-emerald-700">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transactions
                      .filter(t => t.customerName === showCustomerHistory.name && !t.isPending)
                      .reduce((acc, t) => acc + t.value, 0))}
                  </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Total Pendente</p>
                  <p className="text-2xl font-black text-amber-700">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transactions
                      .filter(t => t.customerName === showCustomerHistory.name && t.isPending)
                      .reduce((acc, t) => acc + t.value, 0))}
                  </p>
                </div>
              </div>

              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock size={16} className="text-indigo-500" />
                Últimas Compras
              </h4>

              <div className="space-y-3">
                {transactions
                  .filter(t => t.customerName === showCustomerHistory.name)
                  .slice(0, 10)
                  .map(t => (
                    <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-700">{t.item}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(t.date).toLocaleDateString()} • {t.paymentMethod}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${t.isPending ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.value)}
                        </p>
                        {t.isPending && <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Pendente</span>}
                      </div>
                    </div>
                  ))}
                
                {transactions.filter(t => t.customerName === showCustomerHistory.name).length === 0 && (
                  <div className="text-center py-12">
                    <Package size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold">Nenhuma compra registrada.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={() => {
                  const msg = `Olá ${showCustomerHistory.name}! Notamos que faz um tempo que você não pede conosco. Temos novidades hoje!`;
                  window.open(`https://wa.me/${showCustomerHistory.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
              >
                <Phone size={20} />
                Enviar Promoção WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-3xl overflow-hidden flex flex-col max-h-[90vh] relative">
            {/* Modal Header */}
            <div className="p-8 pb-4 flex justify-between items-center border-b border-slate-50">
              <h3 className="text-xl font-black text-slate-800 uppercase">{editingUser ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
              <button onClick={() => setShowUserModal(false)} className="p-2 text-slate-300 hover:text-slate-500 transition-all"><X size={20} /></button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-8 pt-4 no-scrollbar space-y-4">
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Nome</label><input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase text-xs outline-none" /></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">E-mail</label><input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl font-bold text-xs outline-none" placeholder="exemplo@gmail.com" /></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Função</label><select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl font-bold text-xs outline-none uppercase"><option value="OWNER">Proprietário</option><option value="MANAGER_FACTORY">Gerente Fábrica</option><option value="MANAGER_STALL">Gerente Barraca</option></select></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">PIN Acesso (6 Dígitos)</label><input type="number" maxLength={6} value={userForm.accessCode} onChange={e => setUserForm({...userForm, accessCode: e.target.value})} className="w-full p-4 bg-indigo-50 border-2 border-indigo-100 rounded-xl font-black text-center text-lg outline-none text-indigo-700" placeholder="••••••" /></div>
              
              {/* Dynamic Section Assignment */}
              <div className="pt-4 border-t border-slate-50 space-y-3">
                <p className="text-[9px] font-black text-slate-400 uppercase ml-2">Abas Autorizadas</p>
                <div className="grid grid-cols-2 gap-2">
                  {sections.map(section => (
                     <button 
                       key={section.id} 
                       onClick={() => {
                          const current = userForm.assignedSectionIds;
                          const newIds = current.includes(section.id) 
                             ? current.filter(id => id !== section.id)
                             : [...current, section.id];
                          setUserForm({...userForm, assignedSectionIds: newIds});
                       }}
                       className={`p-3 rounded-xl border-2 flex items-center justify-between gap-2 transition-all ${userForm.assignedSectionIds.includes(section.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                     >
                        <div className="flex flex-col text-left overflow-hidden">
                           <span className="text-[9px] font-black uppercase truncate w-24">{section.name}</span>
                           <span className="text-[7px] font-bold opacity-60">
                             {section.type === 'FACTORY_STYLE' ? 'Fábrica' : section.type === 'STALL_STYLE' ? 'Barraca' : 'Estoque'}
                           </span>
                        </div>
                        {userForm.assignedSectionIds.includes(section.id) ? <CheckCircle2 size={14} /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />}
                     </button>
                  ))}
                  {sections.length === 0 && (
                     <p className="text-[9px] text-slate-400 col-span-2 text-center py-2">Nenhuma aba disponível.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"><div className="flex items-center gap-2"><EyeOff size={16} className="text-slate-400" /><span className="text-[10px] font-black text-slate-500 uppercase">Ocultar Financeiro</span></div><button onClick={() => setUserForm({...userForm, hideSalesValues: !userForm.hideSalesValues})} className={`w-10 h-6 rounded-full relative transition-all ${userForm.hideSalesValues ? 'bg-indigo-500' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${userForm.hideSalesValues ? 'left-5' : 'left-1'}`} /></button></div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 pt-4 flex gap-3 border-t border-slate-50">
              <button onClick={() => setShowUserModal(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
              <button onClick={handleSaveUser} disabled={isProcessing || !userForm.name || userForm.accessCode.length < 4} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">
                {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION MODAL - NEW / EDIT (MANAGE) */}
      {showSectionModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-3xl overflow-y-auto max-h-[90vh]">
            {!editingSection ? (
              // CREATE NEW SECTION LAYOUT
              <>
                <h3 className="text-xl font-black text-slate-800 mb-6 uppercase">Nova Aba</h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Nome da Nova Aba</label>
                    <input 
                      autoFocus
                      value={sectionForm.name} 
                      onChange={e => setSectionForm({...sectionForm, name: e.target.value})} 
                      placeholder="Ex: Lanchonete" 
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold uppercase text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800" 
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Tipo de Operação</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setSectionForm({...sectionForm, type: 'FACTORY_STYLE'})} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${sectionForm.type === 'FACTORY_STYLE' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                        <Package size={24} />
                        <span className="text-[9px] font-black uppercase">Fábrica</span>
                      </button>
                      <button onClick={() => setSectionForm({...sectionForm, type: 'STALL_STYLE'})} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${sectionForm.type === 'STALL_STYLE' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                        <Store size={24} />
                        <span className="text-[9px] font-black uppercase">Barraca</span>
                      </button>
                      <button onClick={() => setSectionForm({...sectionForm, type: 'STOCK_STYLE'})} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all col-span-2 ${sectionForm.type === 'STOCK_STYLE' ? 'border-amber-500 bg-amber-50 text-amber-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                        <Package size={24} />
                        <span className="text-[9px] font-black uppercase">Estoque</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button onClick={() => setShowSectionModal(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                  <button onClick={handleCreateSection} disabled={isProcessing || !sectionForm.name} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50">
                    {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : 'Criar Aba'}
                  </button>
                </div>
              </>
            ) : (
              // MANAGE TAB LAYOUT (Based on Screenshot)
              <>
                <div className="flex justify-between items-start mb-6">
                   <div className="w-full mr-4">
                      <h3 className="text-xl font-black text-slate-800 uppercase leading-none mb-1">Gerenciar Aba</h3>
                      <input 
                        value={editingSection.name}
                        onChange={(e) => setEditingSection({...editingSection, name: e.target.value})}
                        onBlur={() => saveConfig(sections.map(s => s.id === editingSection.id ? { ...s, name: editingSection.name } : s))}
                        className="w-full bg-transparent text-[12px] font-black text-indigo-600 uppercase tracking-widest outline-none border-b border-dashed border-indigo-200 focus:border-indigo-500 placeholder-indigo-300"
                        placeholder="NOME DA ABA"
                      />
                   </div>
                   <button onClick={() => setShowSectionModal(false)} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-200 transition-all shrink-0">
                      <X size={20} />
                   </button>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                   <button onClick={() => setManageTab('PRODUCTS')} className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${manageTab === 'PRODUCTS' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Produtos</button>
                   <button onClick={() => setManageTab('EXPENSES')} className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${manageTab === 'EXPENSES' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Despesas</button>
                </div>

                <div className="flex gap-3 mb-2">
                   <div onClick={() => manageFileInputRef.current?.click()} className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center shrink-0 cursor-pointer overflow-hidden group relative hover:border-indigo-400 transition-all">
                      {manageForm.imageUrl ? (
                         <>
                           <img src={manageForm.imageUrl} className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><Camera className="text-white" size={16} /></div>
                         </>
                      ) : (
                         <div className="text-slate-300"><Camera size={20} /></div>
                      )}
                      <input type="file" ref={manageFileInputRef} hidden accept="image/*" onChange={handleManageImageUpload} />
                   </div>
                   <div className="flex-1 space-y-2">
                      <input value={manageForm.name} onChange={e => setManageForm({...manageForm, name: e.target.value})} placeholder="NOME DO ITEM" className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase text-[10px] outline-none border border-transparent focus:border-indigo-100 focus:bg-white transition-all text-slate-700" />
                      <div className="flex gap-2">
                         <div className="flex-1 relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400">R$</span>
                            <input type="number" step="0.01" value={manageForm.priceVista} onChange={e => setManageForm({...manageForm, priceVista: e.target.value})} placeholder="VISTA" className="w-full p-2 pl-6 bg-slate-50 rounded-lg font-black text-[10px] outline-none text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-50 transition-all" />
                         </div>
                         <div className="flex-1 relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400">R$</span>
                            <input type="number" step="0.01" value={manageForm.pricePrazo} onChange={e => setManageForm({...manageForm, pricePrazo: e.target.value})} placeholder="PRAZO" className="w-full p-2 pl-6 bg-slate-50 rounded-lg font-black text-[10px] outline-none text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-50 transition-all" />
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <div className="flex-1 relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-emerald-500">R$</span>
                            <input type="number" step="0.01" value={manageForm.promoVista} onChange={e => setManageForm({...manageForm, promoVista: e.target.value})} placeholder="PROMO VISTA" className="w-full p-2 pl-6 bg-emerald-50 text-emerald-700 rounded-lg font-black text-[10px] outline-none placeholder:text-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all" />
                         </div>
                         <div className="flex-1 relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-emerald-500">R$</span>
                            <input type="number" step="0.01" value={manageForm.promoPrazo} onChange={e => setManageForm({...manageForm, promoPrazo: e.target.value})} placeholder="PROMO PRAZO" className="w-full p-2 pl-6 bg-emerald-50 text-emerald-700 rounded-lg font-black text-[10px] outline-none placeholder:text-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all" />
                         </div>
                      </div>
                      {(manageForm.promoVista || manageForm.promoPrazo) && (
                        <div className="relative">
                          <input 
                            type="datetime-local" 
                            value={manageForm.promoEndsAt ? new Date(new Date(manageForm.promoEndsAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} 
                            onChange={e => setManageForm({...manageForm, promoEndsAt: e.target.value ? new Date(e.target.value).toISOString() : ''})} 
                            className="w-full p-2 bg-slate-50 rounded-lg font-bold text-[10px] text-slate-600 outline-none" 
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase pointer-events-none">Validade</span>
                        </div>
                      )}
                   </div>
                </div>

                <button 
                   onClick={handleSaveManageItem}
                   disabled={isProcessing || !manageForm.name}
                   className="w-full py-4 mb-6 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:active:scale-100"
                >
                   {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : editingItemId ? 'Atualizar Item' : 'Adicionar'}
                </button>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                   {((manageTab === 'PRODUCTS' ? editingSection.items : editingSection.expenses) || []).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-indigo-100 transition-all">
                         <div className="w-10 h-10 bg-slate-50 rounded-lg overflow-hidden shrink-0 border border-slate-100 flex items-center justify-center">
                            {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-slate-300" />}
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-slate-700 uppercase truncate">{item.name}</p>
                            <p className="text-[9px] font-bold text-slate-400">
                               R$ {item.defaultPriceAVista?.toFixed(2) || '0.00'} / R$ {item.defaultPriceAPrazo?.toFixed(2) || '0.00'}
                            </p>
                         </div>
                         <div className="flex gap-1">
                            <button onClick={() => startEditManageItem(item)} className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg transition-colors"><Edit3 size={14} /></button>
                            <button onClick={() => handleDeleteManageItem(item.id)} className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                         </div>
                      </div>
                   ))}
                   {((manageTab === 'PRODUCTS' ? editingSection.items : editingSection.expenses) || []).length === 0 && (
                      <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                         <p className="text-[10px] font-black uppercase tracking-widest">Nenhum item cadastrado</p>
                      </div>
                   )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
