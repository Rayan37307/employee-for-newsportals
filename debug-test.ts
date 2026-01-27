import { getLatestNews } from './lib/bangladesh-guardian-agent.ts';

async function runDebugTest() {
  console.log('Running debug test for Bangladesh Guardian scraper...');
  try {
    const news = await getLatestNews();
    console.log(`Debug test completed. Found ${news.length} articles.`);
    if (news.length > 0) {
      console.log('First article:', news[0]);
    } else {
      console.log('No articles found. The scraper may need adjustments for the current website structure.');
    }
  } catch (error) {
    console.error('Debug test failed:', error);
  }
}

runDebugTest();