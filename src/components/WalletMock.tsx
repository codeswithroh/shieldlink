import React, { useRef } from 'react';
import type { MockWallet } from '../hooks/useStarknetState';

interface WalletMockProps {
  wallets: MockWallet[];
  activeWallet: MockWallet;
  switchWallet: (id: number) => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
}

export const WalletMock: React.FC<WalletMockProps> = ({
  wallets,
  activeWallet,
  switchWallet,
  isConnected,
  setIsConnected,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedWalletType, setSelectedWalletType] = React.useState<'argent' | 'braavos'>('argent');

  const openModal = () => {
    dialogRef.current?.showModal();
  };

  const closeModal = () => {
    dialogRef.current?.close();
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const handleConnect = () => {
    setIsConnected(true);
    closeModal();
  };

  const handleDisconnect = () => {
    setIsConnected(false);
  };

  return (
    <>
      {isConnected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--heading)' }}>
                {activeWallet.name}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-secondary))', fontFamily: 'var(--mono)' }}>
                {formatAddress(activeWallet.address)}
              </span>
            </div>
            <div 
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: selectedWalletType === 'argent' ? 'linear-gradient(135deg, #FF4F1A, #E03E0B)' : 'linear-gradient(135deg, #00C6FF, #0072FF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
              title={`Connected via ${selectedWalletType === 'argent' ? 'Argent X' : 'Braavos'}`}
            >
              {selectedWalletType === 'argent' ? 'A' : 'B'}
            </div>
          </div>
          <button className="btn btn-secondary" style={{ padding: '8px 14px', borderRadius: '10px' }} onClick={handleDisconnect}>
            Disconnect
          </button>
          <button className="btn btn-outline-purple" style={{ padding: '8px 14px', borderRadius: '10px' }} onClick={openModal}>
            Switch
          </button>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={openModal}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
          Connect Wallet
        </button>
      )}

      {/* Modern Dialog with Entry/Exit Transitions */}
      <dialog ref={dialogRef} className="wallet-modal" onClick={(e) => {
        // Light dismiss: close when clicking on backdrop
        if (e.target === dialogRef.current) closeModal();
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--heading)' }}>Connect a Wallet</h3>
          <button 
            onClick={closeModal} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'hsl(var(--text-secondary))', 
              cursor: 'pointer', 
              fontSize: '1.2rem' 
            }}
          >
            &times;
          </button>
        </div>

        {/* Wallet Type Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <div 
            onClick={() => setSelectedWalletType('argent')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: `2px solid ${selectedWalletType === 'argent' ? 'hsl(var(--starknet-orange))' : 'hsla(var(--text-primary) / 0.08)'}`,
              background: selectedWalletType === 'argent' ? 'hsla(var(--starknet-orange) / 0.08)' : 'rgba(255,255,255,0.01)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #FF4F1A, #FF7B54)', borderRadius: '10px', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.2rem' }}>
              A
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: selectedWalletType === 'argent' ? 'white' : 'hsl(var(--text-secondary))' }}>Argent X</div>
            <div style={{ fontSize: '0.7rem', color: 'hsla(var(--text-primary) / 0.4)', marginTop: '2px' }}>Starknet Native</div>
          </div>

          <div 
            onClick={() => setSelectedWalletType('braavos')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: `2px solid ${selectedWalletType === 'braavos' ? 'hsl(var(--starknet-purple))' : 'hsla(var(--text-primary) / 0.08)'}`,
              background: selectedWalletType === 'braavos' ? 'hsla(var(--starknet-purple) / 0.08)' : 'rgba(255,255,255,0.01)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #00C6FF, #0072FF)', borderRadius: '10px', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.2rem' }}>
              B
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: selectedWalletType === 'braavos' ? 'white' : 'hsl(var(--text-secondary))' }}>Braavos</div>
            <div style={{ fontSize: '0.7rem', color: 'hsla(var(--text-primary) / 0.4)', marginTop: '2px' }}>Smart Wallet</div>
          </div>
        </div>

        {/* Account Selection */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Select Simulated Account</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {wallets.map(w => (
              <div 
                key={w.id} 
                onClick={() => switchWallet(w.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: activeWallet.id === w.id ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${activeWallet.id === w.id ? 'hsla(var(--text-primary) / 0.2)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: activeWallet.id === w.id ? 'white' : 'hsl(var(--text-secondary))' }}>
                    {w.name} {w.id === 1 ? '👨‍💻 (Sender)' : '📥 (Receiver)'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'hsla(var(--text-primary) / 0.4)', fontFamily: 'var(--mono)' }}>
                    {formatAddress(w.address)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 700, color: 'white' }}>{w.publicStrk} STRK</span>
                  <span style={{ fontSize: '0.75rem', color: 'hsla(var(--text-primary) / 0.5)' }}>{w.publicUsdc} USDC</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={closeModal}>
            Cancel
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConnect}>
            Confirm Connect
          </button>
        </div>
      </dialog>
    </>
  );
};
