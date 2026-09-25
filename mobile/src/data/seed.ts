import type { AppState, Product } from '../types/models';
import { makeId } from '../utils/format';

const now = new Date().toISOString();

function product(
  name: string,
  category: string,
  unit: string,
  costCents: number,
  priceCents: number,
  stock: number,
  lowStockLevel: number,
  favorite = false,
): Product {
  return {
    id: makeId(),
    name,
    category,
    barcode: '',
    unit,
    costCents,
    priceCents,
    stock,
    lowStockLevel,
    favorite,
    active: true,
    trackStock: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function createInitialState(): AppState {
  const products = [
    product('Instant Noodles - Chicken', 'Food', 'piece', 1200, 1500, 24, 8, true),
    product('Canned Sardines', 'Food', 'can', 2200, 2700, 14, 6, true),
    product('Coffee Sachet', 'Drinks', 'sachet', 700, 900, 38, 12, true),
    product('Bottled Water', 'Drinks', 'bottle', 1100, 1500, 20, 8, true),
    product('Laundry Detergent Sachet', 'Household', 'sachet', 600, 800, 28, 10),
    product('Egg', 'Food', 'piece', 800, 1000, 30, 12, true),
    product('Shampoo Sachet', 'Personal Care', 'sachet', 650, 900, 22, 8),
    product('Candle', 'Household', 'piece', 700, 1000, 16, 6),
  ];

  return {
    schemaVersion: 1,
    products,
    stockMovements: products.map((item) => ({
      id: makeId(),
      productId: item.id,
      quantityChange: item.stock,
      reason: 'opening' as const,
      unitCostCents: item.costCents,
      createdAt: now,
      syncState: 'pending' as const,
    })),
    sales: [],
    customers: [],
    creditEntries: [],
    expenses: [],
    outbox: [],
    settings: {
      storeName: 'ACDC',
      ownerName: 'Store Owner',
      theme: 'light',
      pin: '1234',
      outOfStockPolicy: 'warn',
      requirePinForPriceChange: false,
      serverUrl: '',
    },
  };
}
