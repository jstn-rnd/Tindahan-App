import {
  AlertTriangle,
  HandCoins,
  PackagePlus,
  ShoppingBasket,
  WalletCards,
} from 'lucide-react';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';
import type { AppScreen } from '../types/navigation';
import { formatMoney } from '../utils/format';

interface HomeScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const state = useACDCState();
  const metrics = acdcStore.getMetrics();
  const lowStock = state.products.filter(
    (product) => product.active && product.trackStock && product.stock <= product.lowStockLevel,
  );
  const creditCustomers = state.customers.filter((customer) => customer.balanceCents > 0);

  return (
    <div className="screen home-screen">
      <section className="screen-heading-row">
        <div>
          <p className="eyebrow">{new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p>
          <h1>Good day, {state.settings.ownerName.split(' ')[0]}</h1>
          <p>Your store is ready, even without internet.</p>
        </div>
      </section>

      <button className="new-sale-hero" type="button" onClick={() => onNavigate('sell')}>
        <span><strong>New Sale</strong><small>Start selling in one tap</small></span>
        <span className="hero-icon"><ShoppingBasket size={28} /></span>
      </button>

      <section className="metric-grid" aria-label="Today's summary">
        <article className="metric-card"><span>Sales today</span><strong>{formatMoney(metrics.salesTodayCents)}</strong></article>
        <article className="metric-card"><span>Estimated profit</span><strong>{formatMoney(metrics.estimatedProfitTodayCents)}</strong></article>
        <article className="metric-card"><span>Credit balance</span><strong>{formatMoney(metrics.outstandingCreditCents)}</strong></article>
        <article className="metric-card"><span>Low-stock items</span><strong>{metrics.lowStockCount}</strong></article>
      </section>

      <section>
        <div className="section-heading"><h2>Quick actions</h2></div>
        <div className="quick-action-grid">
          <button type="button" onClick={() => onNavigate('stock')}><PackagePlus /><span>Add Stock</span></button>
          <button type="button" onClick={() => onNavigate('credit')}><HandCoins /><span>Record Payment</span></button>
          <button type="button" onClick={() => onNavigate('expenses')}><WalletCards /><span>Expense</span></button>
          <button type="button" onClick={() => onNavigate('products')}><ShoppingBasket /><span>Products</span></button>
        </div>
      </section>

      <section>
        <div className="section-heading"><h2>Needs attention</h2></div>
        <div className="list-card">
          <button type="button" className="attention-row" onClick={() => onNavigate('products')}>
            <span className="attention-icon"><AlertTriangle size={18} /></span>
            <span><strong>{lowStock.length} low-stock product{lowStock.length === 1 ? '' : 's'}</strong><small>Review quantities before restocking.</small></span>
          </button>
          <button type="button" className="attention-row" onClick={() => onNavigate('credit')}>
            <span className="attention-icon"><HandCoins size={18} /></span>
            <span><strong>{creditCustomers.length} customer balance{creditCustomers.length === 1 ? '' : 's'}</strong><small>Record full or partial payments.</small></span>
          </button>
        </div>
      </section>
    </div>
  );
}
