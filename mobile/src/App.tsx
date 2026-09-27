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
import { BackupScreen } from './screens/BackupScreen';
import { screenTitles, type AppScreen } from './types/navigation';

export default function App() {
  const state = useACDCState();
  const [initialized, setInitialized] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [screen, setScreen] = useState<AppScreen>('home');
  const [isOnline, setIsOnline] = useState(false);
  const [connectionType, setConnectionType] = useState('none');

  useEffect(() => {
    acdcStore.initialize().finally(() => setInitialized(true));
    const applyNetworkStatus = (status: { connected: boolean; connectionType: string }) => {
      const connected = status.connected && status.connectionType !== 'none';
      setIsOnline(connected);
      setConnectionType(connected ? status.connectionType : 'none');
    };
    Network.getStatus().then(applyNetworkStatus).catch(() => undefined);
    const listener = Network.addListener('networkStatusChange', applyNetworkStatus);
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
    backup: <BackupScreen />,
  };

  return (
    <AppShell
      activeScreen={screen}
      screenTitle={screenTitles[screen]}
      isOnline={isOnline}
      connectionType={connectionType}
      onNavigate={setScreen}
    >
      {screenContent[screen]}
    </AppShell>
  );
}
