import { useEffect, useState } from 'react';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { AppShell } from './components/AppShell';
import { acdcStore } from './data/store';
import { useACDCState } from './data/useStore';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SellScreen } from './screens/SellScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { CreditScreen } from './screens/CreditScreen';
import { MoreScreen } from './screens/MoreScreen';
import { SalesScreen } from './screens/SalesScreen';
import { StockScreen } from './screens/StockScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SyncScreen } from './screens/SyncScreen';
import { screenTitles, type AppScreen } from './types/navigation';

export default function App() {
  const state = useACDCState();
  const [initialized, setInitialized] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [screen, setScreen] = useState<AppScreen>('home');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    acdcStore.initialize().finally(() => setInitialized(true));
    Network.getStatus().then((status) => setIsOnline(status.connected)).catch(() => undefined);
    const listener = Network.addListener('networkStatusChange', (status) => setIsOnline(status.connected));
    return () => { listener.then((handle) => handle.remove()).catch(() => undefined); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      state.settings.theme === 'dark' ? '#050706' : '#238654',
    );
    SystemBars.setStyle({
      style: state.settings.theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    }).catch(() => undefined);
  }, [state.settings.theme]);

  if (!initialized) {
    return <div className="loading-screen"><span className="loading-mark">A</span><p>Opening ACDC…</p></div>;
  }

  if (!unlocked) {
    return <LoginScreen onUnlock={() => setUnlocked(true)} />;
  }

  const shared = { onNavigate: setScreen };
  const screenContent: Record<AppScreen, React.ReactNode> = {
    home: <HomeScreen {...shared} />,
    sell: <SellScreen {...shared} />,
    products: <ProductsScreen />,
    credit: <CreditScreen />,
    more: <MoreScreen {...shared} onLock={() => setUnlocked(false)} />,
    sales: <SalesScreen />,
    stock: <StockScreen />,
    expenses: <ExpensesScreen />,
    reports: <ReportsScreen />,
    settings: <SettingsScreen />,
    sync: <SyncScreen isOnline={isOnline} />,
  };

  return (
    <AppShell
      activeScreen={screen}
      screenTitle={screenTitles[screen]}
      pendingSyncCount={state.outbox.length}
      isOnline={isOnline}
      onNavigate={setScreen}
    >
      {screenContent[screen]}
    </AppShell>
  );
}
