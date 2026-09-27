import { useEffect, useMemo, useState } from 'react';
import {
  Cloud,
  CloudUpload,
  Database,
  FileClock,
  FolderOpen,
  HardDrive,
  MailCheck,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';
import { openBackupFile, saveBackupFile } from '../native/backupFile';
import {
  openGoogleDriveBackup,
  removeGoogleDriveAccount,
  saveGoogleDriveBackup,
  verifyGoogleDriveEmail,
} from '../native/googleDriveBackup';
import { formatDateTime } from '../utils/format';

type BackupDialog = 'backup' | 'restore' | null;

function backupsThisMonth(history: string[]): number {
  const now = new Date();
  return history.filter((value) => {
    const date = new Date(value);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The backup request could not be completed.';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function BackupScreen() {
  const state = useACDCState();
  const [email, setEmail] = useState(state.backup.googleEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<BackupDialog>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const monthlyCount = useMemo(() => backupsThisMonth(state.backup.history), [state.backup.history]);
  const localRecords = state.products.length + state.sales.length + state.expenses.length + state.customers.length;
  const verifiedEmail = state.backup.googleEmail;

  useEffect(() => {
    if (verifiedEmail) setEmail(verifiedEmail);
  }, [verifiedEmail]);

  const begin = () => {
    setBusy(true);
    setMessage('');
    setError('');
    setLocationUnavailable(false);
  };

  const verifyEmail = async () => {
    if (!isValidEmail(email)) {
      setError('Enter a valid email address first.');
      return;
    }
    begin();
    try {
      const result = await verifyGoogleDriveEmail(email.trim().toLowerCase());
      if (result.cancelled) return;
      if (!result.email) throw new Error('Google did not return a verified email address.');
      await acdcStore.setGoogleBackupEmail(result.email);
      setEmail(result.email);
      setMessage(`${result.email} is verified for Google Drive backup.`);
    } catch (verifyError) {
      setError(errorMessage(verifyError));
    } finally {
      setBusy(false);
    }
  };

  const removeEmail = async () => {
    if (!verifiedEmail) return;
    if (!window.confirm(`Remove ${verifiedEmail} from ACDC and revoke its Google Drive access?`)) return;
    begin();
    try {
      await removeGoogleDriveAccount(verifiedEmail);
      await acdcStore.setGoogleBackupEmail();
      setEmail('');
      setMessage('The Google account was removed from ACDC.');
    } catch (removeError) {
      setError(errorMessage(removeError));
    } finally {
      setBusy(false);
    }
  };

  const backUpLocal = async (chooseNewLocation = false) => {
    begin();
    try {
      const prepared = acdcStore.prepareBackup();
      const result = await saveBackupFile(
        prepared.data,
        chooseNewLocation ? undefined : state.backup.localFileUri,
      );
      if (result.cancelled) return;
      if (!result.uri) throw new Error('The local backup location was not selected.');
      await acdcStore.completeLocalBackup(prepared.createdAt, result.uri, result.name ?? 'ACDC-backup.json');
      setDialog(null);
      setMessage(state.backup.localFileUri && !chooseNewLocation
        ? 'The existing local backup was updated.'
        : 'Local backup created. Future local backups will replace this file.');
    } catch (backupError) {
      const code = typeof backupError === 'object' && backupError !== null && 'code' in backupError
        ? String((backupError as { code?: unknown }).code)
        : '';
      setLocationUnavailable(code === 'BACKUP_LOCATION_UNAVAILABLE');
      setError(errorMessage(backupError));
    } finally {
      setBusy(false);
    }
  };

  const backUpDrive = async () => {
    if (!verifiedEmail) {
      setError('Verify a Google email before backing up to Google Drive.');
      setDialog(null);
      return;
    }
    begin();
    try {
      const prepared = acdcStore.prepareBackup();
      const result = await saveGoogleDriveBackup(
        verifiedEmail,
        prepared.data,
        state.backup.driveFileId,
      );
      if (result.cancelled) return;
      if (!result.fileId) throw new Error('Google Drive did not return the backup file.');
      await acdcStore.completeDriveBackup(
        prepared.createdAt,
        result.fileId,
        result.name ?? 'ACDC-backup.json',
      );
      setDialog(null);
      setMessage(state.backup.driveFileId
        ? 'The existing Google Drive backup was updated.'
        : 'Google Drive backup created. Future Drive backups will replace this file.');
    } catch (backupError) {
      setError(errorMessage(backupError));
    } finally {
      setBusy(false);
    }
  };

  const restoreLocal = async () => {
    begin();
    try {
      const result = await openBackupFile();
      if (result.cancelled) return;
      if (!result.data || !result.uri) throw new Error('The selected local backup could not be opened.');
      const confirmed = window.confirm('Restore this local backup? Current ACDC data on this phone will be replaced.');
      if (!confirmed) return;
      await acdcStore.restoreBackup(result.data);
      await acdcStore.rememberLocalBackupFile(result.uri, result.name ?? 'ACDC-backup.json');
      setDialog(null);
      setMessage('Local backup restored successfully.');
    } catch (restoreError) {
      setError(errorMessage(restoreError));
    } finally {
      setBusy(false);
    }
  };

  const restoreDrive = async () => {
    if (!verifiedEmail) {
      setError('Verify a Google email before restoring from Google Drive.');
      setDialog(null);
      return;
    }
    begin();
    try {
      const result = await openGoogleDriveBackup(verifiedEmail, state.backup.driveFileId);
      if (result.cancelled) return;
      if (!result.data || !result.fileId) throw new Error('The Google Drive backup could not be opened.');
      const confirmed = window.confirm('Restore this Google Drive backup? Current ACDC data on this phone will be replaced.');
      if (!confirmed) return;
      await acdcStore.restoreBackup(result.data);
      await acdcStore.rememberDriveBackupFile(result.fileId, result.name ?? 'ACDC-backup.json');
      setDialog(null);
      setMessage('Google Drive backup restored successfully.');
    } catch (restoreError) {
      setError(errorMessage(restoreError));
    } finally {
      setBusy(false);
    }
  };

  const locations = [state.backup.localFileUri ? 'Local' : '', state.backup.driveFileId ? 'Drive' : '']
    .filter(Boolean)
    .join(' + ');

  return <div className="screen">
    <section className="screen-heading-row"><div><h1>Backup & Restore</h1><p>Optional protection for the records stored on this phone.</p></div></section>

    <section className="backup-status-panel">
      <span><CloudUpload size={27} /></span>
      <div><strong>{locations ? `${locations} backup ready` : 'Choose a backup destination'}</strong><p>Local and Google Drive backups can be kept at the same time.</p></div>
    </section>

    <div className="metric-grid">
      <article className="metric-card"><span>Backups this month</span><strong>{monthlyCount}</strong></article>
      <article className="metric-card"><span>Last backup</span><strong className="small-metric">{state.backup.lastBackupAt ? formatDateTime(state.backup.lastBackupAt) : 'Not yet'}</strong></article>
      <article className="metric-card"><span>Local backup</span><strong className="small-metric">{state.backup.localLastBackupAt ? formatDateTime(state.backup.localLastBackupAt) : 'Not yet'}</strong></article>
      <article className="metric-card"><span>Drive backup</span><strong className="small-metric">{state.backup.driveLastBackupAt ? formatDateTime(state.backup.driveLastBackupAt) : 'Not yet'}</strong></article>
      <article className="metric-card"><span>Local records</span><strong>{localRecords}</strong></article>
    </div>

    <section className="settings-section">
      <div className="settings-heading"><span><MailCheck size={19} /></span><div><h2>Google Drive account</h2><p>Verify the account that ACDC may use for Drive backup.</p></div></div>
      <label className="field-label"><span>Email address</span><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@gmail.com" /></label>
      {verifiedEmail && <p className="verified-account"><ShieldCheck size={16} /> Verified: {verifiedEmail}</p>}
      <div className="backup-account-actions">
        <button className="primary-button" type="button" disabled={busy || !isValidEmail(email) || email.trim().toLowerCase() === verifiedEmail} onClick={verifyEmail}><MailCheck size={17} /> Verify</button>
        <button className="danger-button" type="button" disabled={busy || !verifiedEmail} onClick={removeEmail}><Trash2 size={17} /> Remove</button>
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-heading"><span><Database size={19} /></span><div><h2>Single-file backup</h2><p>Each destination keeps one backup file and replaces it with the newest copy.</p></div></div>
      <p className="backup-help"><FolderOpen size={17} /> Local backup uses Android’s file picker. Google Drive uses the verified account above.</p>
      <button className="primary-button full-button" type="button" disabled={busy} onClick={() => setDialog('backup')}><RefreshCw size={18} /> {busy ? 'Please wait…' : 'Back Up Now'}</button>
      {locationUnavailable && <button className="secondary-button full-button" type="button" disabled={busy} onClick={() => backUpLocal(true)}><FolderOpen size={18} /> Choose New Local Backup File</button>}
    </section>

    <section className="settings-section">
      <div className="settings-heading"><span><RotateCcw size={19} /></span><div><h2>Restore a backup</h2><p>Recover store data from a local file or Google Drive.</p></div></div>
      <button className="secondary-button full-button" type="button" disabled={busy} onClick={() => setDialog('restore')}><FileClock size={18} /> Restore Backup</button>
    </section>

    {message && <p className="success-callout"><ShieldCheck size={17} /> {message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}

    <section className="settings-section">
      <div className="settings-heading"><span><ShieldCheck size={19} /></span><div><h2>Data safety</h2><p>Backup is optional. Selling and recording transactions always work offline.</p></div></div>
      <ul className="plain-list"><li>Local and Google Drive backups are independent.</li><li>Each backup replaces only the existing file at that destination.</li><li>Keep backup files private because they contain store information.</li></ul>
    </section>

    {dialog && <Modal
      title={dialog === 'backup' ? 'Choose backup destination' : 'Choose restore source'}
      description={dialog === 'backup' ? 'Local and Google Drive copies can both be maintained.' : 'Select where ACDC should fetch the backup.'}
      onClose={() => !busy && setDialog(null)}
    >
      <div className="backup-option-grid">
        <button className="backup-option" type="button" disabled={busy} onClick={dialog === 'backup' ? () => backUpLocal(false) : restoreLocal}>
          <span><HardDrive size={24} /></span><strong>Local</strong><small>{dialog === 'backup' ? 'Save with Android’s file picker' : 'Choose a backup file on this phone'}</small>
        </button>
        <button className="backup-option" type="button" disabled={busy || !verifiedEmail} onClick={dialog === 'backup' ? backUpDrive : restoreDrive}>
          <span><Cloud size={24} /></span><strong>Google Drive</strong><small>{verifiedEmail ?? 'Verify an email first'}</small>
        </button>
      </div>
    </Modal>}
  </div>;
}
