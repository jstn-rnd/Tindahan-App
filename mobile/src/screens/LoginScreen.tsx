import { useState } from 'react';
import { Delete, Fingerprint, Store } from 'lucide-react';
import { acdcStore } from '../data/store';
import { useACDCState } from '../data/useStore';

interface LoginScreenProps {
  onUnlock: () => void;
}

export function LoginScreen({ onUnlock }: LoginScreenProps) {
  const { settings } = useACDCState();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const press = (digit: string) => {
    if (pin.length >= 6) return;
    const next = `${pin}${digit}`;
    setPin(next);
    setError('');
    if (next.length >= 4 && acdcStore.verifyPin(next)) {
      window.setTimeout(onUnlock, 120);
    }
  };

  const submit = () => {
    if (acdcStore.verifyPin(pin)) onUnlock();
    else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <main className="login-screen">
      <div className="login-panel">
        <span className="login-logo"><Store size={30} /></span>
        <div className="login-heading">
          <p className="eyebrow">{settings.storeName}</p>
          <h1>Welcome back</h1>
          <p>Enter your PIN to open the store.</p>
        </div>

        <div className="pin-dots" aria-label={`${pin.length} PIN digits entered`}>
          {Array.from({ length: Math.max(4, settings.pin.length) }, (_, index) => (
            <span key={index} className={index < pin.length ? 'filled' : ''} />
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="pin-keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
            <button type="button" key={number} onClick={() => press(String(number))}>{number}</button>
          ))}
          <button type="button" className="key-icon" aria-label="Biometric unlock" disabled><Fingerprint size={22} /></button>
          <button type="button" onClick={() => press('0')}>0</button>
          <button type="button" className="key-icon" aria-label="Delete digit" onClick={() => setPin(pin.slice(0, -1))}><Delete size={22} /></button>
        </div>

        <button className="primary-button full-button" type="button" onClick={submit}>Unlock</button>
        <p className="login-help">First-time PIN: <strong>1234</strong></p>
      </div>
    </main>
  );
}
