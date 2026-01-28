import IndexingService from './services/indexingService.js';
import Logger from './config/logger.js';

async function testIndexing() {
  console.log('--- Testing Indexing Service ---');
  
  // Test 1: Publish URL (Should fail/warn gently without credentials)
  console.log('Test 1: Attempting to publish URL...');
  const result1 = await IndexingService.publishUrl('https://tasskr.com/test-url');
  console.log('Result 1:', result1); // Should be false if no key

  // Test 2: Remove URL
  console.log('Test 2: Attempting to remove URL...');
  const result2 = await IndexingService.removeUrl('https://tasskr.com/test-url-delete');
  console.log('Result 2:', result2);

  console.log('--- Test Complete ---');
}

testIndexing().catch(console.error);
