const { generateCardImage } = require('./lib/card-generator');

// Test data
const testTemplate = {
  canvasData: JSON.stringify({
    width: 800,
    height: 400,
    objects: [
      {
        type: 'rect',
        left: 100,
        top: 50,
        width: 200,
        height: 150,
        fill: '#ff0000',
        dynamicField: 'image'
      },
      {
        type: 'i-text',
        left: 350,
        top: 50,
        text: 'Placeholder Title',
        fontSize: 24,
        dynamicField: 'title'
      }
    ]
  })
};

const testNewsItem = {
  title: 'Test News Title',
  image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
};

const testMapping = {};

async function runTest() {
  console.log('Starting test...');
  try {
    const buffer = await generateCardImage({
      template: testTemplate,
      mapping: testMapping,
      newsItem: testNewsItem
    });
    console.log('Generated buffer size:', buffer.length);
    console.log('Buffer starts with PNG magic:', buffer.slice(0, 8).toString('hex'));
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest();
