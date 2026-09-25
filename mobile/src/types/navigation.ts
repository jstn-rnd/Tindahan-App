export type AppScreen =
  | 'home'
  | 'sell'
  | 'products'
  | 'credit'
  | 'more'
  | 'sales'
  | 'stock'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'sync';

export const screenTitles: Record<AppScreen, string> = {
  home: 'Home',
  sell: 'New Sale',
  products: 'Products',
  credit: 'Credit',
  more: 'More',
  sales: 'Sales History',
  stock: 'Stock',
  expenses: 'Expenses',
  reports: 'Reports',
  settings: 'Store Settings',
  sync: 'Sync & Backup',
};
