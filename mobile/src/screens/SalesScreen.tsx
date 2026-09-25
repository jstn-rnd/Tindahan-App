import { useState } from 'react';
import { Ban, ReceiptText } from 'lucide-react';
import { Modal } from '../components/Modal';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';
import type { Sale } from '../types/models';
import { formatDateTime, formatMoney } from '../utils/format';

export function SalesScreen() {
  const state = useACDCState();
  const [selected, setSelected] = useState<Sale | null>(null);
  const sales = [...state.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <div className="screen">
    <section className="screen-heading-row"><div><h1>Sales History</h1><p>{sales.length} recorded sale{sales.length === 1 ? '' : 's'} on this device.</p></div></section>
    <div className="management-list">
      {sales.map((sale) => <button className="management-row clickable-row" type="button" key={sale.id} onClick={() => setSelected(sale)}><span className="row-leading"><ReceiptText size={20} /></span><span className="row-main"><strong>{sale.receiptNumber}</strong><small>{formatDateTime(sale.createdAt)} · {sale.paymentType} · {sale.items.length} products</small></span><span className={`stock-value ${sale.status === 'voided' ? 'muted-value' : ''}`}><strong>{formatMoney(sale.totalCents)}</strong><small>{sale.status}</small></span></button>)}
      {!sales.length && <div className="empty-state"><ReceiptText size={30} /><h2>No sales yet</h2><p>Completed sales will appear here.</p></div>}
    </div>
    {selected && <SaleDetail sale={state.sales.find((sale) => sale.id === selected.id) ?? selected} onClose={() => setSelected(null)} />}
  </div>;
}

function SaleDetail({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const voidSale = async () => {
    if (!window.confirm('Void this sale? Stock and customer credit will be reversed.')) return;
    await acdcStore.voidSale(sale.id);
  };
  return <Modal title={sale.receiptNumber} description={`${formatDateTime(sale.createdAt)} · ${sale.status}`} onClose={onClose}
    footer={<><button className="secondary-button" type="button" onClick={onClose}>Close</button>{sale.status === 'completed' && <button className="danger-button" type="button" onClick={voidSale}><Ban size={17} /> Void Sale</button>}</>}>
    <div className="receipt-lines">{sale.items.map((item) => <div key={item.id}><span><strong>{item.productName}</strong><small>{item.quantity} × {formatMoney(item.priceCents)}</small></span><strong>{formatMoney(item.lineTotalCents)}</strong></div>)}<div className="receipt-total"><span>Total</span><strong>{formatMoney(sale.totalCents)}</strong></div>{sale.creditCents > 0 && <div><span>Added to credit</span><strong>{formatMoney(sale.creditCents)}</strong></div>}{sale.changeCents > 0 && <div><span>Change</span><strong>{formatMoney(sale.changeCents)}</strong></div>}</div>
  </Modal>;
}
