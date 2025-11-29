# CCTP Transfer Testing Guide

This guide walks you through testing the Base Sepolia → Aptos USDC transfer using Circle CCTP.

## 📋 Prerequisites

1. **Node.js 18+** installed
2. **Dependencies installed**: `npm install`
3. **Two wallets ready**:
   - Base Sepolia wallet (with private key)
   - Aptos wallet (with private key)

## 🔧 Step 1: Set Up Environment Variables

Create a `.env` or `.env.local` file in the project root:

```env
# REQUIRED: Base Sepolia Configuration
BASE_RPC_URL=https://sepolia.base.org
BASE_SPONSOR_PRIVATE_KEY=0x...your_base_private_key_here...

# REQUIRED: Aptos Testnet Configuration
APTOS_RPC_URL=https://fullnode.testnet.aptoslabs.com/v1
APTOS_SPONSOR_PRIVATE_KEY=ed25519-priv-0x...your_aptos_private_key_here...

# REQUIRED: Network Type
NETWORK_TYPE=Testnet
```

**Important Notes:**
- Base private key: Use format `0x...` or plain hex
- Aptos private key: Can be `ed25519-priv-0x...` or plain 64-char hex string
- These wallets will be used to initiate and complete transfers

## 💰 Step 2: Fund Your Wallets

### Base Sepolia Wallet Needs:
- ✅ **ETH** for gas fees (0.001 ETH should be plenty)
- ✅ **USDC testnet tokens** to transfer (minimum amount you want to test)

**Get Testnet Tokens:**
- **ETH**: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- **USDC**: Get from Circle testnet faucets or bridge from other testnets

### Aptos Wallet Needs:
- ✅ **APT** for gas fees (0.1 APT should be plenty)

**Get Testnet APT:**
- Aptos Testnet Faucet: https://faucet.testnet.aptoslabs.com/

## ✅ Step 3: Verify Your Setup

### Check Environment Variables

```bash
# The script will automatically check for required env vars
# If missing, you'll get clear error messages
```

### Verify Wallet Addresses

The script will print your wallet addresses when it starts:
```
✅ Base signer: 0x...
✅ Aptos signer: 0x...
```

Make sure these match your expected wallets.

## 🚀 Step 4: Run a Test Transfer

### Test with Small Amount (Recommended First Test)

```bash
# Transfer 0.1 USDC to your sponsor wallet (default recipient)
npx tsx src/runCctp.ts --amount 0.1
```

**What to Expect:**
1. SDK initialization messages
2. Signer initialization
3. Transfer initiation on Base Sepolia
4. Waiting for attestation (may take 1-3 minutes)
5. Transfer completion on Aptos
6. Success message with transaction hashes

### Expected Output (Success)

```
🚀 Starting CCTP Transfer (Base Sepolia → Aptos)
────────────────────────────────────────────────────────────
💰 Amount: 0.1 USDC
📬 Recipient: (using sponsor wallet)
────────────────────────────────────────────────────────────

🔑 Initializing Wormhole SDK with Testnet network...
✅ Wormhole SDK initialized
🔑 Initializing signers...
✅ Base signer: 0x...
✅ Aptos signer: 0x...
💰 Amount: 0.1 USDC (100000 smallest units)
📬 Recipient: 0x...
🚀 Starting CCTP Transfer...
📤 Initiating transfer on Base Sepolia...
✅ Sent Base transaction: 0x...
🕒 Waiting for Circle attestation (this may take 1-3 minutes)...
📜 Attestation received: ...
💸 Completing transfer on Aptos...
✅ Completed Aptos transaction: 0x...
🎉 Finalized! USDC delivered to Aptos.

────────────────────────────────────────────────────────────
✅ Transfer completed successfully!

📋 Transfer Details:
   Source TX: 0x...
   Attestation ID: ...
   Destination TX: 0x...

💸 USDC has been delivered to Aptos!
```

### Test with Custom Recipient

```bash
# Transfer to a specific Aptos address
npx tsx src/runCctp.ts --amount 0.5 --to 0xc3e2a21da9f68dcd3ad8668c8fb72ede9f46fea67652fbffa9db8f8af0c612cf
```

## 🔍 Step 5: Verify Transfer Success

### Check Base Sepolia Transaction

1. Copy the **Source TX** hash from the output
2. Visit: https://sepolia.basescan.org/tx/{SOURCE_TX}
3. Verify:
   - Transaction status: Success
   - USDC was transferred to CCTP contracts
   - Gas fees were paid

### Check Aptos Transaction

1. Copy the **Destination TX** hash from the output
2. Visit: https://explorer.aptoslabs.com/txn/{DESTINATION_TX}?network=testnet
3. Verify:
   - Transaction status: Success
   - USDC was minted/released
   - Recipient received the USDC

### Check Aptos Wallet Balance

1. Visit: https://explorer.aptoslabs.com/account/{APTOS_ADDRESS}?network=testnet
2. Look for USDC balance in your wallet
3. Verify the amount matches what you sent

## 🐛 Troubleshooting

### Error: "Missing required environment variable"

**Solution:**
- Check your `.env` or `.env.local` file exists
- Verify all required variables are set
- Make sure variable names are exactly as shown (case-sensitive)

### Error: "Insufficient USDC balance"

**Solution:**
- Check your Base Sepolia wallet has enough USDC
- Visit: https://sepolia.basescan.org/address/{YOUR_BASE_ADDRESS}
- Get more testnet USDC if needed

### Error: "Insufficient ETH/APT for gas"

**Solution:**
- Base Sepolia: Get ETH from faucet (see Step 2)
- Aptos: Get APT from faucet (see Step 2)

### Error: "Attestation not received after 180 seconds"

**Possible Causes:**
1. Circle's attestation service is slow (common)
2. Base Sepolia transaction hasn't been finalized yet
3. Network issues

**Solution:**
- Wait 5-10 minutes and check Base Sepolia transaction manually
- If transaction succeeded on Base, attestation should eventually be available
- Try running the transfer again (it's idempotent)
- Check Circle's attestation status: https://developers.circle.com/stablecoin/docs/cctp-technical-reference

### Error: "Invalid signer, not SignAndSendSigner or SignOnlySigner"

**Solution:**
- This should be fixed with the signer wrapping
- Make sure you've run `npm install` to get latest dependencies
- Check that `src/helper.ts` has the wrapper functions

### Error: "Network and chain not supported"

**Solution:**
- Make sure `NETWORK_TYPE=Testnet` is set in your `.env`
- Check that RPC URLs are correct

## 🧪 Test Scenarios

### Test 1: Small Amount (0.1 USDC)
```bash
npx tsx src/runCctp.ts --amount 0.1
```
**Purpose:** Verify basic functionality

### Test 2: Medium Amount (1.0 USDC)
```bash
npx tsx src/runCctp.ts --amount 1.0
```
**Purpose:** Test with larger amount

### Test 3: Custom Recipient
```bash
npx tsx src/runCctp.ts --amount 0.5 --to <different-aptos-address>
```
**Purpose:** Verify recipient address handling

### Test 4: Multiple Transfers
```bash
npx tsx src/runCctp.ts --amount 0.2
# Wait for completion, then:
npx tsx src/runCctp.ts --amount 0.2
```
**Purpose:** Verify sequential transfers work

## 📊 Monitoring Transfer Progress

### Real-Time Status

The script prints progress updates:
- ✅ SDK initialization
- ✅ Signer setup
- ✅ Base transaction sent
- ⏳ Attestation polling (with elapsed time)
- ✅ Aptos transaction completed

### Check Transaction Status

**Base Sepolia:**
- Explorer: https://sepolia.basescan.org/
- Search by transaction hash

**Aptos:**
- Explorer: https://explorer.aptoslabs.com/?network=testnet
- Search by transaction hash

## ✅ Success Criteria

A successful test means:
1. ✅ No errors during execution
2. ✅ Base Sepolia transaction succeeded (visible on explorer)
3. ✅ Circle attestation was retrieved
4. ✅ Aptos transaction succeeded (visible on explorer)
5. ✅ USDC appears in Aptos wallet balance
6. ✅ Amount matches what you sent

## 🎯 Quick Test Checklist

- [ ] `.env` file created with all required variables
- [ ] Base Sepolia wallet funded with ETH and USDC
- [ ] Aptos wallet funded with APT
- [ ] Run test: `npx tsx src/runCctp.ts --amount 0.1`
- [ ] Verify Base transaction on explorer
- [ ] Verify Aptos transaction on explorer
- [ ] Verify USDC in Aptos wallet

## 📞 Need Help?

If you encounter issues:
1. Check the error message carefully
2. Review the troubleshooting section above
3. Verify all prerequisites are met
4. Check transaction explorers for detailed error messages
5. Review the `CCTP_SETUP.md` file for setup details

## 🚀 Next Steps After Successful Test

Once your test succeeds:
1. Try different amounts
2. Test with different recipients
3. Test multiple sequential transfers
4. Monitor gas costs and timing
5. Consider adding error handling for production use

