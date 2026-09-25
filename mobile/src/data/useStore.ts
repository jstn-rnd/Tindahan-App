import { useSyncExternalStore } from 'react';
import { acdcStore } from './store';

export function useACDCState() {
  return useSyncExternalStore(acdcStore.subscribe, acdcStore.getSnapshot, acdcStore.getSnapshot);
}
