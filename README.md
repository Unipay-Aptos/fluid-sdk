# Cross-Chain USDC Transfer: Base Sepolia → Aptos

A Node.js + TypeScript backend service for transferring USDC from Base Sepolia (EVM) to Aptos (Move) using the Wormhole Token Bridge protocol.

## Overview

This project implements a complete cross-chain transfer flow where:
- **Source Chain**: Base Sepolia (EVM-compatible)
- **Destination Chain**: Aptos (Move-based)
- **Protocol**: Wormhole Token Bridge
- **Token**: USDC (6 decimals)

The service uses sponsor wallets to pay all gas fees, so users don't need to sign any on-chain transactions.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system architecture and data flow diagrams.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Base Sepolia testnet wallet with ETH and USDC
- Aptos testnet wallet with APT

### Installation

```bash
npm install
```

### Configuration

Create a `.env.local` file:

```env
# Base Sepolia Testnet
BASE_RPC_URL=https://sepolia.base.org
BASE_SPONSOR_PRIVATE_KEY=0x...

# Aptos Testnet
APTOS_RPC_URL=https://fullnode.testnet.aptoslabs.com/v1
APTOS_SPONSOR_PRIVATE_KEY=ed25519-priv-0x...

# Network Type
NETWORK_TYPE=Testnet

# Aptos Token Bridge (required)
APTOS_TOKEN_BRIDGE_ADDRESS=0x576410486a2da45eee6c949c995670112ddf2fbeedab20350d506328eefc9d4f

# Aptos USDC Coin Type (required)
APTOS_USDC_COIN_TYPE=0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832::usdc::USDC
```

### Run Transfer

```bash
npx tsx src/runTransferWormhole.ts
```

## How It Works

1. **Base Sepolia Transfer**
   - Approves USDC to Wormhole Token Bridge
   - Calls `transferTokens()` to lock USDC
   - Gets sequence number from transaction event

2. **VAA Generation**
   - Wormhole guardians observe the transfer
   - Generate VAA (Verified Action Approval) via multi-sig
   - Typically takes 1-2 minutes

3. **Aptos Completion**
   - Polls Wormhole API for VAA
   - Submits VAA to Aptos Token Bridge
   - Token Bridge verifies and mints/releases USDC

## Project Structure

```
src/
├── config.ts                 # Environment configuration
├── types.ts                  # TypeScript interfaces
├── helper.ts                 # Signer creation utilities
├── wormholeContracts.ts      # Contract addresses & ABIs
├── wormholeBase.ts           # Base Sepolia transfer logic
├── wormholeVaa.ts            # VAA retrieval from guardians
├── aptosIntegration.ts       # Aptos Token Bridge integration
├── transferWormholeOnly.ts  # Main orchestration
└── runTransferWormhole.ts    # Entry point
```

## Key Features

- ✅ **Sponsor Wallet Model**: All gas fees paid by sponsor wallets
- ✅ **Error Handling**: Comprehensive checks for balances, approvals, and network issues
- ✅ **VAA Polling**: Automatic retry with exponential backoff
- ✅ **Real Move Integration**: Uses actual Wormhole Move contracts from `/aptos`
- ✅ **Type Safety**: Full TypeScript implementation

## Contract Addresses

### Base Sepolia Testnet
- **Token Bridge**: `0x86F55A04690fd7815A3D802bD587e83eA888B239`
- **Core**: `0x79A1027a6A159502049F10906D333EC57E95F083`
- **USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (verify)

### Aptos Testnet
- **Token Bridge**: `0x576410486a2da45eee6c949c995670112ddf2fbeedab20350d506328eefc9d4f`
- **USDC Coin Type**: `0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832::usdc::USDC`

## Troubleshooting

### "Insufficient ETH for gas fees"
- Get Base Sepolia ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

### "Insufficient USDC balance"
- You need testnet USDC on Base Sepolia

### "VAA not ready after X retries"
- VAA generation typically takes 1-2 minutes
- Check transaction on Wormhole Scan: https://testnet.wormholescan.io

### "Could not find TransferTokens event"
- The code will fall back to querying VAA by transaction hash
- This is normal and will still work

## Development

### Build

```bash
npm run build
```

### Type Checking

```bash
npx tsc --noEmit
```

## License

MIT
