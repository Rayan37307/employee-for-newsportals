import { getLatestNews } from '@/lib/bangladesh-guardian-agent';

// Test the Bangladesh Guardian Agent
async function testBangladeshGuardianAgent() {
  console.log('Testing Bangladesh Guardian Agent...');

  try {
    console.log('Fetching news...');
    const articles = await getLatestNews();

    console.log(`Number of articles found: ${articles.length}`);

    if (articles.length > 0) {
      console.log('\nFirst article preview:');
      console.log(`Title: ${articles[0].title}`);
      console.log(`Link: ${articles[0].link}`);
      console.log(`Description: ${articles[0].description ? articles[0].description.substring(0, 100) + '...' : 'N/A'}`);
      console.log(`Image: ${articles[0].image ? 'Available' : 'N/A'}`);
      console.log(`Date: ${articles[0].date || 'N/A'}`);
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run test
testBangladeshGuardianAgent();