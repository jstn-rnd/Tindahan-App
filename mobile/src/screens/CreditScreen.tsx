import { useState } from 'react';
import { HandCoins, Plus, Search, UserRound } from 'lucide-react';
import { Modal } from '../components/Modal';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';
import type { Customer, CustomerInput } from '../types/models';
import { formatDateTime, formatMoney, parseMoney } from '../utils/format';

const blankCustomer: CustomerInput = {
  name: '',
  phone: '',
  address: '',
  creditLimitCents: 0,
  active: true,
};

export function CreditScreen() {
  const state = useACDCState();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [paying, setPaying] = useState<Customer | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const totalBalance = state.customers.reduce((sum, customer) => sum + customer.balanceCents, 0);
  const customers = state.customers.filter((customer) => customer.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="screen">
      <section className="screen-heading-row">
        <div><h1>Credit</h1><p>Total outstanding · {formatMoney(totalBalance)}</p></div>
        <button className="primary-button" type="button" onClick={() => setEditing('new')}><Plus size={18} /> Add Customer</button>
      </section>
      <div className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer" /></div>
      <div className="management-list">
        {customers.map((customer) => (
          <article className="management-row customer-row" key={customer.id} onClick={() => setSelected(customer)}>
            <span className="customer-avatar">{customer.name.slice(0, 2).toUpperCase()}</span>
            <span className="row-main"><strong>{customer.name}</strong><small>{customer.phone || 'No phone number'} · {customer.active ? 'Active' : 'Disabled'}</small></span>
            <span className={`stock-value ${customer.balanceCents ? 'warning' : ''}`}><strong>{formatMoney(customer.balanceCents)}</strong><small>balance</small></span>
            <button className="secondary-button compact-button" type="button" disabled={!customer.balanceCents} onClick={(event) => { event.stopPropagation(); setPaying(customer); }}><HandCoins size={16} /> Pay</button>
          </article>
        ))}
        {!customers.length && <div className="empty-state"><UserRound size={30} /><h2>No customers yet</h2><p>Add a customer before recording a credit sale.</p></div>}
      </div>

      {editing && <CustomerEditor customer={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {paying && <PaymentEditor customer={paying} onClose={() => setPaying(null)} />}
      {selected && <CustomerDetail customer={state.customers.find((customer) => customer.id === selected.id) ?? selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} onPay={() => { setPaying(selected); setSelected(null); }} />}
    </div>
  );
}

function CustomerEditor({ customer, onClose }: { customer?: Customer; onClose: () => void }) {
  const [form, setForm] = useState<CustomerInput>(customer ? {
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    creditLimitCents: customer.creditLimitCents,
    active: customer.active,
  } : blankCustomer);
  const [limit, setLimit] = useState(customer?.creditLimitCents ? (customer.creditLimitCents / 100).toFixed(2) : '');
  const [error, setError] = useState('');

  const save = async () => {
    try {
      await acdcStore.saveCustomer({ ...form, creditLimitCents: parseMoney(limit) }, customer?.id);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Customer could not be saved.');
    }
  };

  return <Modal title={customer ? 'Edit Customer' : 'Add Customer'} description="Only the name is required." onClose={onClose}
    footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="button" onClick={save}>Save Customer</button></>}>
    <div className="form-stack">
      <label className="field-label"><span>Customer name *</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Name or familiar nickname" /></label>
      <label className="field-label"><span>Phone number</span><input inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Optional" /></label>
      <label className="field-label"><span>Address or landmark</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Optional" /></label>
      <label className="field-label"><span>Credit warning limit</span><input inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="0.00" /></label>
      {customer && <label className="switch-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span><strong>Customer is active</strong><small>Disabled customers remain in history.</small></span></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </Modal>;
}

function PaymentEditor({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const save = async () => {
    try {
      await acdcStore.recordPayment(customer.id, parseMoney(amount), method, note);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Payment could not be saved.');
    }
  };

  return <Modal title="Record Payment" description={`${customer.name} owes ${formatMoney(customer.balanceCents)}`} onClose={onClose}
    footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="button" onClick={save}>Save Payment</button></>}>
    <div className="form-stack">
      <label className="field-label"><span>Amount paid *</span><input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label>
      <div className="cash-suggestions"><button type="button" onClick={() => setAmount((customer.balanceCents / 100).toFixed(2))}>Full balance</button><button type="button" onClick={() => setAmount((Math.min(customer.balanceCents, 5000) / 100).toFixed(2))}>₱50</button><button type="button" onClick={() => setAmount((Math.min(customer.balanceCents, 10000) / 100).toFixed(2))}>₱100</button></div>
      <label className="field-label"><span>Payment method</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option>Cash</option><option>GCash</option><option>Maya</option><option>Other</option></select></label>
      <label className="field-label"><span>Note</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </Modal>;
}

function CustomerDetail({ customer, onClose, onEdit, onPay }: { customer: Customer; onClose: () => void; onEdit: () => void; onPay: () => void }) {
  const state = useACDCState();
  const ledger = state.creditEntries.filter((entry) => entry.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <Modal title={customer.name} description={`Current balance · ${formatMoney(customer.balanceCents)}`} onClose={onClose}
    footer={<><button className="secondary-button" type="button" onClick={onEdit}>Edit</button><button className="primary-button" type="button" onClick={onPay} disabled={!customer.balanceCents}>Record Payment</button></>}>
    <div className="ledger-list">
      {ledger.map((entry) => <div key={entry.id}><span><strong>{entry.type[0].toUpperCase() + entry.type.slice(1)}</strong><small>{formatDateTime(entry.createdAt)}</small></span><strong className={entry.amountCents < 0 ? 'positive-value' : ''}>{entry.amountCents < 0 ? '−' : '+'}{formatMoney(Math.abs(entry.amountCents))}</strong></div>)}
      {!ledger.length && <div className="empty-state compact"><HandCoins size={25} /><p>No credit activity yet.</p></div>}
    </div>
  </Modal>;
}
