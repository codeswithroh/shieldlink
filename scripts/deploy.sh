#!/bin/bash
# Helper script to deploy the compiled ShieldLink contract to Starknet Sepolia testnet using starkli.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "================================================================="
echo "   ShieldLink Contract Deployment Script via Starkli"
echo "================================================================="

# Ensure starkli is installed
if ! command -v starkli &> /dev/null; then
    echo "Error: starkli is not installed. Please install it first:"
    echo "curl https://get.starkli.sh | sh"
    exit 1
fi

# Path to compiled Sierra file
SIERRA_FILE="contracts/target/dev/shieldlink_ShieldLink.contract_class.json"

if [ ! -f "$SIERRA_FILE" ]; then
    echo "Error: Compiled Sierra contract class not found at:"
    echo "  $SIERRA_FILE"
    echo "Please run: cd contracts && scarb build"
    exit 1
fi

# Check variables
if [ -z "$STARKNET_ACCOUNT" ] || [ -z "$STARKNET_KEYSTORE" ]; then
    echo "Please set STARKNET_ACCOUNT and STARKNET_KEYSTORE environment variables."
    echo "Example:"
    echo "  export STARKNET_ACCOUNT=~/.starkli-wallets/deployer/account.json"
    echo "  export STARKNET_KEYSTORE=~/.starkli-wallets/deployer/keystore.json"
    echo ""
    echo "Would you like to continue in interactive mode? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        exit 1
    fi
fi

echo "1. Declaring the contract class..."
# Declare and capture class hash
CLASS_HASH=$(starkli declare "$SIERRA_FILE" --network sepolia)
echo "Contract class declared! Class Hash: $CLASS_HASH"

echo ""
echo "2. Deploying the contract instance..."
# Deploy contract with no constructor arguments
CONTRACT_ADDRESS=$(starkli deploy "$CLASS_HASH" --network sepolia)

echo ""
echo "================================================================="
echo "   SUCCESS!"
echo "   Contract Address: $CONTRACT_ADDRESS"
echo "   Copy this address and paste it into the DApp settings panel!"
echo "================================================================="
