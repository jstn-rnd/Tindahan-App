import { useMemo, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';
import type { AppScreen } from '../types/navigation';
import type { PaymentType, Sale } from '../types/models';
import { formatMoney, parseMoney } from '../utils/format';

interface SellScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export function SellScreen({ onNavigate }: SellScreenProps) {
  const state = useACDCState();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Favorites');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [savedSale, setSavedSale] = useState<Sale | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = ['Favorites', 'All', ...new Set(state.products.filter((p) => p.active).map((p) => p.category))];
  const products = state.products.filter((product) => {
    if (!product.active) return false;
    const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase())
      || product.barcode.includes(query);
    const matchesCategory = category === 'All'
      || (category === 'Favorites' ? product.favorite : product.category === category);
    return matchesQuery && matchesCategory;
  });
  const cartItems = useMemo(() => Object.entries(cart).map(([productId, quantity]) => ({
    product: state.products.find((product) => product.id === productId)!,
    quantity,
  })).filter((line) => line.product), [cart, state.products]);
  const cartCount = cartItems.reduce((sum, line) => sum + line.quantity, 0);
  const totalCents = cartItems.reduce((sum, line) => sum + (line.product.priceCents * line.quantity), 0);
  const receivedCents = parseMoney(amountReceived);
  const creditCents = paymentType === 'credit' ? Math.max(totalCents - receivedCents, 0) : 0;
  const changeCents = paymentType === 'credit' ? 0 : Math.max(receivedCents - totalCents, 0);
  const insufficientItems = cartItems.filter(
    (line) => line.product.trackStock && line.quantity > line.product.stock,
  );
  const stockBlocked = state.settings.outOfStockPolicy === 'block' && insufficientItems.length > 0;

  const changeQuantity = (productId: string, delta: number) => {
    setCart((current) => {
      const nextQuantity = Math.max(0, (current[productId] ?? 0) + delta);
      if (!nextQuantity) {
        const { [productId]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [productId]: nextQuantity };
    });
  };

  const openCheckout = () => {
    if (!cartCount) return;
    setAmountReceived((totalCents / 100).toFixed(2));
    setPaymentType('cash');
    setError('');
    setCheckoutOpen(true);
  };

  const finishSale = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const sale = await acdcStore.createSale({
        lines: cartItems.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        paymentType,
        amountReceivedCents: paymentType === 'credit' ? receivedCents : Math.max(receivedCents, totalCents),
        customerId: customerId || undefined,
        note,
      });
      await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
      setSavedSale(sale);
      setCart({});
      setCheckoutOpen(false);
      setAmountReceived('');
      setCustomerId('');
      setNote('');
    } catch (saleError) {
      setError(saleError instanceof Error ? saleError.message : 'The sale could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen sell-screen">
      <section className="screen-heading-row">
        <div><h1>New Sale</h1><p>{cartCount} item{cartCount === 1 ? '' : 's'} in cart</p></div>
      </section>

      <div className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or barcode" /></div>
      <div className="filter-chips product-filters">
        {categories.map((item) => <button key={item} type="button" className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>

      <div className="sell-layout">
        <section className="product-grid">
          {products.map((product) => (
            <button className="product-card" type="button" key={product.id} onClick={() => changeQuantity(product.id, 1)}>
              <span className="product-image"><Package size={24} /></span>
              <span className="product-copy"><strong>{product.name}</strong><small>{product.stock} {product.unit}{product.stock === 1 ? '' : 's'} left</small></span>
              <span className="product-price">{formatMoney(product.priceCents)}</span>
              {(cart[product.id] ?? 0) > 0 && <span className="cart-count-badge">{cart[product.id]}</span>}
            </button>
          ))}
          {!products.length && <div className="empty-state"><Package size={28} /><h2>No products found</h2><p>Try another search or category.</p></div>}
        </section>

        <aside className="tablet-cart">
          <div className="section-heading"><h2>Cart</h2><span>{cartCount} items</span></div>
          <CartLines cartItems={cartItems} changeQuantity={changeQuantity} />
          <div className="cart-total"><span>Total</span><strong>{formatMoney(totalCents)}</strong></div>
          <button className="primary-button full-button" type="button" onClick={openCheckout} disabled={!cartCount}>Checkout</button>
        </aside>
      </div>

      <button className="mobile-cart-bar" type="button" onClick={openCheckout} disabled={!cartCount}>
        <span><ShoppingCart size={20} /><span><small>{cartCount} items</small><strong>{formatMoney(totalCents)}</strong></span></span>
        <span>Review Sale</span>
      </button>

      {checkoutOpen && (
        <Modal title="Checkout" description={`${cartCount} items · ${formatMoney(totalCents)}`} onClose={() => setCheckoutOpen(false)} wide
          footer={<><button className="secondary-button" type="button" onClick={() => setCheckoutOpen(false)}>Back to Cart</button><button className="primary-button" type="button" onClick={finishSale} disabled={saving || stockBlocked}>{saving ? 'Saving…' : 'Complete Sale'}</button></>}>
          <div className="checkout-layout">
            <div><h3>Order</h3><CartLines cartItems={cartItems} changeQuantity={changeQuantity} /><div className="cart-total"><span>Total</span><strong>{formatMoney(totalCents)}</strong></div></div>
            <div className="form-stack">
              <fieldset className="segmented-field"><legend>Payment type</legend>{(['cash', 'ewallet', 'credit'] as PaymentType[]).map((type) => <button type="button" key={type} className={paymentType === type ? 'active' : ''} onClick={() => { setPaymentType(type); setAmountReceived(type === 'credit' ? '0.00' : (totalCents / 100).toFixed(2)); }}>{type === 'ewallet' ? 'E-wallet' : type[0].toUpperCase() + type.slice(1)}</button>)}</fieldset>
              {paymentType === 'credit' && <label className="field-label"><span>Customer *</span><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Choose customer</option>{state.customers.filter((customer) => customer.active).map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {formatMoney(customer.balanceCents)}</option>)}</select></label>}
              <label className="field-label"><span>{paymentType === 'credit' ? 'Amount paid now' : 'Amount received'}</span><input inputMode="decimal" value={amountReceived} onChange={(event) => setAmountReceived(event.target.value)} /></label>
              <div className="cash-suggestions">{[totalCents, 5000, 10000, 20000, 50000, 100000].filter((value, index, all) => value >= totalCents && all.indexOf(value) === index).slice(0, 4).map((value) => <button type="button" key={value} onClick={() => setAmountReceived((value / 100).toFixed(2))}>{value === totalCents ? 'Exact' : formatMoney(value)}</button>)}</div>
              <div className="payment-summary"><span>{paymentType === 'credit' ? 'Remaining credit' : 'Change'}</span><strong>{formatMoney(paymentType === 'credit' ? creditCents : changeCents)}</strong></div>
              {insufficientItems.length > 0 && state.settings.outOfStockPolicy !== 'allow' && (
                <p className="info-callout" role={stockBlocked ? 'alert' : 'status'}>
                  {stockBlocked ? 'Sale blocked: ' : 'Stock warning: '}
                  {insufficientItems.map((line) => line.product.name).join(', ')} {insufficientItems.length === 1 ? 'has' : 'have'} less stock than the cart quantity.
                </p>
              )}
              <label className="field-label"><span>Note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" rows={2} /></label>
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
          </div>
        </Modal>
      )}

      {savedSale && (
        <Modal title="Sale saved" description="Saved on this phone and ready to sync." onClose={() => setSavedSale(null)}
          footer={<><button className="secondary-button" type="button" onClick={() => { setSavedSale(null); onNavigate('home'); }}>Home</button><button className="primary-button" type="button" onClick={() => setSavedSale(null)}>New Sale</button></>}>
          <div className="sale-success"><CheckCircle2 size={52} /><strong>{formatMoney(savedSale.totalCents)}</strong><span>{savedSale.receiptNumber}</span>{savedSale.changeCents > 0 && <p>Change: {formatMoney(savedSale.changeCents)}</p>}</div>
        </Modal>
      )}
    </div>
  );
}

interface CartLinesProps {
  cartItems: Array<{ product: ReturnType<typeof acdcStore.getSnapshot>['products'][number]; quantity: number }>;
  changeQuantity: (productId: string, delta: number) => void;
}

function CartLines({ cartItems, changeQuantity }: CartLinesProps) {
  if (!cartItems.length) return <div className="empty-cart"><ShoppingCart size={25} /><span>Your cart is empty.</span></div>;
  return <div className="cart-lines">{cartItems.map(({ product, quantity }) => (
    <div className="cart-line" key={product.id}>
      <span><strong>{product.name}</strong><small>{formatMoney(product.priceCents)} each</small></span>
      <span className="quantity-control"><button type="button" onClick={() => changeQuantity(product.id, -1)} aria-label={`Remove one ${product.name}`}>{quantity === 1 ? <Trash2 size={15} /> : <Minus size={15} />}</button><b>{quantity}</b><button type="button" onClick={() => changeQuantity(product.id, 1)} aria-label={`Add one ${product.name}`}><Plus size={15} /></button></span>
      <strong>{formatMoney(product.priceCents * quantity)}</strong>
    </div>
  ))}</div>;
}
