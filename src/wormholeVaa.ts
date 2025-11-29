/**
 * Wormhole VAA (Verified Action Approval) Retrieval
 * 
 * Fetches VAAs from Wormhole's guardian network
 */

import { config } from './config';

/**
 * Wormhole Guardian API endpoints
 */
const WORMHOLE_API = {
  testnet: 'https://api.testnet.wormholescan.io',
  mainnet: 'https://api.wormholescan.io',
};

/**
 * Fetches a VAA from Wormhole's API using transaction hash
 * 
 * @param txHash - Transaction hash from the transfer
 * @param emitterChain - Chain ID where the transfer was initiated (Base Sepolia = 30)
 * @param emitterAddress - Token Bridge contract address
 * @returns VAA bytes as hex string or null if not ready
 */
export async function fetchVaaByTxHash(
  txHash: string,
  emitterChain: number = 30, // Base Sepolia
  emitterAddress?: string
): Promise<string | null> {
  const baseUrl = config.networkType === 'Mainnet' 
    ? WORMHOLE_API.mainnet 
    : WORMHOLE_API.testnet;
  
  // Try fetching by transaction hash
  const url = `${baseUrl}/api/v1/vaas/${emitterChain}/${txHash}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        // VAA not ready yet
        return null;
      }
      throw new Error(`Wormhole API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.vaa) {
      return data.vaa;
    }
    
    return null;
  } catch (error: any) {
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      return null; // Not ready yet
    }
    throw error;
  }
}

/**
 * Fetches a VAA from Wormhole's API using sequence number
 * 
 * @param sequence - Sequence number from the TransferTokens event
 * @param emitterChain - Chain ID where the transfer was initiated (Base Sepolia = 30)
 * @param emitterAddress - Token Bridge contract address
 * @returns VAA bytes as hex string or null if not ready
 */
export async function fetchVaaBySequence(
  sequence: bigint | number,
  emitterChain: number = 30, // Base Sepolia
  emitterAddress: string
): Promise<string | null> {
  const baseUrl = config.networkType === 'Mainnet' 
    ? WORMHOLE_API.mainnet 
    : WORMHOLE_API.testnet;
  
  // Format emitter address (remove 0x prefix, pad to 64 chars)
  let emitterAddr = emitterAddress.startsWith('0x') 
    ? emitterAddress.slice(2).toLowerCase() 
    : emitterAddress.toLowerCase();
  emitterAddr = emitterAddr.padStart(64, '0');
  
  // Wormhole API format: /api/v1/vaas/{emitterChain}/{emitterAddress}/{sequence}
  const url = `${baseUrl}/api/v1/vaas/${emitterChain}/${emitterAddr}/${sequence}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        // VAA not ready yet
        return null;
      }
      throw new Error(`Wormhole API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.vaa) {
      return data.vaa;
    }
    
    return null;
  } catch (error: any) {
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      return null; // Not ready yet
    }
    throw error;
  }
}

/**
 * Polls Wormhole's API until VAA is ready
 * 
 * @param sequence - Sequence number from the TransferTokens event
 * @param emitterChain - Chain ID where the transfer was initiated
 * @param emitterAddress - Token Bridge contract address
 * @param maxRetries - Maximum number of retries
 * @param initialBackoff - Initial backoff delay in ms
 * @returns VAA bytes as hex string
 */
export async function pollVaa(
  sequence: bigint | number,
  emitterChain: number = 30,
  emitterAddress: string,
  maxRetries: number = 30,
  initialBackoff: number = 2000
): Promise<string> {
  let retries = 0;
  let backoff = initialBackoff;
  
  while (retries < maxRetries) {
    try {
      const vaa = await fetchVaaBySequence(sequence, emitterChain, emitterAddress);
      
      if (vaa) {
        return vaa;
      }
      
      console.log(`⏳ VAA not ready yet (attempt ${retries + 1}/${maxRetries}), retrying in ${backoff}ms...`);
    } catch (error: any) {
      console.warn(`⚠️ Error fetching VAA: ${error.message}`);
    }
    
    retries++;
    if (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      // Exponential backoff
      backoff = Math.min(backoff * 1.5, 30000); // Cap at 30 seconds
    }
  }
  
  throw new Error(`Failed to get VAA after ${maxRetries} retries`);
}

