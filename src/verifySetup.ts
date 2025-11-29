/**
 * Setup Verification Script
 * 
 * This script verifies that all required environment variables are set
 * and checks if the configuration is ready for testing.
 */

import { config } from './config';

function checkEnvVar(name: string, value: string | undefined, required: boolean = true): boolean {
  if (!value || value.trim() === '') {
    if (required) {
      console.error(`❌ Missing required: ${name}`);
      return false;
    } else {
      console.warn(`⚠️  Optional missing: ${name}`);
      return true; // Optional vars are OK to be missing
    }
  }
  
  // Basic validation
  if (name.includes('PRIVATE_KEY')) {
    const key = value.startsWith('0x') ? value.slice(2) : value;
    if (key.length < 64) {
      console.error(`❌ Invalid ${name}: Private key too short`);
      return false;
    }
    console.log(`✅ ${name}: Set (${key.length} chars)`);
  } else if (name.includes('ADDRESS')) {
    if (!value.startsWith('0x') || value.length !== 66) {
      console.warn(`⚠️  ${name}: May be invalid format (expected 0x + 64 hex chars)`);
    } else {
      console.log(`✅ ${name}: ${value}`);
    }
  } else if (name.includes('COIN_TYPE')) {
    if (!value.includes('::')) {
      console.error(`❌ ${name}: Invalid format (expected: 0x...::coin::USDC)`);
      return false;
    }
    console.log(`✅ ${name}: ${value}`);
  } else {
    console.log(`✅ ${name}: Set`);
  }
  
  return true;
}

function verifySetup() {
  console.log('🔍 Verifying Setup...\n');
  console.log('─'.repeat(60));
  
  let allGood = true;
  
  // Required variables
  console.log('\n📋 Required Variables:');
  allGood = checkEnvVar('BASE_RPC_URL', config.baseRpcUrl) && allGood;
  allGood = checkEnvVar('APTOS_RPC_URL', config.aptosRpcUrl) && allGood;
  allGood = checkEnvVar('BASE_SPONSOR_PRIVATE_KEY', config.baseSponsorPrivateKey) && allGood;
  allGood = checkEnvVar('APTOS_SPONSOR_PRIVATE_KEY', config.aptosSponsorPrivateKey) && allGood;
  allGood = checkEnvVar('NETWORK_TYPE', config.networkType) && allGood;
  
  // Critical for integration
  console.log('\n🔧 Integration Variables:');
  const hasTokenBridge = checkEnvVar('APTOS_TOKEN_BRIDGE_ADDRESS', config.aptosTokenBridgeAddress, false);
  const hasCoinType = checkEnvVar('APTOS_USDC_COIN_TYPE', config.aptosUsdcCoinType, false);
  
  if (!hasTokenBridge || !hasCoinType) {
    allGood = false;
  }
  
  // Optional
  console.log('\n📦 Optional Variables:');
  checkEnvVar('CIRCLE_API_KEY', config.circleApiKey, false);
  
  console.log('\n' + '─'.repeat(60));
  
  if (allGood) {
    console.log('\n✅ Setup looks good! You should be ready to test.');
    console.log('\n📝 Next Steps:');
    console.log('   1. Ensure wallets are funded with gas tokens');
    console.log('   2. Get testnet USDC on Base Sepolia (if needed)');
    console.log('   3. Run: npx tsx src/runTransfer.ts');
  } else {
    console.log('\n❌ Setup incomplete. Please fix the issues above.');
    console.log('\n📝 Missing Items:');
    if (!config.aptosTokenBridgeAddress) {
      console.log('   - APTOS_TOKEN_BRIDGE_ADDRESS');
      console.log('     Get it: node wormhole/clients/js/build/main.js info contract testnet aptos TokenBridge');
    }
    if (!config.aptosUsdcCoinType) {
      console.log('   - APTOS_USDC_COIN_TYPE');
      console.log('     Check: Circle/Wormhole docs for Aptos testnet USDC coin type');
      console.log('     Format: 0x<address>::coin::USDC');
    }
  }
  
  console.log('\n');
  
  // Display current config (without private keys)
  console.log('📊 Current Configuration:');
  console.log(`   Network: ${config.networkType}`);
  console.log(`   Base RPC: ${config.baseRpcUrl}`);
  console.log(`   Aptos RPC: ${config.aptosRpcUrl}`);
  console.log(`   Token Bridge: ${config.aptosTokenBridgeAddress || 'NOT SET'}`);
  console.log(`   USDC Coin Type: ${config.aptosUsdcCoinType || 'NOT SET'}`);
  console.log(`   Base Wallet: ${config.baseSponsorPrivateKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Aptos Wallet: ${config.aptosSponsorPrivateKey ? '✅ Set' : '❌ Missing'}`);
}

verifySetup();


