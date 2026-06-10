import React, { useState, useEffect } from 'react';

export interface ProofStep {
  title: string;
  description: string;
}

interface ProofGeneratorProps {
  type: 'shield' | 'claim';
  amount: number;
  token: string;
  onComplete: () => void;
}

const SHIELD_STEPS: ProofStep[] = [
  {
    title: 'Constructing Secret Commitment',
    description: 'Generating secret key (r) and nullifier (s) to uniquely secure the asset.',
  },
  {
    title: 'Inserting Leaf in Merkle Tree',
    description: 'Computing Poseidon Hash: h(commitment, amount, token) and updating local accumulator.',
  },
  {
    title: 'Generating ZK-STARK Witness',
    description: 'Running the execution trace to demonstrate valid asset shielding constraints.',
  },
  {
    title: 'Compiling Cryptographic Proof',
    description: 'Finalizing STARK proof and sending transaction to Starknet L2 sequencer.',
  }
];

const CLAIM_STEPS: ProofStep[] = [
  {
    title: 'Decrypting Secret Key & Nullifier',
    description: 'Parsing private parameters from URL hash fragment and checking the spent state.',
  },
  {
    title: 'Constructing Merkle Membership Proof',
    description: 'Generating path indices to verify commitment existence without revealing the index.',
  },
  {
    title: 'Verifying STARK Proof on Starknet L2',
    description: 'Sequencer executes verifier contract. Proof validity evaluates to true.',
  },
  {
    title: 'Executing Decoupled Relayer Transfer',
    description: 'Relayer executes on-chain withdrawal, paying gas and receiving L2 fee reimbursement.',
  }
];

export const ProofGenerator: React.FC<ProofGeneratorProps> = ({
  type,
  amount,
  token,
  onComplete,
}) => {
  const steps = type === 'shield' ? SHIELD_STEPS : CLAIM_STEPS;
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const getMockCryptographicLogs = (stepIndex: number, type: 'shield' | 'claim') => {
    if (type === 'shield') {
      switch (stepIndex) {
        case 0:
          return [
            `[crypto] Entropy pool initialised: ${Math.random().toString(16).substring(2, 18)}`,
            `[crypto] Secret key (r) generated: 0x${Math.random().toString(16).substring(2, 12)}...`,
            `[crypto] Nullifier key (s) generated: 0x${Math.random().toString(16).substring(2, 12)}...`,
            `[crypto] Commitment Hash C = Poseidon(amount, r, s) computed.`
          ];
        case 1:
          return [
            `[merkle] Fetching Starknet state root...`,
            `[merkle] Root: 0x05f88bc77e92e21bca961c0c29f64bf87611ab9c8a92e8fa9f`,
            `[merkle] Hashing leaf: Poseidon(C, StarknetAddress)...`,
            `[merkle] Commitment inserted at index: ${Math.floor(Math.random() * 10000)}`,
            `[merkle] New Root computed successfully.`
          ];
        case 2:
          return [
            `[stark] Constructing arithmetic circuit constraints...`,
            `[stark] Witness generator initialized (134,812 gates)`,
            `[stark] Computing witness variables... done in 45ms.`,
            `[stark] Boundary constraints checked: OK.`,
            `[stark] Transition constraints checked: OK.`
          ];
        case 3:
          return [
            `[stark] Executing STARK FRI prover...`,
            `[stark] Generating commitments for polynomial evaluations...`,
            `[stark] Proof size: 48.2 KB`,
            `[stark] Sending proof payload to Starknet Gateway...`,
            `[stark] Sequencer responded: Tx accepted in L2 block.`
          ];
        default:
          return [];
      }
    } else {
      switch (stepIndex) {
        case 0:
          return [
            `[claim] URL hash loaded. Private parameters decrypted.`,
            `[claim] Recipient address connected.`,
            `[claim] Querying spent nullifiers contract set...`,
            `[claim] Nullifier is unused. Link claimable.`
          ];
        case 1:
          return [
            `[merkle] Fetching current tree root from contract...`,
            `[merkle] Root: 0x05f88bc77e92e21bca961c0c29f64bf87611ab9c8a92e8fa9f`,
            `[merkle] Computing siblings for path verification...`,
            `[merkle] Membership witness generated. Path length: 32`
          ];
        case 2:
          return [
            `[stark] Compiling withdrawal zk-STARK proof...`,
            `[stark] Witness size: 142,510 variables`,
            `[stark] Prover completed in 1.2 seconds.`,
            `[stark] Invoking Starknet L2 verifier contract...`,
            `[stark] Verifier returned: SUCCESS`
          ];
        case 3:
          return [
            `[relayer] Submitting claim transaction payload...`,
            `[relayer] Relayer address: 0xrelayer_${Math.random().toString(36).substring(2, 8)}_network`,
            `[relayer] Gas token (STRK) locked: 0.002`,
            `[relayer] Transaction executed: Funds transferred to recipient.`,
            `[relayer] Sequencer confirmed claim on-chain.`
          ];
        default:
          return [];
      }
    }
  };

  useEffect(() => {
    if (currentStep >= steps.length) {
      setIsFinished(true);
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Append logs for the current step
    const newLogs = getMockCryptographicLogs(currentStep, type);
    
    // Simulate printing logs with delays
    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex < newLogs.length) {
        setLogs(prev => [...prev, newLogs[currentLogIndex]]);
        currentLogIndex++;
      } else {
        clearInterval(interval);
        // Advance to next step after a short wait
        const delay = setTimeout(() => {
          setCurrentStep(prev => prev + 1);
        }, 1200);
        return () => clearTimeout(delay);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [currentStep, steps.length, onComplete, type]);

  return (
    <div className="glass-panel glow-card" style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid hsla(var(--text-primary) / 0.08)', paddingBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--heading)' }}>
            {type === 'shield' ? 'Shielding Asset' : 'Unlocking Private Link'}
          </h2>
          <p style={{ fontSize: '0.85rem', marginTop: '2px' }}>
            Amount: <strong style={{ color: 'white' }}>{amount} {token}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isFinished ? (
            <>
              <div className="spinner" style={{ color: 'hsl(var(--starknet-purple))' }}></div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--starknet-purple))', fontFamily: 'var(--heading)' }}>
                {type === 'shield' ? 'Proving Shielding...' : 'Verifying Proof...'}
              </span>
            </>
          ) : (
            <span className="badge badge-success">
              <span className="status-dot"></span> Completed
            </span>
          )}
        </div>
      </div>

      {/* Grid: Left - Steps, Right - Live Cryptographic Logs Terminal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Steps */}
        <div className="zk-flow-visualizer">
          {steps.map((step, idx) => {
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep || isFinished;
            let statusClass = '';
            if (isActive) statusClass = 'active';
            else if (isCompleted) statusClass = 'completed';

            return (
              <div key={idx} className={`zk-step ${statusClass}`}>
                <div className="zk-step-num">{idx + 1}</div>
                <div className="zk-step-content">
                  <div className="zk-step-title">{step.title}</div>
                  <div className="zk-step-desc">{step.description}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Console Terminal */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ fontFamily: 'var(--heading)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', marginBottom: '8px', letterSpacing: '0.05em' }}>
            Cryptographic Console
          </div>
          <div 
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid hsla(var(--text-primary) / 0.1)',
              borderRadius: '12px',
              padding: '16px',
              fontFamily: 'var(--mono)',
              fontSize: '0.75rem',
              color: '#34D399',
              height: '320px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            {logs.map((log, index) => {
              let color = '#34D399'; // default green
              if (log.startsWith('[crypto]')) color = '#F472B6'; // pink
              if (log.startsWith('[stark]')) color = '#A78BFA'; // purple
              if (log.startsWith('[merkle]')) color = '#60A5FA'; // blue
              if (log.startsWith('[relayer]')) color = '#F59E0B'; // orange
              
              return (
                <div key={index} style={{ color, wordBreak: 'break-all' }}>
                  {log}
                </div>
              );
            })}
            {!isFinished && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6B7280' }}>
                <span>&gt;</span>
                <span className="spinner" style={{ width: '8px', height: '8px', borderWidth: '1px' }}></span>
              </div>
            )}
            {isFinished && (
              <div style={{ color: '#10B981', fontWeight: 700, marginTop: '8px', borderTop: '1px dashed #10B981', paddingTop: '8px' }}>
                🎉 ZK-STARK TRANSACTION CONFIRMED ON L2
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
