/**
 * Aptos Integration for Wormhole Token Bridge
 * 
 * This file integrates with the REAL Wormhole Aptos token bridge code
 * located in /aptos/token_bridge/
 * 
 * Key function from aptos/token_bridge/sources/complete_transfer.move:
 *   public entry fun submit_vaa_entry<CoinType>(vaa: vector<u8>, fee_recipient: address)
 * 
 * Module address: token_bridge (resource account address, varies by network)
 */

import { AptosSignerResult } from './types';

/**
 * Submits a VAA to the Wormhole Token Bridge on Aptos to complete a transfer
 * 
 * Based on: aptos/token_bridge/sources/complete_transfer.move
 * Function: submit_vaa_entry<CoinType>(vaa: vector<u8>, fee_recipient: address)
 * 
 * @param aptosSigner - Aptos signer (client + account)
 * @param vaaBytes - VAA bytes as Uint8Array or hex string
 * @param coinTypeAddress - The coin type address (e.g., USDC type address)
 * @param feeRecipient - Address to receive the fee (can be same as recipient)
 * @param tokenBridgeAddress - The token_bridge resource account address (from deployment)
 * @returns Transaction hash
 */
export async function submitTokenBridgeVaa(
  aptosSigner: AptosSignerResult,
  vaaBytes: Uint8Array | string,
  coinTypeAddress: string,
  feeRecipient: string,
  tokenBridgeAddress: string
): Promise<string> {
  const { AptosClient, Account, TransactionBuilder, TxnBuilderTypes } = await import('@aptos-labs/ts-sdk');
  
  // Convert VAA bytes to Uint8Array if it's a hex string
  let vaaUint8Array: Uint8Array;
  if (typeof vaaBytes === 'string') {
    // Remove 0x prefix if present
    const hex = vaaBytes.startsWith('0x') ? vaaBytes.slice(2) : vaaBytes;
    vaaUint8Array = new Uint8Array(Buffer.from(hex, 'hex'));
  } else {
    vaaUint8Array = vaaBytes;
  }

  // Ensure addresses are properly formatted
  const tokenBridgeAddr = tokenBridgeAddress.startsWith('0x') 
    ? tokenBridgeAddress.slice(2) 
    : tokenBridgeAddress;
  const feeRecipientAddr = feeRecipient.startsWith('0x') 
    ? feeRecipient.slice(2) 
    : feeRecipient;

  // Coin type address format: 0x<address>::<module>::<name> or <address>::<module>::<name>
  // Example: 0x123::coin::USDC or 123::coin::USDC
  // The StructTag.fromString() expects format: address::module::name
  if (!coinTypeAddress.includes('::')) {
    throw new Error('Coin type must be in format: 0x<address>::<module>::<name>');
  }
  
  // Parse the coin type struct tag
  const coinTypeStructTag = TxnBuilderTypes.StructTag.fromString(coinTypeAddress);

  // Build the transaction to call:
  // token_bridge::complete_transfer::submit_vaa_entry<CoinType>(vaa, fee_recipient)
  // 
  // From aptos/token_bridge/sources/complete_transfer.move line 25:
  // public entry fun submit_vaa_entry<CoinType>(vaa: vector<u8>, fee_recipient: address)
  
  const entryFunctionPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
    TxnBuilderTypes.EntryFunction.natural(
      // Module address and name
      `${tokenBridgeAddr}::complete_transfer`,
      'submit_vaa_entry',
      // Type arguments: [CoinType]
      [new TxnBuilderTypes.TypeTagStruct(coinTypeStructTag)],
      // Function arguments: [vaa: vector<u8>, fee_recipient: address]
      [
        new TxnBuilderTypes.TransactionArgumentU8Vector(vaaUint8Array),
        new TxnBuilderTypes.TransactionArgumentAddress(
          TxnBuilderTypes.AccountAddress.fromHex(feeRecipientAddr)
        ),
      ]
    )
  );

  // Generate raw transaction
  const rawTxn = await aptosSigner.client.generateTransaction(
    aptosSigner.account.accountAddress,
    entryFunctionPayload
  );

  // Sign and submit transaction
  const signedTxn = await aptosSigner.client.signTransaction(
    aptosSigner.account,
    rawTxn
  );

  const pendingTxn = await aptosSigner.client.submitTransaction(signedTxn);
  
  return pendingTxn.hash;
}

/**
 * Alternative: Use submit_vaa_and_register_entry if the fee recipient needs to register the coin
 * 
 * From aptos/token_bridge/sources/complete_transfer.move line 31:
 * public entry fun submit_vaa_and_register_entry<CoinType>(fee_recipient: &signer, vaa: vector<u8>)
 * 
 * This function automatically registers the coin type for the fee recipient if not already registered.
 */
export async function submitTokenBridgeVaaWithRegistration(
  aptosSigner: AptosSignerResult,
  vaaBytes: Uint8Array | string,
  coinTypeAddress: string,
  tokenBridgeAddress: string
): Promise<string> {
  const { TxnBuilderTypes } = await import('@aptos-labs/ts-sdk');
  
  // Convert VAA bytes to Uint8Array if it's a hex string
  let vaaUint8Array: Uint8Array;
  if (typeof vaaBytes === 'string') {
    const hex = vaaBytes.startsWith('0x') ? vaaBytes.slice(2) : vaaBytes;
    vaaUint8Array = new Uint8Array(Buffer.from(hex, 'hex'));
  } else {
    vaaUint8Array = vaaBytes;
  }

  const tokenBridgeAddr = tokenBridgeAddress.startsWith('0x') 
    ? tokenBridgeAddress.slice(2) 
    : tokenBridgeAddress;

  // Coin type address format: 0x<address>::<module>::<name>
  if (!coinTypeAddress.includes('::')) {
    throw new Error('Coin type must be in format: 0x<address>::<module>::<name>');
  }
  
  const coinTypeStructTag = TxnBuilderTypes.StructTag.fromString(coinTypeAddress);

  // Build transaction for submit_vaa_and_register_entry
  // This takes fee_recipient as &signer (the account signing the transaction)
  // From aptos/token_bridge/sources/complete_transfer.move line 31:
  // public entry fun submit_vaa_and_register_entry<CoinType>(fee_recipient: &signer, vaa: vector<u8>)
  const entryFunctionPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
    TxnBuilderTypes.EntryFunction.natural(
      `${tokenBridgeAddr}::complete_transfer`,
      'submit_vaa_and_register_entry',
      [new TxnBuilderTypes.TypeTagStruct(coinTypeStructTag)],
      [
        new TxnBuilderTypes.TransactionArgumentU8Vector(vaaUint8Array),
      ]
    )
  );

  const rawTxn = await aptosSigner.client.generateTransaction(
    aptosSigner.account.accountAddress,
    entryFunctionPayload
  );

  const signedTxn = await aptosSigner.client.signTransaction(
    aptosSigner.account,
    rawTxn
  );

  const pendingTxn = await aptosSigner.client.submitTransaction(signedTxn);
  
  return pendingTxn.hash;
}

/**
 * Get the token bridge address for a given network
 * 
 * For testnet, you can get this by running:
 *   worm info contract testnet aptos TokenBridge
 * 
 * Or check the deployment scripts in aptos/scripts/
 */
export function getTokenBridgeAddress(network: 'testnet' | 'mainnet' | 'devnet'): string {
  // TODO: Replace with actual addresses from Wormhole deployment
  // You can get these by running: worm info contract <network> aptos TokenBridge
  
  const addresses: Record<string, string> = {
    testnet: '', // TODO: Get from: worm info contract testnet aptos TokenBridge
    mainnet: '', // TODO: Get from: worm info contract mainnet aptos TokenBridge
    devnet: '0x84a5f374d29fc77e370014dce4fd6a55b58ad608de8074b0be5571701724da31', // From Move.toml dev-addresses
  };

  return addresses[network] || addresses.devnet;
}

