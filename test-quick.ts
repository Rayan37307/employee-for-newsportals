import { UniversalNewsAgent } from './lib/universal-news-agent';

async function quickTest() {
  console.log('========================================');
  console.log('⚡ QUICK EXTRACTION TEST (OPTIMIZED)');
  console.log('========================================\n');

  const startTime = Date.now();
  
  const agent = new UniversalNewsAgent({
    url: 'https://www.rupalibangladesh.com/latest-news',
    maxConcurrency: 5,
    cacheTimeout: 0
  });

  const result = await agent.fetchNews();
  await agent.cleanup();
  
  const duration = Date.now() - startTime;

  console.log(`✅ SUCCESS: ${result.success}`);
  console.log(`⏱️ DURATION: ${(duration / 1000).toFixed(1)}s`);
  console.log(`📰 ARTICLES: ${result.articles.length}`);

  if (result.articles.length > 0) {
    const article = result.articles[0];
    console.log(`\n📄 EXTRACTION TRACE:`);
    console.log(`   fetch_method: ${article.extraction_trace.fetch_method}`);
    console.log(`   content_length: ${article.extraction_trace.content_length}`);
    console.log(`   paragraphs_found: ${article.extraction_trace.paragraphs_found}`);
    console.log(`   quality_score: ${article.extraction_trace.content_quality_score}`);
    console.log(`\n📰 SAMPLE:`);
    console.log(`   ${article.title.substring(0, 60)}...`);
    console.log(`   ${article.content.substring(0, 150).replace(/\n/g, ' ')}...`);
  }

  console.log('\n========================================\n');
}

quickTest().catch(console.error);
