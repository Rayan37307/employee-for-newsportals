import { getLatestNews } from './lib/bangladesh-guardian-agent.ts';

async function runTest() {
  console.log('Running Bangladesh Guardian scraper test...');
  try {
    const news = await getLatestNews();
    console.log(`Scraper test completed. Found ${news.length} articles.`);
    if (news.length > 0) {
      console.log('First article:', news[0]);
    }
  } catch (error) {
    console.error('Scraper test failed:', error);
  }
}

runTest();
