import { useEffect, useState } from 'react';
import {
  Accessibility,
  LockKeyhole,
  Moon,
  Package,
  Save,
  Store,
  Sun,
} from 'lucide-react';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';
import type { StoreSettings, ThemeMode } from '../types/models';

export function SettingsScreen() {
  const state = useACDCState();
  const [form, setForm] = useState<StoreSettings>(state.settings);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setForm(state.settings), [state.settings]);

  const setTheme = async (theme: ThemeMode) => {
    setForm((current) => ({ ...current, theme }));
    await acdcStore.updateSettings({ theme });
  };

  const save = async () => {
    setError('');
    setMessage('');
    try {
      await acdcStore.updateSettings(form);
      setMessage('Settings saved on this phone.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Settings could not be saved.');
    }
  };

  return <div className="screen settings-screen">
    <section className="screen-heading-row"><div><h1>Store Settings</h1><p>Simple controls for ACDC.</p></div></section>

    <section className="settings-section">
      <div className="settings-heading"><span><Store size={19} /></span><div><h2>Store Profile</h2><p>Shown on the login and home screens.</p></div></div>
      <div className="form-grid">
        <label className="field-label"><span>Store name</span><input value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} /></label>
        <label className="field-label"><span>Owner name</span><input value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} /></label>
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-heading"><span><Accessibility size={19} /></span><div><h2>Appearance</h2><p>Dark mode uses black and charcoal with green accents.</p></div></div>
      <div className="theme-picker" role="radiogroup" aria-label="Appearance">
        <button type="button" role="radio" aria-checked={form.theme === 'light'} className={form.theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={22} /><span><strong>Light</strong><small>Green and white</small></span></button>
        <button type="button" role="radio" aria-checked={form.theme === 'dark'} className={form.theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={22} /><span><strong>Dark</strong><small>Black and charcoal</small></span></button>
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-heading"><span><Package size={19} /></span><div><h2>Products & Sales</h2><p>Warnings protect data without slowing down selling.</p></div></div>
      <label className="field-label"><span>When stock is not enough</span><select value={form.outOfStockPolicy} onChange={(event) => setForm({ ...form, outOfStockPolicy: event.target.value as StoreSettings['outOfStockPolicy'] })}><option value="allow">Allow</option><option value="warn">Warn and allow</option><option value="block">Block sale</option></select></label>
      <label className="switch-field"><input type="checkbox" checked={form.requirePinForPriceChange} onChange={(event) => setForm({ ...form, requirePinForPriceChange: event.target.checked })} /><span><strong>Require PIN for price changes</strong><small>Helps prevent accidental discounts.</small></span></label>
    </section>

    <section className="settings-section">
      <div className="settings-heading"><span><LockKeyhole size={19} /></span><div><h2>Security & Connection</h2><p>Connection can remain empty while the app is offline-only.</p></div></div>
      <div className="form-grid">
        <label className="field-label"><span>Device PIN</span><input inputMode="numeric" type="password" value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/\D/g, '').slice(0, 6) })} /></label>
        <label className="field-label"><span>Frappe server URL</span><input inputMode="url" value={form.serverUrl} onChange={(event) => setForm({ ...form, serverUrl: event.target.value })} placeholder="https://store.example.com" /></label>
      </div>
    </section>

    {message && <p className="success-callout">{message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button full-button" type="button" onClick={save}><Save size={18} /> Save Settings</button>
  </div>;
}
