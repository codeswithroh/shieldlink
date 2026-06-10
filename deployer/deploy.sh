#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# ShieldLink — Sepolia Deployment Script
# Requires: starkli 0.4+, scarb 2.16+
# Fund deployer before running:
#   https://starknet-faucet.vercel.app
#   Address: 0x0714241cbb9d97874f28399063c6c5946659c4ad78b34a0b730dbbf113a9c1d8
# ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTRACT_DIR="$PROJECT_DIR/contracts"
HOOK_SRC="$PROJECT_DIR/src/hooks/useStarknetState.ts"

source "$SCRIPT_DIR/env.sh"

RPC="$STARKNET_RPC"
ACCOUNT="$STARKNET_ACCOUNT"
KEY="$STARKNET_KEYSTORE_PRIVATE_KEY"
DEPLOYER="$DEPLOYER_ADDRESS"

echo "=== ShieldLink Deployment ==="
echo "RPC     : $RPC"
echo "Deployer: $DEPLOYER"

# 1. Check STRK balance via RPC
echo ""
echo "[ 1/5 ] Checking deployer STRK balance..."
BALANCE_JSON=$(curl -sf -X POST "$RPC" \
  -H "Content-Type: application/json" \
  --data-binary @- <<EOF
{"jsonrpc":"2.0","method":"starknet_call","params":{"request":{"contract_address":"0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d","entry_point_selector":"0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e","calldata":["$DEPLOYER"]},"block_id":"latest"},"id":1}
EOF
)
BALANCE=$(python3 -c "
import json, sys
r = json.loads('$BALANCE_JSON')
low = int(r['result'][0], 16)
high = int(r['result'][1], 16) if len(r['result']) > 1 else 0
bal = (high << 128) + low
print(f'{bal / 1e18:.4f}')
")
echo "Balance: $BALANCE STRK"

if python3 -c "import sys; sys.exit(0 if float('$BALANCE') >= 0.01 else 1)"; then
  echo "✓ Balance sufficient"
else
  echo ""
  echo "✗ Deployer needs STRK. Please fund it:"
  echo ""
  echo "  1. Open: https://starknet-faucet.vercel.app"
  echo "  2. Paste: $DEPLOYER"
  echo "  3. Click 'Send Request STRK'  (gives 50 STRK)"
  echo "  4. Re-run this script"
  exit 1
fi

# 2. Build contract
echo ""
echo "[ 2/5 ] Building contract..."
cd "$CONTRACT_DIR"
scarb build
echo "✓ Contract built"

# 3. Deploy OZ account (idempotent)
echo ""
echo "[ 3/5 ] Deploying OZ account..."
ACCT_STATUS=$(python3 -c "import json; print(json.load(open('$ACCOUNT'))['deployment']['status'])")
if [ "$ACCT_STATUS" = "deployed" ]; then
  echo "✓ Already deployed"
else
  starkli account deploy "$ACCOUNT" \
    --rpc "$RPC" \
    --private-key "$KEY"
  echo "✓ Account deployed"
fi

# 4. Declare contract class
echo ""
echo "[ 4/5 ] Declaring contract class..."
DECLARE_OUT=$(starkli declare \
  "$CONTRACT_DIR/target/dev/shieldlink_ShieldLink.contract_class.json" \
  --rpc "$RPC" \
  --account "$ACCOUNT" \
  --private-key "$KEY" \
  --fee-token strk \
  --watch 2>&1 || true)
CLASS_HASH=$(echo "$DECLARE_OUT" | grep -oP '0x[0-9a-f]+' | tail -1)
echo "✓ Class hash: $CLASS_HASH"

# 5. Deploy contract instance
echo ""
echo "[ 5/5 ] Deploying ShieldLink instance..."
DEPLOY_OUT=$(starkli deploy \
  "$CLASS_HASH" \
  --rpc "$RPC" \
  --account "$ACCOUNT" \
  --private-key "$KEY" \
  --fee-token strk \
  --salt 0x1 \
  --watch 2>&1)
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUT" | grep -oP '0x[0-9a-f]+' | tail -1)
echo "✓ Contract: $CONTRACT_ADDRESS"

# 6. Patch the default address in the hook
echo ""
echo "[ ✓ ] Patching app config..."
OLD_LINE="return saved || '0x[0-9a-f]*';"
NEW_LINE="return saved || '$CONTRACT_ADDRESS';"
sed -i.bak -E "s|$OLD_LINE|$NEW_LINE|" "$HOOK_SRC" && rm -f "$HOOK_SRC.bak"
echo "✓ Updated $HOOK_SRC"

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  Deployment complete!                         ║"
echo "╠═══════════════════════════════════════════════╣"
printf  "║  Contract: %-35s ║\n" "$CONTRACT_ADDRESS"
echo "║                                               ║"
echo "║  App already running → http://localhost:5174  ║"
echo "╚═══════════════════════════════════════════════╝"
