import { AlertTriangle, Banknote, Boxes, HandCoins, TrendingUp } from 'lucide-react';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';
import { formatMoney } from '../utils/format';

export function ReportsScreen() {
  const state = useACDCState();
  const metrics = acdcStore.getMetrics();
  const activeSales = state.sales.filter((sale) => sale.status === 'completed');
  const allSalesCents = activeSales.reduce((sum, sale) => sum + sale.totalCents, 0);
  const expenseCents = state.expenses.filter((expense) => !expense.voided).reduce((sum, expense) => sum + expense.amountCents, 0);
  const stockValueCents = state.products.reduce((sum, product) => sum + Math.max(product.stock, 0) * product.costCents, 0);

  return (
    <div className="screen">
      <section className="screen-heading-row"><div><h1>Reports</h1><p>A practical summary based on this device.</p></div></section>
      <div className="filter-chips"><button className="active" type="button">Today</button><button type="button">7 Days</button><button type="button">Month</button></div>
      <section className="report-grid">
        <article><span className="report-icon"><Banknote /></span><small>Sales today</small><strong>{formatMoney(metrics.salesTodayCents)}</strong></article>
        <article><span className="report-icon"><TrendingUp /></span><small>Estimated profit</small><strong>{formatMoney(metrics.estimatedProfitTodayCents)}</strong></article>
        <article><span className="report-icon"><HandCoins /></span><small>Outstanding credit</small><strong>{formatMoney(metrics.outstandingCreditCents)}</strong></article>
        <article><span className="report-icon"><Boxes /></span><small>Stock value at cost</small><strong>{formatMoney(stockValueCents)}</strong></article>
      </section>
      <section className="summary-panel">
        <div><span>All recorded sales</span><strong>{formatMoney(allSalesCents)}</strong></div>
        <div><span>Recorded expenses</span><strong>{formatMoney(expenseCents)}</strong></div>
        <div><span>Completed transactions</span><strong>{activeSales.length}</strong></div>
        <div><span>Products needing stock</span><strong>{metrics.lowStockCount}</strong></div>
      </section>
      <p className="info-callout"><AlertTriangle size={17} /> Profit is an estimate based on each product’s recorded purchase cost.</p>
    </div>
  );
}
