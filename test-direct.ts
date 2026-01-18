import { UniversalNewsAgent } from './lib/universal-news-agent';

async function testContentValidation() {
  console.log('========================================');
  console.log('🚨 CONTENT VALIDATION STRESS TEST');
  console.log('========================================\n');

  const testSites = [
    {
      name: 'Rupali Bangladesh',
      url: 'https://www.rupalibangladesh.com/latest-news'
    },
    {
      name: 'Another News Site',
      url: 'https://www.banglanews24.com'
    }
  ];

  for (const site of testSites) {
    console.log(`\n🔍 TESTING: ${site.name}`);
    console.log(`   URL: ${site.url}`);
    console.log('   ' + '='.repeat(60));

    try {
      const agent = new UniversalNewsAgent({
        url: site.url,
        maxConcurrency: 2,
        cacheTimeout: 0
      });

      const startTime = Date.now();
      const result = await agent.fetchNews();
      const duration = Date.now() - startTime;

      await agent.cleanup();

      console.log(`\n   ✅ SUCCESS: ${result.success}`);
      console.log(`   📊 METHOD: ${result.method}`);
      console.log(`   ⏱️ DURATION: ${(duration / 1000).toFixed(1)}s`);
      console.log(`   📰 ARTICLES FOUND: ${result.articles.length}`);

      if (result.articles.length > 0) {
        const article = result.articles[0];
        
        console.log(`\n   📄 EXTRACTION TRACE:`);
        console.log(`      url_fetched: ${article.extraction_trace.url_fetched}`);
        console.log(`      fetch_method: ${article.extraction_trace.fetch_method}`);
        console.log(`      article_root_selector: ${article.extraction_trace.article_root_selector}`);
        console.log(`      paragraphs_found: ${article.extraction_trace.paragraphs_found}`);
        console.log(`      content_length: ${article.extraction_trace.content_length}`);
        console.log(`      fallback_used: ${article.extraction_trace.fallback_used}`);
        console.log(`      content_quality_score: ${article.extraction_trace.content_quality_score || 'N/A'}`);
        console.log(`      is_listing_page: ${article.extraction_trace.is_listing_page || false}`);
        console.log(`      is_contact_page: ${article.extraction_trace.is_contact_page || false}`);
        console.log(`      is_advertisement: ${article.extraction_trace.is_advertisement || false}`);
        
        if (article.extraction_trace.content_quality_reasons?.length) {
          console.log(`      quality_reasons: ${article.extraction_trace.content_quality_reasons.join('; ')}`);
        }

        console.log(`\n   📰 SAMPLE ARTICLE:`);
        console.log(`      Title: ${article.title.substring(0, 80)}...`);
        console.log(`      Content length: ${article.content.length} chars`);
        console.log(`      Extraction failed: ${article.extraction_failed}`);

        if (article.content.length > 100) {
          console.log(`\n   📝 CONTENT PREVIEW:`);
          console.log(`      ${article.content.substring(0, 250).replace(/\n/g, ' ')}...`);
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
  console.log('✅ CONTENT VALIDATION TEST COMPLETE');
  console.log('========================================\n');
}

testContentValidation().catch(console.error);
