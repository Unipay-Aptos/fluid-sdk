# Architecture Diagram

## System Overview

This system implements a cross-chain USDC transfer from Base Sepolia (EVM) to Aptos (Move) using the Wormhole Token Bridge protocol.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Cross-Chain Transfer Flow                        │
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
│  │  src/runTransferWormhole.ts                                     │  │
│  │  - Entry point                                                   │  │
│  │  - Orchestrates the full transfer flow                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/transferWormholeOnly.ts                                    │  │
│  │  - Main transfer orchestration                                  │  │
│  │  - Coordinates: Base transfer → VAA retrieval → Aptos submit  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         │                                       │
         │                                       │
         ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Base Sepolia Layer                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/wormholeBase.ts                                             │  │
│  │  - transferUsdcViaWormhole()                                     │  │
│  │  - Handles USDC approval                                         │  │
│  │  - Calls Wormhole Token Bridge contract                         │  │
│  │  - Extracts sequence number from events                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/wormholeContracts.ts                                       │  │
│  │  - Contract addresses (Base Sepolia testnet)                  │  │
│  │  - Token Bridge ABI                                            │  │
│  │  - Chain IDs                                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/helper.ts                                                   │  │
│  │  - getEvmSigner() - Creates ethers.js signer                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Wormhole Guardian Network                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Wormhole Guardians                                            │  │
│  │  - Observe transfer events on Base                            │  │
│  │  - Generate VAA (Verified Action Approval)                    │  │
│  │  - Multi-sig consensus (typically 1-2 minutes)                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/wormholeVaa.ts                                             │  │
│  │  - fetchVaaBySequence() - Query by sequence number            │  │
│  │  - fetchVaaByTxHash() - Query by transaction hash              │  │
│  │  - pollVaa() - Poll with exponential backoff                   │  │
│  │  - Uses Wormhole Scan API (testnet/mainnet)                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Aptos Layer                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/aptosIntegration.ts                                        │  │
│  │  - submitTokenBridgeVaa()                                       │  │
│  │  - Calls: token_bridge::complete_transfer::submit_vaa_entry    │  │
│  │  - Uses real Move code from /aptos/token_bridge/                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/helper.ts                                                   │  │
│  │  - getAptosSigner() - Creates Aptos SDK client & account        │  │
│  │  - Handles ed25519 private key format                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  /aptos/token_bridge/ (Wormhole Move Contracts)                 │  │
│  │  - Real Wormhole implementation                                 │  │
│  │  - complete_transfer.move                                        │  │
│  │  - Verifies VAA and mints/releases USDC                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Detailed Component Architecture

### 1. Configuration Layer

```
src/config.ts
├── Loads environment variables from .env.local
├── Base Sepolia RPC URL
├── Aptos RPC URL
├── Sponsor wallet private keys (Base & Aptos)
├── Network type (Testnet/Mainnet)
├── Aptos Token Bridge address
└── Aptos USDC coin type
```

### 2. Base Sepolia Transfer Flow

```
User Request
    │
    ▼
transferUsdcWithWormholeOnly()
    │
    ├─► getEvmSigner()
    │   └─► Creates ethers.js Wallet & Provider
    │
    ├─► transferUsdcViaWormhole()
    │   ├─► Check ETH balance (for gas)
    │   ├─► Check USDC balance
    │   ├─► Approve USDC to Token Bridge (if needed)
    │   ├─► Call TokenBridge.transferTokens()
    │   │   ├─► Parameters:
    │   │   │   - token: USDC contract address
    │   │   │   - amount: USDC amount (6 decimals)
    │   │   │   - recipientChain: 22 (Aptos)
    │   │   │   - recipient: Aptos address (bytes32)
    │   │   │   - arbiterFee: 0
    │   │   │   - nonce: 0
    │   │   └─► Returns: sequence number
    │   └─► Extract sequence from TransferTokens event
    │
    └─► Return: { txHash, sequence }
```

### 3. VAA Retrieval Flow

```
pollVaa(sequence, emitterChain, emitterAddress)
    │
    ├─► fetchVaaBySequence()
    │   └─► GET https://api.testnet.wormholescan.io/api/v1/vaas/{chain}/{emitter}/{sequence}
    │
    ├─► If not ready, wait with exponential backoff
    │   └─► Initial: 2s, Max: 30s, Max retries: 30
    │
    └─► Return: VAA hex string
```

### 4. Aptos Completion Flow

```
submitTokenBridgeVaa(aptosSigner, vaaBytes, coinType, feeRecipient, tokenBridgeAddress)
    │
    ├─► Convert VAA hex to Uint8Array
    │
    ├─► Build Move transaction:
    │   ├─► Module: {tokenBridgeAddress}::complete_transfer
    │   ├─► Function: submit_vaa_entry<CoinType>
    │   ├─► Type args: [USDC coin type]
    │   └─► Args: [vaa: vector<u8>, fee_recipient: address]
    │
    ├─► Generate transaction
    ├─► Sign transaction
    ├─► Submit transaction
    └─► Wait for confirmation
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
│  Step 1: Base Sepolia Transfer                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Input: 1.0 USDC                                         │ │
│  │ Process:                                                │ │
│  │   1. Approve USDC → Token Bridge                       │ │
│  │   2. transferTokens() → Lock USDC                       │ │
│  │   3. Emit TransferTokens event                          │ │
│  │ Output: { txHash, sequence }                           │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       │ txHash: 0x...
       │ sequence: 12345
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Wormhole Guardian Network                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Input: sequence number                                   │ │
│  │ Process:                                                │ │
│  │   1. Guardians observe TransferTokens event             │ │
│  │   2. Generate VAA (multi-sig)                           │ │
│  │   3. Publish to Wormhole network                        │ │
│  │ Output: VAA (hex string)                                │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       │ VAA: 0x010000000001...
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Aptos Completion                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Input: VAA bytes                                         │ │
│  │ Process:                                                │ │
│  │   1. Submit VAA to Token Bridge                         │ │
│  │   2. Token Bridge verifies VAA                          │ │
│  │   3. Mint/release USDC to recipient                     │ │
│  │ Output: Aptos transaction hash                          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       │ txHash: 0x...
       ▼
┌──────────────┐
│   Success   │
│ USDC on Aptos│
└──────────────┘
```

## Technology Stack

### Base Sepolia (EVM)
- **Language**: TypeScript
- **Library**: ethers.js v6
- **Network**: Base Sepolia Testnet
- **RPC**: https://sepolia.base.org

### Aptos (Move)
- **Language**: TypeScript + Move
- **Library**: @aptos-labs/ts-sdk v1.39.0
- **Network**: Aptos Testnet
- **RPC**: https://fullnode.testnet.aptoslabs.com/v1

### Wormhole
- **Protocol**: Wormhole Token Bridge
- **API**: Wormhole Scan API (testnet)
- **Guardians**: Multi-sig network (19 guardians)

## Key Contracts

### Base Sepolia
- **Token Bridge**: `0x86F55A04690fd7815A3D802bD587e83eA888B239`
- **Core**: `0x79A1027a6A159502049F10906D333EC57E95F083`
- **USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (verify)

### Aptos
- **Token Bridge**: `0x576410486a2da45eee6c949c995670112ddf2fbeedab20350d506328eefc9d4f`
- **USDC Coin Type**: `0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832::usdc::USDC`

## Security Considerations

1. **Private Keys**: Stored in `.env.local` (never committed)
2. **Sponsor Wallets**: Pay all gas fees (user doesn't sign)
3. **VAA Verification**: Aptos Token Bridge verifies VAA authenticity
4. **Multi-sig**: Wormhole guardians provide security through consensus
5. **Testnet Only**: All addresses and keys are for testnet

## Error Handling

- **Insufficient Funds**: Checks ETH and USDC balances before transfer
- **VAA Polling**: Exponential backoff with max retries
- **Transaction Failures**: Clear error messages with actionable steps
- **Network Issues**: Retry logic for API calls

## File Structure

```
src/
├── config.ts                 # Environment configuration
├── types.ts                  # TypeScript interfaces
├── helper.ts                 # Signer creation (EVM & Aptos)
├── wormholeContracts.ts      # Contract addresses & ABIs
├── wormholeBase.ts           # Base Sepolia transfer logic
├── wormholeVaa.ts            # VAA retrieval from guardians
├── aptosIntegration.ts       # Aptos Token Bridge integration
├── transferWormholeOnly.ts   # Main orchestration
└── runTransferWormhole.ts    # Entry point
```

## Sequence Diagram

```
User          App            Base          Guardians      Aptos
 │             │              │               │            │
 │─transfer───►│              │               │            │
 │             │─approve─────►│               │            │
 │             │◄─confirmed───│               │            │
 │             │─transfer────►│               │            │
 │             │◄─sequence────│               │            │
 │             │              │─event────────►│            │
 │             │              │               │            │
 │             │─poll─────────│               │            │
 │             │              │               │            │
 │             │              │               │─VAA───────►│
 │             │◄─VAA─────────│               │            │
 │             │─submit───────────────────────────────────►│
 │             │◄─confirmed─────────────────────────────────│
 │◄─success────│              │               │            │
```

