/**
 * Wormhole Contract Addresses and ABIs
 * 
 * Source: Wormhole SDK constants
 * Base Sepolia testnet addresses from: wormhole/sdk/js/src/utils/consts.ts
 */

export const WORMHOLE_CONTRACTS = {
  testnet: {
    baseSepolia: {
      core: '0x79A1027a6A159502049F10906D333EC57E95F083',
      tokenBridge: '0x86F55A04690fd7815A3D802bD587e83eA888B239',
      nftBridge: '0x268557122Ffd64c85750d630b716471118F323c8',
    },
  },
  mainnet: {
    base: {
      core: '0xbebdb6C8ddC678FfA9f8748f85C815C556Dd8ac6',
      tokenBridge: '0x24850c6f61C438823F01B7A3BF2B89B72174Fa9d',
    },
  },
};

/**
 * Wormhole Token Bridge ABI - Minimal interface for token transfers
 * Full ABI available at: https://github.com/wormhole-foundation/wormhole
 */
export const TOKEN_BRIDGE_ABI = [
  // transferTokens function
  'function transferTokens(address token, uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) returns (uint64 sequence)',
  // Events
  'event TransferTokens(uint256 tokenChain, address tokenAddress, uint256 amount, uint256 fee, bytes32 indexed to, uint256 indexed toChain, bytes32 indexed fromAddress, uint64 indexed sequence)',
] as const;

/**
 * USDC ERC20 ABI - For approving and checking balance
 */
export const USDC_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
] as const;

/**
 * Wormhole Chain IDs
 * Source: Wormhole SDK
 */
export const WORMHOLE_CHAIN_IDS = {
  // EVM chains
  ethereum: 2,
  base: 30,
  baseSepolia: 30, // Same as Base for testnet
  // Non-EVM chains
  aptos: 22,
} as const;

