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
