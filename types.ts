
export type TabType = 'HOME' | 'FABRICA' | 'BARRACA' | 'ESTOQUE' | 'ADMIN' | 'CONFIG' | 'ACTIVITY' | 'MARKETPLACE';
export type SectionType = 'FACTORY_STYLE' | 'STALL_STYLE' | 'STOCK_STYLE';

export type UserRole = 'OWNER' | 'MANAGER_FACTORY' | 'MANAGER_STALL' | 'CUSTOMER';
export type UserType = 'COMPANY' | 'CUSTOMER';

export type SubTabFactory = 'GASTOS' | 'VENDAS' | 'A_RECEBER';
export type SubTabStall = 'VENDAS' | 'GASTOS';
export type StockMode = 'GLOBAL' | 'LOCAL';

export interface User {
  id: string;
  workspaceId: string;
  name: string;
  email?: string;
  cpf?: string;
  phone?: string;
  role: UserRole;
  accessCode: string;
  assignedSectionIds?: string[]; // Alterado para array de IDs
  isAdFree: boolean;
  isAdvertiser: boolean;
  hideSalesValues: boolean; 
  enableSounds: boolean;
  hasProPlan?: boolean;
  userType?: UserType;
  latitude?: number;
  longitude?: number;
  proExpiresAt?: string;
  adFreeExpiresAt?: string;
  advertiserExpiresAt?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}

export interface StoreProfile {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  address: string;
  whatsapp: string;
  cnpj?: string;
  instagram?: string;
  facebook?: string;
  logoUrl?: string;
  bannerUrl?: string;
  latitude: number;
  longitude: number;
  active: boolean;
  portfolio: PortfolioItem[];
}

export interface PortfolioItem {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl?: string;
  available: boolean;
  highlightExpiresAt?: string; // Novo campo para Stories
}

export interface Workspace {
  id: string;
  name: string;
}

export interface Ad {
  id: string;
  workspaceId: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  longDescription?: string;
  link: string; 
  backgroundColor: string;
  mediaUrl?: string; 
  mediaType?: 'image' | 'video';
  active: boolean;
  clicks: number;
  expiresAt?: string;
}

export interface Customer {
  id: string;
  workspaceId: string;
  name: string;
  phone?: string;
  cpf?: string;
}

export interface ConfigItem {
  id: string;
  name: string;
  order?: number;
  defaultPriceAVista?: number;
  defaultPriceAPrazo?: number;
  defaultPrice?: number;
  defaultQty?: number;
  currentStock?: number;
  minStock?: number;
  trackStock?: boolean;
}

export interface AppSection {
  id: string;
  workspaceId: string;
  name: string;
  type: SectionType;
  order: number;
  items: ConfigItem[];
  expenses: ConfigItem[];
  linkedSectionId?: string;
  globalStockMode: StockMode;
}

export interface Transaction {
  id: string;
  workspaceId: string;
  date: string;
  category: string;
  subCategory: string;
  item: string;
  value: number;
  quantity?: number;
  paymentMethod?: string;
  customerName?: string;
  isPending?: boolean;
  createdBy?: string;
  initialStock?: number;
  leftoverStock?: number;
  unitPrice?: number;
}

export interface EntryState {
  quantity: string;
  value: string;
  calcQty?: string;
  calcUnit?: string;
}

export interface ExpenseCalc {
  qty: string;
  unit: string;
}

export interface PeriodTotals {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface NoteData {
  dateKey: string;
  total: number;
  items: Transaction[];
}

export interface EntityGroup {
  total: number;
  notes: Record<string, NoteData>;
}

export interface LocalStock {
  initialStock: string;
  leftoverStock: string;
}

export interface Note {
  id: string;
  workspaceId: string;
  createdById: string;
  createdByName: string;
  content: string;
  type: 'INFO' | 'ALERT' | 'MONEY';
  amount?: number;
  isRead: boolean;
  createdAt: string;
}