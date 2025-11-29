import dotenv from 'dotenv';

// Load .env.local first (if exists), then .env
dotenv.config({ path: '.env.local' });
dotenv.config(); // This will override with .env if it exists

export interface Config {
  baseRpcUrl: string;
  aptosRpcUrl: string;
  baseSponsorPrivateKey: string;
  aptosSponsorPrivateKey: string;
  circleApiKey?: string;
  networkType: 'Mainnet' | 'Testnet';
  // Wormhole Token Bridge address on Aptos (get from: worm info contract <network> aptos TokenBridge)
  aptosTokenBridgeAddress?: string;
  // USDC coin type address on Aptos (format: 0x...::coin::USDC)
  aptosUsdcCoinType?: string;
  // Circle CCTP contract addresses (optional, defaults provided)
  baseUsdcAddress?: string;
  baseTokenMessengerAddress?: string;
  baseMessageTransmitterAddress?: string;
  // Wormhole contract addresses (optional, defaults provided)
  baseWormholeTokenBridgeAddress?: string;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string): string | undefined {
  return process.env[key];
}

export const config: Config = {
  baseRpcUrl: getRequiredEnv('BASE_RPC_URL'),
  aptosRpcUrl: getRequiredEnv('APTOS_RPC_URL'),
  baseSponsorPrivateKey: getRequiredEnv('BASE_SPONSOR_PRIVATE_KEY'),
  aptosSponsorPrivateKey: getRequiredEnv('APTOS_SPONSOR_PRIVATE_KEY'),
  circleApiKey: getOptionalEnv('CIRCLE_API_KEY'),
  networkType: (getOptionalEnv('NETWORK_TYPE') || 'Testnet') as 'Mainnet' | 'Testnet',
  aptosTokenBridgeAddress: getOptionalEnv('APTOS_TOKEN_BRIDGE_ADDRESS'),
  aptosUsdcCoinType: getOptionalEnv('APTOS_USDC_COIN_TYPE'),
  baseUsdcAddress: getOptionalEnv('BASE_USDC_ADDRESS'),
  baseTokenMessengerAddress: getOptionalEnv('BASE_TOKEN_MESSENGER_ADDRESS'),
  baseMessageTransmitterAddress: getOptionalEnv('BASE_MESSAGE_TRANSMITTER_ADDRESS'),
  baseWormholeTokenBridgeAddress: getOptionalEnv('BASE_WORMHOLE_TOKEN_BRIDGE_ADDRESS'),
};

