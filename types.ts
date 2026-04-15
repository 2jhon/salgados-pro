
export type TabType = 'HOME' | 'FABRICA' | 'BARRACA' | 'ESTOQUE' | 'ADMIN' | 'CONFIG' | 'ACTIVITY' | 'MARKETPLACE';
export type SectionType = 'FACTORY_STYLE' | 'STALL_STYLE' | 'STOCK_STYLE' | 'ARCHIVE_SUMMARY';

export type UserRole = 'OWNER' | 'MANAGER_FACTORY' | 'MANAGER_STALL' | 'CUSTOMER';
export type UserType = 'COMPANY' | 'CUSTOMER';

export type SubTabFactory = 'GASTOS' | 'VENDAS' | 'A_RECEBER';
export type SubTabStall = 'VENDAS' | 'GASTOS';
export type StockMode = 'GLOBAL' | 'LOCAL';
export type FulfillmentMode = 'PICKUP' | 'DELIVERY' | 'BOTH';

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
  lastSeen?: string;
  isBlocked?: boolean;
  totalSpent?: number;
  planActivations?: number;
  customAdPrice?: number;
  customProPrice?: number;
  activePlanId?: string;
  freeAdsUsedThisMonth?: number;
  lastFreeAdReset?: string;
}

export interface StoreInteraction {
  id: string;
  userId: string;
  workspaceId: string;
  type: 'FOLLOW' | 'FAVORITE';
  createdAt: string;
}

export interface StoreRating {
  id: string;
  userId: string;
  workspaceId: string;
  stars: number;
  comment?: string;
  createdAt: string;
}

export interface DeliveryDistanceTier {
  upToKm: number;
  fee: number;
}

export interface DeliveryConfig {
  freeDeliveryThreshold?: number;
  maxDistance?: number;
  distanceTiers?: DeliveryDistanceTier[];
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
  fulfillmentMode?: FulfillmentMode;
  pixKey?: string;
  deliveryConfig?: DeliveryConfig;
}

export interface PortfolioItem {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl?: string;
  available: boolean;
  highlightExpiresAt?: string; // Novo campo para Stories
  linkedFactoryItemId?: string; // Vínculo com item da Fábrica (Omnichannel)
  useFactoryPrice?: boolean; // Usar preço dinâmico da Fábrica
  promotionalPrice?: number; // Preço promocional (riscado)
  promoEndsAt?: string; // Validade da promoção
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
  requestedDuration?: number;
}

export interface Customer {
  id: string;
  workspaceId: string;
  name: string;
  phone?: string;
  cpf?: string;
  type?: 'CLIENT' | 'SUPPLIER';
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
  imageUrl?: string; // Nova propriedade para imagem
  promotionalPriceAVista?: number; // Preço promocional à vista
  promotionalPriceAPrazo?: number; // Preço promocional a prazo
  promoEndsAt?: string; // Validade da promoção
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
  // Novos campos para Barraca Online
  isPublic?: boolean;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  address?: string; // Endereço manual para a barraca
  description?: string; // Informações adicionais
  openingHours?: string; // Horário e dias de funcionamento
  whatsappMode?: 'SYSTEM' | 'MANUAL';
  manualWhatsapp?: string;
  lastSync?: string;
  fulfillmentMode?: FulfillmentMode;
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
  customerPhone?: string; // Novo campo para vincular empresas
  isPending?: boolean;
  isExternal?: boolean; // Novo campo para identificar dívidas de outros workspaces
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
  type: 'INFO' | 'ALERT' | 'MONEY' | 'LOG' | 'STOCK_LOW' | 'HIGH_SALE' | 'SECURITY';
  amount?: number;
  isRead: boolean;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reportedWorkspaceId: string;
  reason: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  grants_pro: boolean;
  grants_ad_free: boolean;
  grants_advertiser: boolean;
  free_ads_per_month: number;
  promo_price?: number;
  promo_ends_at?: string;
  promo_description?: string;
  active: boolean;
}

export interface Coupon {
  id: string;
  workspaceId: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minPurchaseValue?: number;
  maxUses?: number;
  currentUses: number;
  expiresAt?: string;
  active: boolean;
  createdAt?: string;
}

export interface StockMovement {
  id?: string;
  workspace_id: string;
  item_id: string;
  item_name: string;
  movement_type: 'IN' | 'OUT';
  reason: 'PRODUCTION' | 'SALE' | 'MANUAL_ADJUSTMENT' | 'LOSS' | 'RETURN';
  quantity: number;
  previous_balance: number;
  new_balance: number;
  created_by?: string;
  reference_id?: string;
  created_at?: string;
}
