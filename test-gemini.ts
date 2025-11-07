/**
 * Test script for Gemini API integration
 * Run with: npx tsx test-gemini.ts
 */

import { testConnection } from './src/lib/gemini-client';
import { geminiFileSearch } from './src/lib/gemini-file-search';

async function runTests() {
  console.log('🧪 Testing Gemini API Integration\n');
  console.log('='.repeat(50));

  // Test 1: API Connection
  console.log('\n📡 Test 1: API Connection');
  const isConnected = await testConnection();

  if (!isConnected) {
    console.error('❌ API connection test failed!');
    process.exit(1);
  }

  // Test 2: List Files
  console.log('\n📂 Test 2: List Uploaded Files');
  try {
    const files = await geminiFileSearch.listFiles();
    console.log(`✅ Successfully listed ${files.length} files`);

    if (files.length > 0) {
      console.log('\nFirst 3 files:');
      files.slice(0, 3).forEach((file, i) => {
        console.log(`  ${i + 1}. ${file.displayName}`);
        console.log(`     Size: ${(parseInt(file.sizeBytes) / 1024).toFixed(2)} KB`);
        console.log(`     Type: ${file.mimeType}`);
        console.log(`     State: ${file.state}`);
      });
    }
  } catch (error) {
    console.error('❌ List files test failed:', error);
  }

  // Test 3: Get Statistics
  console.log('\n📊 Test 3: File Statistics');
  try {
    const stats = await geminiFileSearch.getStats();
    console.log('✅ Statistics:');
    console.log(`   Total files: ${stats.totalFiles}`);
    console.log(`   Total size: ${stats.totalSizeMB.toFixed(2)} MB`);
    console.log(`   File types:`, stats.filesByType);
  } catch (error) {
    console.error('❌ Statistics test failed:', error);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ All tests completed!\n');
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
