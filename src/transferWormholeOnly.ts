/**
 * Wormhole-Only Transfer Implementation
 * 
 * This is a simpler approach that uses Wormhole token bridge directly
 * instead of trying to convert between CCTP and Wormhole.
 * 
 * Flow:
 * 1. Transfer USDC on Base using Wormhole Token Bridge
 * 2. Get Wormhole VAA from guardians
 * 3. Submit VAA to Aptos Token Bridge
 */

import { config } from './config';
import { getEvmSigner, getAptosSigner } from './helper';
import { TransferRequest, TransferResult } from './types';
import { transferUsdcViaWormhole } from './wormholeBase';
import { pollVaa } from './wormholeVaa';
import { submitTokenBridgeVaa } from './aptosIntegration';
import { WORMHOLE_CONTRACTS, WORMHOLE_CHAIN_IDS } from './wormholeContracts';

/**
 * Performs a complete USDC cross-chain transfer from Base Sepolia to Aptos using Wormhole
 * 
 * @param request - Transfer request parameters
 * @param maxRetries - Maximum number of retries for VAA polling
 * @param initialBackoff - Initial backoff delay in ms
 * @returns Transfer result with transaction hashes
 */
export async function transferUsdcWithWormholeOnly(
  request: TransferRequest,
  maxRetries: number = 30,
  initialBackoff: number = 2000
): Promise<TransferResult> {
  try {
    console.log('🚀 Starting Wormhole-only transfer (Base Sepolia → Aptos)');
    console.log(`📡 Network: ${config.networkType}`);
    console.log(`💰 Amount: ${request.transferAmount} USDC`);
    console.log('─'.repeat(60));
    
    // Step 1: Get signers
    console.log('\n🔑 Initializing signers...');
    const baseSigner = getEvmSigner(config.baseRpcUrl, config.baseSponsorPrivateKey);
    const aptosSigner = await getAptosSigner(config.aptosRpcUrl, config.aptosSponsorPrivateKey);
    
    console.log(`✅ Base signer: ${baseSigner.address}`);
    console.log(`✅ Aptos signer: ${aptosSigner.address}`);
    
    // Determine recipient (default to sponsor wallet)
    const recipientAddress = request.recipientAddress || aptosSigner.address;
    console.log(`📬 Recipient: ${recipientAddress}`);
    
    // Step 2: Transfer USDC on Base Sepolia via Wormhole Token Bridge
    console.log('\n🔥 Step 1: Transferring USDC via Wormhole Token Bridge on Base Sepolia...');
    
    const transferResult = await transferUsdcViaWormhole(
      baseSigner,
      request.transferAmount,
      recipientAddress
    );
    
    console.log(`✅ Transfer transaction: ${transferResult.txHash}`);
    console.log(`📝 Sequence: ${transferResult.sequence}`);
    
    // Step 3: Poll for VAA from Wormhole guardians
    console.log('\n⏳ Step 2: Waiting for Wormhole VAA...');
    
    const tokenBridgeAddress = WORMHOLE_CONTRACTS.testnet.baseSepolia.tokenBridge;
    const emitterChain = WORMHOLE_CHAIN_IDS.baseSepolia;
    
    let vaaHex: string;
    
    // If sequence is 0, try querying by transaction hash
    if (transferResult.sequence === BigInt(0)) {
      console.log('📝 Sequence not found, querying VAA by transaction hash...');
      const { fetchVaaByTxHash } = await import('./wormholeVaa');
      const { pollVaa } = await import('./wormholeVaa');
      
      // Try fetching by tx hash first
      let vaa = await fetchVaaByTxHash(transferResult.txHash, emitterChain);
      
      if (!vaa) {
        // If not ready, poll with exponential backoff
        console.log('⏳ VAA not ready yet, polling...');
        let retries = 0;
        let backoff = initialBackoff;
        
        while (retries < maxRetries) {
          vaa = await fetchVaaByTxHash(transferResult.txHash, emitterChain);
          if (vaa) break;
          
          console.log(`⏳ VAA not ready yet (attempt ${retries + 1}/${maxRetries}), retrying in ${backoff}ms...`);
          retries++;
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            backoff = Math.min(backoff * 1.5, 30000);
          }
        }
        
        if (!vaa) {
          throw new Error(`Failed to get VAA after ${maxRetries} retries. Transaction: ${transferResult.txHash}`);
        }
      }
      
      vaaHex = vaa;
    } else {
      // Use sequence number to fetch VAA
      vaaHex = await pollVaa(
        transferResult.sequence,
        emitterChain,
        tokenBridgeAddress,
        maxRetries,
        initialBackoff
      );
    }
    
    console.log(`✅ VAA received: ${vaaHex.substring(0, 20)}...`);
    
    // Step 4: Submit VAA to Aptos Token Bridge
    console.log('\n🎯 Step 3: Submitting VAA to Aptos Token Bridge...');
    
    if (!config.aptosTokenBridgeAddress || !config.aptosUsdcCoinType) {
      throw new Error('Missing Aptos configuration: APTOS_TOKEN_BRIDGE_ADDRESS and APTOS_USDC_COIN_TYPE required');
    }
    
    const destinationTx = await submitTokenBridgeVaa(
      aptosSigner,
      vaaHex,
      config.aptosUsdcCoinType,
      recipientAddress, // Fee recipient
      config.aptosTokenBridgeAddress
    );
    
    console.log(`✅ Aptos transaction submitted: ${destinationTx}`);
    console.log('Waiting for confirmation...');
    
    // Wait for transaction confirmation
    await aptosSigner.client.waitForTransaction({ transactionHash: destinationTx });
    console.log('✅ Aptos transaction confirmed');
    
    return {
      success: true,
      sourceTx: transferResult.txHash,
      attestationId: vaaHex.substring(0, 40), // First 40 chars of VAA as ID
      destinationTx: destinationTx,
    };
    
  } catch (error: any) {
    console.error('❌ Transfer failed:', error);
    
    // Provide helpful error messages
    if (error.code === 'INSUFFICIENT_FUNDS' || error.message?.includes('insufficient funds')) {
      return {
        success: false,
        error: `Insufficient funds for gas fees.\n\n` +
               `Your Base Sepolia wallet (${baseSigner.address}) needs ETH for gas.\n` +
               `Get testnet ETH from:\n` +
               `  • https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n` +
               `  • https://faucet.quicknode.com/base/sepolia\n` +
               `\nYou need at least 0.001 ETH for gas fees.`,
      };
    }
    
    if (error.message?.includes('Insufficient USDC')) {
      return {
        success: false,
        error: error.message,
      };
    }
    
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

