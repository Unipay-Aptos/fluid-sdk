# Cross-Chain USDC Transfer: Base Sepolia → Aptos via Circle CCTP

A Node.js + TypeScript backend service for transferring USDC from **Base Sepolia (EVM)** to **Aptos (Move)** using **Circle CCTP (Cross-Chain Transfer Protocol)** via the **Wormhole SDK**. This is the same method that Portal Bridge uses and is the only method that works for Base Sepolia → Aptos transfers.

## Overview

This project implements a complete cross-chain transfer flow where:
- **Source Chain**: Base Sepolia (EVM-compatible)
- **Destination Chain**: Aptos (Move-based)
- **Protocol**: Circle CCTP via Wormhole SDK
- **Token**: USDC (6 decimals)

The service uses sponsor wallets to pay all gas fees, so users don't need to sign any on-chain transactions.

## Why CCTP?

**Important**: The traditional Wormhole Token Bridge (message_type = 1) does **NOT** work for Base Sepolia → Aptos transfers. Portal Bridge UI succeeds only because it uses Circle CCTP → Wormhole Attestation → Aptos completion. This implementation replicates that exact flow.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system architecture, data flow diagrams, and component descriptions.

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

Create a `.env.local` or `.env` file:

```env
# REQUIRED: Base Sepolia Testnet
BASE_RPC_URL=https://sepolia.base.org
BASE_SPONSOR_PRIVATE_KEY=0x...your_private_key_here...

# REQUIRED: Aptos Testnet  
APTOS_RPC_URL=https://fullnode.testnet.aptoslabs.com/v1
APTOS_SPONSOR_PRIVATE_KEY=ed25519-priv-0x...your_private_key_here...

# REQUIRED: Network Type
NETWORK_TYPE=Testnet
```

**Note**: Contract addresses are automatically handled by the Wormhole SDK. No manual configuration needed.

### Run Transfer

```bash
# Transfer 1.0 USDC (uses sponsor wallet as recipient)
npx tsx src/runCctp.ts --amount 1.0

# Transfer 0.5 USDC to a specific Aptos address
npx tsx src/runCctp.ts --amount 0.5 --to 0xc3e2a21da9f68dcd3ad8668c8fb72ede9f46fea67652fbffa9db8f8af0c612cf
```

## How It Works

1. **Initiate Transfer on Base Sepolia**
   - SDK creates CircleTransfer object via Wormhole SDK
   - Calls Circle TokenMessenger contract
   - Burns/locks USDC on Base Sepolia
   - MessageTransmitter sends message to Circle

2. **Circle Attestation**
   - Circle observes the transfer event
   - Generates cryptographically signed attestation
   - Typically available within 1-3 minutes
   - SDK polls Circle Attestation API automatically

3. **Complete Transfer on Aptos**
   - SDK retrieves Circle attestation
   - Calls Circle CCTP contracts on Aptos
   - Verifies attestation and mints/releases USDC
   - USDC appears in recipient's Aptos wallet

## Project Structure

```
src/
├── config.ts                 # Environment configuration
├── types.ts                  # TypeScript interfaces
├── helper.ts                 # Signer creation & SDK wrapping utilities
│   ├── getEvmSigner()        # Creates raw EVM signer
│   ├── getAptosSigner()      # Creates raw Aptos signer
│   ├── toEvmSdkSigner()      # Wraps EVM signer for SDK
│   └── toAptosSdkSigner()    # Wraps Aptos signer for SDK
├── cctpTransfer.ts           # Main CCTP transfer logic
│   └── transferUsdcViaCctp() # Complete CCTP flow
└── runCctp.ts                # CLI entry point
```

## Key Features

- ✅ **Circle CCTP Integration**: Uses Circle's Cross-Chain Transfer Protocol
- ✅ **Wormhole SDK**: Leverages official Wormhole SDK for CCTP support
- ✅ **Sponsor Wallet Model**: All gas fees paid by sponsor wallets
- ✅ **Automatic Attestation Polling**: SDK handles Circle attestation retrieval
- ✅ **Error Handling**: Comprehensive checks and clear error messages
- ✅ **Type Safety**: Full TypeScript implementation

## Technology Stack

- **Wormhole SDK**: `@wormhole-foundation/sdk` v4.0.2
- **EVM SDK**: `@wormhole-foundation/sdk-evm` v4.0.2
- **Aptos SDK**: `@wormhole-foundation/sdk-aptos` v4.0.2
- **CCTP SDKs**: `@wormhole-foundation/sdk-evm-cctp` & `@wormhole-foundation/sdk-aptos-cctp` v4.0.2
- **ethers.js**: v6.9.0 - EVM blockchain interactions
- **@aptos-labs/ts-sdk**: v1.8.0 - Aptos blockchain interactions

## Contract Addresses

Contract addresses are automatically managed by the Wormhole SDK. The SDK uses the correct Circle CCTP contracts for testnet/mainnet without manual configuration.

### Chain IDs
- **Base Sepolia**: Wormhole Chain ID 30
- **Aptos**: Wormhole Chain ID 22

## Documentation

- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed system design
- **Setup Guide**: [CCTP_SETUP.md](./CCTP_SETUP.md) - Configuration instructions
- **Testing Guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Comprehensive testing instructions

## Troubleshooting

### "Missing required environment variable"
- Ensure your `.env.local` or `.env` file contains all required variables
- See [CCTP_SETUP.md](./CCTP_SETUP.md) for the complete list

### "Insufficient ETH for gas fees"
- Get Base Sepolia ETH from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

### "Insufficient USDC balance"
- You need testnet USDC on Base Sepolia to transfer

### "Insufficient APT for gas fees"
- Get Aptos testnet APT from: https://faucet.devnet.aptoslabs.com/

### "Attestation not received after 180 seconds"
- Circle's attestation service can sometimes be slow (up to 5-10 minutes)
- Check the Base Sepolia transaction on the explorer
- If the source transaction is confirmed, the attestation should eventually appear
- Try running the transfer again after a few minutes

For more troubleshooting tips, see [TESTING_GUIDE.md](./TESTING_GUIDE.md).

## Development

### Build

```bash
npm run build
```

### Type Checking

```bash
npx tsc --noEmit
```

## Key Differences from TokenBridge

| Aspect | TokenBridge (Old) | CCTP (Current) |
|--------|-------------------|----------------|
| **Protocol** | Wormhole Token Bridge | Circle CCTP via Wormhole |
| **Message Type** | VAA (Verified Action Approval) | Circle Attestation |
| **Base Sepolia → Aptos** | ❌ Not supported | ✅ Supported |
| **Attestation Source** | Wormhole Guardians | Circle Infrastructure |
| **Speed** | 1-2 minutes | 1-3 minutes |

## License

MIT
