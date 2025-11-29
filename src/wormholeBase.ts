/**
 * Wormhole Token Bridge Integration for Base Sepolia
 * 
 * Handles burning/locking USDC on Base Sepolia using Wormhole Token Bridge
 */

import { ethers } from 'ethers';
import { EvmSignerResult } from './types';
import { WORMHOLE_CONTRACTS, TOKEN_BRIDGE_ABI, USDC_ABI, WORMHOLE_CHAIN_IDS } from './wormholeContracts';
import { config } from './config';

/**
 * Transfers USDC on Base Sepolia using Wormhole Token Bridge
 * 
 * @param signer - Base signer (provider + signer)
 * @param amount - Amount in USDC (will be converted to smallest unit)
 * @param recipientAddress - Recipient address on destination chain (Aptos address)
 * @param usdcAddress - USDC token contract address on Base Sepolia
 * @returns Transaction hash and sequence number
 */
export async function transferUsdcViaWormhole(
  signer: EvmSignerResult,
  amount: string,
  recipientAddress: string,
  usdcAddress?: string
): Promise<{ txHash: string; sequence: bigint }> {
  // Use config or default addresses
  const tokenBridgeAddress = WORMHOLE_CONTRACTS.testnet.baseSepolia.tokenBridge;
  
  // USDC address on Base Sepolia testnet
  // TODO: Verify this address - might need to get from Wormhole docs or deploy
  const defaultUsdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia testnet USDC
  const usdcContractAddress = usdcAddress || defaultUsdcAddress;
  
  // Convert amount to smallest unit (USDC has 6 decimals)
  const amountFloat = parseFloat(amount);
  const amountInSmallestUnit = BigInt(Math.floor(amountFloat * 1_000_000));
  
  // Check ETH balance first (needed for gas)
  const ethBalance = await signer.provider.getBalance(signer.address);
  const minEthRequired = ethers.parseEther('0.001'); // Minimum 0.001 ETH for gas
  if (ethBalance < minEthRequired) {
    const ethBalanceFormatted = ethers.formatEther(ethBalance);
    throw new Error(
      `Insufficient ETH for gas fees.\n` +
      `  Current balance: ${ethBalanceFormatted} ETH\n` +
      `  Required: ~0.001 ETH minimum\n` +
      `  Wallet: ${signer.address}\n` +
      `\n💡 Get Base Sepolia ETH from:\n` +
      `  https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n` +
      `  Or: https://faucet.quicknode.com/base/sepolia`
    );
  }
  
  // Get contract instances
  const usdcContract = new ethers.Contract(usdcContractAddress, USDC_ABI, signer.signer);
  const tokenBridgeContract = new ethers.Contract(
    tokenBridgeAddress,
    TOKEN_BRIDGE_ABI,
    signer.signer
  );
  
  // Check USDC balance
  const balance = await usdcContract.balanceOf(signer.address);
  if (balance < amountInSmallestUnit) {
    const balanceFormatted = ethers.formatUnits(balance, 6);
    const neededFormatted = ethers.formatUnits(amountInSmallestUnit, 6);
    throw new Error(
      `Insufficient USDC balance.\n` +
      `  Current balance: ${balanceFormatted} USDC\n` +
      `  Required: ${neededFormatted} USDC\n` +
      `  Wallet: ${signer.address}\n` +
      `\n💡 You need testnet USDC on Base Sepolia to proceed.`
    );
  }
  
  // Check and approve if needed
  let allowance = await usdcContract.allowance(signer.address, tokenBridgeAddress);
  if (allowance < amountInSmallestUnit) {
    console.log('Approving USDC spend for Wormhole Token Bridge...');
    console.log(`  Current allowance: ${allowance}`);
    console.log(`  Required: ${amountInSmallestUnit}`);
    
    // Approve with a bit extra to avoid rounding issues
    const approveAmount = amountInSmallestUnit * BigInt(2); // Approve 2x to be safe
    const approveTx = await usdcContract.approve(tokenBridgeAddress, approveAmount);
    console.log(`  Approval transaction: ${approveTx.hash}`);
    console.log('  Waiting for confirmation...');
    
    const approveReceipt = await approveTx.wait();
    if (!approveReceipt || approveReceipt.status !== 1) {
      throw new Error(`Approval transaction failed: ${approveTx.hash}`);
    }
    
    console.log('✅ Approval confirmed');
    
    // Wait a bit for state to propagate, then verify allowance
    // Sometimes the state takes a moment to update after confirmation
    console.log('  Waiting for state to propagate...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    // Retry checking allowance a few times in case of state lag
    let retries = 0;
    const maxRetries = 5;
    while (retries < maxRetries) {
      allowance = await usdcContract.allowance(signer.address, tokenBridgeAddress);
      console.log(`  Checking allowance (attempt ${retries + 1}/${maxRetries}): ${allowance}`);
      
      if (allowance >= amountInSmallestUnit) {
        console.log(`✅ Allowance verified: ${allowance}`);
        break;
      }
      
      retries++;
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between retries
      }
    }
    
    if (allowance < amountInSmallestUnit) {
      throw new Error(
        `Approval failed: allowance ${allowance} is less than required ${amountInSmallestUnit}.\n` +
        `Approval transaction: ${approveTx.hash}\n` +
        `This might be a state propagation issue. Try waiting a few seconds and running again.`
      );
    }
  } else {
    console.log(`✅ Sufficient allowance: ${allowance}`);
  }
  
  // Convert Aptos address to bytes32 format for Wormhole
  // Aptos addresses are 32 bytes (64 hex chars)
  let recipientBytes32: string;
  if (recipientAddress.startsWith('0x')) {
    const hex = recipientAddress.slice(2);
    // Pad to 64 hex chars (32 bytes) or truncate if longer
    recipientBytes32 = hex.padEnd(64, '0').slice(0, 64);
  } else {
    recipientBytes32 = recipientAddress.padEnd(64, '0').slice(0, 64);
  }
  
  // Aptos chain ID for Wormhole
  const aptosChainId = WORMHOLE_CHAIN_IDS.aptos;
  
  // Call transferTokens
  // Parameters: token, amount, recipientChain, recipient (bytes32), arbiterFee, nonce
  console.log('Transferring USDC via Wormhole Token Bridge...');
  console.log(`  Amount: ${amount} USDC (${amountInSmallestUnit} smallest units)`);
  console.log(`  Recipient Chain: Aptos (${aptosChainId})`);
  console.log(`  Recipient: ${recipientAddress}`);
  
  // Use nonce 0 (or generate a random nonce)
  const nonce = 0;
  // Arbiter fee: 0 for now (can be set if needed)
  const arbiterFee = 0;
  
  const tx = await tokenBridgeContract.transferTokens(
    usdcContractAddress, // token
    amountInSmallestUnit, // amount
    aptosChainId, // recipientChain (Aptos = 22)
    '0x' + recipientBytes32, // recipient (bytes32)
    arbiterFee, // arbiterFee
    nonce // nonce
  );
  
  console.log(`✅ Transfer transaction submitted: ${tx.hash}`);
  console.log('Waiting for confirmation...');
  
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Transfer transaction failed: ${tx.hash}`);
  }
  
  console.log('✅ Transfer transaction confirmed');
  
  // Extract sequence number from TransferTokens event
  // The event might be emitted by the Token Bridge or Core contract
  let transferEvent: any = null;
  let sequence: bigint | null = null;
  
  // Try to find TransferTokens event in Token Bridge contract
  for (const log of receipt.logs) {
    try {
      const parsed = tokenBridgeContract.interface.parseLog(log);
      if (parsed?.name === 'TransferTokens') {
        transferEvent = log;
        sequence = parsed.args.sequence;
        break;
      }
    } catch {
      // Not this contract, continue
    }
  }
  
  // If not found, try parsing all logs to see what events we have
  if (!transferEvent) {
    console.log('⚠️  TransferTokens event not found in Token Bridge contract');
    console.log('📋 Checking all events in transaction...');
    
    // Try to find sequence in any log (might be in Core contract)
    for (const log of receipt.logs) {
      try {
        // Try to decode as TransferTokens
        const parsed = tokenBridgeContract.interface.parseLog(log);
        console.log(`  Found event: ${parsed?.name}`, parsed?.args);
      } catch {
        // Try other common event formats
        try {
          // Check if it's a log from Core contract (LogMessagePublished)
          const coreAbi = ['event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)'];
          const coreInterface = new ethers.Interface(coreAbi);
          const parsed = coreInterface.parseLog(log);
          if (parsed?.name === 'LogMessagePublished') {
            console.log(`  Found LogMessagePublished event with sequence: ${parsed.args.sequence}`);
            sequence = parsed.args.sequence;
            transferEvent = log;
            break;
          }
        } catch {
          // Not this either
        }
      }
    }
  }
  
  if (!transferEvent || sequence === null) {
    // Last resort: try to get sequence from transaction receipt directly
    // Some implementations store it in the receipt
    console.log('⚠️  Could not find sequence in events, trying alternative methods...');
    
    // Check if we can query the sequence from the contract
    try {
      // Some token bridges have a method to get sequence from tx hash
      // For now, we'll need to use the tx hash to query Wormhole API
      console.log('📝 Using transaction hash to query VAA:');
      console.log(`   TX Hash: ${tx.hash}`);
      console.log('   Will query Wormhole API by transaction hash');
      
      // Return with tx hash - we'll query by tx hash instead
      return {
        txHash: tx.hash,
        sequence: BigInt(0), // Placeholder - will query by tx hash
      };
    } catch (error) {
      throw new Error(
        `Could not find TransferTokens event or sequence in transaction.\n` +
        `Transaction hash: ${tx.hash}\n` +
        `Please check the transaction on Base Sepolia explorer to find the sequence number.\n` +
        `You can also try querying the VAA by transaction hash using the Wormhole API.`
      );
    }
  }
  
  console.log(`📝 Sequence: ${sequence}`);
  
  return {
    txHash: tx.hash,
    sequence: sequence,
  };
}

