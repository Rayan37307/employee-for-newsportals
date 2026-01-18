import { NewsSourceManager } from './lib/news-source-manager';

async function testSourceManager() {
  console.log('========================================');
  console.log('🚨 NEWS SOURCE MANAGER INTEGRATION TEST');
  console.log('========================================\n');

  const testCases = [
    {
      name: 'Rupali Bangladesh - Universal Agent',
      type: 'UNIVERSAL_AGENT',
      url: 'https://www.rupalibangladesh.com/latest-news'
    },
    {
      name: 'Rupali Bangladesh - RSS (Direct)',
      type: 'RSS',
      url: 'https://www.rupalibangladesh.com/feed',
      rssUrl: 'https://www.rupalibangladesh.com/feed'
    },
    {
      name: 'Auto Discovery',
      type: 'AUTO',
      url: 'https://www.rupalibangladesh.com'
    }
  ];

  const manager = new NewsSourceManager();

  for (const testCase of testCases) {
    console.log(`\n🔍 TESTING: ${testCase.name}`);
    console.log(`   Type: ${testCase.type}`);
    console.log(`   URL: ${testCase.url}`);
    console.log('   ' + '='.repeat(60));

    try {
      const startTime = Date.now();
      
      const result = await manager.fetchNewsSource(testCase.type, {
        url: testCase.url,
        rssUrl: testCase.rssUrl
      });

      const duration = Date.now() - startTime;

      console.log(`\n   ✅ SUCCESS: ${result.success}`);
      console.log(`   📊 METHOD: ${result.method}`);
      console.log(`   ⏱️ DURATION: ${(duration / 1000).toFixed(1)}s`);
      console.log(`   📰 ITEMS FOUND: ${result.items.length}`);

      if (result.items.length > 0) {
        const item = result.items[0];
        
        console.log(`\n   📰 SAMPLE ITEM:`);
        console.log(`      Title: ${item.title?.substring(0, 80)}...`);
        console.log(`      URL: ${item.url}`);
        console.log(`      Content length: ${item.content?.length || 0} chars`);
        console.log(`      Has image: ${!!item.image}`);
        console.log(`      Has author: ${!!item.author}`);

        if (item.content && item.content.length > 50) {
          console.log(`\n   📝 CONTENT PREVIEW:`);
          console.log(`      ${item.content.substring(0, 200).replace(/\n/g, ' ')}...`);
        }
      } else if (result.error) {
        console.log(`\n   ❌ ERROR: ${result.error}`);
      }

      console.log('\n   ' + '='.repeat(60));

    } catch (error) {
      console.log(`\n   ❌ EXCEPTION: ${error}`);
      console.log('   ' + '='.repeat(60));
    }
  }

  console.log('\n========================================');
  console.log('✅ SOURCE MANAGER TEST COMPLETE');
  console.log('========================================\n');
}

testSourceManager().catch(console.error);
