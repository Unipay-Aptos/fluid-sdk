/**
 * CCTP (Circle Cross-Chain Transfer Protocol) Transfer Implementation
 * 
 * This file implements USDC transfers from Base Sepolia to Aptos using
 * Circle CCTP via Wormhole SDK. This is the method that Portal Bridge uses
 * and is the only method that works for Base Sepolia → Aptos transfers.
 */

import { wormhole, CircleTransfer, Network, Wormhole } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";
import aptos from "@wormhole-foundation/sdk/aptos";
import { config } from "./config";
import { getEvmSigner, getAptosSigner, toEvmSdkSigner, toAptosSdkSigner } from "./helper";
import { TransferResult } from "./types";


export interface CctpTransferRequest {
  amount: string; // Amount in USDC (e.g., "1.0")
  destAddress?: string; // Aptos recipient address (hex format)
}

/**
 * Transfers USDC from Base Sepolia to Aptos using Circle CCTP
 * @param request - Transfer request with amount and optional destination address
 * @returns Transfer result with transaction hashes and attestation IDs
 */
export async function transferUsdcViaCctp(
  request: CctpTransferRequest
): Promise<TransferResult> {
  try {
    const network: Network = config.networkType === "Mainnet" ? "Mainnet" : "Testnet";
    
    console.log(`🔑 Initializing Wormhole SDK with ${network} network...`);
    
    // For testnet, use "BaseSepolia" chain name; for mainnet use "Base"
    const srcChainName = network === "Testnet" ? "BaseSepolia" : "Base";
    
    // Initialize Wormhole SDK with EVM and Aptos platforms
    const wh = await wormhole(network, [evm, aptos], {
      chains: {
        [srcChainName]: {
          rpc: config.baseRpcUrl,
        },
        Aptos: {
          rpc: config.aptosRpcUrl,
        },
      },
    });

    console.log(`✅ Wormhole SDK initialized`);

    // Get signers
    console.log(`🔑 Initializing signers...`);
    const baseSigner = getEvmSigner(config.baseRpcUrl, config.baseSponsorPrivateKey);
    const aptosSigner = await getAptosSigner(config.aptosRpcUrl, config.aptosSponsorPrivateKey);
    
    console.log(`✅ Base signer: ${baseSigner.address}`);
    console.log(`✅ Aptos signer: ${aptosSigner.address}`);

    // Get chain contexts (srcChainName already defined above)
    const srcChain = wh.getChain(srcChainName);
    const dstChain = wh.getChain("Aptos");

    // Parse amount - USDC has 6 decimals
    const amountBigInt = BigInt(Math.floor(parseFloat(request.amount) * 1_000_000));
    console.log(`💰 Amount: ${request.amount} USDC (${amountBigInt.toString()} smallest units)`);

    // Use destination address if provided, otherwise use sponsor wallet
    const recipientAddress = request.destAddress || aptosSigner.address;
    console.log(`📬 Recipient: ${recipientAddress}`);

    // Create Circle CCTP transfer
    console.log(`🚀 Starting CCTP Transfer...`);
    
    // Create ChainAddress objects using Wormhole static method
    const senderAddress = Wormhole.chainAddress(srcChainName, baseSigner.address);
    const receiverAddress = Wormhole.chainAddress("Aptos", recipientAddress);
    
    const circleTransfer = await wh.circleTransfer(
      amountBigInt,
      senderAddress,
      receiverAddress,
      false, // manual mode (not automatic)
      undefined, // no payload
      0n // no native gas (BigInt literal as per user instruction)
    );

    // Get transfer quote (optional, for informational purposes)
    try {
      const quote = await CircleTransfer.quoteTransfer(
        srcChain.chain,
        dstChain.chain,
        circleTransfer.transfer
      );
      console.log(`📊 Transfer quote:`, quote);
    } catch (quoteError: any) {
      console.log(`⚠️  Could not get transfer quote (non-critical):`, quoteError.message);
      // Continue anyway - quote is optional
    }

    // Step 1: Initiate transfer on Base Sepolia
    console.log(`📤 Initiating transfer on Base Sepolia...`);
    
    // Refresh nonce to ensure we have the latest from network
    const currentNonce = await baseSigner.provider.getTransactionCount(baseSigner.address, 'pending');
    console.log(`📊 Current wallet nonce: ${currentNonce}`);
    
    // Wrap EVM signer into SDK Signer wrapper
    const baseSdkSigner = await toEvmSdkSigner(baseSigner.signer);
    const srcTxids = await circleTransfer.initiateTransfer(baseSdkSigner);
    const sourceTx = Array.isArray(srcTxids) ? srcTxids[0] : srcTxids;
    console.log(`✅ Sent Base transaction: ${sourceTx}`);

    // Step 2: Wait for Circle attestation
    console.log(`🕒 Waiting for Circle attestation (this may take 1-3 minutes)...`);
    
    // Fetch attestation with 180 second timeout (per user instruction)
    let attestationIds: string[] | undefined;
    try {
      attestationIds = await circleTransfer.fetchAttestation(180000); // 180 seconds timeout
      if (attestationIds && attestationIds.length > 0) {
        console.log(`📜 Attestation received: ${attestationIds[0]}`);
      } else {
        throw new Error('Attestation not received after timeout');
      }
    } catch (error: any) {
      throw new Error(
        `Attestation not received after 180 seconds. ` +
        `This can happen if Circle's attestation service is slow. ` +
        `Please check the transaction on Base Sepolia explorer and try again later. ` +
        `Error: ${error.message}`
      );
    }

    // Step 3: Complete transfer on Aptos
    console.log(`💸 Completing transfer on Aptos...`);
    // Wrap Aptos account into SDK Signer wrapper
    const aptosSdkSigner = toAptosSdkSigner(
      aptosSigner.account,
      aptosSigner.client,
      "Aptos"
    );
    const dstTxids = await circleTransfer.completeTransfer(aptosSdkSigner);
    const destinationTx = Array.isArray(dstTxids) ? dstTxids[0] : dstTxids;
    console.log(`✅ Completed Aptos transaction: ${destinationTx}`);

    console.log(`🎉 Finalized! USDC delivered to Aptos.`);

    return {
      success: true,
      sourceTx,
      attestationId: attestationIds[0],
      destinationTx,
    };
  } catch (error: any) {
    console.error(`❌ CCTP transfer failed:`, error.message);
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

