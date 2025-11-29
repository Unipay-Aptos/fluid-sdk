# Architecture Documentation

## System Overview

This system implements a cross-chain USDC transfer from **Base Sepolia (EVM)** to **Aptos (Move)** using **Circle CCTP (Cross-Chain Transfer Protocol)** via the **Wormhole SDK**. This is the method that Portal Bridge uses and is the only method that works for Base Sepolia → Aptos transfers.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CCTP Cross-Chain Transfer Flow                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐                    ┌─────────────────┐
│   Base Sepolia  │                    │     Aptos       │
│    (EVM)        │                    │    (Move)       │
└─────────────────┘                    └─────────────────┘
         │                                       │
         │                                       │
         ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Application Layer                              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/runCctp.ts                                                 │  │
│  │  - CLI entry point                                              │  │
│  │  - Parses command-line arguments (--amount, --to)              │  │
│  │  - Calls transferUsdcViaCctp()                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/cctpTransfer.ts                                            │  │
│  │  - Main CCTP transfer orchestration                             │  │
│  │  - Coordinates: Initiate → Attestation → Complete               │  │
│  │  - Uses Wormhole SDK CircleTransfer API                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         │                                       │
         │                                       │
         ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Wormhole SDK Layer                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Wormhole SDK (CircleTransfer)                                  │  │
│  │  - wh.circleTransfer() - Creates transfer object               │  │
│  │  - initiateTransfer() - Starts transfer on Base                │  │
│  │  - fetchAttestation() - Retrieves Circle attestation           │  │
│  │  - completeTransfer() - Completes transfer on Aptos            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         │                                       │
         │                                       │
         ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Base Sepolia Layer                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Circle CCTP Contracts                                          │  │
│  │  - TokenMessenger - Initiates USDC burn/lock                    │  │
│  │  - MessageTransmitter - Sends message to Circle                 │  │
│  │  - SDK handles all contract interactions automatically          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/helper.ts                                                   │  │
│  │  - getEvmSigner() - Creates ethers.js signer                    │  │
│  │  - toEvmSdkSigner() - Wraps signer for SDK                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Circle Attestation Service                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Circle CCTP Attestation                                       │  │
│  │  - Observes MessageTransmitter events                         │  │
│  │  - Generates attestation (signed message)                     │  │
│  │  - Typically available within 1-3 minutes                     │  │
│  │  - SDK polls Circle API automatically                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Aptos Layer                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Circle CCTP Contracts (via Wormhole SDK)                      │  │
│  │  - Completes transfer using Circle attestation                 │  │
│  │  - Mints/releases USDC on Aptos                                │  │
│  │  - SDK handles all Move contract interactions automatically    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/helper.ts                                                   │  │
│  │  - getAptosSigner() - Creates Aptos SDK client & account       │  │
│  │  - toAptosSdkSigner() - Wraps account for SDK                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Detailed Component Architecture

### 1. Configuration Layer

```
src/config.ts
├── Loads environment variables from .env.local or .env
├── BASE_RPC_URL - Base Sepolia RPC endpoint
├── APTOS_RPC_URL - Aptos Testnet RPC endpoint
├── BASE_SPONSOR_PRIVATE_KEY - EVM wallet private key
├── APTOS_SPONSOR_PRIVATE_KEY - Aptos wallet private key
└── NETWORK_TYPE - "Testnet" or "Mainnet"
```

### 2. CCTP Transfer Flow

```
transferUsdcViaCctp(request)
    │
    ├─► Initialize Wormhole SDK
    │   ├─► Network: Testnet/Mainnet
    │   ├─► Platforms: [evm, aptos]
    │   └─► Chain configs (RPC URLs)
    │
    ├─► Create Signers
    │   ├─► getEvmSigner() → baseSigner
    │   │   └─► Creates ethers.js Wallet & Provider
    │   └─► getAptosSigner() → aptosSigner
    │       └─► Creates Aptos Account & Client
    │
    ├─► Create CircleTransfer Object
    │   ├─► wh.circleTransfer(amount, sender, receiver, manual, undefined, 0n)
    │   ├─► Uses ChainAddress objects
    │   └─► SDK handles contract addresses automatically
    │
    ├─► Step 1: Initiate Transfer (Base Sepolia)
    │   ├─► Wrap signer: toEvmSdkSigner(baseSigner.signer)
    │   ├─► circleTransfer.initiateTransfer(baseSdkSigner)
    │   │   ├─► SDK calls Circle TokenMessenger contract
    │   │   ├─► Burns/locks USDC on Base
    │   │   └─► Emits message to Circle
    │   └─► Returns: Base transaction hash
    │
    ├─► Step 2: Fetch Attestation
    │   ├─► circleTransfer.fetchAttestation(180000ms timeout)
    │   │   ├─► SDK polls Circle Attestation API
    │   │   ├─► Waits for Circle to sign message
    │   │   └─► Returns attestation ID when ready
    │   └─► Typically takes 1-3 minutes
    │
    └─► Step 3: Complete Transfer (Aptos)
        ├─► Wrap signer: toAptosSdkSigner(aptosSigner.account, ...)
        ├─► circleTransfer.completeTransfer(aptosSdkSigner)
        │   ├─► SDK calls Circle CCTP contracts on Aptos
        │   ├─► Verifies Circle attestation
        │   └─► Mints/releases USDC to recipient
        └─► Returns: Aptos transaction hash
```

### 3. Signer Wrapping (SDK Integration)

```
Raw Signers                      SDK Wrappers
    │                                │
    ├─► ethers.Wallet               ├─► SignAndSendSigner<N, Chain>
    │   └─► baseSigner.signer       │   └─► toEvmSdkSigner()
    │                               │
    └─► Aptos Account               └─► AptosSigner<N, Chain>
        └─► aptosSigner.account         └─► toAptosSdkSigner()

Purpose:
- SDK requires wrapped signers that implement Signer interface
- Wrappers provide chain context and broadcast methods
- Enables SDK to handle transactions automatically
```

## Data Flow

```
┌──────────────┐
│  User Input  │
│  - Amount    │
│  - Recipient │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Initialize & Create Transfer Object                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Process:                                                │ │
│  │   1. Initialize Wormhole SDK                           │ │
│  │   2. Create EVM & Aptos signers                        │ │
│  │   3. Wrap signers for SDK compatibility                │ │
│  │   4. Create ChainAddress objects                       │ │
│  │   5. wh.circleTransfer() creates transfer object       │ │
│  │ Output: CircleTransfer object                          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Initiate Transfer on Base Sepolia                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Input: CircleTransfer object, wrapped EVM signer        │ │
│  │ Process:                                                │ │
│  │   1. SDK calls Circle TokenMessenger contract          │ │
│  │   2. Approves USDC (if needed)                         │ │
│  │   3. Burns/locks USDC on Base Sepolia                  │ │
│  │   4. MessageTransmitter sends message to Circle        │ │
│  │ Output: { txHash: "0x..." }                            │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       │ txHash: 0x...
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Wait for Circle Attestation                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Input: CircleTransfer object                            │ │
│  │ Process:                                                │ │
│  │   1. SDK polls Circle Attestation API                  │ │
│  │   2. Circle observes MessageTransmitter event          │ │
│  │   3. Circle signs attestation (automatic)              │ │
│  │   4. SDK retrieves attestation when ready              │ │
│  │ Output: { attestationId: "..." }                        │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       │ attestationId: ...
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Complete Transfer on Aptos                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Input: CircleTransfer object, attestation, wrapped signer│ │
│  │ Process:                                                │ │
│  │   1. SDK calls Circle CCTP contracts on Aptos          │ │
│  │   2. Verifies Circle attestation                       │ │
│  │   3. Mints/releases USDC to recipient                  │ │
│  │ Output: { txHash: "0x..." }                            │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       │ txHash: 0x...
       ▼
┌──────────────┐
│   Success    │
│ USDC on Aptos│
└──────────────┘
```

## Technology Stack

### Core Libraries
- **Wormhole SDK**: `@wormhole-foundation/sdk` v4.0.2
  - Provides Circle CCTP integration
  - Handles chain abstractions
  - Manages contract interactions

### Platform SDKs
- **EVM SDK**: `@wormhole-foundation/sdk-evm` v4.0.2
  - Base Sepolia chain support
  - Signer wrappers for EVM chains
- **Aptos SDK**: `@wormhole-foundation/sdk-aptos` v4.0.2
  - Aptos chain support
  - Signer wrappers for Aptos

### CCTP Integration
- **EVM CCTP**: `@wormhole-foundation/sdk-evm-cctp` v4.0.2
  - Circle CCTP contracts on EVM chains
- **Aptos CCTP**: `@wormhole-foundation/sdk-aptos-cctp` v4.0.2
  - Circle CCTP contracts on Aptos

### Base Libraries
- **ethers.js**: v6.9.0 - EVM blockchain interactions
- **@aptos-labs/ts-sdk**: v1.8.0 - Aptos blockchain interactions

### Network Configuration
- **Base Sepolia Testnet**: Chain ID 84532 (Wormhole Chain ID: 30)
- **Aptos Testnet**: Chain ID 22

## Key Contracts (Handled by SDK)

The SDK automatically uses the correct Circle CCTP contract addresses for testnet/mainnet. No manual contract configuration is required.

### Base Sepolia (Testnet)
- **USDC**: Managed by SDK
- **TokenMessenger**: Managed by SDK
- **MessageTransmitter**: Managed by SDK

### Aptos (Testnet)
- **Circle CCTP Contracts**: Managed by SDK
- **USDC**: Managed by SDK

## Security Considerations

1. **Private Keys**: Stored in `.env.local` (never committed to git)
2. **Sponsor Wallets**: Pay all gas fees on both chains
3. **Circle Attestations**: Cryptographically signed by Circle's infrastructure
4. **SDK Validation**: Wormhole SDK validates all inputs and contract interactions
5. **Testnet Only**: All default configurations are for testnet

## Error Handling

### Balance Checks
- **Insufficient ETH**: Checked before initiating transfer on Base
- **Insufficient USDC**: Checked before initiating transfer
- **Insufficient APT**: Checked before completing transfer on Aptos

### Attestation Polling
- **Timeout**: 180 seconds maximum wait time
- **Error Handling**: Clear error messages with actionable steps
- **Retry Logic**: Built into SDK's fetchAttestation method

### Transaction Failures
- **Clear Messages**: Specific error descriptions
- **Actionable Steps**: Instructions on how to resolve issues
- **Network Issues**: SDK handles retries automatically

## File Structure

```
src/
├── config.ts                 # Environment configuration
├── types.ts                  # TypeScript interfaces
├── helper.ts                 # Signer creation & SDK wrapping
│   ├── getEvmSigner()        # Creates raw EVM signer
│   ├── getAptosSigner()      # Creates raw Aptos signer
│   ├── toEvmSdkSigner()      # Wraps EVM signer for SDK
│   └── toAptosSdkSigner()    # Wraps Aptos signer for SDK
├── cctpTransfer.ts           # Main CCTP transfer logic
│   └── transferUsdcViaCctp() # Complete CCTP flow
└── runCctp.ts                # CLI entry point
```

## Sequence Diagram

```
User          App            SDK             Base        Circle        Aptos
 │             │              │               │            │            │
 │─transfer───►│              │               │            │            │
 │             │─init SDK────►│               │            │            │
 │             │─create──────►│               │            │            │
 │             │  transfer    │               │            │            │
 │             │              │─initiate──────►│            │            │
 │             │              │               │─lock USDC  │            │
 │             │              │               │─message───►│            │
 │             │              │◄─txHash───────│            │            │
 │             │              │               │            │            │
 │             │─poll────────►│               │            │            │
 │             │              │─get attest───►│            │            │
 │             │              │               │            │─sign──────►│
 │             │              │◄─attest───────│            │            │
 │             │              │               │            │            │
 │             │─complete────►│               │            │            │
 │             │              │───────────────────────────────────────►│
 │             │              │               │            │            │─verify
 │             │              │               │            │            │─mint
 │             │              │◄─txHash───────────────────────────────────│
 │◄─success────│              │               │            │            │
```

## Key Differences from TokenBridge

| Aspect | TokenBridge (Old) | CCTP (Current) |
|--------|-------------------|----------------|
| **Protocol** | Wormhole Token Bridge | Circle CCTP via Wormhole |
| **Message Type** | VAA (Verified Action Approval) | Circle Attestation |
| **Guardians** | Wormhole Guardians (19) | Circle Infrastructure |
| **Retrieval** | Poll Guardian RPC/Scan API | Poll Circle Attestation API |
| **Aptos Completion** | token_bridge::complete_transfer | Circle CCTP contracts (via SDK) |
| **Speed** | 1-2 minutes | 1-3 minutes |
| **Base Sepolia → Aptos** | ❌ Not supported | ✅ Supported |

## Implementation Details

### Signer Wrapping

The SDK requires wrapped signers that implement specific interfaces:

```typescript
// EVM Signer Wrapping
const baseSdkSigner = await toEvmSdkSigner(baseSigner.signer);
// → Returns: SignAndSendSigner<Network, EvmChains>

// Aptos Signer Wrapping  
const aptosSdkSigner = toAptosSdkSigner(
  aptosSigner.account,
  aptosSigner.client,
  "Aptos"
);
// → Returns: AptosSigner<Network, AptosChains>
```

### Chain Address Format

The SDK uses `ChainAddress` objects for cross-chain addressing:

```typescript
const senderAddress = Wormhole.chainAddress("BaseSepolia", baseAddress);
const receiverAddress = Wormhole.chainAddress("Aptos", aptosAddress);
```

### Amount Formatting

USDC uses 6 decimals:
```typescript
const amountBigInt = BigInt(Math.floor(parseFloat("1.0") * 1_000_000));
// "1.0" USDC → 1000000 smallest units
```

## Testing

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for comprehensive testing instructions.

## Additional Resources

- **CCTP Setup**: [CCTP_SETUP.md](./CCTP_SETUP.md)
- **Testing Guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Circle CCTP Docs**: https://developers.circle.com/stablecoin/docs/cctp-technical-reference
- **Wormhole SDK Docs**: https://github.com/wormhole-foundation/wormhole-sdk-ts
