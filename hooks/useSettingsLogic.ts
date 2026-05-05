
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, safeStringifyError } from '../lib/supabase';
import { AppSection, User, Transaction, Ad, StoreProfile, Customer, ConfigItem } from '../types';
import { useCustomers } from './useCustomers';
import { toast } from 'sonner';
import { GoogleGenAI } from "@google/genai";

interface UseSettingsLogicProps {
  sections: AppSection[];
  saveConfig: (sections: AppSection[]) => Promise<boolean>;
  addUser: (user: Omit<User, 'id'>) => Promise<User | null>;
  removeUser: (id: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  currentUser: User;
  saveAd: (ad: Partial<Ad> & { ownerId: string, workspaceId: string }) => Promise<Ad | null>;
  deleteAd: (id: string) => Promise<boolean>;
  addNote?: (note: any) => Promise<boolean>;
  transactions: Transaction[];
  clearTransactions: (period: 'day' | 'week' | 'month' | 'all' | 'custom', wid: string, customRange?: { start: string, end: string }, categoryFilter?: string[]) => Promise<void>;
  archiveYear: (wid: string, year: number) => Promise<number>;
  customers: Customer[];
  addCustomer: (name: string, phone?: string, type?: 'CLIENT' | 'SUPPLIER') => Promise<Customer | null>;
  removeCustomer: (id: string) => Promise<void>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
}

export const useSettingsLogic = ({
  sections, saveConfig, addUser, removeUser, updateUser, currentUser, saveAd, deleteAd, addNote,
  transactions, clearTransactions, archiveYear, customers, addCustomer, removeCustomer, updateCustomer
}: UseSettingsLogicProps) => {
  const [activeTab, setActiveTab] = useState<'ESTRUTURA' | 'CLIENTES' | 'EQUIPE' | 'VITRINE' | 'INSIGHTS' | 'MARKETING' | 'ANUNCIO' | 'SISTEMA' | 'PLANOS' | 'AUDITORIA'>('ESTRUTURA');
  const [isMarketplaceDirty, setIsMarketplaceDirty] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [supportPhone, setSupportPhone] = useState('21999999999');
  const [adDailyPrice, setAdDailyPrice] = useState(5);
  const [promoAdPrice, setPromoAdPrice] = useState<number | null>(null);
  const [promoAdEndsAt, setPromoAdEndsAt] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const pendingTab = localStorage.getItem('settings_pending_tab');
    if (pendingTab) {
      const validTabs: any[] = ['ESTRUTURA', 'CLIENTES', 'EQUIPE', 'VITRINE', 'INSIGHTS', 'MARKETING', 'ANUNCIO', 'SISTEMA', 'PLANOS'];
      if (validTabs.includes(pendingTab)) setActiveTab(pendingTab as any);
      localStorage.removeItem('settings_pending_tab');
    }
  }, []);

  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const { data: newSettings } = await supabase.from('system_settings').select('*').eq('id', 'GLOBAL').maybeSingle();
        if (newSettings) {
          setSupportPhone(newSettings.support_phone);
          setAdDailyPrice(newSettings.ad_daily_price);
          setPromoAdPrice(newSettings.promo_ad_price);
          setPromoAdEndsAt(newSettings.promo_ad_ends_at);
        }
        const { data: plansData } = await supabase.from('subscription_plans').select('*').eq('active', true).order('sort_order', { ascending: true });
        if (plansData) setPlans(plansData);
      } catch (e) { console.warn("Kernel: Erro ao carregar configurações globais."); }
    };
    fetchGlobalSettings();
  }, []);

  const activePlan = useMemo(() => currentUser.activePlanId ? plans.find(p => p.id === currentUser.activePlanId) : null, [currentUser.activePlanId, plans]);
  const now = Date.now();
  const isProActive = useMemo(() => !!((currentUser.hasProPlan || activePlan?.grants_pro) && currentUser.proExpiresAt && new Date(currentUser.proExpiresAt).getTime() > now), [currentUser, activePlan, now]);
  const isAdFreeActive = useMemo(() => !!((currentUser.isAdFree || activePlan?.grants_ad_free) && currentUser.adFreeExpiresAt && new Date(currentUser.adFreeExpiresAt).getTime() > now), [currentUser, activePlan, now]);
  const isAdvertiserActive = useMemo(() => !!((currentUser.isAdvertiser || activePlan?.grants_advertiser) && currentUser.advertiserExpiresAt && new Date(currentUser.advertiserExpiresAt).getTime() > now), [currentUser, activePlan, now]);
  const freeAdsRemaining = useMemo(() => activePlan ? Math.max(0, (activePlan.free_ads_per_month || 0) - (currentUser.freeAdsUsedThisMonth || 0)) : 0, [activePlan, currentUser.freeAdsUsedThisMonth]);
  const isFreeAdAvailable = freeAdsRemaining > 0;
  const effectiveAdPrice = useMemo(() => {
    if (isFreeAdAvailable) return 0;
    if (currentUser.customAdPrice) return currentUser.customAdPrice;
    if (promoAdPrice && promoAdEndsAt && new Date(promoAdEndsAt).getTime() > Date.now()) return promoAdPrice;
    return adDailyPrice;
  }, [currentUser.customAdPrice, adDailyPrice, promoAdPrice, promoAdEndsAt, isFreeAdAvailable]);

  // Modal States
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
    name: '', phone: '', email: '', accessCode: '', role: 'MANAGER_FACTORY',
    hideSalesValues: false, assignedSectionIds: [] as string[]
  });

  // States for Section Modal
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<AppSection | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: '', type: 'FACTORY_STYLE' });

  // States for Manage Item (Modal Content)
  const [manageTab, setManageTab] = useState<'PRODUCTS' | 'EXPENSES'>('PRODUCTS');
  const [manageForm, setManageForm] = useState({ 
    name: '', category: '', priceVista: '', pricePrazo: '', imageUrl: '',
    promoVista: '', promoPrazo: '', promoEndsAt: ''
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // States for Ad Tab
  const [adForm, setAdForm] = useState({ title: '', description: '', whatsapp: '', duration: 7, mediaUrl: '' });
  const [editingAdId, setEditingAdId] = useState<string | null>(null);

  // Handlers
  const uploadToStorage = async (base64Str: string, folder: string): Promise<string | null> => {
    try {
      const base64Data = base64Str.split(',')[1];
      const type = base64Str.split(';')[0].split(':')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type });
      const fileName = `${currentUser.id}/config_${folder}_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage.from('app_banners').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('app_banners').getPublicUrl(data.path);
      return publicUrl;
    } catch (e) {
      console.error("Storage error:", e);
      return null;
    }
  };

  const handleTabChange = (newTab: any) => {
    if (activeTab === 'VITRINE' && isMarketplaceDirty && newTab !== 'VITRINE') {
      setConfirmModal({
        show: true, title: "DADOS NÃO SALVOS", message: "Você tem alterações de vitrine não salvas. Sair mesmo assim?",
        onConfirm: () => { setIsMarketplaceDirty(false); setActiveTab(newTab); setConfirmModal(null); }
      });
      return;
    }
    setActiveTab(newTab);
  };

  const handleSaveCustomer = async () => {
    if (!customerForm.name) return;
    setIsProcessing(true);
    try {
      if (editingCustomer) await updateCustomer(editingCustomer.id, { name: customerForm.name, phone: customerForm.phone, type: customerForm.type });
      else await addCustomer(customerForm.name, customerForm.phone, customerForm.type);
      setShowCustomerModal(false);
      setEditingCustomer(null);
    } finally { setIsProcessing(false); }
  };

  const handleSaveUser = async () => {
    if (!userForm.name || !userForm.accessCode) return;
    setIsProcessing(true);
    try {
      const cleanEmail = userForm.email ? userForm.email.trim().toLowerCase() : '';
      if (editingUser) {
        await updateUser(editingUser.id, { ...userForm, email: cleanEmail, role: userForm.role as any });
      } else {
        await addUser({ ...userForm, workspaceId: currentUser.workspaceId, email: cleanEmail, role: userForm.role as any, isAdFree: false, isAdvertiser: false, hasProPlan: false, enableSounds: true });
      }
      setShowUserModal(false);
      setEditingUser(null);
      toast.success("Usuário atualizado!");
    } catch(e: any) { toast.error(safeStringifyError(e)); } finally { setIsProcessing(false); }
  };

  const handleCreateSection = async () => {
    if (!sectionForm.name) return;
    setIsProcessing(true);
    try {
      const newSection: AppSection = {
        id: `sec_${Date.now()}`, workspaceId: currentUser.workspaceId, name: sectionForm.name,
        type: sectionForm.type as any, order: sections.length, items: [], expenses: [], globalStockMode: 'GLOBAL'
      };
      await saveConfig([...sections, newSection]);
      setShowSectionModal(false);
    } finally { setIsProcessing(false); }
  };

  const handleSaveManageItem = async () => {
    if (!editingSection || !manageForm.name) return;
    setIsProcessing(true);
    try {
        const isProduct = manageTab === 'PRODUCTS';
        const priceV = parseFloat((manageForm.priceVista || '0').replace(',', '.')) || 0;
        const priceP = parseFloat((manageForm.pricePrazo || '0').replace(',', '.')) || 0;
        
        let finalUrl = manageForm.imageUrl;
        if (finalUrl && finalUrl.startsWith('data:image')) {
            const url = await uploadToStorage(finalUrl, 'item_migration');
            if (url) finalUrl = url;
        }

        const newItem: ConfigItem = {
            id: editingItemId || `item_${Date.now()}`,
            name: manageForm.name,
            category: manageForm.category ? manageForm.category.trim() : undefined,
            defaultPriceAVista: priceV, defaultPriceAPrazo: priceP, defaultPrice: priceV,
            imageUrl: finalUrl,
            promotionalPriceAVista: manageForm.promoVista ? parseFloat(manageForm.promoVista.replace(',', '.')) : undefined,
            promotionalPriceAPrazo: manageForm.promoPrazo ? parseFloat(manageForm.promoPrazo.replace(',', '.')) : undefined,
            promoEndsAt: manageForm.promoEndsAt || undefined,
            currentStock: 0, minStock: 0, trackStock: true
        };

        const updatedSection = { ...editingSection };
        const list = isProduct ? (updatedSection.items || []) : (updatedSection.expenses || []);
        let newList = editingItemId ? list.map(i => i.id === editingItemId ? { ...i, ...newItem } : i) : [newItem, ...list];

        if (isProduct) updatedSection.items = newList; else updatedSection.expenses = newList;
        setEditingSection(updatedSection);
        await saveConfig(sections.map(s => s.id === updatedSection.id ? updatedSection : s));
        setEditingItemId(null);
        toast.success("Salvo com sucesso!");
    } catch(e) { toast.error("Erro interno."); } finally { setIsProcessing(false); }
  };

  const handleDeleteManageItem = async (itemId: string) => {
    if (!editingSection) return;
    setIsProcessing(true);
    try {
      const isProduct = manageTab === 'PRODUCTS';
      const updatedSection = { ...editingSection };
      const list = isProduct ? (updatedSection.items || []) : (updatedSection.expenses || []);
      const newList = list.filter(i => i.id !== itemId);
      if (isProduct) updatedSection.items = newList; else updatedSection.expenses = newList;
      setEditingSection(updatedSection);
      await saveConfig(sections.map(s => s.id === updatedSection.id ? updatedSection : s));
    } finally { setIsProcessing(false); }
  };

  const startEditManageItem = (item: ConfigItem) => {
    setEditingItemId(item.id);
    setManageForm({
      name: item.name,
      category: item.category || '',
      priceVista: String(item.defaultPriceAVista || ''),
      pricePrazo: String(item.defaultPriceAPrazo || ''),
      imageUrl: item.imageUrl || '',
      promoVista: String(item.promotionalPriceAVista || ''),
      promoPrazo: String(item.promotionalPriceAPrazo || ''),
      promoEndsAt: item.promoEndsAt || ''
    });
  };

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
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Crie um título curto (máx 35 char) e uma descrição vendedora (máx 100 char) para um anúncio de: ${adPrompt}. Responda em JSON formato: { "title": "...", "description": "..." }`,
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

  const handleGenerateAdImage = async () => {
    if (!adForm.title) return toast.error("Título obrigatório!");
    setIsGeneratingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Crie um prompt em INGLÊS, curto e focado em visual para um banner de comida. O título do anúncio é: ${adForm.title}. Foque em iluminação profissional, 4k, food photography. Retorne APENAS o prompt em inglês.`
      });
      const visualPrompt = response.text?.trim() || "delicious food professional photography 4k";
      
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(visualPrompt)}?width=512&height=512&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
      
      setAdForm(prev => ({ ...prev, mediaUrl: imageUrl }));
      toast.success("Imagem gerada com IA!");
    } catch (e) { 
      toast.error("Erro na IA imagem. Tente novamente."); 
    } finally { 
      setIsGeneratingAI(false); 
    }
  };

  const handleRetryAdPayment = async (ad: Ad) => {
    setIsProcessing(true);
    try {
      if (effectiveAdPrice > 0) {
        const response = await fetch('/api/mercadopago/create-ad-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adId: ad.id,
            userId: currentUser.id,
            adTitle: ad.title,
            price: effectiveAdPrice,
            duration: ad.requestedDuration || 7,
            returnUrl: window.location.origin
          })
        });

        const data = await response.json();
        if (data.init_point) {
          window.location.href = data.init_point;
        } else {
          toast.error(data.error || "Erro ao gerar link de pagamento.");
        }
      } else {
        toast.error("Este anúncio não requer pagamento.");
      }
    } catch (e) {
      toast.error("Erro ao conectar com Mercado Pago.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAd = async () => {
    if (!adForm.title || !adForm.description || !adForm.whatsapp) return;
    setIsProcessing(true);
    try {
      const whatsappLink = `https://wa.me/55${adForm.whatsapp.replace(/\D/g, '')}`;
      const savedAd = await saveAd({ 
        id: editingAdId || undefined, 
        ownerId: currentUser.id, 
        ownerName: currentUser.name, 
        workspaceId: currentUser.workspaceId, 
        title: adForm.title, 
        description: adForm.description, 
        link: whatsappLink, 
        mediaUrl: adForm.mediaUrl, 
        requestedDuration: adForm.duration 
      });

      if (!savedAd) throw new Error("Erro ao salvar anúncio.");

      // Se o preço for maior que 0, redireciona para pagamento
      if (effectiveAdPrice > 0 && !editingAdId) {
        const response = await fetch('/api/mercadopago/create-ad-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adId: savedAd.id,
            userId: currentUser.id,
            adTitle: adForm.title,
            price: effectiveAdPrice,
            duration: adForm.duration,
            returnUrl: window.location.origin
          })
        });

        const data = await response.json();
        if (data.init_point) {
          window.location.href = data.init_point;
          return; // Para o fluxo aqui pois vai redirecionar
        } else {
          toast.error(data.error || "Erro ao gerar link de pagamento.");
        }
      }

      setAdForm({ title: '', description: '', whatsapp: '', duration: 7, mediaUrl: '' });
      setEditingAdId(null);
      toast.success("Anúncio salvo!");
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "Tente novamente mais tarde."));
    } finally { setIsProcessing(false); }
  };

  return {
    activeTab, setActiveTab: handleTabChange,
    isMarketplaceDirty, setIsMarketplaceDirty,
    isProcessing, setIsProcessing,
    isGeneratingAI, setIsGeneratingAI,
    searchTerm, setSearchTerm,
    supportPhone, adDailyPrice, plans,
    activePlan, isProActive, isAdFreeActive, isAdvertiserActive,
    freeAdsRemaining, isFreeAdAvailable, effectiveAdPrice,
    confirmModal, setConfirmModal,
    promptModal, setPromptModal,
    successModal, setSuccessModal,
    uploadToStorage,
    customers, addCustomer, removeCustomer, updateCustomer,
    showCustomerModal, setShowCustomerModal, showCustomerHistory, setShowCustomerHistory, editingCustomer, setEditingCustomer, customerForm, setCustomerForm, handleSaveCustomer,
    showUserModal, setShowUserModal, editingUser, setEditingUser, userForm, setUserForm, handleSaveUser,
    showSectionModal, setShowSectionModal, editingSection, setEditingSection, sectionForm, setSectionForm, handleCreateSection,
    manageTab, setManageTab, manageForm, setManageForm, editingItemId, setEditingItemId, handleSaveManageItem, handleDeleteManageItem,
    adForm, setAdForm, editingAdId, setEditingAdId, handleSaveAd, handleRetryAdPayment,
    handleGenerateAdText, handleGenerateAdImage, deleteAd,
    startEditManageItem
  };
};
