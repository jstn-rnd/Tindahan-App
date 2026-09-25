import { useState } from 'react';
import { Plus, Receipt, WalletCards } from 'lucide-react';
import { Modal } from '../components/Modal';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';
import { formatDateTime, formatMoney, parseMoney } from '../utils/format';

export function ExpensesScreen() {
  const state = useACDCState();
  const [open, setOpen] = useState(false);
  const total = state.expenses.filter((expense) => !expense.voided).reduce((sum, expense) => sum + expense.amountCents, 0);
  return <div className="screen">
    <section className="screen-heading-row"><div><h1>Expenses</h1><p>Total recorded · {formatMoney(total)}</p></div><button className="primary-button" type="button" onClick={() => setOpen(true)}><Plus size={18} /> Add Expense</button></section>
    <div className="management-list">
      {[...state.expenses].reverse().map((expense) => <article className="management-row" key={expense.id}><span className="row-leading"><Receipt size={20} /></span><span className="row-main"><strong>{expense.description}</strong><small>{expense.category} · {formatDateTime(expense.createdAt)} · {expense.paymentMethod}</small></span><span className="stock-value"><strong>{formatMoney(expense.amountCents)}</strong><small>{expense.paidFromStoreCash ? 'store cash' : 'other funds'}</small></span></article>)}
      {!state.expenses.length && <div className="empty-state"><WalletCards size={30} /><h2>No expenses recorded</h2><p>Add transport, utilities, supplies, or other store expenses.</p></div>}
    </div>
    {open && <ExpenseEditor onClose={() => setOpen(false)} />}
  </div>;
}

function ExpenseEditor({ onClose }: { onClose: () => void }) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Store Supplies');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidFromStoreCash, setPaidFromStoreCash] = useState(true);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const save = async () => {
    try {
      await acdcStore.saveExpense({ description, category, amountCents: parseMoney(amount), paymentMethod, paidFromStoreCash, note });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Expense could not be saved.');
    }
  };
  return <Modal title="Record Expense" description="Store expense or cash withdrawal." onClose={onClose}
    footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="button" onClick={save}>Save Expense</button></>}>
    <div className="form-stack">
      <label className="field-label"><span>Description *</span><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What was this for?" /></label>
      <label className="field-label"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Store Supplies</option><option>Transportation</option><option>Utilities</option><option>Repairs</option><option>Fees</option><option>Personal Withdrawal</option><option>Other</option></select></label>
      <label className="field-label"><span>Amount *</span><input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label>
      <label className="field-label"><span>Payment method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Cash</option><option>GCash</option><option>Maya</option><option>Other</option></select></label>
      <label className="switch-field"><input type="checkbox" checked={paidFromStoreCash} onChange={(event) => setPaidFromStoreCash(event.target.checked)} /><span><strong>Paid from store cash</strong><small>Include this in expected cash.</small></span></label>
      <label className="field-label"><span>Note</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </Modal>;
}
