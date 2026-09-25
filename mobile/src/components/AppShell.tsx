import { useEffect, useRef, type ReactNode } from 'react';
import {
  BarChart3,
  Home,
  Menu,
  NotebookTabs,
  PackageSearch,
  ShoppingBasket,
  Store,
  WifiOff,
} from 'lucide-react';
import type { AppScreen } from '../types/navigation';

interface AppShellProps {
  children: ReactNode;
  activeScreen: AppScreen;
  screenTitle: string;
  pendingSyncCount: number;
  isOnline: boolean;
  onNavigate: (screen: AppScreen) => void;
}

const phoneNav: Array<{ screen: AppScreen; label: string; icon: typeof Home }> = [
  { screen: 'home', label: 'Home', icon: Home },
  { screen: 'products', label: 'Products', icon: PackageSearch },
  { screen: 'sell', label: 'Sell', icon: ShoppingBasket },
  { screen: 'credit', label: 'Credit', icon: NotebookTabs },
  { screen: 'more', label: 'More', icon: Menu },
];

const tabletNav = [
  ...phoneNav.slice(0, 4),
  { screen: 'reports' as AppScreen, label: 'Reports', icon: BarChart3 },
  phoneNav[4],
];

export function AppShell({
  children,
  activeScreen,
  screenTitle,
  pendingSyncCount,
  isOnline,
  onNavigate,
}: AppShellProps) {
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeScreen]);

  const renderButton = ({ screen, label, icon: Icon }: typeof phoneNav[number], compact = false) => (
    <button
      key={screen}
      type="button"
      className={`nav-button ${activeScreen === screen ? 'active' : ''} ${screen === 'sell' && compact ? 'sell-nav' : ''}`}
      onClick={() => onNavigate(screen)}
      aria-current={activeScreen === screen ? 'page' : undefined}
    >
      <Icon size={compact && screen === 'sell' ? 23 : 20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark"><Store size={20} /></span>
          <span>
            <strong>ACDC</strong>
            <small>{screenTitle}</small>
          </span>
        </div>
        <button className="sync-chip" type="button" onClick={() => onNavigate('sync')}>
          {!isOnline && <WifiOff size={14} />}
          <span>{isOnline ? (pendingSyncCount ? `${pendingSyncCount} waiting` : 'Saved offline') : 'Offline'}</span>
        </button>
      </header>

      <aside className="tablet-sidebar" aria-label="Main navigation">
        {tabletNav.map((item) => renderButton(item, false))}
      </aside>

      <main ref={mainRef} className="app-main">{children}</main>

      <nav className="phone-nav" aria-label="Main navigation">
        {phoneNav.map((item) => renderButton(item, true))}
      </nav>
    </div>
  );
}
