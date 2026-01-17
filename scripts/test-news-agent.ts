import { UniversalNewsAgent } from '@/lib/universal-news-agent';

// Test the Universal News Agent with a sample website
async function testUniversalNewsAgent() {
  console.log('Testing Universal News Agent...');
  
  // Test with a known RSS-enabled site
  const agent = new UniversalNewsAgent({
    url: 'https://feeds.bbci.co.uk/news/rss.xml',
    maxConcurrency: 3,
    cacheTimeout: 3600000, // 1 hour
    userAgent: 'News-Agent/1.0'
  });

  try {
    console.log('Fetching news...');
    const result = await agent.fetchNews();
    
    console.log(`Success: ${result.success}`);
    console.log(`Method used: ${result.method}`);
    console.log(`Number of articles found: ${result.articles.length}`);
    
    if (result.articles.length > 0) {
      console.log('\nFirst article preview:');
      console.log(`Title: ${result.articles[0].title}`);
      console.log(`Source: ${result.articles[0].source}`);
      console.log(`URL: ${result.articles[0].url}`);
      console.log(`Published: ${result.articles[0].published_at}`);
      console.log(`Content length: ${result.articles[0].content.length} characters`);
    }
    
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    await agent.cleanup();
  }
}

// Test with a sitemap-enabled site
async function testWithSitemapSite() {
  console.log('\n\nTesting with sitemap-enabled site (example)...');
  
  const agent = new UniversalNewsAgent({
    url: 'https://example.com', // Replace with a real site that has sitemap
    maxConcurrency: 3,
    cacheTimeout: 3600000,
    userAgent: 'News-Agent/1.0'
  });

  try {
    console.log('Fetching news from sitemap-enabled site...');
    const result = await agent.fetchNews();
    
    console.log(`Success: ${result.success}`);
    console.log(`Method used: ${result.method}`);
    console.log(`Number of articles found: ${result.articles.length}`);
    
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    await agent.cleanup();
  }
}

// Run tests
testUniversalNewsAgent();
// testWithSitemapSite(); // Commented out as example.com doesn't have news content