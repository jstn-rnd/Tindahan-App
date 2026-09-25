import { useState } from 'react';
import { Boxes, History, PackagePlus, Search } from 'lucide-react';
import { Modal } from '../components/Modal';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';
import type { Product, StockMovement } from '../types/models';
import { formatDateTime } from '../utils/format';

export function StockScreen() {
  const state = useACDCState();
  const [query, setQuery] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const products = state.products.filter((item) => item.active && item.trackStock && item.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.stock - b.stock);

  return <div className="screen">
    <section className="screen-heading-row"><div><h1>Stock</h1><p>Add stock, remove stock, or enter an actual count.</p></div></section>
    <div className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product" /></div>
    <div className="management-list">
      {products.map((item) => <article className="management-row" key={item.id}>
        <span className="row-leading"><Boxes size={21} /></span>
        <span className="row-main"><strong>{item.name}</strong><small>Low-stock level: {item.lowStockLevel} {item.unit}</small></span>
        <span className={`stock-value ${item.stock <= item.lowStockLevel ? 'warning' : ''}`}><strong>{item.stock}</strong><small>{item.unit}</small></span>
        <span className="row-actions"><button className="icon-button" type="button" onClick={() => setHistoryProduct(item)} aria-label={`View ${item.name} history`}><History size={18} /></button><button className="primary-button compact-button" type="button" onClick={() => setProduct(item)}><PackagePlus size={17} /> Adjust</button></span>
      </article>)}
    </div>
    {product && <QuickStockEditor product={product} onClose={() => setProduct(null)} />}
    {historyProduct && <StockHistory product={historyProduct} onClose={() => setHistoryProduct(null)} />}
  </div>;
}

function QuickStockEditor({ product, onClose }: { product: Product; onClose: () => void }) {
  const [mode, setMode] = useState<'add' | 'remove' | 'count'>('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<StockMovement['reason']>('restock');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const save = async () => {
    const value = Number(quantity);
    if (!Number.isFinite(value) || value < 0 || (mode !== 'count' && !value)) return setError('Enter a valid quantity.');
    const change = mode === 'count' ? value - product.stock : mode === 'remove' ? -value : value;
    try {
      await acdcStore.adjustStock(product.id, change, mode === 'count' ? 'correction' : reason, note);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Stock could not be saved.');
    }
  };

  return <Modal title="Update Stock" description={`${product.name} · ${product.stock} ${product.unit} recorded`} onClose={onClose}
    footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="button" onClick={save}>Save Change</button></>}>
    <div className="form-stack">
      <fieldset className="segmented-field"><legend>Action</legend><button type="button" className={mode === 'add' ? 'active' : ''} onClick={() => { setMode('add'); setReason('restock'); }}>Add</button><button type="button" className={mode === 'remove' ? 'active' : ''} onClick={() => { setMode('remove'); setReason('household'); }}>Remove</button><button type="button" className={mode === 'count' ? 'active' : ''} onClick={() => setMode('count')}>Count</button></fieldset>
      <label className="field-label"><span>{mode === 'count' ? 'Actual count' : 'Quantity'}</span><input autoFocus type="number" inputMode="decimal" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      {mode === 'remove' && <label className="field-label"><span>Reason</span><select value={reason} onChange={(event) => setReason(event.target.value as StockMovement['reason'])}><option value="household">Household use</option><option value="damaged">Damaged or spoiled</option><option value="correction">Correction</option></select></label>}
      <label className="field-label"><span>Note</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </Modal>;
}

function StockHistory({ product, onClose }: { product: Product; onClose: () => void }) {
  const state = useACDCState();
  const movements = state.stockMovements.filter((movement) => movement.productId === product.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <Modal title="Stock History" description={`${product.name} · ${product.stock} ${product.unit} now`} onClose={onClose}>
    <div className="ledger-list">{movements.map((movement) => <div key={movement.id}><span><strong>{movement.reason.replace('-', ' ')}</strong><small>{formatDateTime(movement.createdAt)}{movement.note ? ` · ${movement.note}` : ''}</small></span><strong className={movement.quantityChange > 0 ? 'positive-value' : ''}>{movement.quantityChange > 0 ? '+' : ''}{movement.quantityChange}</strong></div>)}</div>
  </Modal>;
}
