import { Cloud, Database, RefreshCw, Server, ShieldCheck, WifiOff } from 'lucide-react';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';
import { formatDateTime } from '../utils/format';

export function SyncScreen({ isOnline }: { isOnline: boolean }) {
  const state = useACDCState();
  const configured = Boolean(state.settings.serverUrl.trim());
  return <div className="screen">
    <section className="screen-heading-row"><div><h1>Sync & Backup</h1><p>Your offline data remains available on this device.</p></div></section>
    <section className={`sync-status-panel ${isOnline ? '' : 'offline'}`}>
      <span>{isOnline ? <Cloud size={27} /> : <WifiOff size={27} />}</span>
      <div><strong>{isOnline ? 'Device is online' : 'You are offline'}</strong><p>{isOnline ? 'ACDC can connect when a Frappe server is configured.' : 'You can continue selling and recording transactions.'}</p></div>
    </section>
    <div className="metric-grid">
      <article className="metric-card"><span>Waiting to sync</span><strong>{state.outbox.length}</strong></article>
      <article className="metric-card"><span>Local database</span><strong>{acdcStore.storageMode === 'sqlite' ? 'SQLite' : 'Browser'}</strong></article>
      <article className="metric-card"><span>Last server sync</span><strong className="small-metric">{state.settings.lastSyncAt ? formatDateTime(state.settings.lastSyncAt) : 'Not yet'}</strong></article>
      <article className="metric-card"><span>Local records</span><strong>{state.products.length + state.sales.length + state.expenses.length}</strong></article>
    </div>
    <section className="settings-section">
      <div className="settings-heading"><span><Server size={19} /></span><div><h2>Frappe Connection</h2><p>{configured ? state.settings.serverUrl : 'No server has been configured yet.'}</p></div></div>
      <button className="primary-button full-button" type="button" disabled={!configured || !isOnline}><RefreshCw size={18} /> Sync Now</button>
      {!configured && <p className="info-callout"><Database size={17} /> The APK works fully offline. Add the server URL in Store Settings after the Frappe backend is deployed.</p>}
    </section>
    <section className="settings-section">
      <div className="settings-heading"><span><ShieldCheck size={19} /></span><div><h2>Data Safety</h2><p>Sales and stock changes are stored locally before any network request.</p></div></div>
      <ul className="plain-list"><li>Closing the app does not erase your records.</li><li>Every transaction receives a unique ID.</li><li>Connection loss never interrupts checkout.</li></ul>
    </section>
  </div>;
}
