import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import './index.css'
import App from './App.tsx'

// Defensive patching for non-standard injected wallet providers (e.g. Xverse, Uniswap, Phantom)
// that lack standard EIP-1193 event listener methods, preventing Privy SDK from throwing TypeErrors on initialization.
if (typeof window !== 'undefined') {
  const patchProvider = (provider: any) => {
    if (provider && typeof provider === 'object') {
      if (typeof provider.on !== 'function') {
        provider.on = function (this: any) {
          console.warn('Provider.on mock called');
          return this;
        };
      }
      if (typeof provider.removeListener !== 'function') {
        provider.removeListener = function (this: any) {
          console.warn('Provider.removeListener mock called');
          return this;
        };
      }
      if (typeof provider.off !== 'function') {
        provider.off = function (this: any) {
          console.warn('Provider.off mock called');
          return this;
        };
      }
    }
  };

  if ((window as any).ethereum) {
    patchProvider((window as any).ethereum);
    if (Array.isArray((window as any).ethereum.providers)) {
      (window as any).ethereum.providers.forEach(patchProvider);
    }
  }

  const keys = ['web3', 'celo', 'trustwallet', 'gatewallet', 'okxwallet', 'uniswap', 'phantom', 'xverse'];
  keys.forEach(key => {
    const wKey = (window as any)[key];
    if (wKey) {
      patchProvider(wKey);
      if (wKey.ethereum) {
        patchProvider(wKey.ethereum);
      }
    }
  });
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID || 'cml5e131s01tbjn0cl00eormz'}
      config={{
        loginMethods: ['email', 'wallet', 'google', 'github'],
        appearance: {
          theme: 'dark',
          accentColor: '#10B981',
        },
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
)
