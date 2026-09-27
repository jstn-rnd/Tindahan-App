import { createInitialState } from './seed';
import { StateStorage, type StorageMode } from './storage';
import type {
  AppState,
  CreateSaleInput,
  CreditEntry,
  Customer,
  CustomerInput,
  DashboardMetrics,
  Expense,
  Product,
  ProductInput,
  Sale,
  SaleItem,
  StockMovement,
  StoreSettings,
} from '../types/models';
import { isToday, makeId } from '../utils/format';

type Listener = () => void;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanLegacyItems<T>(value: unknown): T[] {
  return (value as UnknownRecord[]).map((item) => {
    const { syncState: _legacySyncState, ...current } = item;
    return current as T;
  });
}

function migrateAppState(value: unknown): AppState | null {
  if (!isRecord(value) || !isRecord(value.settings)) return null;

  const requiredLists = [
    value.products,
    value.stockMovements,
    value.sales,
    value.customers,
    value.creditEntries,
    value.expenses,
  ];
  if (requiredLists.some((list) => !Array.isArray(list) || !(list as unknown[]).every(isRecord))) return null;

  const defaults = createInitialState();
  const settings = value.settings;
  const backup = isRecord(value.backup) ? value.backup : {};
  const history = Array.isArray(backup.history)
    ? backup.history.filter((item): item is string => typeof item === 'string' && !Number.isNaN(Date.parse(item)))
    : [];

  return {
    schemaVersion: 2,
    products: cleanLegacyItems<Product>(value.products),
    stockMovements: cleanLegacyItems<StockMovement>(value.stockMovements),
    sales: cleanLegacyItems<Sale>(value.sales),
    customers: cleanLegacyItems<Customer>(value.customers),
    creditEntries: cleanLegacyItems<CreditEntry>(value.creditEntries),
    expenses: cleanLegacyItems<Expense>(value.expenses),
    settings: {
      storeName: typeof settings.storeName === 'string' ? settings.storeName : defaults.settings.storeName,
      ownerName: typeof settings.ownerName === 'string' ? settings.ownerName : defaults.settings.ownerName,
      theme: settings.theme === 'dark' ? 'dark' : 'light',
      pin: typeof settings.pin === 'string' && /^\d{4,6}$/.test(settings.pin)
        ? settings.pin
        : defaults.settings.pin,
      outOfStockPolicy: settings.outOfStockPolicy === 'allow' || settings.outOfStockPolicy === 'block'
        ? settings.outOfStockPolicy
        : 'warn',
      requirePinForPriceChange: settings.requirePinForPriceChange === true,
    },
    backup: {
      history,
      googleEmail: typeof backup.googleEmail === 'string' ? backup.googleEmail : undefined,
      localFileUri: typeof backup.localFileUri === 'string'
        ? backup.localFileUri
        : typeof backup.fileUri === 'string' ? backup.fileUri : undefined,
      localFileName: typeof backup.localFileName === 'string'
        ? backup.localFileName
        : typeof backup.fileName === 'string' ? backup.fileName : undefined,
      localLastBackupAt: typeof backup.localLastBackupAt === 'string'
        ? backup.localLastBackupAt
        : typeof backup.lastBackupAt === 'string' && typeof backup.fileUri === 'string'
          ? backup.lastBackupAt
          : undefined,
      driveFileId: typeof backup.driveFileId === 'string' ? backup.driveFileId : undefined,
      driveFileName: typeof backup.driveFileName === 'string' ? backup.driveFileName : undefined,
      driveLastBackupAt: typeof backup.driveLastBackupAt === 'string' ? backup.driveLastBackupAt : undefined,
      lastBackupAt: typeof backup.lastBackupAt === 'string' ? backup.lastBackupAt : history.at(-1),
    },
  };
}

export class ACDCStore {
  private state: AppState = createInitialState();
  private storage = new StateStorage();
  private listeners = new Set<Listener>();
  private ready = false;

  get storageMode(): StorageMode {
    return this.storage.mode;
  }

  getSnapshot = (): AppState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async initialize(): Promise<void> {
    if (this.ready) return;
    await this.storage.initialize();
    const saved = await this.storage.load();
    const migrated = migrateAppState(saved);
    if (migrated) this.state = migrated;
    await this.storage.save(this.state);
    this.ready = true;
    this.emit();
  }

  verifyPin(pin: string): boolean {
    return pin === this.state.settings.pin;
  }

  getMetrics(): DashboardMetrics {
    const todaySales = this.state.sales.filter((sale) => sale.status === 'completed' && isToday(sale.createdAt));
    const salesTodayCents = todaySales.reduce((sum, sale) => sum + sale.totalCents, 0);
    const estimatedProfitTodayCents = todaySales.reduce(
      (sum, sale) => sum + sale.items.reduce(
        (itemSum, item) => itemSum + ((item.priceCents - item.costCents) * item.quantity),
        0,
      ),
      0,
    );

    return {
      salesTodayCents,
      estimatedProfitTodayCents,
      outstandingCreditCents: this.state.customers.reduce((sum, customer) => sum + customer.balanceCents, 0),
      lowStockCount: this.state.products.filter(
        (product) => product.active && product.trackStock && product.stock <= product.lowStockLevel,
      ).length,
    };
  }

  async saveProduct(input: ProductInput, productId?: string): Promise<Product> {
    const name = input.name.trim();
    if (!name) throw new Error('Product name is required.');
    if (input.priceCents < 0 || input.costCents < 0) throw new Error('Prices cannot be negative.');
    if (input.barcode && this.state.products.some(
      (product) => product.barcode === input.barcode.trim() && product.id !== productId,
    )) throw new Error('That barcode is already used by another product.');

    const timestamp = new Date().toISOString();
    let saved: Product;

    if (productId) {
      const current = this.state.products.find((product) => product.id === productId);
      if (!current) throw new Error('Product was not found.');
      saved = {
        ...current,
        ...input,
        name,
        barcode: input.barcode.trim(),
        stock: current.stock,
        updatedAt: timestamp,
      };
      this.state = {
        ...this.state,
        products: this.state.products.map((product) => product.id === productId ? saved : product),
      };
    } else {
      saved = {
        id: makeId(),
        ...input,
        name,
        barcode: input.barcode.trim(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const openingMovement: StockMovement | null = input.trackStock && input.stock !== 0 ? {
        id: makeId(),
        productId: saved.id,
        quantityChange: input.stock,
        reason: 'opening',
        unitCostCents: input.costCents,
        createdAt: timestamp,
      } : null;
      this.state = {
        ...this.state,
        products: [...this.state.products, saved],
        stockMovements: openingMovement
          ? [...this.state.stockMovements, openingMovement]
          : this.state.stockMovements,
      };
    }

    await this.commit();
    return saved;
  }

  async setProductActive(productId: string, active: boolean): Promise<void> {
    const timestamp = new Date().toISOString();
    this.state = {
      ...this.state,
      products: this.state.products.map((product) => product.id === productId
        ? { ...product, active, updatedAt: timestamp }
        : product),
    };
    await this.commit();
  }

  async deleteUnusedProduct(productId: string): Promise<void> {
    const used = this.state.sales.some((sale) => sale.items.some((item) => item.productId === productId));
    const movements = this.state.stockMovements.filter((movement) => movement.productId === productId);
    if (used || movements.some((movement) => movement.reason !== 'opening')) {
      throw new Error('This product has transaction history. Disable it instead.');
    }
    this.state = {
      ...this.state,
      products: this.state.products.filter((product) => product.id !== productId),
      stockMovements: this.state.stockMovements.filter((movement) => movement.productId !== productId),
    };
    await this.commit();
  }

  async adjustStock(
    productId: string,
    quantityChange: number,
    reason: StockMovement['reason'],
    note = '',
    unitCostCents?: number,
  ): Promise<void> {
    if (!quantityChange) throw new Error('Enter a quantity greater than zero.');
    const product = this.state.products.find((item) => item.id === productId);
    if (!product) throw new Error('Product was not found.');
    const timestamp = new Date().toISOString();
    const movement: StockMovement = {
      id: makeId(),
      productId,
      quantityChange,
      reason,
      note: note.trim() || undefined,
      unitCostCents,
      createdAt: timestamp,
    };
    this.state = {
      ...this.state,
      products: this.state.products.map((item) => item.id === productId
        ? {
            ...item,
            stock: item.stock + quantityChange,
            costCents: unitCostCents ?? item.costCents,
            updatedAt: timestamp,
          }
        : item),
      stockMovements: [...this.state.stockMovements, movement],
    };
    await this.commit();
  }

  async createSale(input: CreateSaleInput): Promise<Sale> {
    if (!input.lines.length) throw new Error('Add at least one product.');
    const timestamp = new Date().toISOString();
    const items: SaleItem[] = input.lines.map((line) => {
      const product = this.state.products.find((item) => item.id === line.productId);
      if (!product) throw new Error('A product in the cart no longer exists.');
      if (line.quantity <= 0) throw new Error('Quantity must be greater than zero.');
      if (
        product.trackStock
        && line.quantity > product.stock
        && this.state.settings.outOfStockPolicy === 'block'
      ) {
        throw new Error(`${product.name} does not have enough stock for this sale.`);
      }
      return {
        id: makeId(),
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: line.quantity,
        priceCents: product.priceCents,
        costCents: product.costCents,
        trackStock: product.trackStock,
        lineTotalCents: product.priceCents * line.quantity,
      };
    });
    const totalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
    const amountReceivedCents = input.paymentType === 'credit'
      ? Math.min(Math.max(input.amountReceivedCents, 0), totalCents)
      : Math.max(input.amountReceivedCents, totalCents);
    const creditCents = input.paymentType === 'credit' ? totalCents - amountReceivedCents : 0;
    if (creditCents > 0 && !input.customerId) throw new Error('Choose a customer for a credit sale.');

    const count = this.state.sales.length + 1;
    const compactDate = timestamp.slice(0, 10).replaceAll('-', '');
    const sale: Sale = {
      id: makeId(),
      receiptNumber: `ACDC-${compactDate}-${String(count).padStart(4, '0')}`,
      items,
      subtotalCents: totalCents,
      totalCents,
      paymentType: input.paymentType,
      amountReceivedCents,
      changeCents: input.paymentType === 'credit' ? 0 : amountReceivedCents - totalCents,
      creditCents,
      customerId: input.customerId,
      note: input.note?.trim() || undefined,
      status: 'completed',
      createdAt: timestamp,
    };
    const movementByProduct = new Map<string, number>();
    for (const item of items) {
      if (!item.trackStock) continue;
      movementByProduct.set(item.productId, (movementByProduct.get(item.productId) ?? 0) + item.quantity);
    }
    const movements: StockMovement[] = [...movementByProduct.entries()].map(([productId, quantity]) => ({
      id: makeId(),
      productId,
      quantityChange: -quantity,
      reason: 'sale',
      sourceId: sale.id,
      createdAt: timestamp,
    }));
    let customers = this.state.customers;
    let creditEntries = this.state.creditEntries;
    if (creditCents > 0 && input.customerId) {
      const entry: CreditEntry = {
        id: makeId(),
        customerId: input.customerId,
        type: 'charge',
        amountCents: creditCents,
        saleId: sale.id,
        createdAt: timestamp,
      };
      customers = customers.map((customer) => customer.id === input.customerId
        ? { ...customer, balanceCents: customer.balanceCents + creditCents, updatedAt: timestamp }
        : customer);
      creditEntries = [...creditEntries, entry];
    }

    this.state = {
      ...this.state,
      products: this.state.products.map((product) => ({
        ...product,
        stock: product.stock - (movementByProduct.get(product.id) ?? 0),
      })),
      sales: [...this.state.sales, sale],
      stockMovements: [...this.state.stockMovements, ...movements],
      customers,
      creditEntries,
    };
    await this.commit();
    return sale;
  }

  async voidSale(saleId: string): Promise<void> {
    const sale = this.state.sales.find((item) => item.id === saleId);
    if (!sale || sale.status === 'voided') return;
    const timestamp = new Date().toISOString();
    const movementByProduct = new Map<string, number>();
    sale.items.forEach((item) => {
      if (item.trackStock === false) return;
      movementByProduct.set(
        item.productId,
        (movementByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    });
    const reversals: StockMovement[] = [...movementByProduct.entries()].map(([productId, quantity]) => ({
      id: makeId(),
      productId,
      quantityChange: quantity,
      reason: 'sale-reversal',
      sourceId: sale.id,
      createdAt: timestamp,
    }));
    let customers = this.state.customers;
    let creditEntries = this.state.creditEntries;
    if (sale.creditCents && sale.customerId) {
      const entry: CreditEntry = {
        id: makeId(),
        customerId: sale.customerId,
        type: 'reversal',
        amountCents: -sale.creditCents,
        saleId: sale.id,
        createdAt: timestamp,
      };
      customers = customers.map((customer) => customer.id === sale.customerId
        ? { ...customer, balanceCents: Math.max(0, customer.balanceCents - sale.creditCents), updatedAt: timestamp }
        : customer);
      creditEntries = [...creditEntries, entry];
    }
    this.state = {
      ...this.state,
      sales: this.state.sales.map((item) => item.id === saleId
        ? { ...item, status: 'voided', voidedAt: timestamp }
        : item),
      products: this.state.products.map((product) => ({
        ...product,
        stock: product.stock + (movementByProduct.get(product.id) ?? 0),
      })),
      stockMovements: [...this.state.stockMovements, ...reversals],
      customers,
      creditEntries,
    };
    await this.commit();
  }

  async saveCustomer(input: CustomerInput, customerId?: string): Promise<Customer> {
    const name = input.name.trim();
    if (!name) throw new Error('Customer name is required.');
    const timestamp = new Date().toISOString();
    let saved: Customer;
    if (customerId) {
      const current = this.state.customers.find((customer) => customer.id === customerId);
      if (!current) throw new Error('Customer was not found.');
      saved = { ...current, ...input, name, updatedAt: timestamp };
      this.state = {
        ...this.state,
        customers: this.state.customers.map((customer) => customer.id === customerId ? saved : customer),
      };
    } else {
      saved = {
        id: makeId(),
        ...input,
        name,
        balanceCents: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.state = { ...this.state, customers: [...this.state.customers, saved] };
    }
    await this.commit();
    return saved;
  }

  async recordPayment(customerId: string, amountCents: number, paymentMethod: string, note = ''): Promise<void> {
    const customer = this.state.customers.find((item) => item.id === customerId);
    if (!customer) throw new Error('Customer was not found.');
    if (amountCents <= 0) throw new Error('Payment must be greater than zero.');
    if (amountCents > customer.balanceCents) throw new Error('Payment is greater than the customer balance.');
    const timestamp = new Date().toISOString();
    const entry: CreditEntry = {
      id: makeId(),
      customerId,
      type: 'payment',
      amountCents: -amountCents,
      paymentMethod,
      note: note.trim() || undefined,
      createdAt: timestamp,
    };
    this.state = {
      ...this.state,
      customers: this.state.customers.map((item) => item.id === customerId
        ? { ...item, balanceCents: item.balanceCents - amountCents, updatedAt: timestamp }
        : item),
      creditEntries: [...this.state.creditEntries, entry],
    };
    await this.commit();
  }

  async saveExpense(input: Omit<Expense, 'id' | 'createdAt' | 'voided'>): Promise<void> {
    if (!input.description.trim()) throw new Error('Expense description is required.');
    if (input.amountCents <= 0) throw new Error('Expense amount must be greater than zero.');
    const expense: Expense = {
      id: makeId(),
      ...input,
      description: input.description.trim(),
      createdAt: new Date().toISOString(),
      voided: false,
    };
    this.state = { ...this.state, expenses: [...this.state.expenses, expense] };
    await this.commit();
  }

  async updateSettings(changes: Partial<StoreSettings>): Promise<void> {
    if (changes.pin && !/^\d{4,6}$/.test(changes.pin)) {
      throw new Error('PIN must contain 4 to 6 digits.');
    }
    this.state = { ...this.state, settings: { ...this.state.settings, ...changes } };
    await this.commit();
  }

  prepareBackup(): { data: string; createdAt: string } {
    const createdAt = new Date().toISOString();
    const history = [...this.state.backup.history, createdAt].slice(-1000);
    const portableState: AppState = {
      ...this.state,
      backup: {
        ...this.state.backup,
        history,
        lastBackupAt: createdAt,
      },
    };
    return {
      createdAt,
      data: JSON.stringify({
        format: 'ACDC_BACKUP',
        version: 1,
        createdAt,
        state: portableState,
      }),
    };
  }

  async completeLocalBackup(createdAt: string, fileUri: string, fileName: string): Promise<void> {
    this.state = {
      ...this.state,
      backup: {
        ...this.state.backup,
        history: [...this.state.backup.history, createdAt].slice(-1000),
        localFileUri: fileUri,
        localFileName: fileName,
        localLastBackupAt: createdAt,
        lastBackupAt: createdAt,
      },
    };
    await this.commit();
  }

  async completeDriveBackup(createdAt: string, fileId: string, fileName: string): Promise<void> {
    this.state = {
      ...this.state,
      backup: {
        ...this.state.backup,
        history: [...this.state.backup.history, createdAt].slice(-1000),
        driveFileId: fileId,
        driveFileName: fileName,
        driveLastBackupAt: createdAt,
        lastBackupAt: createdAt,
      },
    };
    await this.commit();
  }

  async setGoogleBackupEmail(email?: string): Promise<void> {
    this.state = {
      ...this.state,
      backup: {
        ...this.state.backup,
        googleEmail: email?.trim().toLowerCase() || undefined,
        driveFileId: email ? this.state.backup.driveFileId : undefined,
        driveFileName: email ? this.state.backup.driveFileName : undefined,
      },
    };
    await this.commit();
  }

  async rememberLocalBackupFile(fileUri: string, fileName: string): Promise<void> {
    this.state = {
      ...this.state,
      backup: {
        ...this.state.backup,
        localFileUri: fileUri,
        localFileName: fileName,
      },
    };
    await this.commit();
  }

  async rememberDriveBackupFile(fileId: string, fileName: string): Promise<void> {
    this.state = {
      ...this.state,
      backup: {
        ...this.state.backup,
        driveFileId: fileId,
        driveFileName: fileName,
      },
    };
    await this.commit();
  }

  async restoreBackup(data: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      throw new Error('That file is not a valid ACDC backup.');
    }
    if (!isRecord(parsed) || parsed.format !== 'ACDC_BACKUP' || parsed.version !== 1) {
      throw new Error('Choose an ACDC backup file.');
    }
    const restored = migrateAppState(parsed.state);
    if (!restored) throw new Error('The backup is incomplete or damaged.');
    this.state = {
      ...restored,
      // Backup destinations and account authorization belong to this device,
      // not to the imported file. Keep the current connection metadata.
      backup: this.state.backup,
    };
    await this.commit();
  }

  private async commit(): Promise<void> {
    await this.storage.save(this.state);
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const acdcStore = new ACDCStore();
