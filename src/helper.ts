import { ethers } from 'ethers';
import { EvmSignerResult, AptosSignerResult } from './types';

/**
 * Creates an EVM signer (provider + signer) for Base chain
 * @param rpcUrl - Base RPC endpoint URL
 * @param privateKey - Private key of the sponsor wallet (without 0x prefix is fine)
 * @returns Provider, signer, and wallet address
 */
export function getEvmSigner(rpcUrl: string, privateKey: string): EvmSignerResult {
  // Ensure private key has 0x prefix if not present
  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(formattedKey, provider);
  const address = signer.address;

  return {
    provider,
    signer,
    address,
  };
}

/**
 * Creates an Aptos signer (client + account) for Aptos chain
 * @param rpcUrl - Aptos RPC endpoint URL
 * @param privateKey - Private key of the sponsor wallet (hex string, 64 chars)
 * @returns AptosClient, account, and wallet address
 */
export async function getAptosSigner(rpcUrl: string, privateKey: string): Promise<AptosSignerResult> {
  // @aptos-labs/ts-sdk v1.39.0 uses different API
  const aptos = await import('@aptos-labs/ts-sdk');
  
  // The SDK exports Aptos (client) and Account classes
  const { Aptos, Account, Ed25519PrivateKey } = aptos;
  
  // Create Aptos client instance
  const client = new Aptos({ fullnode: rpcUrl });
  
  // Handle different private key formats
  let formattedKey: string;
  
  // Aptos CLI format: "ed25519-priv-0x<hex>"
  if (privateKey.startsWith('ed25519-priv-0x')) {
    formattedKey = privateKey.replace('ed25519-priv-0x', '');
  }
  // Standard hex format with 0x prefix
  else if (privateKey.startsWith('0x')) {
    formattedKey = privateKey.slice(2);
  }
  // Plain hex format
  else {
    formattedKey = privateKey;
  }
  
  // Validate hex format
  if (!/^[0-9a-fA-F]+$/.test(formattedKey)) {
    throw new Error(`Invalid private key format: must be hex string. Got: ${privateKey.substring(0, 20)}...`);
  }
  
  // Aptos private keys are 32 bytes (64 hex chars)
  // If the key is longer, it might include the public key - take first 32 bytes
  if (formattedKey.length > 64) {
    formattedKey = formattedKey.slice(0, 64);
  }
  
  // Validate minimum length
  if (formattedKey.length < 64) {
    throw new Error(`Invalid private key length: expected 64 hex characters (32 bytes), got ${formattedKey.length}. Your key might be in the wrong format (mnemonic instead of hex).`);
  }
  
  // Convert hex string to Uint8Array (32 bytes)
  let privateKeyBytes: Uint8Array;
  try {
    privateKeyBytes = Uint8Array.from(Buffer.from(formattedKey, 'hex'));
  } catch (error) {
    throw new Error(`Failed to parse private key as hex: ${error}`);
  }
  
  // Validate length
  if (privateKeyBytes.length !== 32) {
    throw new Error(`Invalid private key length: expected 32 bytes, got ${privateKeyBytes.length}. Make sure your APTOS_SPONSOR_PRIVATE_KEY is a 64-character hex string.`);
  }
  
  // Create private key object - try constructor directly
  const privateKeyObj = new Ed25519PrivateKey(privateKeyBytes);
  const account = Account.fromPrivateKey({ privateKey: privateKeyObj });
  const address = account.accountAddress.toString();

  return {
    client,
    account,
    address,
  };
}

