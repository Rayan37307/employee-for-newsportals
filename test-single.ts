import { UniversalNewsAgent } from './lib/universal-news-agent';

async function testSingleSite() {
  console.log('========================================');
  console.log('🚨 KALER KANTHO EXTRACTION TEST');
  console.log('========================================\n');

  // Test Kaler Kantho specifically
  const testUrl = 'https://www.kalerkantho.com';

  console.log(`🔍 TESTING: ${testUrl}\n`);

  try {
    const agent = new UniversalNewsAgent({
      url: testUrl,
      maxConcurrency: 1,
      cacheTimeout: 0
    });

    const startTime = Date.now();
    const result = await agent.fetchNews();
    const duration = Date.now() - startTime;

    console.log(`✅ SUCCESS: ${result.success}`);
    console.log(`📊 METHOD: ${result.method}`);
    console.log(`⏱️ DURATION: ${duration}ms`);
    console.log(`📰 ARTICLES FOUND: ${result.articles.length}`);

    if (result.articles.length > 0) {
      const article = result.articles[0];
      
      console.log(`\n📄 EXTRACTION TRACE:`);
      console.log(`   url_fetched: ${article.extraction_trace.url_fetched}`);
      console.log(`   fetch_method: ${article.extraction_trace.fetch_method}`);
      console.log(`   article_root_selector: ${article.extraction_trace.article_root_selector}`);
      console.log(`   paragraphs_found: ${article.extraction_trace.paragraphs_found}`);
      console.log(`   content_length: ${article.extraction_trace.content_length}`);
      console.log(`   fallback_used: ${article.extraction_trace.fallback_used}`);
      if (article.extraction_trace.failure_reason) {
        console.log(`   failure_reason: ${article.extraction_trace.failure_reason}`);
      }

      console.log(`\n📰 SAMPLE ARTICLE:`);
      console.log(`   Title: ${article.title.substring(0, 80)}...`);
      console.log(`   Content length: ${article.content.length} chars`);
      console.log(`   Extraction failed: ${article.extraction_failed}`);

      if (article.content.length > 100) {
        console.log(`\n📝 CONTENT PREVIEW:`);
        console.log(`   ${article.content.substring(0, 300).replace(/\n/g, ' ')}...`);
      }
    } else if (result.error) {
      console.log(`\n❌ ERROR: ${result.error}`);
    }

    await agent.cleanup();

  } catch (error) {
    console.log(`\n❌ EXCEPTION: ${error}`);
  }

  console.log('\n========================================\n');
}

testSingleSite().catch(console.error);
