export interface TransferRequest {
  targetChain: 'Aptos';
  transferAmount: string; // Amount in USDC (e.g., "1.0")
  networkType?: 'Mainnet' | 'Testnet';
  recipientAddress?: string; // Optional: if not provided, uses sponsor wallet address
}

export interface TransferResult {
  success: boolean;
  sourceTx?: string;
  attestationId?: string;
  destinationTx?: string;
  error?: string;
}

export interface EvmSignerResult {
  provider: any; // ethers.Provider
  signer: any; // ethers.Signer
  address: string;
}

export interface AptosSignerResult {
  client: any; // AptosClient
  account: any; // AptosAccount or similar
  address: string;
}


