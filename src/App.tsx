import React, { useState, useEffect, useRef } from 'react';
import QRCodeSVG from 'react-qr-code';
import { useStarknetState, type MockWallet, type ShieldLinkData, type NoteEntry, FIXED_DENOMS, splitIntoNotes } from './hooks/useStarknetState';
import { getOrg, saveOrg, getRecipients, saveRecipient, deleteRecipient,
         savePayRun, type OrgRecord, type RecipientRecord, type PayRunRecord } from './utils/db';

// ─────────────────────────────────────────────────────────────
// Icons Definition
// ─────────────────────────────────────────────────────────────
const I: Record<string, React.ReactNode> = {
  dashboard: <g><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></g>,
  shield: <g><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/></g>,
  send: <g><line x1="6" y1="18" x2="18" y2="6"/><polyline points="9 6 18 6 18 15"/></g>,
  claim: <g><polyline points="7 11 12 16 17 11"/><line x1="12" y1="4" x2="12" y2="16"/><path d="M5 19h14"/></g>,
  unshield: <g><polyline points="7 9 12 4 17 9"/><line x1="12" y1="4" x2="12" y2="16"/><path d="M5 20h14"/></g>,
  activity: <polyline points="3 13 8 13 11 5 14 19 17 13 21 13"/>,
  copy: <g><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M5.5 15.5h-1a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></g>,
  check: <polyline points="4 12.5 9.5 18 20 6"/>,
  eye: <g><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/></g>,
  lock: <g><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></g>,
  chevron: <polyline points="9 5 16 12 9 19"/>,
  plus: <g><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></g>,
  arrowDown: <g><line x1="12" y1="4" x2="12" y2="19"/><polyline points="6 13 12 19 18 13"/></g>,
  arrowRight: <g><line x1="4" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></g>,
  link: <g><path d="M10 14a4 4 0 0 0 5.7.4l2.5-2.5a4 4 0 0 0-5.7-5.7L11 7.6"/><path d="M14 10a4 4 0 0 0-5.7-.4L5.8 12a4 4 0 0 0 5.7 5.7L13 16.4"/></g>,
  x: <g><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></g>,
  info: <g><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.8" r="0.6" fill="currentColor" stroke="none"/></g>,
  settings: <g><line x1="4" y1="8" x2="20" y2="8"/><circle cx="9" cy="8" r="2.4" fill="var(--bg-1)"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="16" r="2.4" fill="var(--bg-1)"/></g>,
  refresh: <g><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8"/><polyline points="20 3 20 8 15 8"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16"/><polyline points="4 21 4 16 9 16"/></g>,
  scan: <g><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8"/><path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8"/><path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16"/><path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/></g>,
  payroll: <g><rect x="4" y="4" width="16" height="4" rx="1.5"/><rect x="4" y="10" width="16" height="4" rx="1.5"/><rect x="4" y="16" width="10" height="4" rx="1.5"/></g>,
  users: <g><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><circle cx="18" cy="9" r="2.5"/><path d="M22 20c0-2.5-1.8-4.5-4-4.5"/></g>,
  trash: <g><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></g>,
};

interface IconProps {
  name: string;
  size?: number;
  sw?: number;
  style?: React.CSSProperties;
  className?: string;
}

const Icon: React.FC<IconProps> = ({ name, size = 20, sw = 1.6, style, className }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true">
      {I[name]}
    </svg>
  );
};

// Logo Mark
const Mark: React.FC<{ size?: number }> = ({ size = 26 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12.5" cy="16" r="8.4" stroke="var(--text-2)" strokeWidth="2" />
      <circle cx="19.5" cy="16" r="8.4" fill="var(--mint-bg)" stroke="var(--mint)" strokeWidth="2" />
    </svg>
  );
};

// Brand Logo
const Logo: React.FC = () => {
  return (
    <div className="sl-row" style={{ gap: 10, userSelect: 'none' }}>
      <Mark size={26} />
      <div style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}>
        Shield<span style={{ color: 'var(--mint)' }}>Link</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// QR Code Generator (React implementation of PRNG canvas QR)
// ─────────────────────────────────────────────────────────────
interface QRCodeProps {
  size?: number;
  seed?: string;
}

const QRCode: React.FC<QRCodeProps> = ({ size = 132, seed = 'shieldlink' }) => {
  const N = 25;
  const cell = size / N;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rnd = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const isFinder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
    return inBox(0, 0) || inBox(N - 7, 0) || inBox(0, N - 7);
  };
  const finderOn = (x: number, y: number) => {
    const f = (ox: number, oy: number) => {
      const lx = x - ox, ly = y - oy;
      const ring = lx === 0 || lx === 6 || ly === 0 || ly === 6;
      const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
      return (lx >= 0 && lx < 7 && ly >= 0 && ly < 7) && (ring || core);
    };
    return f(0, 0) || f(N - 7, 0) || f(0, N - 7);
  };
  const cells = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let on = isFinder(x, y) ? finderOn(x, y) : rnd() > 0.55;
      if (on) {
        cells.push(
          <rect key={x + '-' + y} x={x * cell} y={y * cell} width={cell * 0.92} height={cell * 0.92} rx={cell * 0.2} />
        );
      }
    }
  }
  return (
    <div style={{ background: '#fff', padding: 10, borderRadius: 12, width: size + 20, height: size + 20, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <g style={{ fill: '#0e0f11' }}>{cells}</g>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, margin: 'auto', width: 28, height: 28, borderRadius: 7,
        background: 'oklch(0.86 0.085 168)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, border: '2px solid #04130d' }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Privacy Decouple Diagram
// ─────────────────────────────────────────────────────────────
const DecoupleDiagram: React.FC = () => {
  const dots = [0, 1, 2, 3, 4, 5, 6];
  const Node = ({ label, sub, tone }: { label: string; sub: string; tone: 'mint' | 'gray' }) => (
    <div className="sl-col" style={{ alignItems: 'center', gap: 6, zIndex: 2 }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: tone === 'mint' ? 'var(--mint-bg)' : 'var(--bg-3)',
        border: '1px solid ' + (tone === 'mint' ? 'var(--mint-line)' : 'var(--line-2)'),
        color: tone === 'mint' ? 'var(--mint)' : 'var(--text-2)',
      }}>
        <Icon name={tone === 'mint' ? 'claim' : 'send'} size={18} />
      </div>
      <div className="sl-col" style={{ alignItems: 'center', gap: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
        <span className="sl-tiny sl-dim" style={{ fontSize: 9.5 }}>{sub}</span>
      </div>
    </div>
  );
  return (
    <div style={{ position: 'relative', padding: '6px 4px', width: '100%' }}>
      <div className="sl-row" style={{ justifyContent: 'space-between', gap: 10, position: 'relative' }}>
        <Node label="You" sub="public address" tone="gray" />

        {/* shielded pool */}
        <div className="sl-col" style={{ alignItems: 'center', gap: 6, zIndex: 2 }}>
          <div style={{
            width: 100, height: 46, borderRadius: 12, position: 'relative', overflow: 'hidden',
            background: 'var(--bg-2)', border: '1px solid var(--mint-line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 8px', flexWrap: 'wrap',
          }}>
            {dots.map(d => (
              <span key={d} style={{
                width: 7, height: 7, borderRadius: '50%',
                background: d % 3 === 0 ? 'var(--mint)' : 'var(--text-3)', opacity: d % 3 === 0 ? 0.9 : 0.55,
              }} />
            ))}
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--mint)' }}>Private pool</span>
        </div>

        <Node label="Recipient" sub="claims privately" tone="mint" />

        {/* connectors */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 1 }} aria-hidden="true">
          <defs>
            <marker id="ah" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
              <path d="M0,0 L5,3 L0,6 Z" fill="var(--text-3)" />
            </marker>
          </defs>
          <line x1="50" y1="23" x2="35%" y2="23" stroke="var(--line-2)" strokeWidth="1.2" markerEnd="url(#ah)" />
          <line x1="65%" y1="23" x2="calc(100% - 50px)" y2="23" stroke="var(--mint-line)" strokeWidth="1.2" markerEnd="url(#ah)" />
        </svg>
      </div>

      {/* severed direct link */}
      <div style={{ position: 'relative', marginTop: 12 }}>
        <div style={{ borderTop: '1.5px dashed var(--line-2)', position: 'absolute', left: 46, right: 46, top: 11 }} />
        <div style={{
          position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)',
          display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', padding: '2px 10px',
          borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)',
        }}>
          <Icon name="x" size={12} style={{ color: 'var(--amber)' }} />
          <span className="sl-tiny" style={{ fontWeight: 600, color: 'var(--text-2)', fontSize: 10 }}>no on-chain link</span>
        </div>
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
};

// Amount Component
interface AmountProps {
  value: string | number;
  unit?: string;
  size?: number;
  tone?: 'mint' | 'gray';
  prefix?: string;
}

const Amount: React.FC<AmountProps> = ({ value, unit, size = 34, tone, prefix }) => {
  const [int, dec] = String(value).split('.');
  return (
    <div className="sl-mono sl-row" style={{ alignItems: 'baseline', gap: 5, color: tone === 'mint' ? 'var(--mint)' : 'var(--text)' }}>
      <span style={{ fontSize: size, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {prefix}{int}{dec && <span style={{ color: tone === 'mint' ? 'var(--mint-2)' : 'var(--text-3)' }}>.{dec}</span>}
      </span>
      {unit && <span style={{ fontSize: size * 0.42, fontWeight: 600, color: 'var(--text-3)' }}>{unit}</span>}
    </div>
  );
};

// Stepper Component
interface Step {
  label: string;
  sub?: string;
  state: 'idle' | 'active' | 'done';
  proof?: boolean;
}

const Stepper: React.FC<{ steps: Step[]; visibleLogs?: string[] }> = ({ steps, visibleLogs }) => {
  return (
    <div className="sl-col" style={{ gap: 0 }}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const color = s.state === 'done' ? 'var(--mint)' : s.state === 'active' ? 'var(--text)' : 'var(--text-3)';
        return (
          <div key={i} className="sl-row" style={{ gap: 13, alignItems: 'flex-start' }}>
            <div className="sl-col" style={{ alignItems: 'center', flex: '0 0 auto' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: s.state === 'done' ? 'var(--mint)' : s.state === 'active' ? 'var(--mint-bg)' : 'var(--bg-3)',
                border: '1px solid ' + (s.state === 'idle' ? 'var(--line-2)' : 'var(--mint-line)'),
                color: s.state === 'done' ? '#04130d' : 'var(--mint)',
              }}>
                {s.state === 'done' ? <Icon name="check" size={13} sw={2.4} />
                  : s.state === 'active' ? <span className="sl-dot sl-dot-mint sl-live" style={{ boxShadow: 'none' }} />
                  : <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>{i + 1}</span>}
              </div>
              {!last && <div style={{ width: 1.5, flex: 1, minHeight: 20, background: s.state === 'done' ? 'var(--mint-line)' : 'var(--line)' }} />}
            </div>
            <div className="sl-col" style={{ gap: 2, paddingBottom: last ? 0 : 14, flexGrow: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color }}>{s.label}</span>
              {s.sub && <span className="sl-tiny sl-dim" style={{ lineHeight: 1.4, fontSize: 11 }}>{s.sub}</span>}
              {s.proof && visibleLogs && visibleLogs.length > 0 && (
                <div className="sl-mono" style={{ fontSize: 10, color: 'var(--mint-2)', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', marginTop: 6, lineHeight: 1.5, wordBreak: 'break-all', maxHeight: 110, overflowY: 'auto' }}>
                  {visibleLogs.slice(-4).map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Inline Cryptographic Prover Component
// ─────────────────────────────────────────────────────────────
interface InlineProverProps {
  type: 'shield' | 'claim';
  amount: number;
  token: string;
  onComplete: () => void;
  connectionType?: 'demo' | 'starknet';
  realTxHash?: string;
}

const PROVER_SHIELD_STEPS = [
  { label: 'Creating a one-time key', sub: 'A unique private key is generated in your browser — it never leaves your device.' },
  { label: 'Securing your payment', sub: 'Your funds are locked into the private pool. The amount is hidden on-chain.' },
  { label: 'Generating privacy proof', sub: 'A cryptographic proof is built so only the key holder can claim the funds.' },
  { label: 'Confirming on Starknet', sub: 'The transaction is submitted. Your payment is now live and shareable.' }
];

const PROVER_CLAIM_STEPS = [
  { label: 'Reading your payment key', sub: 'The one-time key is read from the link. It is never sent to any server.' },
  { label: 'Verifying ownership', sub: 'Proving you hold the key — without revealing any personal information.' },
  { label: 'Confirming on-chain', sub: 'Your proof is verified on Starknet. Everything checks out.' },
  { label: 'Sending funds to your wallet', sub: 'The payment is released to your address. Done.' }
];

const InlineProver: React.FC<InlineProverProps> = ({ type, amount, token, onComplete, connectionType, realTxHash }) => {
  const steps = type === 'shield' ? PROVER_SHIELD_STEPS : PROVER_CLAIM_STEPS;
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const stepAdvanceRef = useRef<any>(null); // ref so cleanup never cancels step-advance

  const getStepLogs = (stepIdx: number) => {
    const seedStr = Math.random().toString(16).substring(2, 12);
    if (type === 'shield') {
      switch (stepIdx) {
        case 0:
          return [
            `[crypto] Initialize entropy pool... ok.`,
            `[crypto] Secret key (r) generated: 0x${seedStr}...`,
            `[crypto] Nullifier key (s) generated: 0x${Math.random().toString(16).substring(2, 12)}...`,
            `[crypto] Poseidon Hash C = Poseidon(amount, r, s) computed.`
          ];
        case 1:
          return [
            `[merkle] Querying L2 accumulator root...`,
            `[merkle] State Root: 0x05f88b...${seedStr}`,
            `[merkle] Insert leaf: Poseidon(C, activeAddress)...`,
            `[merkle] Commitment index: ${Math.floor(Math.random() * 8000) + 1200}`,
            `[merkle] Tree accumulator updated.`
          ];
        case 2:
          return [
            `[stark] Constructing arithmetic trace constraints...`,
            `[stark] Constraint system initialised (134,812 gates)`,
            `[stark] Witness variables computed in 42ms.`,
            `[stark] Constraint verification checks passed.`
          ];
        case 3:
          const shieldLogs = [
            `[stark] Launching FRI compiler...`,
            `[stark] Generating commitments for polynomial evaluations...`,
            `[stark] Proof size: 46.8 KB`,
            `[stark] Submitting proof payload to Starknet Gateway sequencer...`,
            `[stark] Sequencer responded: TX_ACCEPTED_ON_L2.`
          ];
          if (connectionType === 'starknet' && realTxHash) {
            shieldLogs.push(`[stark] Real Tx Hash: ${realTxHash}`);
          }
          return shieldLogs;
        default:
          return [];
      }
    } else {
      switch (stepIdx) {
        case 0:
          return [
            `[claim] URL hash detected. Decrypting nullifier s...`,
            `[claim] Nullifier verified unused in contract set.`,
            `[claim] Connected recipient address.`
          ];
        case 1:
          return [
            `[merkle] Fetching Merkle root from L2 contract...`,
            `[merkle] Root: 0x05f88bc77e92e21bca961c0c29f64bf87611ab9c8a92e8fa9f`,
            `[merkle] Generating path indices... done.`,
            `[merkle] Membership path length: 32 sibling hashes.`
          ];
        case 2:
          return [
            `[stark] Initiating prover circuit...`,
            `[stark] Prover trace generated successfully.`,
            `[stark] Compiling membership witness proof...`,
            `[stark] STARK verifier returned: SUCCESS.`
          ];
        case 3:
          const claimLogs = [
            `[relayer] Relaying proof to gasless execution node...`,
            `[relayer] Relayer: 0xrelayer_${seedStr}_stark`,
            `[relayer] L2 sequencer accepted proof. Funds released.`,
            `[relayer] Claim transaction confirmed.`
          ];
          if (connectionType === 'starknet' && realTxHash) {
            claimLogs.push(`[relayer] Real Tx Hash: ${realTxHash}`);
          }
          return claimLogs;
        default:
          return [];
      }
    }
  };

  useEffect(() => {
    if (currentStep >= steps.length) {
      const timer = setTimeout(() => {
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }

    const stepLogs = getStepLogs(currentStep);
    let logIdx = 0;

    const interval = setInterval(() => {
      if (logIdx < stepLogs.length) {
        setLogs(prev => [...prev, stepLogs[logIdx]]);
        logIdx++;
      } else {
        clearInterval(interval);
        // Use ref so React cleanup never cancels the step-advance timeout
        stepAdvanceRef.current = setTimeout(() => {
          setCurrentStep(prev => prev + 1);
        }, 1100);
      }
    }, 220);

    return () => {
      clearInterval(interval);
      // Intentionally NOT clearing stepAdvanceRef — step advancement must complete
    };
  }, [currentStep]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="sl-col" style={{ gap: 18, width: '100%' }}>
      <div className="sl-between" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
        <div className="sl-col" style={{ gap: 3 }}>
          <span className="sl-eyebrow" style={{ color: 'var(--mint)' }}>
            {type === 'shield' ? 'Sending privately' : 'Claiming your payment'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            Amount: <span className="sl-mono" style={{ fontWeight: 600 }}>{amount} {token}</span>
          </span>
        </div>
        <div className="sl-row" style={{ gap: 8 }}>
          <div className="spinner"></div>
          <span className="sl-tiny sl-dim sl-mono">processing...</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20, alignItems: 'start' }}>
        <div className="sl-col" style={{ gap: 14 }}>
          <Stepper
            steps={steps.map((s, idx) => ({
              label: s.label,
              sub: s.sub,
              state: idx === currentStep ? 'active' : idx < currentStep ? 'done' : 'idle',
              proof: idx === currentStep && idx === 1
            }))}
            visibleLogs={logs}
          />
        </div>

        <div className="sl-col">
          <span className="sl-eyebrow" style={{ marginBottom: 6 }}>Activity log</span>
          <div style={{
            background: 'var(--bg-0)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)',
            padding: 12, fontFamily: 'var(--mono)', fontSize: 10.5, color: '#34D399',
            height: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5,
            boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)', scrollbarWidth: 'none'
          }}>
            {logs.map((log, index) => {
              if (typeof log !== 'string') return null;
              let color = '#34D399';
              if (log.startsWith('[crypto]')) color = 'var(--mint-2)';
              if (log.startsWith('[stark]')) color = 'oklch(0.83 0.09 72)';
              if (log.startsWith('[merkle]')) color = '#60A5FA';
              if (log.startsWith('[relayer]')) color = 'var(--amber)';
              return (
                <div key={index} style={{ color, wordBreak: 'break-all' }}>{log}</div>
              );
            })}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ClaimReadyView — timing countdown + privacy score + note breakdown
// ─────────────────────────────────────────────────────────────
interface ClaimReadyViewProps {
  claimLinkData: ShieldLinkData;
  isConnected: boolean;
  walletName: string;
  onClaim: () => void;
  onConnect: () => void;
}

const PRIVACY_WAIT_MS = 10 * 60 * 1000; // 10 minutes

const ClaimReadyView: React.FC<ClaimReadyViewProps> = ({
  claimLinkData, isConnected, walletName, onClaim, onConnect,
}) => {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const createdAt = claimLinkData.createdAtMs ?? 0;
  const ageMs = createdAt > 0 ? now - createdAt : PRIVACY_WAIT_MS;
  const waitRemaining = Math.max(0, PRIVACY_WAIT_MS - ageMs);
  const waitDone = waitRemaining === 0;

  // Privacy score: 0-100 based on how long the link has been in flight
  const rawScore = createdAt > 0 ? Math.min(100, Math.round((ageMs / PRIVACY_WAIT_MS) * 70) + 30) : 100;
  const privacyScore = waitDone ? Math.min(100, rawScore) : rawScore;

  const scoreColor = privacyScore >= 80 ? 'var(--mint)' : privacyScore >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = privacyScore >= 80 ? 'Strong' : privacyScore >= 50 ? 'Moderate' : 'Low';

  const secsLeft = Math.ceil(waitRemaining / 1000);
  const minsLeft = Math.floor(secsLeft / 60);
  const secsPart = secsLeft % 60;

  const notes = claimLinkData.notes ?? [];
  const noteCount = notes.length;

  // Group notes by denomination for display
  const denomGroups: Record<number, number> = {};
  for (const n of notes) {
    denomGroups[n.denom] = (denomGroups[n.denom] ?? 0) + 1;
  }
  const denomEntries = Object.entries(denomGroups)
    .map(([d, c]) => ({ denom: Number(d), count: c }))
    .sort((a, b) => b.denom - a.denom);

  return (
    <div className="sl-col" style={{ gap: 16, width: '100%', alignItems: 'center' }}>
      {/* Amount header */}
      <div className="sl-col" style={{ gap: 6, alignItems: 'center' }}>
        <span className="sl-eyebrow">You've received</span>
        <Amount value={claimLinkData.amount} unit={claimLinkData.token} size={46} tone="mint" />
        {noteCount > 1 && (
          <span className="sl-tiny sl-muted">{noteCount} parts · sent for better privacy</span>
        )}
      </div>

      {/* Note breakdown */}
      {denomEntries.length > 0 && (
        <div className="sl-card" style={{ width: '100%', padding: '12px 14px', background: 'var(--bg-1)', gap: 8, display: 'flex', flexDirection: 'column' }}>
          <span className="sl-tiny" style={{ color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Breakdown</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {denomEntries.map(({ denom, count }) => (
              <span key={denom} style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 20, padding: '3px 10px', fontSize: 12, color: 'var(--text-2)'
              }}>
                {count > 1 ? `${count}×` : ''}{denom} {claimLinkData.token}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Optional sender note */}
      {claimLinkData.note && (
        <div className="sl-card sl-row" style={{ gap: 9, padding: '11px 15px', background: 'var(--bg-1)', width: '100%', justifyContent: 'center' }}>
          <Icon name="info" size={15} style={{ color: 'var(--text-3)', flex: '0 0 auto' }} />
          <span className="sl-tiny sl-muted" style={{ lineHeight: 1.45, textAlign: 'left' }}>&ldquo;{claimLinkData.note}&rdquo;</span>
        </div>
      )}

      {/* Privacy score bar */}
      <div className="sl-card" style={{ width: '100%', padding: '12px 14px', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="sl-tiny" style={{ color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Privacy Score</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor }}>{scoreLabel} · {privacyScore}/100</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${privacyScore}%`, background: scoreColor, borderRadius: 3, transition: 'width 1s ease' }} />
        </div>
        <span className="sl-tiny sl-muted">
          {waitDone
            ? 'This payment cannot be traced back to the sender.'
            : `Best to wait a bit longer: ${minsLeft}m ${secsPart.toString().padStart(2, '0')}s remaining`}
        </span>
      </div>

      {/* Countdown / Claim CTA */}
      {!waitDone && createdAt > 0 ? (
        <div className="sl-card" style={{ width: '100%', padding: '14px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>⏳ Wait a little longer: {minsLeft}m {secsPart.toString().padStart(2, '0')}s</span>
          <span className="sl-tiny sl-muted" style={{ textAlign: 'center', lineHeight: 1.5 }}>
            Claiming right away is fine, but waiting a bit makes this payment harder to trace.
          </span>
          {isConnected ? (
            <button className="sl-btn" style={{ height: 42, width: '100%', marginTop: 4, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)' }} onClick={onClaim}>
              Claim now anyway
            </button>
          ) : (
            <button className="sl-btn" style={{ height: 42, width: '100%', marginTop: 4, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)' }} onClick={onConnect}>
              Connect wallet to claim now
            </button>
          )}
        </div>
      ) : (
        isConnected ? (
          <button className="sl-btn sl-btn-primary" style={{ height: 50, width: '100%' }} onClick={onClaim}>
            <Icon name="arrowDown" size={17} /> Claim to {walletName}
          </button>
        ) : (
          <button className="sl-btn sl-btn-primary" style={{ height: 50, width: '100%' }} onClick={onConnect}>
            Connect Wallet to Claim
          </button>
        )
      )}

      <span className="sl-tiny sl-dim">No account needed · completely private</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// AppShell Layout
// ─────────────────────────────────────────────────────────────
interface AppShellProps {
  active: 'dashboard' | 'shield' | 'send' | 'unshield' | 'activity' | 'claim' | 'payroll';
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  isConnected: boolean;
  isReconnecting?: boolean;
  activeWallet: MockWallet;
  openWalletModal: () => void;
  connectWallet: () => void;
  onSignOut: () => void;
  navigate: (view: 'landing' | 'dashboard' | 'shield' | 'send' | 'unshield' | 'activity' | 'claim' | 'payroll', dir: 'forward' | 'backward') => void;
}

const AppShell: React.FC<AppShellProps> = ({
  active, title, subtitle, headerRight, children,
  isConnected, isReconnecting, activeWallet, openWalletModal, connectWallet, onSignOut, navigate,
}) => {
  const sidebarNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'send', label: 'Send', icon: 'send' },
    { id: 'payroll', label: 'Payroll', icon: 'payroll' },
    { id: 'activity', label: 'Activity & Links', icon: 'activity' },
  ] as const;

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}…${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="sl-app sl-row" style={{ alignItems: 'stretch' }}>
      {/* Sidebar */}
      <aside className="sl-col" style={{
        width: 232, flex: '0 0 232px', background: 'var(--bg-1)',
        borderRight: '1px solid var(--line)', padding: '20px 14px',
      }}>
        <div style={{ padding: '6px 8px 22px' }}><Logo /></div>
        <nav className="sl-col" style={{ gap: 2 }}>
          {sidebarNavItems.map(n => (
            <div
              key={n.id}
              className={'sl-nav-item' + (active === n.id ? ' is-active' : '')}
              onClick={() => navigate(n.id, 'forward')}
            >
              <Icon name={n.icon} size={19} />
              <span>{n.label}</span>
            </div>
          ))}
        </nav>
        <div className="sl-grow" />

        {/* Network & Account card */}
        {isConnected || isReconnecting ? (
          <div className="sl-card" style={{ background: 'var(--bg-2)', padding: 12, borderRadius: 'var(--r-md)' }}>
            <div className="sl-row" style={{ gap: 8 }}>
              {isReconnecting
                ? <span className="sl-dot sl-dot-amber" style={{ animation: 'pulse 1.2s infinite' }} />
                : <span className="sl-dot sl-dot-mint sl-live" />}
              <span className="sl-tiny" style={{ fontWeight: 600 }}>
                {isReconnecting ? 'Reconnecting…' : 'Starknet Sepolia'}
              </span>
              <span className="sl-tiny sl-dim" style={{ marginLeft: 'auto' }}>Testnet</span>
            </div>
            <hr className="sl-divider" style={{ margin: '11px 0' }} />
            <div className="sl-row" style={{ gap: 10, cursor: 'pointer' }} onClick={openWalletModal}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--bg-4)', flex: '0 0 auto' }} className="sl-scan" />
              <div className="sl-grow sl-col" style={{ gap: 1 }}>
                <span className="sl-tiny" style={{ fontWeight: 600 }}>{activeWallet.name}</span>
                <span className="sl-mono sl-dim" style={{ fontSize: 10.5 }}>{formatAddress(activeWallet.address)}</span>
              </div>
              <Icon name="chevron" size={15} style={{ color: 'var(--text-3)' }} />
            </div>
            <hr className="sl-divider" style={{ margin: '11px 0' }} />
            <button
              onClick={onSignOut}
              style={{ width: '100%', background: 'transparent', border: '1px solid var(--line)', borderRadius: 7, padding: '7px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--amber-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Icon name="unshield" size={13} /> Sign Out
            </button>
          </div>
        ) : (
          /* Disconnected */
          <button
            className="sl-btn"
            style={{ background: 'var(--mint-bg)', border: '1px solid var(--mint-line)', borderRadius: 'var(--r-md)', padding: '10px 14px', width: '100%', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
            onClick={connectWallet}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="sl-dot sl-dot-amber" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>Not connected</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'stretch', justifyContent: 'center' }}>
              <Icon name="shield" size={14} style={{ color: 'var(--mint)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--mint)' }}>Connect Wallet</span>
            </div>
          </button>
        )}
      </aside>

      {/* Main Panel */}
      <main className="sl-col sl-grow" style={{ background: 'var(--bg-0)', minWidth: 0 }}>
        <header className="sl-between" style={{
          height: 72, flex: '0 0 72px', padding: '0 30px', borderBottom: '1px solid var(--line)',
        }}>
          <div className="sl-col" style={{ gap: 3 }}>
            <div className="sl-h1" style={{ fontSize: 21 }}>{title}</div>
            {subtitle && <div className="sl-tiny sl-muted">{subtitle}</div>}
          </div>
          <div className="sl-row" style={{ gap: 10 }}>
            {headerRight}
          </div>
        </header>
        <div className="sl-grow" style={{ padding: 30, overflowY: 'auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// LANDING PAGE COMPONENTS (From Figma Mockup)
// ─────────────────────────────────────────────────────────────

interface LandingProp {
  onLaunchApp: (view?: 'landing' | 'dashboard' | 'shield' | 'send' | 'unshield' | 'activity' | 'claim') => void;
}

const LandingNav: React.FC<LandingProp> = ({ onLaunchApp }) => {
  return (
    <nav className="lp-nav">
      <div className="lp-wrap lp-nav-inner">
        <Logo />
        <div className="lp-nav-links">
          <a href="#how">How it works</a>
          <a href="#privacy">Privacy</a>
          <a href="#features">Features</a>
        </div>
        <div className="sl-row" style={{ gap: 10, marginLeft: 'auto' }}>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); onLaunchApp('dashboard'); }} 
            className="sl-btn sl-btn-ghost sl-btn-sm" 
            style={{ textDecoration: 'none' }}
          >
            Open app
          </a>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); onLaunchApp('dashboard'); }} 
            className="sl-btn sl-btn-primary sl-btn-sm" 
            style={{ textDecoration: 'none' }}
          >
            Launch app
          </a>
        </div>
      </div>
    </nav>
  );
};

const LandingHeroVisual: React.FC = () => {
  return (
    <div className="lp-visual" style={{ minHeight: 380 }}>
      {/* floating public chip */}
      <div className="lp-float lp-bob" style={{ left: -6, top: 18, animationDelay: '0s' }}>
        <div className="sl-card sl-row" style={{ gap: 9, padding: '11px 14px', background: 'var(--bg-2)' }}>
          <Icon name="eye" size={15} style={{ color: 'var(--amber)' }} />
          <div className="sl-col" style={{ gap: 1 }}>
            <span className="sl-tiny" style={{ fontWeight: 600 }}>Public balance</span>
            <span className="sl-mono sl-dim" style={{ fontSize: 11 }}>visible to everyone</span>
          </div>
        </div>
      </div>
      {/* floating shielded chip */}
      <div className="lp-float lp-bob" style={{ right: -4, bottom: 26, animationDelay: '1.4s' }}>
        <div className="sl-card sl-row" style={{ gap: 9, padding: '11px 14px', background: 'var(--mint-bg)', borderColor: 'var(--mint-line)' }}>
          <Icon name="lock" size={15} style={{ color: 'var(--mint)' }} />
          <div className="sl-col" style={{ gap: 1 }}>
            <span className="sl-tiny" style={{ fontWeight: 600, color: 'var(--mint)' }}>Shielded</span>
            <span className="sl-mono" style={{ fontSize: 11, color: 'var(--mint-2)' }}>only you can see</span>
          </div>
        </div>
      </div>

      {/* the link ticket */}
      <div className="sl-card sl-col lp-bob" style={{ width: 340, overflow: 'hidden', borderColor: 'var(--mint-line)', boxShadow: '0 30px 80px -30px rgba(0,0,0,0.7)', animationDelay: '0.6s' }}>
        <div style={{ padding: '16px 20px', background: 'linear-gradient(160deg, var(--mint-bg), transparent)', borderBottom: '1px solid var(--line)' }}>
          <div className="sl-between">
            <span className="sl-row" style={{ gap: 8 }}><Icon name="link" size={15} style={{ color: 'var(--mint)' }} /><span className="sl-eyebrow" style={{ color: 'var(--mint-2)' }}>Payment link</span></span>
            <span className="sl-chip sl-chip-mint" style={{ height: 22 }}>one-time</span>
          </div>
        </div>
        <div className="sl-row" style={{ gap: 16, padding: 18, alignItems: 'center' }}>
          <QRCode size={96} seed="shieldlink-hero" />
          <div className="sl-col" style={{ gap: 4 }}>
            <span className="sl-eyebrow">Recipient claims</span>
            <Amount value="450.00" unit="STRK" size={26} tone="mint" />
          </div>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          <div className="sl-mono" style={{ fontSize: 11.5, lineHeight: 1.5, wordBreak: 'break-all', padding: '11px 12px', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 10 }}>
            <span className="sl-dim">shield.link/#claim?key=</span>
            <span style={{ color: 'var(--mint)', background: 'var(--mint-bg)', borderRadius: 4, padding: '1px 3px' }}>a7Fb2Kx9_Qz4Lm</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const LandingHero: React.FC<LandingProp> = ({ onLaunchApp }) => {
  return (
    <header className="lp-hero">
      <div className="lp-wrap lp-hero-grid">
        <div>
          <span className="sl-chip sl-chip-mint"><span className="sl-dot sl-dot-mint sl-live" /> Private payments on Starknet</span>
          <h1 className="lp-h1">Send money on-chain.<br /><em>Reveal nothing.</em></h1>
          <p className="lp-lead">
            Public blockchains expose every balance and payment. ShieldLink routes your money through a private pool on Starknet — no one can see the amount, and your address is never connected to the recipient's.
          </p>
          <div className="lp-cta-row">
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onLaunchApp('dashboard'); }} 
              className="sl-btn sl-btn-primary" 
              style={{ textDecoration: 'none' }}
            >
              <Icon name="shield" size={17} /> Launch app
            </a>
            <a href="#how" className="sl-btn sl-btn-ghost" style={{ textDecoration: 'none' }}>See how it works <Icon name="arrowRight" size={16} /></a>
          </div>
          <div className="lp-trust">
            <span><Icon name="lock" size={14} style={{ color: 'var(--mint)' }} /> Non-custodial</span>
            <span><Icon name="check" size={14} style={{ color: 'var(--mint)' }} /> Zero-knowledge</span>
            <span><Icon name="shield" size={14} style={{ color: 'var(--mint)' }} /> Open source</span>
          </div>
        </div>
        <LandingHeroVisual />
      </div>
    </header>
  );
};

const LandingConceptBand: React.FC = () => {
  return (
    <section className="lp-section" style={{ paddingTop: 24 }}>
      <div className="lp-wrap">
        <div className="lp-section-head">
          <span className="sl-eyebrow">The problem · and the fix</span>
          <h2 className="lp-h2">On a public chain, money has no privacy.</h2>
          <p className="lp-sub">Anyone can read your balance, trace your salary, and map who you pay. ShieldLink uses color to make the difference obvious — and gives you the private half by default.</p>
        </div>
        <div className="lp-concept">
          <div className="lp-concept-card" style={{ background: 'var(--amber-bg)', borderColor: 'var(--amber-line)' }}>
            <div className="sl-row" style={{ gap: 10, marginBottom: 14 }}>
              <Icon name="eye" size={20} style={{ color: 'var(--amber)' }} />
              <span className="sl-h2" style={{ fontSize: 18, color: 'var(--amber)' }}>Public · exposed</span>
            </div>
            <p className="sl-muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>Balances, transfers, and the full graph of who-pays-whom sit in the open forever. Competitors, employers and strangers can all watch.</p>
          </div>
          <div className="lp-concept-card" style={{ background: 'var(--mint-bg)', borderColor: 'var(--mint-line)' }}>
            <div className="sl-row" style={{ gap: 10, marginBottom: 14 }}>
              <Icon name="lock" size={20} style={{ color: 'var(--mint)' }} />
              <span className="sl-h2" style={{ fontSize: 18, color: 'var(--mint)' }}>Private · protected</span>
            </div>
            <p className="sl-muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>Inside the pool, amounts are encrypted and relationships are broken. You spend and receive freely — the ledger learns nothing about you.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

const LandingHowItWorks: React.FC = () => {
  const steps = [
    { ic: 'shield', n: '01', t: 'Send privately', b: "A one-time key is created in your browser. Your payment is sent through the private pool — the amount is hidden from everyone on-chain." },
    { ic: 'link', n: '02', t: 'Share a payment link', b: 'The link carries your one-time key. It never touches a server — share it any way you like.' },
    { ic: 'claim', n: '03', t: 'They receive privately', b: "The recipient opens the link and receives the funds. Your address and theirs are never connected on-chain." },
  ];
  return (
    <section className="lp-section" id="how" style={{ background: 'var(--bg-1)' }}>
      <div className="lp-wrap">
        <div className="lp-section-head">
          <span className="sl-eyebrow">How it works</span>
          <h2 className="lp-h2">Three steps. No traceable trail.</h2>
        </div>
        <div className="lp-steps" style={{ marginBottom: 40 }}>
          {steps.map(s => (
            <div key={s.n} className="sl-col" style={{ gap: 14 }}>
              <div className="sl-between">
                <div className="lp-feat-icon" style={{ marginBottom: 0 }}><Icon name={s.ic} size={20} /></div>
                <span className="sl-mono sl-dim" style={{ fontSize: 22, fontWeight: 600 }}>{s.n}</span>
              </div>
              <span className="sl-h2" style={{ fontSize: 19 }}>{s.t}</span>
              <p className="sl-muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{s.b}</p>
            </div>
          ))}
        </div>
        <div className="sl-card sl-card-pad" style={{ background: 'var(--bg-2)' }}>
          <span className="sl-eyebrow">What the ledger sees</span>
          <div style={{ maxWidth: 620, margin: '14px auto 0' }}><DecoupleDiagram /></div>
        </div>
      </div>
    </section>
  );
};

const LandingFeatures: React.FC = () => {
  const feats = [
    ['shield', 'Private payment pool', 'Your payment enters a private pool where the amount is hidden on-chain — no one can see what you sent.'],
    ['link', 'One-time payment links', 'A fresh key is created for every link, right in your browser. It is never stored anywhere and disappears after the payment is claimed.'],
    ['lock', 'Proven privately', 'The recipient proves they own the link without revealing any personal details. Everything happens in their browser.'],
    ['refresh', 'Untraceable by design', "Sending and receiving are two separate on-chain events with nothing in common — your address is never linked to the recipient's."],
    ['unshield', 'Cancel anytime', 'Cancel a link any time and get your money back instantly. No questions asked.'],
    ['check', 'STRK & USDC, non-custodial', 'Works with the assets you already hold. Your keys stay in your browser — ShieldLink never touches your funds.'],
  ];
  return (
    <section className="lp-section" id="features">
      <div className="lp-wrap">
        <div className="lp-section-head">
          <span className="sl-eyebrow">Features</span>
          <h2 className="lp-h2">Everything you need to transact privately.</h2>
        </div>
        <div className="lp-features">
          {feats.map(([ic, t, b]) => (
            <div key={t} className="lp-feature">
              <div className="lp-feat-icon"><Icon name={ic} size={20} /></div>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8 }}>{t}</div>
              <p className="sl-muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const LandingPrivacyDeepDive: React.FC = () => {
  const points = [
    ['Your key never leaves your browser', "A unique key is created in your browser and embedded in the link. It is never stored on any server — only you and the recipient ever see it."],
    ['Sender and receiver are completely separated', 'Sending and receiving happen as two independent events on-chain. Nothing connects them — no shared address, no common data.'],
    ['Amounts are fully encrypted', 'Balances are stored in encrypted form on-chain. Only the account owner can read them — the blockchain stores nothing readable to anyone else.'],
  ];
  return (
    <section className="lp-section" id="privacy" style={{ background: 'var(--bg-1)' }}>
      <div className="lp-wrap lp-privacy">
        <div>
          <span className="sl-eyebrow">Why it's untraceable</span>
          <h2 className="lp-h2" style={{ marginBottom: 26 }}>The connection is broken by design.</h2>
          <div className="sl-col" style={{ gap: 20 }}>
            {points.map(([t, b]) => (
              <div key={t} className="sl-row" style={{ gap: 14, alignItems: 'flex-start' }}>
                <div className="lp-feat-icon" style={{ width: 32, height: 32, borderRadius: 9, marginBottom: 0, flex: '0 0 auto' }}><Icon name="check" size={16} sw={2.2} /></div>
                <div className="sl-col" style={{ gap: 4 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 600 }}>{t}</span>
                  <p className="sl-muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sl-card sl-card-pad" style={{ background: 'var(--bg-2)', borderColor: 'var(--mint-line)' }}>
          <DecoupleDiagram />
          <div className="sl-row" style={{ gap: 9, justifyContent: 'center', marginTop: 4 }}>
            <span className="sl-chip"><Icon name="arrowDown" size={13} /> independent deposit</span>
            <span className="sl-chip sl-chip-mint"><Icon name="claim" size={13} /> separate claim</span>
          </div>
        </div>
      </div>
    </section>
  );
};

const LandingCtaBand: React.FC<LandingProp> = ({ onLaunchApp }) => {
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <div className="lp-ctaband">
          <div className="sl-row" style={{ justifyContent: 'center', marginBottom: 8 }}><Mark size={40} /></div>
          <h2 className="lp-h2" style={{ fontSize: 'clamp(26px, 3.6vw, 40px)' }}>Start sending privately.</h2>
          <p className="lp-sub" style={{ margin: '14px auto 0', maxWidth: 440 }}>Shield your first deposit and send a link in under a minute. Non-custodial, open source, yours.</p>
          <div className="sl-row" style={{ gap: 12, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onLaunchApp('dashboard'); }} 
              className="sl-btn sl-btn-primary" 
              style={{ textDecoration: 'none' }}
            >
              <Icon name="shield" size={17} /> Launch app
            </a>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onLaunchApp('dashboard'); }} 
              className="sl-btn sl-btn-ghost" 
              style={{ textDecoration: 'none' }}
            >
              Read the docs
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

const LandingFooter: React.FC<LandingProp> = ({ onLaunchApp }) => {
  const cols = [
    ['Product', ['Send privately', 'Payment link', 'Claim', 'Withdraw']],
    ['Resources', ['Documentation', 'How it works', 'Audits', 'Status']],
    ['Project', ['GitHub', 'Whitepaper', 'Community', 'Terms']],
  ] as const;

  const handleLinkClick = (e: React.MouseEvent, link: string) => {
    if (['Send privately', 'Payment link', 'Claim', 'Withdraw'].includes(link)) {
      e.preventDefault();
      const targetView = link === 'Send privately' ? 'shield'
                       : link === 'Payment link' ? 'send'
                       : link === 'Claim' ? 'claim'
                       : 'unshield';
      onLaunchApp(targetView);
    }
  };

  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-foot-grid">
          <div>
            <Logo />
            <p className="sl-muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 14, maxWidth: 280 }}>
              Private payments for everyday assets on Starknet.
            </p>
            <span className="sl-chip" style={{ marginTop: 16 }}><span className="sl-dot sl-dot-mint sl-live" /> Starknet · L2 live</span>
          </div>
          {cols.map(([h, links]) => (
            <div key={h} className="lp-foot-col">
              <h4>{h}</h4>
              {links.map(l => (
                <a 
                  key={l} 
                  href={l === 'How it works' ? '#how' : '#'}
                  onClick={(e) => handleLinkClick(e, l)}
                >
                  {l}
                </a>
              ))}
            </div>
          ))}
        </div>
        <hr className="lp-rule" style={{ margin: '36px 0 22px' }} />
        <div className="sl-between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span className="sl-tiny sl-dim">© 2026 ShieldLink. Concept design.</span>
          <span className="sl-tiny sl-dim">Use of privacy tools is your responsibility — comply with your local laws.</span>
        </div>
      </div>
    </footer>
  );
};

// ─────────────────────────────────────────────────────────────
// Wallet Modal Content (shared between claim view & main shell)
// ─────────────────────────────────────────────────────────────
interface WalletModalContentProps {
  realWalletAddress: string;
  realWalletBalances: { strk: number; usdc: number };
  isConnecting: boolean;
  connectStarknetWallet: () => Promise<boolean>;
  disconnectStarknetWallet: () => void;
  loginPrivy: () => void;
  shieldLinkContractAddress: string;
  setShieldLinkContractAddress: (v: string) => void;
  deployShieldLinkContract: () => Promise<string | null>;
  isDeployingContract: boolean;
  onClose: () => void;
}

const WalletModalContent: React.FC<WalletModalContentProps> = ({
  realWalletAddress, realWalletBalances, isConnecting,
  connectStarknetWallet, disconnectStarknetWallet, loginPrivy,
  shieldLinkContractAddress, setShieldLinkContractAddress,
  deployShieldLinkContract, isDeployingContract, onClose,
}) => (
  <div className="sl-col" style={{ gap: 0 }}>
    <div className="sl-between" style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 17, fontWeight: 600 }}>Wallet & Settings</h3>
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>&times;</button>
    </div>

    <div className="sl-col" style={{ gap: 16 }}>
      {/* Network badge */}
      <div className="sl-row" style={{ gap: 8, padding: '8px 12px', background: 'var(--mint-bg)', border: '1px solid var(--mint-line)', borderRadius: 'var(--r-md)' }}>
        <span className="sl-dot sl-dot-mint sl-live" />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--mint)' }}>Starknet Sepolia</span>
        <span className="sl-tiny sl-dim" style={{ marginLeft: 'auto' }}>Testnet</span>
      </div>

      {realWalletAddress ? (
        <div className="sl-col" style={{ gap: 10, padding: 14, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)' }}>
          <div className="sl-between">
            <span className="sl-row" style={{ gap: 8 }}>
              <span className="sl-dot sl-dot-mint sl-live" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Connected</span>
            </span>
            <button className="sl-btn sl-btn-ghost sl-btn-sm" style={{ color: 'var(--amber)', height: 24, padding: '0 8px', fontSize: 11 }} onClick={disconnectStarknetWallet}>
              Disconnect
            </button>
          </div>
          <div className="sl-mono sl-dim" style={{ fontSize: 11.5, wordBreak: 'break-all', padding: '6px 8px', background: 'var(--bg-0)', borderRadius: 6 }}>
            {realWalletAddress}
          </div>
          <div className="sl-between" style={{ fontSize: 12, marginTop: 4 }}>
            <span>STRK balance: <strong className="sl-mono">{realWalletBalances.strk.toFixed(4)}</strong></span>
          </div>
        </div>
      ) : (
        <div className="sl-col" style={{ gap: 10 }}>
          {/* Close our overlay first so the wallet picker isn't hidden behind it */}
          <button
            className="sl-btn sl-btn-primary"
            style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => { onClose(); connectStarknetWallet(); }}
            disabled={isConnecting}
          >
            <Icon name="shield" size={16} /> Connect Wallet (Argent X / Braavos)
          </button>
          <button
            className="sl-btn"
            style={{ width: '100%', height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1F2937', color: '#F9FAFB', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}
            onClick={() => { onClose(); loginPrivy(); }}
          >
            <Icon name="lock" size={15} style={{ color: '#10B981' }} /> Login with Privy
          </button>
        </div>
      )}

      <div className="sl-col" style={{ gap: 6 }}>
        <label className="sl-label" style={{ fontSize: 12 }}>ShieldLink Contract</label>
        <input type="text" value={shieldLinkContractAddress} onChange={(e) => setShieldLinkContractAddress(e.target.value)} className="sl-input" style={{ fontFamily: 'var(--mono)', fontSize: 11 }} placeholder="0x..." />
        {realWalletAddress && (
          <button type="button" className="sl-btn" style={{ alignSelf: 'flex-start', height: 28, padding: '0 10px', fontSize: 11, marginTop: 2, background: 'var(--mint-bg)', color: 'var(--mint)', border: '1px solid var(--mint-line)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', borderRadius: 'var(--r-md)' }} onClick={deployShieldLinkContract} disabled={isDeployingContract}>
            <Icon name="shield" size={12} />
            {isDeployingContract ? 'Deploying...' : 'Deploy Contract on Sepolia'}
          </button>
        )}
      </div>

      <button className="sl-btn sl-btn-primary" style={{ width: '100%', height: 40, marginTop: 6 }} onClick={onClose}>
        Close
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// PAYROLL VIEW — Phase 1
// ─────────────────────────────────────────────────────────────
type CreateShieldLinkFn = (
  amount: number,
  token: 'STRK' | 'USDC',
  note?: string,
  p2pOptions?: { recipientAddress: string },
) => Promise<ShieldLinkData>;

const PayrollView: React.FC<{
  walletAddress: string;
  createShieldLink: CreateShieldLinkFn;
  walletBalance: { strk: number; usdc: number };
}> = ({ walletAddress, createShieldLink, walletBalance }) => {
  const [org, setOrg] = useState<OrgRecord | null | undefined>(undefined);
  const [orgNameInput, setOrgNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!walletAddress) { setOrg(null); return; }
    getOrg(walletAddress).then(o => setOrg(o ?? null));
  }, [walletAddress]);

  const handleCreateOrg = async () => {
    const name = orgNameInput.trim();
    if (!name || !walletAddress) return;
    setSaving(true);
    const newOrg: OrgRecord = {
      id: `org_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      ownerAddress: walletAddress,
      createdAtMs: Date.now(),
    };
    await saveOrg(newOrg);
    setOrg(newOrg);
    setSaving(false);
  };

  if (!walletAddress) {
    return (
      <div className="sl-card sl-card-pad sl-col" style={{ alignItems: 'center', gap: 12, textAlign: 'center', padding: 40 }}>
        <Icon name="lock" size={28} style={{ color: 'var(--text-3)' }} />
        <span style={{ color: 'var(--text-3)', fontSize: 14 }}>Connect your wallet to access Payroll.</span>
      </div>
    );
  }

  if (org === undefined) {
    return <div className="sl-col" style={{ alignItems: 'center', padding: 40 }}><div className="spinner" /></div>;
  }

  if (org === null) {
    return (
      <div className="sl-col" style={{ gap: 24, maxWidth: 520 }}>
        <div className="sl-col" style={{ gap: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>Set up your organization</span>
          <span style={{ color: 'var(--text-3)', fontSize: 13.5 }}>Give your org a name. You'll add team members next.</span>
        </div>
        <div className="sl-card sl-card-pad sl-col" style={{ gap: 16 }}>
          <div className="sl-col" style={{ gap: 6 }}>
            <label className="sl-eyebrow" htmlFor="org-name-input">Organization name</label>
            <input
              id="org-name-input"
              className="sl-input"
              placeholder="e.g. Acme Corp, My DAO"
              value={orgNameInput}
              onChange={e => setOrgNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateOrg()}
              maxLength={60}
              autoFocus
            />
          </div>
          <button
            className="sl-btn sl-btn-primary"
            onClick={handleCreateOrg}
            disabled={!orgNameInput.trim() || saving}
            style={{ alignSelf: 'flex-start' }}
          >
            {saving ? 'Saving…' : 'Create organization →'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <PayrollRoster
      org={org}
      createShieldLink={createShieldLink}
      walletBalance={walletBalance}
    />
  );
};

// ─────────────────────────────────────────────────────────────
// PAYROLL ROSTER — manage recipients + run payroll
// ─────────────────────────────────────────────────────────────
type RunStatus = { recipientId: string; label: string; state: 'pending' | 'sending' | 'done' | 'failed'; txHash?: string; error?: string };

const PayrollRoster: React.FC<{
  org: OrgRecord;
  createShieldLink: CreateShieldLinkFn;
  walletBalance: { strk: number; usdc: number };
}> = ({ org, createShieldLink, walletBalance }) => {
  const [recipients, setRecipients] = useState<RecipientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [labelInput, setLabelInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Pay run state
  const [payToken, setPayToken] = useState<'STRK' | 'USDC'>('STRK');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [runStatuses, setRunStatuses] = useState<RunStatus[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runDone, setRunDone] = useState(false);

  const reload = () => getRecipients(org.id).then(r => { setRecipients(r); setLoading(false); });
  useEffect(() => { reload(); }, [org.id]);

  const handleAdd = async () => {
    const label = labelInput.trim();
    const addr = addressInput.trim();
    setAddError('');
    if (!label) { setAddError('Enter a name or label.'); return; }
    if (!addr.startsWith('0x') || addr.length < 10) { setAddError('Enter a valid Starknet wallet address.'); return; }
    if (recipients.some(r => r.walletAddress.toLowerCase() === addr.toLowerCase())) {
      setAddError('This address is already in the roster.'); return;
    }
    setAdding(true);
    const rec: RecipientRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      orgId: org.id,
      label,
      walletAddress: addr,
      addedAtMs: Date.now(),
    };
    await saveRecipient(rec);
    setLabelInput('');
    setAddressInput('');
    await reload();
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    await deleteRecipient(id);
    setAmounts(prev => { const next = { ...prev }; delete next[id]; return next; });
    await reload();
  };

  const payableRows = recipients.filter(r => {
    const v = parseFloat(amounts[r.id] || '0');
    return v > 0;
  });

  const totalAmount = payableRows.reduce((s, r) => s + (parseFloat(amounts[r.id]) || 0), 0);
  const available = payToken === 'STRK' ? walletBalance.strk : walletBalance.usdc;
  const canRun = payableRows.length > 0 && totalAmount > 0 && totalAmount <= available && !isRunning;

  const handleRunPayroll = async () => {
    if (!canRun) return;
    setIsRunning(true);
    setRunDone(false);

    const initialStatuses: RunStatus[] = payableRows.map(r => ({
      recipientId: r.id,
      label: r.label,
      state: 'pending',
    }));
    setRunStatuses(initialStatuses);

    const txHashes: string[] = [];
    const runRecipients: PayRunRecord['recipients'] = [];

    for (let i = 0; i < payableRows.length; i++) {
      const r = payableRows[i];
      const amount = parseFloat(amounts[r.id]);

      // Mark as sending
      setRunStatuses(prev => prev!.map((s, idx) => idx === i ? { ...s, state: 'sending' } : s));

      try {
        const link = await createShieldLink(
          amount,
          payToken,
          `Payroll — ${org.name}`,
          { recipientAddress: r.walletAddress },
        );
        txHashes.push(link.id);
        runRecipients.push({ recipientId: r.id, walletAddress: r.walletAddress, label: r.label, amount });
        setRunStatuses(prev => prev!.map((s, idx) => idx === i ? { ...s, state: 'done', txHash: link.id } : s));
      } catch (err: any) {
        setRunStatuses(prev => prev!.map((s, idx) => idx === i ? { ...s, state: 'failed', error: err?.message || 'Transaction failed' } : s));
      }
    }

    // Persist pay run record
    const run: PayRunRecord = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      orgId: org.id,
      ownerAddress: org.ownerAddress,
      token: payToken,
      recipients: runRecipients,
      totalAmount,
      status: 'done',
      createdAtMs: Date.now(),
      completedAtMs: Date.now(),
      txHashes,
    };
    await savePayRun(run);
    setIsRunning(false);
    setRunDone(true);
  };

  const resetRun = () => {
    setRunStatuses(null);
    setRunDone(false);
    setAmounts({});
  };

  return (
    <div className="sl-col" style={{ gap: 24 }}>
      {/* Org header */}
      <div className="sl-row" style={{ alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: 'var(--mint-bg)',
          border: '1px solid var(--mint-line)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--mint)', flexShrink: 0,
        }}>
          <Icon name="users" size={18} />
        </div>
        <div className="sl-col" style={{ gap: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>{org.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{recipients.length} team member{recipients.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Add recipient form — hidden during an active run */}
      {!runStatuses && (
        <div className="sl-card sl-card-pad sl-col" style={{ gap: 14 }}>
          <span className="sl-eyebrow">Add team member</span>
          <div className="sl-row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <input
              className="sl-input"
              placeholder="Name or label"
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              style={{ flex: '1 1 160px', minWidth: 140 }}
              maxLength={60}
            />
            <input
              className="sl-input sl-mono"
              placeholder="0x… wallet address"
              value={addressInput}
              onChange={e => setAddressInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              style={{ flex: '2 1 260px', minWidth: 200, fontSize: 12 }}
            />
            <button className="sl-btn sl-btn-primary" onClick={handleAdd} disabled={adding} style={{ flexShrink: 0 }}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
          {addError && <span style={{ fontSize: 12, color: '#e05c5c' }}>{addError}</span>}
        </div>
      )}

      {/* ── ACTIVE RUN progress ── */}
      {runStatuses && (
        <div className="sl-card sl-card-pad sl-col" style={{ gap: 14, borderColor: 'var(--mint-line)' }}>
          <div className="sl-between">
            <span className="sl-eyebrow">Pay run in progress</span>
            <span className="sl-chip sl-chip-mint" style={{ height: 22, fontSize: 10 }}>
              {runStatuses.filter(s => s.state === 'done').length}/{runStatuses.length} sent
            </span>
          </div>
          <div className="sl-col" style={{ gap: 8 }}>
            {runStatuses.map(s => (
              <div key={s.recipientId} className="sl-row" style={{ gap: 12, alignItems: 'center', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-3)' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: s.state === 'done' ? 'var(--mint-bg)' : s.state === 'failed' ? 'rgba(224,92,92,0.12)' : 'var(--bg-4)',
                  border: `1.5px solid ${s.state === 'done' ? 'var(--mint)' : s.state === 'failed' ? '#e05c5c' : 'var(--line)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.state === 'done' && <Icon name="check" size={11} style={{ color: 'var(--mint)' }} />}
                  {s.state === 'failed' && <Icon name="x" size={11} style={{ color: '#e05c5c' }} />}
                  {s.state === 'sending' && <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 12, color: s.state === 'failed' ? '#e05c5c' : 'var(--text-3)' }}>
                  {s.state === 'pending' ? 'Waiting…' :
                   s.state === 'sending' ? 'Sending…' :
                   s.state === 'done' ? `${amounts[s.recipientId] || ''} ${payToken}` :
                   s.error || 'Failed'}
                </span>
              </div>
            ))}
          </div>
          {runDone && (() => {
            const succeeded = runStatuses!.filter(s => s.state === 'done').length;
            const failed = runStatuses!.filter(s => s.state === 'failed').length;
            const allOk = failed === 0;
            return (
              <div className="sl-col" style={{ gap: 12, paddingTop: 4 }}>
                {/* Result banner */}
                <div style={{
                  padding: '16px 18px',
                  borderRadius: 10,
                  background: allOk ? 'var(--mint-bg)' : 'rgba(224,92,92,0.08)',
                  border: `1px solid ${allOk ? 'var(--mint-line)' : 'rgba(224,92,92,0.3)'}`,
                }}>
                  <div className="sl-row" style={{ alignItems: 'center', gap: 10, marginBottom: failed > 0 ? 10 : 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: allOk ? 'var(--mint-bg)' : 'rgba(224,92,92,0.12)',
                      border: `1px solid ${allOk ? 'var(--mint)' : '#e05c5c'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: allOk ? 'var(--mint)' : '#e05c5c',
                    }}>
                      <Icon name={allOk ? 'check' : 'info'} size={15} />
                    </div>
                    <div className="sl-col" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: allOk ? 'var(--mint)' : '#e05c5c' }}>
                        {allOk
                          ? `Payroll complete — all ${succeeded} payment${succeeded !== 1 ? 's' : ''} sent`
                          : `Pay run finished with ${failed} failure${failed !== 1 ? 's' : ''}`}
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                        {succeeded} sent privately
                        {failed > 0 ? ` · ${failed} failed` : ''}
                        {' · '}each recipient sees only their own amount
                      </span>
                    </div>
                  </div>
                  {/* Per-failure detail */}
                  {failed > 0 && (
                    <div className="sl-col" style={{ gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(224,92,92,0.2)' }}>
                      {runStatuses!.filter(s => s.state === 'failed').map(s => (
                        <div key={s.recipientId} className="sl-row" style={{ gap: 8, fontSize: 12, color: '#e05c5c', alignItems: 'flex-start' }}>
                          <Icon name="x" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span><strong>{s.label}</strong> — {s.error || 'Transaction rejected'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button className="sl-btn" onClick={resetRun} style={{ alignSelf: 'flex-start', fontSize: 13 }}>
                  ← Run another payroll
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Roster + amount inputs ── */}
      {!runStatuses && (
        <div className="sl-card sl-card-pad sl-col" style={{ gap: 12 }}>
          <div className="sl-between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <span className="sl-eyebrow">Team roster</span>
            {/* Token selector */}
            <div className="sl-row" style={{ gap: 6 }}>
              {(['STRK', 'USDC'] as const).map(t => (
                <button
                  key={t}
                  className={'sl-btn' + (payToken === t ? ' sl-btn-primary' : '')}
                  style={{ padding: '3px 12px', fontSize: 12, height: 26 }}
                  onClick={() => setPayToken(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {loading && <div className="sl-col" style={{ alignItems: 'center', padding: 24 }}><div className="spinner" /></div>}

          {!loading && recipients.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              No team members yet. Add someone above.
            </div>
          )}

          {!loading && recipients.map((r, i) => (
            <div key={r.id} className="sl-card sl-row" style={{ padding: '10px 12px', background: 'var(--bg-3)', gap: 12, alignItems: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, background: 'var(--bg-4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'var(--text-2)', flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div className="sl-col sl-grow" style={{ gap: 1, overflow: 'hidden' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</span>
                <span className="sl-mono sl-dim" style={{ fontSize: 10.5 }}>
                  {r.walletAddress.slice(0, 10)}…{r.walletAddress.slice(-6)}
                </span>
              </div>
              {/* Amount input */}
              <input
                className="sl-input sl-mono"
                placeholder="0"
                value={amounts[r.id] || ''}
                onChange={e => setAmounts(prev => ({ ...prev, [r.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                style={{ width: 90, textAlign: 'right', fontSize: 13, padding: '5px 10px' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 34 }}>{payToken}</span>
              <button
                className="sl-btn"
                style={{ padding: '4px 8px', color: 'var(--text-3)', border: '1px solid var(--line)', flexShrink: 0 }}
                onClick={() => handleRemove(r.id)}
                disabled={isRunning}
                title="Remove"
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          ))}

          {/* Summary + Run button */}
          {recipients.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 4 }}>
              <div className="sl-between" style={{ marginBottom: 12 }}>
                <div className="sl-col" style={{ gap: 2 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    {payableRows.length} of {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} will receive payment
                  </span>
                  {totalAmount > available && (
                    <span style={{ fontSize: 12, color: '#e05c5c' }}>
                      Insufficient balance — you have {available.toFixed(2)} {payToken}
                    </span>
                  )}
                </div>
                <div className="sl-col" style={{ alignItems: 'flex-end', gap: 1 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: totalAmount > available ? '#e05c5c' : 'var(--text)' }}>
                    {totalAmount > 0 ? totalAmount.toFixed(2) : '—'} {payToken}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>total</span>
                </div>
              </div>
              <button
                className="sl-btn sl-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={!canRun}
                onClick={handleRunPayroll}
              >
                <Icon name="payroll" size={15} />
                Run payroll — {payableRows.length} payment{payableRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN APPLICATION COMPONENT
// ─────────────────────────────────────────────────────────────
function App() {
  const {
    connectionType,
    shieldLinkContractAddress,
    setShieldLinkContractAddress,
    activeWallet,
    links,
    ledger,
    createShieldLink,
    claimShieldLink,
    cancelShieldLink,
    incomingTransfers,
    claimIncomingTransfer,
    isCommitmentActive,
    realWalletAddress,
    realWalletBalances,
    isConnecting,
    isReconnecting,
    connectStarknetWallet,
    disconnectStarknetWallet,
    realTxHash,
    setRealTxHash,
    isDeployingContract,
    deployShieldLinkContract,
    loginPrivy,
    refreshBalances,
  } = useStarknetState();

  // View state
  const [view, setView] = useState<'landing' | 'dashboard' | 'shield' | 'send' | 'unshield' | 'activity' | 'claim' | 'payroll'>('landing');
  const isConnected = !!realWalletAddress;
  
  // Wallet modal select dialog
  const [walletModalOpen, setWalletModalOpen] = useState<boolean>(false);

  // Form States
  const [createAmount, setCreateAmount] = useState<string>('10');
  const [createToken, setCreateToken] = useState<'STRK' | 'USDC'>('STRK');
  const [createNote, setCreateNote] = useState<string>('For the design work — thanks!');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [successCopied, setSuccessCopied] = useState<boolean>(false);

  // Unshield form state (Tongo cancel/ragequit is triggered by cancelShieldLink)
  const [unshieldAmount, setUnshieldAmount] = useState<string>('');
  const [unshieldToken, setUnshieldToken] = useState<'STRK' | 'USDC'>('STRK');
  const [unshieldAddress, setUnshieldAddress] = useState<string>('');

  // Stub — the actual Tongo withdraw flow is in cancelShieldLink (ragequit)
  const unshieldTokens = async (_amount: number, _token: 'STRK' | 'USDC') => {
    alert('Use the Cancel button on a payment link to withdraw your funds back to your wallet.');
  };

  // P2P modal state
  const [p2pModalOpen, setP2pModalOpen] = useState(false);
  const [p2pRecipient, setP2pRecipient] = useState('');
  const [p2pAmount, setP2pAmount] = useState('10');
  const [p2pToken, setP2pToken] = useState<'STRK' | 'USDC'>('STRK');
  const [p2pNote, setP2pNote] = useState('');
  const [p2pSending, setP2pSending] = useState(false);
  const [p2pCopied, setP2pCopied] = useState<string | null>(null);

  // Per-transfer claim state: id → 'claiming' | 'claimed' | 'failed'
  const [transferClaimState, setTransferClaimState] = useState<Record<string, 'claiming' | 'claimed' | 'failed'>>({});

  // ZK-Prover running state
  const [proverState, setProverState] = useState<{
    isRunning: boolean;
    type: 'shield' | 'claim';
    amount: number;
    token: string;
    onComplete: () => void;
  } | null>(null);

  // Claim State
  const [claimLinkData, setClaimLinkData] = useState<ShieldLinkData | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<boolean>(false);
  const [claimError, setClaimError] = useState<string>('');

  // URL Hash Listener Routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;

      // ── v2 multi-note link: #claim?v=2&d=<base64url> ─────────────────────
      if (hash.startsWith('#claim?v=2&d=')) {
        const b64 = hash.slice('#claim?v=2&d='.length);
        try {
          const json = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
          // json = { t: 'STRK', n: [{k,d}, ...], note: '...', ts: 1234567890 }
          const token = json.t as 'STRK' | 'USDC';
          const notes: NoteEntry[] = (json.n as any[]).map((x: any) => ({ key: x.k, denom: x.d }));
          const totalAmount = notes.reduce((s, n) => s + n.denom, 0);
          const claimedMap: Record<string, boolean> = JSON.parse(localStorage.getItem('sl_claimed_keys') || '{}');
          const allClaimed = notes.every(n => claimedMap[n.key]);
          const firstKey = notes[0]?.key || '';
          const found = links.find(l => l.secretKey === firstKey);
          if (found) {
            setClaimLinkData(found);
            setClaimSuccess(found.status === 'claimed');
          } else {
            const synthetic: ShieldLinkData = {
              id: `url_${firstKey.slice(0, 10)}`,
              amount: totalAmount,
              token,
              secretKey: firstKey,
              notes,
              createdAtMs: json.ts ? Number(json.ts) : undefined,
              creatorAddress: '0x0',
              status: allClaimed ? 'claimed' : 'pending',
              timestamp: 'From link',
              note: json.note || undefined,
            };
            setClaimLinkData(synthetic);
            setClaimSuccess(false);
            if (!allClaimed) {
              isCommitmentActive(firstKey, token, notes).then(active => {
                if (!active) setClaimLinkData(prev => prev ? { ...prev, status: 'claimed' } : prev);
              });
            }
          }
          setView('claim');
          setClaimError('');
        } catch {
          setClaimLinkData(null);
          setClaimError('Invalid or corrupted payment link.');
          setView('claim');
        }

      // ── v1 single-key link: #claim?key=0x... (backward compat) ──────────
      } else if (hash.startsWith('#claim?key=')) {
        const paramStr = hash.slice('#claim?'.length);
        const params = new URLSearchParams(paramStr);
        const key = params.get('key') || '';
        setView('claim');
        const found = links.find(l => l.secretKey === key);
        if (found) {
          setClaimLinkData(found);
          setClaimError('');
          setClaimSuccess(found.status === 'claimed');
          if (found.status === 'pending') {
            isCommitmentActive(key, found.token, found.notes).then(active => {
              if (!active) setClaimLinkData(prev => prev ? { ...prev, status: 'claimed' } : prev);
            });
          }
        } else if (key && params.get('amount') && params.get('token')) {
          const claimedMap: Record<string, boolean> = JSON.parse(localStorage.getItem('sl_claimed_keys') || '{}');
          const alreadyClaimed = claimedMap[key] === true;
          const tokenParam = params.get('token') as 'STRK' | 'USDC';
          const synthetic: ShieldLinkData = {
            id: `url_${key.slice(0, 8)}`,
            amount: parseFloat(params.get('amount')!),
            token: tokenParam,
            secretKey: key,
            creatorAddress: '0x0',
            status: alreadyClaimed ? 'claimed' : 'pending',
            timestamp: 'From link',
            note: params.get('note') ? decodeURIComponent(params.get('note')!) : undefined,
            createdAtMs: params.get('ts') ? Number(params.get('ts')) : undefined,
          };
          setClaimLinkData(synthetic);
          setClaimError('');
          setClaimSuccess(false);
          if (!alreadyClaimed) {
            isCommitmentActive(key, tokenParam).then(active => {
              if (!active) setClaimLinkData(prev => prev ? { ...prev, status: 'claimed' } : prev);
            });
          }
        } else {
          setClaimLinkData(null);
          setClaimError('Invalid or expired payment link.');
        }
      } else if (hash === '#dashboard') {
        setView('dashboard');
      } else if (hash === '#shield') {
        setView('shield');
      } else if (hash === '#send') {
        setView('send');
      } else if (hash === '#unshield') {
        setView('unshield');
      } else if (hash === '#activity') {
        setView('activity');
      } else if (hash === '#payroll') {
        setView('payroll');
      } else {
        setView('landing');
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [links]);

  // View Transitions SPA Navigation Helper
  const navigateWithTransition = (
    newView: 'landing' | 'dashboard' | 'shield' | 'send' | 'unshield' | 'activity' | 'claim' | 'payroll',
    direction: 'forward' | 'backward'
  ) => {
    if (newView === 'landing') {
      window.location.hash = '';
    } else if (newView === 'dashboard') {
      window.location.hash = '#dashboard';
    } else if (newView === 'shield') {
      window.location.hash = '#shield';
    } else if (newView === 'send') {
      window.location.hash = '#send';
    } else if (newView === 'unshield') {
      window.location.hash = '#unshield';
    } else if (newView === 'activity') {
      window.location.hash = '#activity';
    } else if (newView === 'payroll') {
      window.location.hash = '#payroll';
    }

    if (!(document as any).startViewTransition) {
      setView(newView);
      return;
    }
    (document as any).startViewTransition({
      update: () => setView(newView),
      types: [direction]
    });
  };



  // Form Submits with inline Prover integrations
  // (handleShieldSubmit removed — shield view is now informational; Tongo shielding happens in createShieldLink)

  const handleCreateLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(createAmount);
    if (isNaN(amt) || amt <= 0) return;
    // Balance check against wallet STRK balance
    const available = createToken === 'STRK' ? realWalletBalances.strk : realWalletBalances.usdc;
    if (amt > available) {
      alert(`Insufficient ${createToken} balance. You have ${available.toFixed(4)} ${createToken}.`);
      return;
    }

    setProverState({
      isRunning: true,
      type: 'shield',
      amount: amt,
      token: createToken,
      onComplete: async () => {
        try {
          const newLink = await createShieldLink(amt, createToken, createNote);
          setProverState(null);
          setSelectedKey(newLink.secretKey);
        } catch (err: any) {
          setProverState(null);
          alert(err?.message || 'Transaction rejected or failed. Please try again.');
        }
      }
    });
  };

  const handleUnshieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(unshieldAmount);
    if (isNaN(amt) || amt <= 0) return;
    const currentShielded = unshieldToken === 'STRK' ? activeWallet.shieldedStrk : activeWallet.shieldedUsdc;
    if (amt > currentShielded) {
      alert(`Insufficient ${unshieldToken} balance.`);
      return;
    }

    setProverState({
      isRunning: true,
      type: 'shield', // uses membership proofs
      amount: amt,
      token: unshieldToken,
      onComplete: async () => {
        try {
          await unshieldTokens(amt, unshieldToken);
          setProverState(null);
          navigateWithTransition('dashboard', 'backward');
        } catch (err) {
          console.error(err);
          alert('Unshield transaction failed.');
          setProverState(null);
        }
      }
    });
  };

  const handleClaimSubmit = () => {
    if (!claimLinkData) return;
    if (!isConnected) {
      setWalletModalOpen(true);
      return;
    }

    setRealTxHash('');
    setProverState({
      isRunning: true,
      type: 'claim',
      amount: claimLinkData.amount,
      token: claimLinkData.token,
      onComplete: async () => {
        try {
          const success = await claimShieldLink(
            claimLinkData.secretKey,
            activeWallet.address,
            { amount: claimLinkData.amount, token: claimLinkData.token, notes: claimLinkData.notes },
          );
          setProverState(null);
          if (success) {
            setClaimSuccess(true);
            setClaimLinkData(prev => prev ? { ...prev, status: 'claimed' } : null);
            // Refresh balance immediately + retry to catch RPC indexing lag
            refreshBalances();
            [3000, 8000, 15000].forEach(ms => setTimeout(() => refreshBalances(), ms));
          } else {
            setClaimError('Failed to claim. Link may already be claimed or cancelled.');
          }
        } catch (err: any) {
          console.error(err);
          const msg = err?.message || '';
          if (msg.toLowerCase().includes('no claimable') || msg.toLowerCase().includes('already')) {
            setClaimLinkData(prev => prev ? { ...prev, status: 'claimed' } : null);
            setClaimError('This link has already been claimed.');
          } else {
            setClaimError(msg || 'Transaction rejected or failed.');
          }
          setProverState(null);
        }
      }
    });
  };

  // Build a self-contained claim URL.
  // v2 (multi-note): encodes all note keys + denominations in a compact base64url payload.
  // v1 (legacy single-note): plain query params for backward compat.
  const buildClaimUrl = (secKey: string) => {
    const found = links.find(l => l.secretKey === secKey);
    const origin = `${window.location.origin}${window.location.pathname}`;

    if (found?.notes && found.notes.length > 0) {
      // v2 — multi-denomination, perfect privacy format
      const payload = {
        t: found.token,
        n: found.notes.map(n => ({ k: n.key, d: n.denom })),
        note: found.note || '',
        ts: found.createdAtMs || Date.now(),
      };
      const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      return `${origin}#claim?v=2&d=${b64}`;
    }

    // v1 fallback
    const base = `${origin}#claim?key=${secKey}`;
    if (found) {
      const ts = found.createdAtMs ? `&ts=${found.createdAtMs}` : '';
      return `${base}&amount=${found.amount}&token=${found.token}${found.note ? `&note=${encodeURIComponent(found.note)}` : ''}${ts}`;
    }
    return base;
  };

  const copyPaymentUrl = (secKey: string) => {
    const url = buildClaimUrl(secKey);
    navigator.clipboard.writeText(url).then(() => {
      setSuccessCopied(true);
      setTimeout(() => setSuccessCopied(false), 2000);
    });
  };


  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}…${addr.substring(addr.length - 4)}`;
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER: LANDING VIEW
  // ─────────────────────────────────────────────────────────────
  if (view === 'landing') {
    return (
      <div className="sl-app lp" style={{ height: 'auto', minHeight: '100%', background: 'var(--bg-0)' }}>
        <LandingNav onLaunchApp={(v) => navigateWithTransition(v || 'dashboard', 'forward')} />
        <LandingHero onLaunchApp={(v) => navigateWithTransition(v || 'dashboard', 'forward')} />
        <LandingConceptBand />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingPrivacyDeepDive />
        <LandingCtaBand onLaunchApp={(v) => navigateWithTransition(v || 'dashboard', 'forward')} />
        <LandingFooter onLaunchApp={(v) => navigateWithTransition(v || 'dashboard', 'forward')} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: CLAIM VIEW (Desktop Landing)
  // ─────────────────────────────────────────────────────────────
  if (view === 'claim') {
    return (
      <div className="sl-app sl-col" style={{ width: '100%', minHeight: '100vh', background: 'var(--bg-0)', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
        {/* radial glow */}
        <div style={{ position: 'absolute', top: -120, left: 0, right: 0, height: 320, background: 'radial-gradient(60% 100% at 50% 0%, var(--mint-bg), transparent 70%)', pointerEvents: 'none' }} />
        
        <div className="sl-col sl-grow" style={{ alignItems: 'center', justifyContent: 'center', width: '100%', padding: 40, zIndex: 1 }}>
          <div style={{ marginBottom: 28 }}><Logo /></div>

          <div style={{ width: 480, maxWidth: '100%' }}>
            <div className="sl-col" style={{ gap: 16, width: '100%' }}>
              
              {proverState?.isRunning ? (
                <div className="sl-card sl-card-pad" style={{ background: 'var(--bg-2)', border: '1px solid var(--mint-line)' }}>
                  <InlineProver
                    type="claim"
                    amount={proverState.amount}
                    token={proverState.token}
                    onComplete={proverState.onComplete}
                    connectionType={connectionType}
                    realTxHash={realTxHash}
                  />
                </div>
              ) : (
                <div className="sl-card sl-col" style={{ padding: 28, gap: 18, alignItems: 'center', textAlign: 'center', borderColor: 'var(--mint-line)', background: 'linear-gradient(170deg, var(--mint-bg), transparent 55%), var(--bg-2)' }}>
                  <span className="sl-chip sl-chip-mint"><Icon name="lock" size={12} /> private payment</span>
                  
                  {claimLinkData?.status === 'claimed' && !claimSuccess ? (
                    /* Link already claimed — show locked state */
                    <div className="sl-col" style={{ gap: 16, width: '100%', alignItems: 'center' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="check" size={24} style={{ color: 'var(--text-3)' }} />
                      </div>
                      <div className="sl-col" style={{ gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Already Claimed</span>
                        <span className="sl-tiny sl-muted" style={{ textAlign: 'center', maxWidth: 300 }}>
                          This payment link has already been claimed and can no longer be used.
                        </span>
                      </div>
                      <Amount value={claimLinkData.amount} unit={claimLinkData.token} size={32} tone="mint" />
                      <button className="sl-btn" style={{ width: '100%', height: 44, background: 'var(--bg-3)' }} onClick={() => navigateWithTransition('landing', 'backward')}>
                        Back to Home
                      </button>
                    </div>
                  ) : claimError ? (
                    <div className="sl-col" style={{ gap: 12 }}>
                      <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--amber)' }}>Claim Error</span>
                      <p className="sl-tiny sl-muted">{claimError}</p>
                      <button className="sl-btn sl-btn-ghost" onClick={() => navigateWithTransition('landing', 'backward')}>
                        Back to Landing
                      </button>
                    </div>
                  ) : claimSuccess ? (
                    <div className="sl-col" style={{ gap: 14, width: '100%', alignItems: 'center' }}>
                      <span className="sl-eyebrow" style={{ color: 'var(--mint)' }}>Success</span>
                      <Amount value={claimLinkData?.amount ?? '0.00'} unit={claimLinkData?.token} size={46} tone="mint" />
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Funds Unlocked!</span>
                      
                      <div className="sl-card sl-col" style={{ gap: 8, padding: 14, background: 'var(--bg-1)', width: '100%', textAlign: 'left' }}>
                        <div className="sl-between sl-tiny">
                          <span className="sl-dim">Recipient:</span>
                          <span className="sl-mono">{activeWallet.name}</span>
                        </div>
                        <div className="sl-between sl-tiny">
                          <span className="sl-dim">Public Address:</span>
                          <span className="sl-mono sl-dim">{formatAddress(activeWallet.address)}</span>
                        </div>
                      </div>

                      <button className="sl-btn sl-btn-primary" style={{ width: '100%' }} onClick={() => navigateWithTransition('dashboard', 'forward')}>
                        Open Dashboard
                      </button>
                    </div>
                  ) : claimLinkData ? (
                    <ClaimReadyView
                      claimLinkData={claimLinkData}
                      isConnected={isConnected}
                      walletName={activeWallet.name}
                      onClaim={handleClaimSubmit}
                      onConnect={() => setWalletModalOpen(true)}
                    />
                  ) : (
                    <div className="sl-col" style={{ gap: 10 }}>
                      <span className="sl-eyebrow">Processing link...</span>
                    </div>
                  )}

                </div>
              )}

              <div className="sl-row" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[['lock', 'Key never left your browser'], ['shield', 'Sender cannot be traced'], ['check', 'Settles in seconds']].map(([ic, t]) => (
                  <span key={t} className="sl-chip" style={{ height: 30 }}><Icon name={ic} size={13} style={{ color: 'var(--mint)' }} /> {t}</span>
                ))}
              </div>
            </div>
          </div>

          <span className="sl-tiny sl-dim" style={{ marginTop: 26 }}>Built on Starknet · ShieldLink never sees who you are</span>
        </div>

        {/* WALLET CONNECTOR & NETWORK SETTINGS MODAL */}
        {walletModalOpen && (
          <div 
            className="wallet-modal-overlay" 
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: 20
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setWalletModalOpen(false);
            }}
          >
            <div 
              className="wallet-modal-content" 
              style={{ 
                border: '1px solid var(--line-2)',
                borderRadius: 'var(--r-lg)',
                background: 'var(--bg-1)',
                color: 'var(--text)',
                padding: 24,
                maxWidth: 440,
                width: '100%',
                boxShadow: '0 24px 64px 0 rgba(0, 0, 0, 0.6)',
                outline: 'none',
                position: 'relative'
              }}
            >
              <WalletModalContent
                realWalletAddress={realWalletAddress}
                realWalletBalances={realWalletBalances}
                isConnecting={isConnecting}
                connectStarknetWallet={connectStarknetWallet}
                disconnectStarknetWallet={disconnectStarknetWallet}
                loginPrivy={loginPrivy}
                shieldLinkContractAddress={shieldLinkContractAddress}
                setShieldLinkContractAddress={setShieldLinkContractAddress}
                deployShieldLinkContract={deployShieldLinkContract}
                isDeployingContract={isDeployingContract}
                onClose={() => setWalletModalOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: IN-APP CHROME SHELL
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="sl-app">
      <AppShell
        active={view}
        title={
          view === 'dashboard' ? 'Dashboard' :
          view === 'send' ? 'Send a payment' :
          view === 'payroll' ? 'Payroll' :
          'Activity & Links'
        }
        subtitle={
          view === 'dashboard' ? 'Your balance and recent payments' :
          view === 'send' ? 'Create a private, one-time payment link' :
          view === 'payroll' ? 'Private disbursements for your team' :
          'Manage your payment links and history'
        }
        isConnected={isConnected}
        isReconnecting={isReconnecting}
        activeWallet={activeWallet}
        openWalletModal={() => setWalletModalOpen(true)}
        connectWallet={connectStarknetWallet}
        onSignOut={disconnectStarknetWallet}
        navigate={(v, dir) => navigateWithTransition(v, dir)}
        headerRight={undefined}
      >
        
        {/* ================= 1. DASHBOARD VIEW ================= */}
        {view === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* ── No wallet banner ──────────────────────────────── */}
            {!isConnected && (
              <div className="sl-card" style={{ padding: '12px 18px', background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div className="sl-row" style={{ gap: 10 }}>
                  <Icon name="eye" size={16} style={{ color: 'var(--amber)' }} />
                  <div className="sl-col" style={{ gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>No wallet connected</span>
                    <span className="sl-tiny sl-dim">Connect your wallet to send and receive privately.</span>
                  </div>
                </div>
                <button className="sl-btn sl-btn-primary sl-btn-sm" style={{ background: 'var(--amber)', color: '#000', borderColor: 'var(--amber)', fontSize: 12, fontWeight: 600 }} onClick={() => setWalletModalOpen(true)}>Connect Wallet</button>
              </div>
            )}

            {/* ── Top row: Balance (left) + Generated Links (right) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18, alignItems: 'start' }}>

              {/* LEFT: Balance card */}
              <div className="sl-col" style={{ gap: 14 }}>
                <div className="sl-card sl-card-pad sl-col" style={{
                  borderColor: 'var(--mint-line)',
                  background: 'linear-gradient(160deg, var(--mint-bg), transparent 60%), var(--bg-2)',
                  gap: 16,
                }}>
                  <div className="sl-between">
                    <div className="sl-row" style={{ gap: 8 }}>
                      <Icon name="shield" size={16} style={{ color: 'var(--mint)' }} />
                      <span className="sl-eyebrow" style={{ color: 'var(--mint-2)' }}>Balance</span>
                    </div>
                    <button title="Refresh balances" onClick={() => refreshBalances()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-3)' }}>
                      <Icon name="refresh" size={14} />
                    </button>
                  </div>

                  {/* STRK row */}
                  <div className="sl-col" style={{ gap: 4 }}>
                    <div className="sl-row" style={{ gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 38, fontWeight: 700, color: 'var(--mint)', lineHeight: 1, fontFamily: 'var(--mono)' }}>
                        {realWalletBalances.strk.toFixed(2)}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mint-2)' }}>STRK</span>
                    </div>
                    <span className="sl-tiny sl-dim">≈ ${(realWalletBalances.strk * 0.035).toFixed(2)}</span>
                  </div>

                  {/* USDC row */}
                  {realWalletBalances.usdc > 0 && (
                    <div className="sl-row sl-between" style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>USDC</span>
                      <span className="sl-mono" style={{ fontSize: 13 }}>{realWalletBalances.usdc.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button className="sl-btn sl-btn-primary" style={{ height: 40, fontSize: 13 }} onClick={() => setP2pModalOpen(true)}>
                      <Icon name="send" size={14} /> Send
                    </button>
                    <button className="sl-btn sl-btn-ghost" style={{ height: 40, fontSize: 13 }} onClick={() => navigateWithTransition('send', 'forward')}>
                      <Icon name="lock" size={14} /> Create Link
                    </button>
                  </div>

                  {/* P2P Transfer button */}


                  {isConnected && (
                    <div className="sl-mono sl-dim" style={{ fontSize: 10, wordBreak: 'break-all', padding: '5px 7px', background: 'var(--bg-0)', borderRadius: 6, border: '1px solid var(--line)' }}>
                      {realWalletAddress.slice(0, 18)}…{realWalletAddress.slice(-6)}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Generated Links */}
              <div className="sl-card sl-card-pad sl-col" style={{ gap: 14, minHeight: 200 }}>
                <div className="sl-between">
                  <span className="sl-eyebrow">Generated Links</span>
                  <button className="sl-btn sl-btn-primary sl-btn-sm" style={{ height: 28, fontSize: 12 }} onClick={() => navigateWithTransition('send', 'forward')}>
                    + New Link
                  </button>
                </div>

                {links.length === 0 ? (
                  <div className="sl-col" style={{ alignItems: 'center', justifyContent: 'center', flex: 1, padding: '24px 0', gap: 8 }}>
                    <Icon name="lock" size={28} style={{ color: 'var(--text-4)', opacity: 0.4 }} />
                    <span className="sl-tiny sl-dim" style={{ textAlign: 'center' }}>No links yet.<br />Create your first private payment link.</span>
                    <button className="sl-btn sl-btn-primary sl-btn-sm" style={{ marginTop: 6 }} onClick={() => navigateWithTransition('send', 'forward')}>Create Link</button>
                  </div>
                ) : (
                  <div className="sl-col" style={{ gap: 1 }}>
                    {links.slice(0, 8).map((link, idx) => {
                      const origin = window.location.origin;
                      const isP2P = link.linkType === 'p2p';
                      const url = (() => {
                        if (isP2P) return '';
                        if (link.notes && link.notes.length > 0) {
                          const payload = { t: link.token, n: link.notes.map(n => ({ k: n.key, d: n.denom })), note: link.note || '', ts: link.createdAtMs || 0 };
                          const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                          return `${origin}#claim?v=2&d=${b64}`;
                        }
                        return `${origin}#claim?key=${link.secretKey}&token=${link.token}&ts=${link.createdAtMs || ''}`;
                      })();

                      // Sender-side P2P status copy
                      const p2pStatusLabel = link.status === 'claimed' ? 'Received by recipient' : 'Deposited · Awaiting claim';
                      const statusMeta = isP2P ? {
                        pending:   { label: p2pStatusLabel, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                        claimed:   { label: 'Received by recipient', color: 'var(--mint)', bg: 'var(--mint-bg)' },
                        cancelled: { label: 'Cancelled', color: 'var(--text-3)', bg: 'var(--bg-3)' },
                      }[link.status] : {
                        pending:   { label: 'Unclaimed', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                        claimed:   { label: 'Claimed', color: 'var(--mint)', bg: 'var(--mint-bg)' },
                        cancelled: { label: 'Cancelled', color: 'var(--text-3)', bg: 'var(--bg-3)' },
                      }[link.status];

                      const copied = p2pCopied === link.id;
                      return (
                        <div key={link.id}>
                          {idx > 0 && <hr className="sl-divider" style={{ margin: '6px 0' }} />}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', padding: '4px 0' }}>
                            {/* Description */}
                            <div className="sl-col" style={{ gap: 2, minWidth: 0 }}>
                              <div className="sl-row" style={{ gap: 6 }}>
                                <Icon name={isP2P ? 'send' : 'lock'} size={12} style={{ color: isP2P ? 'var(--mint)' : 'var(--text-3)', flex: '0 0 auto' }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>
                                  {isP2P ? `Private transfer to ${link.recipientAddress?.slice(0, 10)}…${link.recipientAddress?.slice(-4)}` : 'Payment link'}
                                </span>
                              </div>
                              <div className="sl-row" style={{ gap: 6 }}>
                                <span className="sl-tiny sl-dim">{link.amount} {link.token}</span>
                                <span className="sl-tiny sl-dim">·</span>
                                <span className="sl-tiny sl-dim">{link.timestamp}</span>
                                {!isP2P && url && <span className="sl-mono sl-dim" style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>· {url.replace(origin, '').slice(0, 30)}…</span>}
                              </div>
                            </div>

                            {/* Status */}
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: statusMeta.bg, color: statusMeta.color, whiteSpace: 'nowrap' }}>
                              {statusMeta.label}
                            </span>

                            {/* Copy button — shareable links only */}
                            {!isP2P && link.status === 'pending' && (
                              <button
                                title="Copy payment link"
                                style={{ background: copied ? 'var(--mint-bg)' : 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', fontSize: 11, color: copied ? 'var(--mint)' : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => {
                                  navigator.clipboard.writeText(url);
                                  setP2pCopied(link.id);
                                  setTimeout(() => setP2pCopied(null), 2000);
                                }}
                              >
                                {copied ? '✓ Copied' : 'Copy link'}
                              </button>
                            )}
                            {/* P2P: no button for sender — recipient claims on their side */}
                            {isP2P && link.status === 'pending' && (
                              <span className="sl-tiny sl-dim" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>Recipient claims</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {links.length > 8 && (
                      <button className="sl-btn sl-btn-ghost sl-btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={() => navigateWithTransition('activity', 'forward')}>
                        View all {links.length} links →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Incoming Transfers (recipient view) ──────────── */}
            {incomingTransfers.length > 0 && (
              <div className="sl-card sl-col" style={{ gap: 0, overflow: 'hidden', border: '1px solid rgba(52,211,153,0.3)', background: 'linear-gradient(160deg, rgba(52,211,153,0.04), transparent 60%), var(--bg-1)' }}>
                <div className="sl-between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                  <div className="sl-row" style={{ gap: 10 }}>
                    <Icon name="claim" size={15} style={{ color: 'var(--mint)' }} />
                    <div className="sl-col" style={{ gap: 1 }}>
                      <span className="sl-eyebrow" style={{ color: 'var(--mint-2)' }}>Incoming Transfers</span>
                      <span className="sl-tiny sl-muted">Someone sent you money privately — add it to your wallet.</span>
                    </div>
                  </div>
                </div>
                <div className="sl-col" style={{ gap: 0 }}>
                  {incomingTransfers.map((transfer, idx) => (
                    <div key={transfer.id} style={{ borderBottom: idx < incomingTransfers.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14, alignItems: 'center', padding: '14px 18px' }}>
                        {/* Transfer info */}
                        <div className="sl-col" style={{ gap: 3 }}>
                          <div className="sl-row" style={{ gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--mint)' }}>
                              +{transfer.amount} {transfer.token}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: 'var(--mint-bg)', color: 'var(--mint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Ready to claim
                            </span>
                          </div>
                          <span className="sl-tiny sl-muted">
                            Sent privately · {transfer.timestamp}
                          </span>
                          <span className="sl-tiny" style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10 }}>
                            Sender is not visible — this is a private transfer
                          </span>
                        </div>

                        {/* Claim button */}
                        {transferClaimState[transfer.id] === 'claimed' ? (
                          <div className="sl-row" style={{ gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--mint)', padding: '0 4px' }}>
                            <Icon name="check" size={15} /> Added to wallet
                          </div>
                        ) : transferClaimState[transfer.id] === 'failed' ? (
                          <div className="sl-col" style={{ gap: 2, alignItems: 'flex-end' }}>
                            <span style={{ fontSize: 12, color: '#e05c5c' }}>Claim failed</span>
                            <button
                              className="sl-btn"
                              style={{ fontSize: 12, padding: '3px 10px' }}
                              onClick={() => setTransferClaimState(prev => { const n = {...prev}; delete n[transfer.id]; return n; })}
                            >
                              Retry
                            </button>
                          </div>
                        ) : (
                          <button
                            className="sl-btn sl-btn-primary"
                            style={{ height: 38, padding: '0 18px', fontSize: 13, fontWeight: 700 }}
                            disabled={transferClaimState[transfer.id] === 'claiming'}
                            onClick={async () => {
                              setTransferClaimState(prev => ({ ...prev, [transfer.id]: 'claiming' }));
                              try {
                                await claimIncomingTransfer(transfer.id);
                                setTransferClaimState(prev => ({ ...prev, [transfer.id]: 'claimed' }));
                                // Refresh balance immediately + retry to catch RPC lag
                                refreshBalances();
                                [3000, 8000, 15000].forEach(ms => setTimeout(() => refreshBalances(), ms));
                              } catch (e: any) {
                                setTransferClaimState(prev => ({ ...prev, [transfer.id]: 'failed' }));
                              }
                            }}
                          >
                            {transferClaimState[transfer.id] === 'claiming'
                              ? <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 1.5 }} /> Claiming…</>
                              : <><Icon name="arrowDown" size={14} /> Claim to wallet</>}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Bottom: Recent Activities ────────────────────── */}
            <div className="sl-card sl-col" style={{ gap: 0, overflow: 'hidden' }}>
              {/* Header */}
              <div className="sl-between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                <span className="sl-eyebrow">Recent Activities</span>
                <span className="sl-tiny sl-dim" style={{ cursor: 'pointer' }} onClick={() => navigateWithTransition('activity', 'forward')}>View all →</span>
              </div>

              {ledger.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }} className="sl-tiny">
                  No activity yet. Transactions will appear here.
                </div>
              ) : (
                <div className="sl-col" style={{ gap: 0 }}>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 160px 160px 140px', gap: 16, padding: '8px 18px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                    <span />
                    <span className="sl-tiny sl-dim" style={{ fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Transaction</span>
                    <span className="sl-tiny sl-dim" style={{ fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Address</span>
                    <span className="sl-tiny sl-dim" style={{ fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Date</span>
                    <span className="sl-tiny sl-dim" style={{ fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'right' }}>Amount</span>
                  </div>

                  {ledger.slice(0, 8).map((entry, idx) => {
                    const isIncoming = entry.type === 'Claim via Relayer' || entry.type === 'P2P Receive';
                    const isOutgoing = entry.type === 'Deposit to Link' || entry.type === 'Shield' || entry.type === 'P2P Send';
                    const isNeutral  = !isIncoming && !isOutgoing;

                    const iconName = entry.type === 'P2P Send' || entry.type === 'P2P Receive' ? 'send'
                      : entry.type === 'Shield' ? 'shield'
                      : entry.type === 'Unshield' ? 'unshield'
                      : entry.type === 'Claim via Relayer' ? 'claim'
                      : 'send';

                    const label = ({
                      'Shield':            'Private deposit',
                      'Unshield':          'Withdrawn',
                      'Claim via Relayer': 'Received from link',
                      'Deposit to Link':   'Payment sent',
                      'P2P Send':          'Private transfer sent',
                      'P2P Receive':       'Private transfer received',
                    } as Record<string, string>)[entry.type] ?? entry.type;

                    const typeTag = isIncoming ? { label: 'Credit', bg: 'var(--mint-bg)', color: 'var(--mint)' }
                      : isOutgoing ? { label: 'Debit', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' }
                      : { label: 'Event', bg: 'var(--bg-3)', color: 'var(--text-3)' };

                    const amtColor = isIncoming ? 'var(--mint)' : isNeutral ? 'var(--text-2)' : 'var(--text)';
                    const sign = isOutgoing ? '−' : isIncoming ? '+' : '';

                    const addrDisplay = entry.address && entry.address !== entry.walletAddress
                      ? `${entry.address.slice(0, 8)}…${entry.address.slice(-5)}`
                      : '—';

                    const txShort = entry.txHash && entry.txHash !== '0x'
                      ? `${entry.txHash.slice(0, 8)}…${entry.txHash.slice(-5)}`
                      : null;

                    return (
                      <div
                        key={entry.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '36px 1fr 160px 160px 140px',
                          gap: 16,
                          padding: '13px 18px',
                          alignItems: 'center',
                          borderBottom: idx < Math.min(ledger.length, 8) - 1 ? '1px solid var(--line)' : 'none',
                          background: 'transparent',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Icon */}
                        <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isIncoming ? 'var(--mint-bg)' : 'var(--bg-3)', color: isIncoming ? 'var(--mint)' : 'var(--text-2)', flex: '0 0 auto' }}>
                          <Icon name={iconName} size={15} />
                        </div>

                        {/* Transaction name + tag + tx hash */}
                        <div className="sl-col" style={{ gap: 3, minWidth: 0 }}>
                          <div className="sl-row" style={{ gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: typeTag.bg, color: typeTag.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{typeTag.label}</span>
                          </div>
                          {txShort && (
                            <span className="sl-mono sl-dim" style={{ fontSize: 10.5 }}>tx {txShort}</span>
                          )}
                        </div>

                        {/* Address */}
                        <span className="sl-mono" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{addrDisplay}</span>

                        {/* Date */}
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{entry.timestamp}</span>

                        {/* Amount */}
                        <span className="sl-mono" style={{ fontSize: 14, fontWeight: 700, color: amtColor, textAlign: 'right' }}>
                          {sign}{entry.amount.toFixed(4)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)' }}>{entry.token}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── P2P Modal ─────────────────────────────────────── */}
            {p2pModalOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={(e) => { if (e.target === e.currentTarget) setP2pModalOpen(false); }}>
                <div className="sl-card sl-col" style={{ width: 420, maxWidth: '95vw', padding: 24, gap: 18, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 16 }}>
                  <div className="sl-between">
                    <div className="sl-col" style={{ gap: 3 }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>Send to Someone</span>
                      <span className="sl-tiny sl-muted">Send privately — your address and the recipient's are never connected.</span>
                    </div>
                    <button onClick={() => setP2pModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 22, cursor: 'pointer' }}>&times;</button>
                  </div>

                  <div className="sl-col" style={{ gap: 12 }}>
                    <div className="sl-col" style={{ gap: 5 }}>
                      <label className="sl-label">Recipient's wallet address</label>
                      <input className="sl-input" style={{ fontFamily: 'var(--mono)', fontSize: 12 }} placeholder="0x…" value={p2pRecipient} onChange={e => setP2pRecipient(e.target.value)} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="sl-col" style={{ gap: 5 }}>
                        <label className="sl-label">Token</label>
                        <div className="sl-row" style={{ gap: 8 }}>
                          {(['STRK', 'USDC'] as const).map(t => (
                            <button key={t} className="sl-btn sl-btn-sm" style={{ flex: 1, height: 36, background: p2pToken === t ? 'var(--mint-bg)' : 'var(--bg-3)', border: `1px solid ${p2pToken === t ? 'var(--mint-line)' : 'var(--line)'}`, color: p2pToken === t ? 'var(--mint)' : 'var(--text-2)', fontWeight: 600 }} onClick={() => setP2pToken(t)}>{t}</button>
                          ))}
                        </div>
                      </div>
                      <div className="sl-col" style={{ gap: 5 }}>
                        <label className="sl-label">Amount</label>
                        <input className="sl-input" type="number" min="0" step="0.1" value={p2pAmount} onChange={e => setP2pAmount(e.target.value)} />
                      </div>
                    </div>

                    {parseFloat(p2pAmount) > 0 && (
                      <div style={{ padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8, fontSize: 12, color: 'var(--text-2)' }}>
                        Split: {splitIntoNotes(parseFloat(p2pAmount), p2pToken).map(d => `${d} ${p2pToken}`).join(' + ')}
                      </div>
                    )}

                    <div className="sl-col" style={{ gap: 5 }}>
                      <label className="sl-label">Note (optional)</label>
                      <input className="sl-input" placeholder="e.g. For the design work" value={p2pNote} onChange={e => setP2pNote(e.target.value)} />
                    </div>

                    <div style={{ padding: '10px 12px', background: 'rgba(52,211,153,0.05)', border: '1px solid var(--mint-line)', borderRadius: 8 }}>
                      <span className="sl-tiny" style={{ color: 'var(--mint-2)', lineHeight: 1.5 }}>
                        Funds are sent privately. The recipient will see this and can claim it to their wallet. Waiting a few minutes before they claim gives the best privacy.
                      </span>
                    </div>
                  </div>

                  <button
                    className="sl-btn sl-btn-primary"
                    style={{ height: 46, width: '100%' }}
                    disabled={p2pSending || !p2pRecipient || !parseFloat(p2pAmount)}
                    onClick={async () => {
                      if (!isConnected) { setWalletModalOpen(true); setP2pModalOpen(false); return; }
                      setP2pSending(true);
                      try {
                        await createShieldLink(parseFloat(p2pAmount), p2pToken, p2pNote || undefined, { recipientAddress: p2pRecipient });
                        setP2pModalOpen(false);
                        setP2pRecipient('');
                        setP2pAmount('10');
                        setP2pNote('');
                      } catch (e: any) {
                        alert(e.message || 'Transfer failed');
                      }
                      setP2pSending(false);
                    }}
                  >
                    {p2pSending ? 'Sending…' : 'Send privately →'}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ================= 2. SHIELD VIEW ================= */}
        {view === 'shield' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20, maxWidth: 860 }}>

            {/* Tongo privacy pool info panel */}
            <div className="sl-card sl-card-pad sl-col" style={{ gap: 20, borderColor: 'var(--mint-line)', background: 'linear-gradient(160deg, var(--mint-bg), transparent 60%), var(--bg-2)' }}>
              <div className="sl-row" style={{ gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 42, height: 42, flex: '0 0 auto', borderRadius: 12, background: 'var(--mint-bg)', color: 'var(--mint)', border: '1px solid var(--mint-line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="shield" size={20} />
                </div>
                <div className="sl-col" style={{ gap: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>Your money, fully private</span>
                  <span className="sl-tiny sl-muted" style={{ lineHeight: 1.55 }}>
                    ShieldLink uses a private pool on Starknet.
                    Balances are encrypted on-chain — no one can see how much you hold or who you paid.
                  </span>
                </div>
              </div>

              <hr className="sl-divider" />

              <div className="sl-col" style={{ gap: 8 }}>
                <span className="sl-eyebrow">Your STRK balance</span>
                <Amount value={activeWallet.shieldedStrk.toFixed(2)} unit="STRK" size={40} tone="mint" />
                {connectionType === 'starknet' && (
                  <span className="sl-chip sl-chip-mint" style={{ alignSelf: 'flex-start', height: 24, fontSize: 11 }}>
                    <span className="sl-dot sl-dot-mint sl-live" /> Live from wallet
                  </span>
                )}
              </div>

              <div className="sl-col" style={{ gap: 10, marginTop: 4 }}>
                <button className="sl-btn sl-btn-primary" style={{ height: 46 }} onClick={() => navigateWithTransition('send', 'forward')}>
                  <Icon name="send" size={16} /> Create Payment Link
                </button>
                <button className="sl-btn sl-btn-ghost" style={{ height: 40 }} onClick={() => navigateWithTransition('activity', 'forward')}>
                  <Icon name="activity" size={15} /> View Activity & Links
                </button>
              </div>
            </div>

            {/* How it works */}
            <div className="sl-card sl-card-pad sl-col" style={{ gap: 18, background: 'var(--bg-1)' }}>
              <span className="sl-eyebrow">How your privacy works</span>

              <div className="sl-col" style={{ gap: 16 }}>
                {[
                  { icon: 'lock', title: 'A unique key is created', body: 'When you create a link, a one-time key is generated in your browser. It never touches any server.' },
                  { icon: 'shield', title: 'Funds are secured privately', body: 'Your payment is locked into a private pool. The amount is hidden on-chain — no one can see what you sent.' },
                  { icon: 'send', title: 'Recipient receives privately', body: 'The recipient opens the link and claims the funds. Your address and theirs are never connected on-chain.' },
                  { icon: 'unshield', title: 'Cancel anytime, get money back', body: 'Cancel a link at any time and your funds are returned to your wallet immediately.' },
                ].map(({ icon, title, body }) => (
                  <div key={title} className="sl-row" style={{ gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 30, height: 30, flex: '0 0 auto', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={icon} size={15} />
                    </div>
                    <div className="sl-col" style={{ gap: 2 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</span>
                      <span className="sl-tiny sl-muted" style={{ lineHeight: 1.45 }}>{body}</span>
                    </div>
                  </div>
                ))}
              </div>

              <hr className="sl-divider" style={{ marginTop: 'auto' }} />

              <div className="sl-col" style={{ gap: 6 }}>
                <div className="sl-between sl-tiny">
                  <span className="sl-dim">Contract address (Sepolia testnet)</span>
                </div>
                <div className="sl-mono sl-dim" style={{ fontSize: 10, wordBreak: 'break-all', padding: '6px 8px', background: 'var(--bg-0)', borderRadius: 6, border: '1px solid var(--line)' }}>
                  0x408163bfcfc2d76f34b444cb55e09dace5905cf84c0884e4637c2c0f06ab6ed
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ================= 3. SEND VIEW ================= */}
        {view === 'send' && (
          <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 20, minHeight: '100%' }}>
            
            {/* Compose Section */}
            <div className="sl-card sl-card-pad sl-col" style={{ gap: 18 }}>
              {proverState?.isRunning ? (
                <InlineProver
                  type="shield"
                  amount={proverState.amount}
                  token={proverState.token}
                  onComplete={proverState.onComplete}
                  connectionType={connectionType}
                  realTxHash={realTxHash}
                />
              ) : (
                <form onSubmit={handleCreateLinkSubmit} className="sl-col" style={{ gap: 16, height: '100%' }}>

                  {/* Token selector */}
                  <div className="sl-row" style={{ gap: 8 }}>
                    <span className="sl-eyebrow" style={{ flex: 1 }}>Token</span>
                    {(['STRK', 'USDC'] as const).map(tok => (
                      <button
                        key={tok} type="button"
                        onClick={() => { setCreateToken(tok); setCreateAmount(''); }}
                        style={{
                          height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid',
                          borderColor: createToken === tok ? 'var(--mint)' : 'var(--line)',
                          background: createToken === tok ? 'var(--mint-bg)' : 'var(--bg-3)',
                          color: createToken === tok ? 'var(--mint)' : 'var(--text-2)',
                          fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                        }}
                      >{tok}</button>
                    ))}
                  </div>

                  {/* Fixed denomination picker — the privacy foundation */}
                  <div className="sl-col" style={{ gap: 8 }}>
                    <div className="sl-between">
                      <span className="sl-eyebrow">Denomination</span>
                      <span className="sl-tiny" style={{ color: 'var(--mint)', fontWeight: 600 }}>fixed · for privacy</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {(FIXED_DENOMS[createToken] as readonly number[]).map(d => {
                        const active = createAmount === String(d);
                        return (
                          <button
                            key={d} type="button"
                            onClick={() => setCreateAmount(String(d))}
                            style={{
                              height: 54, borderRadius: 10, border: '1.5px solid',
                              borderColor: active ? 'var(--mint)' : 'var(--line)',
                              background: active ? 'var(--mint-bg)' : 'var(--bg-3)',
                              color: active ? 'var(--mint)' : 'var(--text-2)',
                              fontWeight: 700, fontSize: 14, cursor: 'pointer',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                              transition: 'all 0.12s',
                            }}
                          >
                            <span style={{ fontSize: 16, fontWeight: 800 }}>{d < 1 ? d : d >= 1000 ? `${d/1000}k` : d}</span>
                            <span style={{ fontSize: 9, opacity: 0.65 }}>{createToken}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom amount — splits into notes automatically */}
                    <div className="sl-col" style={{ gap: 4 }}>
                      <span className="sl-tiny sl-dim">Or enter any amount (split automatically for better privacy)</span>
                      <input
                        type="number"
                        className="sl-input sl-mono"
                        style={{ height: 40, fontSize: 15 }}
                        value={createAmount}
                        onChange={(e) => setCreateAmount(e.target.value)}
                        placeholder={`e.g. 15 ${createToken}`}
                        min="0.1"
                        step="any"
                      />
                    </div>
                  </div>

                  {/* Note breakdown preview */}
                  {(() => {
                    const amt = parseFloat(createAmount) || 0;
                    if (amt <= 0) return null;
                    const notes = splitIntoNotes(amt, createToken);
                    const unique = [...new Set(notes)].sort((a, b) => b - a);
                    const countOf = (d: number) => notes.filter(n => n === d).length;
                    const isExact = FIXED_DENOMS[createToken].includes(amt as never);
                    return (
                      <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--mint-line)', background: 'var(--mint-bg)' }}>
                        <div className="sl-row" style={{ gap: 6, marginBottom: 6 }}>
                          <Icon name="lock" size={13} style={{ color: 'var(--mint)' }} />
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mint)' }}>
                            {notes.length === 1 ? '1 part' : `${notes.length} parts`}
                          </span>
                          {!isExact && <span className="sl-tiny sl-dim" style={{ marginLeft: 'auto' }}>auto-split</span>}
                        </div>
                        <div className="sl-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          {unique.map(d => (
                            <span key={d} style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                              {countOf(d) > 1 ? `${countOf(d)} × ` : ''}{d} {createToken}
                            </span>
                          ))}
                        </div>
                        <div className="sl-tiny sl-muted" style={{ marginTop: 6, lineHeight: 1.4 }}>
                          Each part is sent independently — the same size as hundreds of other payments, making yours impossible to single out.
                        </div>
                      </div>
                    );
                  })()}

                  {/* Note for recipient */}
                  <div className="sl-col" style={{ gap: 6 }}>
                    <span className="sl-label">Note for recipient <span className="sl-dim">(optional)</span></span>
                    <input
                      type="text"
                      className="sl-input"
                      value={createNote}
                      onChange={(e) => setCreateNote(e.target.value)}
                      placeholder="e.g. For contract writing services"
                    />
                  </div>

                  <div className="sl-grow" />

                  {/* Balance check */}
                  {(() => {
                    const amt = parseFloat(createAmount) || 0;
                    const available = createToken === 'STRK' ? realWalletBalances.strk : realWalletBalances.usdc;
                    if (amt > 0 && amt > available) return (
                      <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--amber-line)', background: 'var(--amber-bg)' }}>
                        <div className="sl-row" style={{ gap: 6 }}>
                          <Icon name="info" size={13} style={{ color: 'var(--amber)' }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)' }}>Insufficient balance</span>
                        </div>
                        <p className="sl-tiny sl-muted" style={{ marginTop: 4 }}>
                          You have {available.toFixed(4)} {createToken}. Needed: {amt} {createToken}.
                        </p>
                      </div>
                    );
                    return null;
                  })()}

                  <button
                    type="submit"
                    className="sl-btn sl-btn-primary"
                    style={{ height: 48 }}
                    disabled={!createAmount || (parseFloat(createAmount) || 0) <= 0 ||
                      (parseFloat(createAmount) || 0) > (createToken === 'STRK' ? realWalletBalances.strk : realWalletBalances.usdc)}
                  >
                    <Icon name="lock" size={16} /> Generate Private Payment Link
                  </button>
                </form>
              )}
            </div>

            {/* Generated Link Result Section */}
            <div className="sl-card sl-col" style={{ overflow: 'hidden', borderColor: selectedKey ? 'var(--mint-line)' : 'var(--line)' }}>
              {selectedKey ? (
                <div className="sl-col" style={{ height: '100%' }}>
                  <div style={{ padding: '16px 20px', background: 'linear-gradient(160deg, var(--mint-bg), transparent)', borderBottom: '1px solid var(--line)' }}>
                    <div className="sl-between">
                      <div className="sl-row" style={{ gap: 9 }}>
                        <Icon name="link" size={17} style={{ color: 'var(--mint)' }} />
                        <span className="sl-eyebrow" style={{ color: 'var(--mint-2)' }}>Your payment link</span>
                      </div>
                      <span className="sl-chip sl-chip-mint" style={{ height: 24, fontSize: 11 }}>one-time use</span>
                    </div>
                  </div>

                  <div className="sl-row sl-card-pad" style={{ gap: 20, alignItems: 'center' }}>
                    <div style={{ background: '#fff', padding: 10, borderRadius: 12, flexShrink: 0 }}>
                      <QRCodeSVG
                        value={buildClaimUrl(selectedKey)}
                        size={112}
                        bgColor="#ffffff"
                        fgColor="#0e0f11"
                        level="M"
                      />
                    </div>
                    <div className="sl-col sl-grow" style={{ gap: 6 }}>
                      <span className="sl-eyebrow">Recipient claims</span>
                      <Amount value={createAmount} unit={createToken} size={30} tone="mint" />
                      {(() => {
                        const found = links.find(l => l.secretKey === selectedKey);
                        const noteCount = found?.notes?.length ?? 1;
                        return (
                          <span className="sl-tiny sl-dim">
                            {noteCount === 1 ? '1 part' : `${noteCount} parts`} · scan or share link
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="sl-col sl-card-pad" style={{ gap: 12, paddingTop: 4, flexGrow: 1 }}>
                    {/* Note breakdown */}
                    {(() => {
                      const found = links.find(l => l.secretKey === selectedKey);
                      if (!found?.notes || found.notes.length <= 1) return null;
                      const denoms = found.notes.map(n => n.denom);
                      const unique = [...new Set(denoms)].sort((a, b) => b - a);
                      const countOf = (d: number) => denoms.filter(x => x === d).length;
                      return (
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--line)' }}>
                          <div className="sl-row" style={{ gap: 6, marginBottom: 4 }}>
                            <Icon name="shield" size={12} style={{ color: 'var(--mint)' }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mint)' }}>Sent in {found.notes.length} parts</span>
                          </div>
                          <div className="sl-row" style={{ gap: 5, flexWrap: 'wrap' }}>
                            {unique.map(d => (
                              <span key={d} style={{ padding: '2px 7px', borderRadius: 5, background: 'var(--mint-bg)', border: '1px solid var(--mint-line)', fontSize: 10.5, fontWeight: 600, color: 'var(--mint)' }}>
                                {countOf(d) > 1 ? `${countOf(d)}×` : ''}{d} {found.token}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* URL box */}
                    <div className="sl-col" style={{ gap: 7 }}>
                      <span className="sl-label">Payment URL</span>
                      <div className="sl-row" style={{ gap: 10, padding: '10px 12px', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)' }}>
                        <div className="sl-mono sl-grow" style={{ fontSize: 10.5, lineHeight: 1.5, wordBreak: 'break-all', maxHeight: 56, overflowY: 'auto', color: 'var(--text-3)' }}>
                          {buildClaimUrl(selectedKey).replace(window.location.origin + window.location.pathname, '…/')}
                        </div>
                        <button
                          type="button"
                          className="sl-btn sl-btn-primary sl-btn-sm"
                          style={{ flex: '0 0 auto', height: 32 }}
                          onClick={() => copyPaymentUrl(selectedKey)}
                        >
                          <Icon name={successCopied ? 'check' : 'copy'} size={14} /> {successCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* Privacy properties */}
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>What makes this private</span>
                      {[
                        ['check', 'Amount hidden from public view'],
                        ['check', 'One-time link — never reused, never stored'],
                        ['check', 'Your payment blends with hundreds of others'],
                        ['check', 'Sender and recipient are never connected'],
                      ].map(([ic, txt]) => (
                        <div key={txt} className="sl-row" style={{ gap: 7, marginBottom: 5 }}>
                          <Icon name={ic} size={12} style={{ color: 'var(--mint)', flex: '0 0 auto' }} sw={2.5} />
                          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{txt}</span>
                        </div>
                      ))}
                    </div>

                    <div className="sl-row" style={{ gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--mint-bg)', border: '1px solid var(--mint-line)' }}>
                      <Icon name="info" size={13} style={{ color: 'var(--mint)', flex: '0 0 auto' }} />
                      <span className="sl-tiny sl-muted" style={{ lineHeight: 1.4 }}>
                        Share this link through any private channel. Everything after <span className="sl-mono" style={{ fontWeight: 700 }}>#</span> never touches a server.
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', padding: 40, textAlign: 'center', gap: 10 }}>
                  <Icon name="link" size={36} style={{ opacity: 0.3 }} />
                  <span className="sl-label">Compose a payment link</span>
                  <p className="sl-tiny sl-muted" style={{ maxWidth: 260 }}>Fill in the details on the left and your shareable payment link will appear here.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ================= 4. UNSHIELD VIEW ================= */}
        {view === 'unshield' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, minHeight: '100%' }}>
            
            {/* Unshield Form */}
            <div className="sl-card sl-card-pad sl-col" style={{ gap: 18 }}>
              {proverState?.isRunning ? (
                <InlineProver
                  type="shield" // unshielding also proves commitment ownership
                  amount={proverState.amount}
                  token={proverState.token}
                  onComplete={proverState.onComplete}
                  connectionType={connectionType}
                  realTxHash={realTxHash}
                />
              ) : (
                <form onSubmit={handleUnshieldSubmit} className="sl-col" style={{ gap: 18, height: '100%' }}>
                  <div className="sl-col" style={{ gap: 9 }}>
                    <div className="sl-between">
                      <span className="sl-label">Amount to withdraw</span>
                      <span className="sl-tiny sl-dim">
                        Available:{' '}
                        <span className="sl-mono" style={{ color: 'var(--mint)', fontWeight: 600 }}>
                          {unshieldToken === 'STRK' ? activeWallet.shieldedStrk.toFixed(2) : activeWallet.shieldedUsdc.toFixed(2)}
                        </span>{' '}
                        {unshieldToken}
                      </span>
                    </div>

                    <div className="sl-row" style={{ gap: 10, height: 64, padding: '0 16px', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)' }}>
                      <input
                        type="number"
                        className="sl-mono"
                        style={{
                          fontSize: 28, fontWeight: 600, background: 'transparent', border: 'none', color: 'var(--text)',
                          outline: 'none', width: '100%', height: '100%'
                        }}
                        value={unshieldAmount}
                        onChange={(e) => setUnshieldAmount(e.target.value)}
                        placeholder="0.00"
                        min="1"
                        step="any"
                        required
                      />
                      <select
                        value={unshieldToken}
                        onChange={(e) => setUnshieldToken(e.target.value as 'STRK' | 'USDC')}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                      >
                        <option value="STRK" style={{ background: 'var(--bg-3)' }}>STRK</option>
                        <option value="USDC" style={{ background: 'var(--bg-3)' }}>USDC</option>
                      </select>
                      <button
                        type="button"
                        className="sl-chip"
                        style={{ height: 28, fontWeight: 600 }}
                        onClick={() => setUnshieldAmount(unshieldToken === 'STRK' ? activeWallet.shieldedStrk.toString() : activeWallet.shieldedUsdc.toString())}
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  {/* conversion preview */}
                  <div className="sl-row" style={{ gap: 12, justifyContent: 'center', padding: '2px 0' }}>
                    <div className="sl-col" style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                      <span className="sl-eyebrow" style={{ color: 'var(--mint-2)' }}>From · private</span>
                      <div className="sl-card sl-row" style={{ width: '100%', justifyContent: 'center', gap: 7, padding: '10px 0', background: 'var(--mint-bg)', borderColor: 'var(--mint-line)' }}>
                        <Icon name="lock" size={14} style={{ color: 'var(--mint)' }} />
                        <span className="sl-mono" style={{ fontWeight: 600, color: 'var(--mint)', fontSize: 13.5 }}>{parseFloat(unshieldAmount) || 0} {unshieldToken}</span>
                      </div>
                    </div>
                    <Icon name="arrowRight" size={18} style={{ color: 'var(--text-3)', marginTop: 22 }} />
                    <div className="sl-col" style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                      <span className="sl-eyebrow">To · public</span>
                      <div className="sl-card sl-row" style={{ width: '100%', justifyContent: 'center', gap: 7, padding: '10px 0', background: 'var(--bg-3)' }}>
                        <Icon name="eye" size={14} style={{ color: 'var(--amber-2)' }} />
                        <span className="sl-mono" style={{ fontWeight: 600, fontSize: 13.5 }}>{parseFloat(unshieldAmount) || 0} {unshieldToken}</span>
                      </div>
                    </div>
                  </div>

                  <div className="sl-col" style={{ gap: 8 }}>
                    <span className="sl-label">Destination public address</span>
                    <div className="sl-row" style={{ gap: 10, padding: '0 14px', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', height: 46 }}>
                      <input
                        type="text"
                        className="sl-mono sl-grow"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', fontSize: 12.5, outline: 'none', width: '100%', height: '100%' }}
                        value={unshieldAddress}
                        onChange={(e) => setUnshieldAddress(e.target.value)}
                        placeholder="0x..."
                        required
                      />
                      <span className="sl-chip sl-chip-mint" style={{ height: 22, fontSize: 10.5 }}>fresh ✓</span>
                    </div>
                  </div>

                  <div className="sl-grow" />
                  <button type="submit" className="sl-btn sl-btn-primary" style={{ height: 48 }} disabled={(parseFloat(unshieldAmount) || 0) > (unshieldToken === 'STRK' ? activeWallet.shieldedStrk : activeWallet.shieldedUsdc)}>
                    <Icon name="unshield" size={16} /> Withdraw to Wallet
                  </button>
                </form>
              )}
            </div>

            {/* Caution panel */}
            <div className="sl-col" style={{ gap: 20 }}>
              
              <div className="sl-card sl-card-pad sl-row" style={{ gap: 12, alignItems: 'flex-start', background: 'var(--amber-bg)', borderColor: 'var(--amber-line)' }}>
                <Icon name="eye" size={18} style={{ color: 'var(--amber)', flex: '0 0 auto', marginTop: 2 }} />
                <div className="sl-col" style={{ gap: 4 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--amber)' }}>This will be visible on-chain</span>
                  <span className="sl-tiny sl-muted" style={{ lineHeight: 1.45 }}>Once withdrawn, the destination balance and details are visible on-chain like any normal transfer. Your private payment history stays hidden.</span>
                </div>
              </div>

              <div className="sl-card sl-card-pad sl-col" style={{ gap: 16, background: 'var(--bg-1)', flexGrow: 1 }}>
                <span className="sl-eyebrow">Tips for better privacy</span>
                
                <div className="sl-col" style={{ gap: 14 }}>
                  <div className="sl-row" style={{ gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 30, height: 30, flex: '0 0 auto', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="shield" size={15} /></div>
                    <div className="sl-col" style={{ gap: 2 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>Use a fresh wallet address</span>
                      <span className="sl-tiny sl-muted" style={{ lineHeight: 1.4 }}>Withdrawing to a new address keeps it unconnected to any history.</span>
                    </div>
                  </div>

                  <div className="sl-row" style={{ gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 30, height: 30, flex: '0 0 auto', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="refresh" size={15} /></div>
                    <div className="sl-col" style={{ gap: 2 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>Mix up the amount and timing</span>
                      <span className="sl-tiny sl-muted" style={{ lineHeight: 1.4 }}>Repeating the same exact amount or timing makes patterns easier to spot. Vary your withdrawals.</span>
                    </div>
                  </div>

                  <div className="sl-row" style={{ gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 30, height: 30, flex: '0 0 auto', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={15} /></div>
                    <div className="sl-col" style={{ gap: 2 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>Keep the rest private</span>
                      <span className="sl-tiny sl-muted" style={{ lineHeight: 1.4 }}>Only withdraw what you need right now. Keep the rest private by default.</span>
                    </div>
                  </div>
                </div>

                <hr className="sl-divider" style={{ marginTop: 'auto' }} />
                
                <div className="sl-between sl-tiny"><span className="sl-dim">Network fee</span><span className="sl-mono sl-muted">~0.21 STRK</span></div>
                <div className="sl-between sl-tiny"><span className="sl-dim">You receive</span><span className="sl-mono">{unshieldAmount ? (parseFloat(unshieldAmount) - 0.21).toFixed(2) : '0.00'} {unshieldToken}</span></div>
              </div>

            </div>

          </div>
        )}

        {/* ================= 5. ACTIVITY / LINKS VIEW ================= */}
        {view === 'activity' && (
          <div className="sl-col" style={{ gap: 24 }}>
            
            {/* Generated Links Manager */}
            <div className="sl-card sl-card-pad sl-col" style={{ gap: 14 }}>
              <span className="sl-eyebrow">Your payment links</span>
              
              <div className="sl-col" style={{ gap: 10 }}>
                {links.map((link) => (
                  <div key={link.id} className="sl-card sl-row" style={{ padding: 14, background: 'var(--bg-1)', border: '1px solid var(--line-2)' }}>
                    <div className="sl-col sl-grow" style={{ gap: 4 }}>
                      <div className="sl-row" style={{ gap: 8 }}>
                        <span className="sl-mono" style={{ fontSize: 14, fontWeight: 600, color: link.status === 'claimed' ? 'var(--text-3)' : 'var(--mint)' }}>
                          {link.amount.toFixed(2)} {link.token}
                        </span>
                        
                        {link.status === 'pending' && <span className="sl-chip sl-chip-mint" style={{ height: 20, fontSize: 10 }}><span className="sl-dot sl-dot-mint sl-live" /> Active</span>}
                        {link.status === 'claimed' && <span className="sl-chip" style={{ height: 20, fontSize: 10 }}>Claimed</span>}
                        {link.status === 'cancelled' && <span className="sl-chip sl-chip-amber" style={{ height: 20, fontSize: 10 }}>Withdrawn</span>}
                      </div>

                      {link.note && (
                        <div className="sl-tiny sl-muted">Memo: "{link.note}"</div>
                      )}

                      <div className="sl-mono sl-dim" style={{ fontSize: 10, wordBreak: 'break-all' }}>
                        Ref: {link.secretKey.slice(0, 16)}…
                      </div>
                    </div>

                    <div className="sl-row" style={{ gap: 8, flexShrink: 0 }}>
                      {link.status === 'pending' && (
                        <>
                          <button className="sl-btn sl-btn-sm" onClick={() => copyPaymentUrl(link.secretKey)}>
                            Copy URL
                          </button>
                          {link.creatorAddress === activeWallet.address && (
                            <button className="sl-btn sl-btn-sm" style={{ color: 'var(--amber)', borderColor: 'var(--amber-line)' }} onClick={() => cancelShieldLink(link.id)}>
                              Withdraw
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {links.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-3)' }} className="sl-tiny">
                    No payment links generated yet.
                  </div>
                )}
              </div>
            </div>

            {/* Complete Public L2 Logs */}
            <div className="sl-card sl-card-pad sl-col" style={{ gap: 14 }}>
              <div className="sl-between">
                <span className="sl-eyebrow">Transaction History</span>
                <span className="sl-chip sl-chip-mint" style={{ height: 22, fontSize: 10 }}><span className="sl-dot sl-dot-mint sl-live" /> synced</span>
              </div>

              <div className="sl-col" style={{ gap: 10 }}>
                {ledger.map((entry) => {
                  const isMint = entry.type === 'Claim via Relayer' || entry.type === 'Deposit to Link';
                  return (
                    <div key={entry.id} className="sl-card sl-row" style={{ padding: '12px 16px', background: 'var(--bg-3)', fontSize: 13, gap: 16 }}>
                      <div className="sl-col" style={{ flex: '0 0 130px' }}>
                        <span style={{ fontWeight: 600 }}>
                          {entry.type === 'Shield' ? 'Private deposit' : entry.type === 'Unshield' ? 'Withdrawal' : entry.type === 'Claim via Relayer' ? 'Payment claimed' : 'Payment sent'}
                        </span>
                        <span className="sl-tiny sl-dim">{entry.timestamp}</span>
                      </div>
                      
                      <div className="sl-col sl-grow" style={{ gap: 2 }}>
                        <span className="sl-mono sl-dim" style={{ fontSize: 11 }}>Tx: {entry.txHash.substring(0, 16)}…{entry.txHash.substring(entry.txHash.length - 8)}</span>
                        <span className="sl-mono sl-dim" style={{ fontSize: 10, opacity: 0.7 }}>Address: {entry.address.substring(0, 10)}…{entry.address.substring(entry.address.length - 6)}</span>
                      </div>

                      <span className="sl-chip" style={{ height: 22, fontSize: 10 }}>{entry.token}</span>
                      
                      <span className="sl-mono" style={{ fontSize: 13.5, fontWeight: 700, color: isMint ? 'var(--mint)' : 'var(--text)' }}>
                        {entry.type === 'Shield' || entry.type === 'Deposit to Link' ? '−' : '+'}{entry.amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ================= 4. PAYROLL VIEW ================= */}
        {view === 'payroll' && (
          <PayrollView
            walletAddress={realWalletAddress || ''}
            createShieldLink={createShieldLink}
            walletBalance={realWalletBalances}
          />
        )}

      </AppShell>

      {/* WALLET CONNECTOR & NETWORK SETTINGS MODAL */}
      {walletModalOpen && (
        <div 
          className="wallet-modal-overlay" 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: 20
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setWalletModalOpen(false);
          }}
        >
          <div 
            className="wallet-modal-content" 
            style={{ 
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--r-lg)',
              background: 'var(--bg-1)',
              color: 'var(--text)',
              padding: 24,
              maxWidth: 440,
              width: '100%',
              boxShadow: '0 24px 64px 0 rgba(0, 0, 0, 0.6)',
              outline: 'none',
              position: 'relative'
            }}
          >
            <WalletModalContent
              realWalletAddress={realWalletAddress}
              realWalletBalances={realWalletBalances}
              isConnecting={isConnecting}
              connectStarknetWallet={connectStarknetWallet}
              disconnectStarknetWallet={disconnectStarknetWallet}
              loginPrivy={loginPrivy}
              shieldLinkContractAddress={shieldLinkContractAddress}
              setShieldLinkContractAddress={setShieldLinkContractAddress}
              deployShieldLinkContract={deployShieldLinkContract}
              isDeployingContract={isDeployingContract}
              onClose={() => setWalletModalOpen(false)}
            />
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
