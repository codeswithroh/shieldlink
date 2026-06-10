# ShieldLink Brand Guidelines & Design System

These guidelines define the visual styling, color semantics, typography, layouts, and copy rules for the ShieldLink web application. All screens and components must adhere strictly to these principles.

---

## 1. Core Visual Concept: Semantics by Color
ShieldLink uses a clear color-coding system to explain private cryptocurrency concepts to users:
- **Gray** (`var(--text-3)`): Represents **Public** data — exposed on-chain.
- **Amber** (`var(--amber)`): Represents **Caution** — data or actions visible to everyone.
- **Mint** (`var(--mint)`): Represents **Shielded** data — private, secure, and off-chain.

*Rule:* Any mint element is hidden or private; any gray/amber element is public. The motion of these colors visually represents the shielding, sending, and unshielding flow.

---

## 2. Color Palette & CSS Variables
Add the following design tokens to the root CSS selector:

```css
:root {
  /* Surfaces & Canvas */
  --bg-0: #0e0f11;       /* Deepest app background */
  --bg-1: #16181b;       /* Sidebar, header, panel backgrounds */
  --bg-2: #1c1f23;       /* Card backgrounds */
  --bg-3: #24282d;       /* Inputs, elevated boxes */
  --bg-4: #2d3238;       /* Hover states */

  /* Borders & Lines */
  --line: rgba(255, 255, 255, 0.075);
  --line-2: rgba(255, 255, 255, 0.13);

  /* Typography Colors */
  --text: #ECEEEF;       /* Principal headings and text */
  --text-2: #A4A8AD;     /* Secondary / muted text */
  --text-3: #6C7177;     /* Highly muted / label text */

  /* Mint Semantic Accent (Shielded / Private) */
  --mint: oklch(0.86 0.085 168);
  --mint-2: oklch(0.72 0.075 168);
  --mint-bg: oklch(0.86 0.085 168 / 0.12);
  --mint-line: oklch(0.86 0.085 168 / 0.30);

  /* Amber Semantic Accent (Public / Caution) */
  --amber: oklch(0.83 0.09 72);
  --amber-2: oklch(0.70 0.085 72);
  --amber-bg: oklch(0.83 0.09 72 / 0.11);
  --amber-line: oklch(0.83 0.09 72 / 0.28);

  /* Border Radii */
  --r-lg: 18px;
  --r-md: 13px;
  --r-sm: 9px;
  --r-pill: 999px;

  /* Fonts */
  --sans: "Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SF Mono", monospace;
}
```

---

## 3. Typography Rules
- **Schibsted Grotesk**: Main UI font for navigation, buttons, titles, and explanations.
- **JetBrains Mono**: Used for all cryptocurrency addresses, keys, transaction hashes, block indicators, and amounts (with `font-feature-settings: "tnum" 1` for tabular figures).

---

## 4. UI Components

### Cards (`.sl-card`)
- Background: `var(--bg-2)`
- Border: `1px solid var(--line)`
- Radius: `var(--r-lg)` (18px)
- Padding: `var(--sl-card-pad)` (22px)

### Buttons (`.sl-btn`)
- **Primary Button**: `background: var(--mint)`, `color: #04130d`. On hover: white-mixed mint. Used for confirmations (Shield, Claim).
- **Secondary/Ghost Button**: Transparent or `var(--bg-3)` background with `var(--line-2)` border. On hover: raised background.

### Chips (`.sl-chip`)
- Standard chip: Pill layout with `var(--line)` border.
- **Mint chip**: `color: var(--mint)`, `background: var(--mint-bg)`, `border: 1px solid var(--mint-line)`.
- **Amber chip**: `color: var(--amber)`, `background: var(--amber-bg)`, `border: 1px solid var(--amber-line)`.

### Form Inputs (`.sl-input`)
- Height: 46px, Radius: `var(--r-md)` (13px), Background: `var(--bg-3)`, Border: `var(--line-2)`. Focus border: `var(--mint-line)`.

---

## 5. Main Layout Structure
ShieldLink features a dual-layout structure:
1. **Landing Page**: Full screen landing page with a dark background, a looping abstract background video (`https://starkzap.io/hero-bg.mp4`), partners ticker, steps layout, comparison toggle, and FAQs.
2. **App Shell (`.sl-app`)**: A sidebar-driven workspace.
   - **Sidebar**: Fixed width 232px, `var(--bg-1)` background, containing the Logo, navigation entries, and Starknet Connection status box.
   - **Main Area**: `flex-grow` layout with 72px header and 30px content padding.

---

## 6. Copywriting & Screen Content
- **Shield Assets Page**: Move public assets into the private pool. Highlight "What shielding does" (Joins a shared pool, Hides your balance, Stays spendable) and the "Anonymity Set" progress indicator.
- **Send Page**: Create a private, one-time payment link. Emphasize "The key lives only in the link" (URL hash fragment is never sent to a server).
- **Claim Page**: Land from a link to withdraw privately via a relayer. The decryption key is processed locally to compile a zero-knowledge membership proof.
- **Unshield Page**: Withdraw private assets back to a public address. Warn that "This amount becomes public" but "The link to your shielded history stays hidden".
