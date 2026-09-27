import {
  BarChart3,
  ChevronRight,
  DatabaseBackup,
  LockKeyhole,
  ReceiptText,
  Settings,
  WalletCards,
} from 'lucide-react';
import type { AppScreen } from '../types/navigation';

interface MoreScreenProps {
  onNavigate: (screen: AppScreen) => void;
  onLock: () => void;
}

const rows: Array<{ screen: AppScreen; label: string; description: string; icon: typeof ReceiptText }> = [
  { screen: 'sales', label: 'Sales History', description: 'Review, repeat, or void sales', icon: ReceiptText },
  { screen: 'expenses', label: 'Expenses', description: 'Record and review store expenses', icon: WalletCards },
  { screen: 'reports', label: 'Reports', description: 'Sales, profit, credit, and stock', icon: BarChart3 },
  { screen: 'backup', label: 'Backup & Restore', description: 'Optional Google Drive or device backup', icon: DatabaseBackup },
  { screen: 'settings', label: 'Store Settings', description: 'Appearance, access, and preferences', icon: Settings },
];

export function MoreScreen({ onNavigate, onLock }: MoreScreenProps) {
  return (
    <div className="screen">
      <section className="screen-heading-row"><div><h1>More</h1><p>Settings and less frequent tools.</p></div></section>
      <div className="menu-list">
        {rows.map(({ screen, label, description, icon: Icon }) => (
          <button key={screen} type="button" onClick={() => onNavigate(screen)}>
            <span className="menu-icon"><Icon size={20} /></span>
            <span><strong>{label}</strong><small>{description}</small></span>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
      <button className="secondary-button full-button" type="button" onClick={onLock}><LockKeyhole size={18} /> Lock App</button>
    </div>
  );
}
