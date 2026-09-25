import { useMemo, useState } from 'react';
import {
  Archive,
  Boxes,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';
import type { Product, ProductInput, StockMovement } from '../types/models';
import { formatMoney, parseMoney } from '../utils/format';

type ProductFilter = 'active' | 'low' | 'disabled';

const blankProduct: ProductInput = {
  name: '',
  category: 'Food',
  barcode: '',
  unit: 'piece',
  costCents: 0,
  priceCents: 0,
  stock: 0,
  lowStockLevel: 5,
  favorite: false,
  active: true,
  trackStock: true,
};

export function ProductsScreen() {
  const state = useACDCState();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('active');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [error, setError] = useState('');

  const products = useMemo(() => state.products.filter((product) => {
    const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase())
      || product.barcode.includes(query);
    if (!matchesQuery) return false;
    if (filter === 'disabled') return !product.active;
    if (filter === 'low') return product.active && product.trackStock && product.stock <= product.lowStockLevel;
    return product.active;
  }).sort((a, b) => a.name.localeCompare(b.name)), [filter, query, state.products]);

  return (
    <div className="screen">
      <section className="screen-heading-row">
        <div><h1>Products</h1><p>{state.products.filter((product) => product.active).length} active · {state.products.filter((product) => product.active && product.stock <= product.lowStockLevel).length} low stock</p></div>
        <button className="primary-button" type="button" onClick={() => { setEditing('new'); setError(''); }}><Plus size={18} /> Add Product</button>
      </section>

      <div className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or barcode" /></div>
      <div className="filter-chips"><button type="button" className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Active</button><button type="button" className={filter === 'low' ? 'active' : ''} onClick={() => setFilter('low')}>Low Stock</button><button type="button" className={filter === 'disabled' ? 'active' : ''} onClick={() => setFilter('disabled')}>Disabled</button></div>

      <div className="management-list">
        {products.map((product) => (
          <article className="management-row" key={product.id}>
            <span className="row-leading"><Package size={21} /></span>
            <span className="row-main"><strong>{product.name}</strong><small>{formatMoney(product.costCents)} cost · {formatMoney(product.priceCents)} price · {product.unit}</small></span>
            <span className={`stock-value ${product.stock <= product.lowStockLevel ? 'warning' : ''}`}><strong>{product.stock}</strong><small>in stock</small></span>
            <span className="row-actions">
              <button className="icon-button" type="button" onClick={() => setAdjusting(product)} aria-label={`Adjust stock for ${product.name}`}><PackagePlus size={18} /></button>
              <button className="icon-button" type="button" onClick={() => { setEditing(product); setError(''); }} aria-label={`Edit ${product.name}`}><Pencil size={18} /></button>
            </span>
          </article>
        ))}
        {!products.length && <div className="empty-state"><Boxes size={30} /><h2>No matching products</h2><p>Add a product or change the selected filter.</p></div>}
      </div>

      {editing && <ProductEditor product={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} error={error} setError={setError} />}
      {adjusting && <StockAdjuster product={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  );
}

interface ProductEditorProps {
  product?: Product;
  onClose: () => void;
  error: string;
  setError: (value: string) => void;
}

function ProductEditor({ product, onClose, error, setError }: ProductEditorProps) {
  const { settings } = useACDCState();
  const [form, setForm] = useState<ProductInput>(product ? {
    name: product.name,
    category: product.category,
    barcode: product.barcode,
    unit: product.unit,
    costCents: product.costCents,
    priceCents: product.priceCents,
    stock: product.stock,
    lowStockLevel: product.lowStockLevel,
    favorite: product.favorite,
    active: product.active,
    trackStock: product.trackStock,
  } : blankProduct);
  const [cost, setCost] = useState(product ? (product.costCents / 100).toFixed(2) : '');
  const [price, setPrice] = useState(product ? (product.priceCents / 100).toFixed(2) : '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const nextCostCents = parseMoney(cost);
      const nextPriceCents = parseMoney(price);
      const priceChanged = product
        && (product.costCents !== nextCostCents || product.priceCents !== nextPriceCents);
      if (priceChanged && settings.requirePinForPriceChange) {
        const enteredPin = window.prompt('Enter the device PIN to change product prices.');
        if (enteredPin === null) return;
        if (!acdcStore.verifyPin(enteredPin)) throw new Error('Incorrect PIN. Prices were not changed.');
      }
      await acdcStore.saveProduct({ ...form, costCents: nextCostCents, priceCents: nextPriceCents }, product?.id);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The product could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const disable = async () => {
    if (!product) return;
    await acdcStore.setProductActive(product.id, !product.active);
    onClose();
  };

  const remove = async () => {
    if (!product || !window.confirm(`Delete ${product.name}? This is only allowed when it has no transaction history.`)) return;
    try {
      await acdcStore.deleteUnusedProduct(product.id);
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'The product could not be deleted.');
    }
  };

  return (
    <Modal title={product ? 'Edit Product' : 'Add Product'} description="Product details, price, and stock in one place." onClose={onClose} wide
      footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Product'}</button></>}>
      <div className="form-grid">
        <label className="field-label full-span"><span>Product name *</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Example: Coffee Sachet" /></label>
        <label className="field-label"><span>Category</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
        <label className="field-label"><span>Barcode</span><input value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} placeholder="Optional" /></label>
        <label className="field-label"><span>Selling unit *</span><select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option>piece</option><option>sachet</option><option>bottle</option><option>pack</option><option>can</option><option>kilogram</option><option>liter</option><option>other</option></select></label>
        <label className="field-label"><span>Purchase cost</span><input inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="0.00" /></label>
        <label className="field-label"><span>Selling price *</span><input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" /></label>
        {!product && <label className="field-label"><span>Opening stock</span><input inputMode="decimal" type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) || 0 })} /></label>}
        {product && <div className="read-only-field"><span>Current stock</span><strong>{product.stock} {product.unit}</strong><small>Use Add or Adjust Stock to change this.</small></div>}
        <label className="field-label"><span>Low-stock level</span><input inputMode="decimal" type="number" value={form.lowStockLevel} onChange={(event) => setForm({ ...form, lowStockLevel: Number(event.target.value) || 0 })} /></label>
        <label className="switch-field"><input type="checkbox" checked={form.favorite} onChange={(event) => setForm({ ...form, favorite: event.target.checked })} /><span><strong>Favorite product</strong><small>Show it first on the Sell screen.</small></span></label>
        <label className="switch-field"><input type="checkbox" checked={form.trackStock} onChange={(event) => setForm({ ...form, trackStock: event.target.checked })} /><span><strong>Track stock</strong><small>Update quantity after sales and restocking.</small></span></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {product && <div className="danger-zone"><button className="secondary-button" type="button" onClick={disable}><Archive size={17} /> {product.active ? 'Disable Product' : 'Enable Product'}</button><button className="danger-button" type="button" onClick={remove}><Trash2 size={17} /> Delete</button></div>}
    </Modal>
  );
}

interface StockAdjusterProps {
  product: Product;
  onClose: () => void;
}

function StockAdjuster({ product, onClose }: StockAdjusterProps) {
  const [mode, setMode] = useState<'add' | 'remove' | 'count'>('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<StockMovement['reason']>('restock');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const save = async () => {
    const value = Number(quantity);
    if (!Number.isFinite(value) || value < 0 || (mode !== 'count' && value === 0)) {
      setError('Enter a valid quantity.');
      return;
    }
    const quantityChange = mode === 'count' ? value - product.stock : mode === 'remove' ? -value : value;
    try {
      await acdcStore.adjustStock(product.id, quantityChange, mode === 'count' ? 'correction' : reason, note);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Stock could not be updated.');
    }
  };

  return (
    <Modal title="Add or Adjust Stock" description={`${product.name} · ${product.stock} ${product.unit} currently recorded`} onClose={onClose}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="button" onClick={save}>Save Stock Change</button></>}>
      <div className="form-stack">
        <fieldset className="segmented-field"><legend>Action</legend><button type="button" className={mode === 'add' ? 'active' : ''} onClick={() => { setMode('add'); setReason('restock'); }}>Add</button><button type="button" className={mode === 'remove' ? 'active' : ''} onClick={() => { setMode('remove'); setReason('household'); }}>Remove</button><button type="button" className={mode === 'count' ? 'active' : ''} onClick={() => setMode('count')}>Count</button></fieldset>
        <label className="field-label"><span>{mode === 'count' ? 'Actual count' : 'Quantity'}</span><input autoFocus inputMode="decimal" type="number" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        {mode !== 'count' && <label className="field-label"><span>Reason</span><select value={reason} onChange={(event) => setReason(event.target.value as StockMovement['reason'])}>{mode === 'add' ? <><option value="restock">Restock</option><option value="correction">Correction</option></> : <><option value="household">Household use</option><option value="damaged">Damaged or spoiled</option><option value="correction">Count correction</option></>}</select></label>}
        <label className="field-label"><span>Note</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
