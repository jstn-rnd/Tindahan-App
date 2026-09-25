export type ThemeMode = 'light' | 'dark';
export type SyncState = 'pending' | 'synced' | 'error';
export type PaymentType = 'cash' | 'ewallet' | 'credit';
export type SaleStatus = 'completed' | 'voided';

export interface Product {
  id: string;
  name: string;
  category: string;
  barcode: string;
  unit: string;
  costCents: number;
  priceCents: number;
  stock: number;
  lowStockLevel: number;
  favorite: boolean;
  active: boolean;
  trackStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  quantityChange: number;
  reason: 'opening' | 'restock' | 'sale' | 'household' | 'damaged' | 'correction' | 'sale-reversal';
  unitCostCents?: number;
  note?: string;
  sourceId?: string;
  createdAt: string;
  syncState: SyncState;
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  priceCents: number;
  costCents: number;
  trackStock: boolean;
  lineTotalCents: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  items: SaleItem[];
  subtotalCents: number;
  totalCents: number;
  paymentType: PaymentType;
  amountReceivedCents: number;
  changeCents: number;
  creditCents: number;
  customerId?: string;
  note?: string;
  status: SaleStatus;
  createdAt: string;
  voidedAt?: string;
  syncState: SyncState;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  creditLimitCents: number;
  balanceCents: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditEntry {
  id: string;
  customerId: string;
  type: 'charge' | 'payment' | 'adjustment' | 'reversal';
  amountCents: number;
  paymentMethod?: string;
  saleId?: string;
  note?: string;
  createdAt: string;
  syncState: SyncState;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amountCents: number;
  paymentMethod: string;
  paidFromStoreCash: boolean;
  note?: string;
  createdAt: string;
  syncState: SyncState;
  voided: boolean;
}

export interface OutboxEvent {
  id: string;
  entityType: 'product' | 'stock_movement' | 'sale' | 'customer' | 'credit_entry' | 'expense' | 'settings';
  entityId: string;
  action: 'create' | 'update' | 'disable' | 'void';
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface StoreSettings {
  storeName: string;
  ownerName: string;
  theme: ThemeMode;
  pin: string;
  outOfStockPolicy: 'allow' | 'warn' | 'block';
  requirePinForPriceChange: boolean;
  serverUrl: string;
  lastSyncAt?: string;
}

export interface AppState {
  schemaVersion: 1;
  products: Product[];
  stockMovements: StockMovement[];
  sales: Sale[];
  customers: Customer[];
  creditEntries: CreditEntry[];
  expenses: Expense[];
  outbox: OutboxEvent[];
  settings: StoreSettings;
}

export interface ProductInput {
  name: string;
  category: string;
  barcode: string;
  unit: string;
  costCents: number;
  priceCents: number;
  stock: number;
  lowStockLevel: number;
  favorite: boolean;
  active: boolean;
  trackStock: boolean;
}

export interface CustomerInput {
  name: string;
  phone: string;
  address: string;
  creditLimitCents: number;
  active: boolean;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface CreateSaleInput {
  lines: CartLine[];
  paymentType: PaymentType;
  amountReceivedCents: number;
  customerId?: string;
  note?: string;
}

export interface DashboardMetrics {
  salesTodayCents: number;
  estimatedProfitTodayCents: number;
  outstandingCreditCents: number;
  lowStockCount: number;
  pendingSyncCount: number;
}
