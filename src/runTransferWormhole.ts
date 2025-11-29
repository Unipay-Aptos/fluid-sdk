import { transferUsdcWithWormholeOnly } from './transferWormholeOnly';
import { config } from './config';

async function main() {
  console.log('🚀 Starting Wormhole-only cross-chain transfer (Base Sepolia → Aptos)');
  console.log(`📡 Network: ${config.networkType}`);
  console.log('─'.repeat(60));

  const result = await transferUsdcWithWormholeOnly({
    targetChain: 'Aptos',
    transferAmount: '1.0', // Transfer 1 USDC
    networkType: config.networkType,
  });

  console.log('\n' + '─'.repeat(60));
  console.log('📊 TRANSFER RESULT');
  console.log('─'.repeat(60));
  
  if (result.success) {
    console.log('✅ Status: SUCCESS');
    console.log(`📍 Source TX (Base): ${result.sourceTx}`);
    console.log(`🔐 VAA: ${result.attestationId}...`);
    console.log(`📍 Destination TX (Aptos): ${result.destinationTx}`);
  } else {
    console.log('❌ Status: FAILED');
    console.log(`💥 Error: ${result.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

