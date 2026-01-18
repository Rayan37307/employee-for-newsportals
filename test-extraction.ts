import { UniversalNewsAgent } from './lib/universal-news-agent';

async function runStressTest() {
  console.log('========================================');
  console.log('🚨 SITE-STRESS TEST - EXECUTION PROOF');
  console.log('========================================\n');

  const testSites = [
    {
      name: 'Rupali Bangladesh',
      url: 'https://www.rupalibangladesh.com/latest-news',
      expectedType: 'HTML'
    },
    {
      name: 'Prothom Alo',
      url: 'https://www.prothomalo.com',
      expectedType: 'Mixed'
    }
  ];

  for (const site of testSites) {
    console.log(`\n🔍 TESTING: ${site.name}`);
    console.log(`   URL: ${site.url}`);
    console.log(`   Expected: ${site.expectedType}`);
    console.log('   ' + '═'.repeat(60));

    try {
      const startTime = Date.now();
      const agent = new UniversalNewsAgent({
        url: site.url,
        maxConcurrency: 2,
        cacheTimeout: 0
      });

      const result = await agent.fetchNews();
      await agent.cleanup();
      
      const duration = Date.now() - startTime;

      console.log(`\n   ✅ SUCCESS: ${result.success}`);
      console.log(`   📊 METHOD: ${result.method}`);
      console.log(`   ⏱️ DURATION: ${(duration / 1000).toFixed(1)}s`);
      console.log(`   📰 ARTICLES FOUND: ${result.articles.length}`);

      if (result.articles.length > 0) {
        const article = result.articles[0];
        
        console.log(`\n   📄 EXTRACTION TRACE (First Article):`);
        console.log(`      url_fetched: ${article.extraction_trace.url_fetched}`);
        console.log(`      fetch_method: ${article.extraction_trace.fetch_method}`);
        console.log(`      article_root_selector: ${article.extraction_trace.article_root_selector}`);
        console.log(`      paragraphs_found: ${article.extraction_trace.paragraphs_found}`);
        console.log(`      content_length: ${article.extraction_trace.content_length}`);
        console.log(`      fallback_used: ${article.extraction_trace.fallback_used}`);
        if (article.extraction_trace.failure_reason) {
          console.log(`      failure_reason: ${article.extraction_trace.failure_reason}`);
        }

        console.log(`\n   📰 SAMPLE ARTICLE:`);
        console.log(`      Title: ${article.title.substring(0, 80)}...`);
        console.log(`      Content length: ${article.content.length} chars`);
        console.log(`      Extraction failed: ${article.extraction_failed}`);

        if (article.content.length > 0) {
          console.log(`\n   📝 CONTENT PREVIEW:`);
          console.log(`      ${article.content.substring(0, 200).replace(/\n/g, ' ')}...`);
        }
      } else if (result.error) {
        console.log(`\n   ❌ ERROR: ${result.error}`);
      }

      console.log('\n   ' + '═'.repeat(60));

    } catch (error) {
      console.log(`\n   ❌ EXCEPTION: ${error}`);
      console.log('   ' + '═'.repeat(60));
    }
  }

  console.log('\n========================================');
  console.log('✅ STRESS TEST COMPLETE');
  console.log('========================================\n');
}

runStressTest().catch(console.error);
