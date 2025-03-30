const axios = require('axios');

async function testFalAi() {
  const apiKey = process.env.FAL_AI_API_KEY;
  console.log('FAL AI API Key exists:', !!apiKey);
  
  if (!apiKey) {
    console.error('No FAL AI API key found in environment variables');
    return;
  }

  // Правильно форматируем ключ с префиксом "Key"
  const formattedApiKey = apiKey.startsWith('Key ') ? apiKey : `Key ${apiKey}`;
  console.log('Formatted key starts with "Key":', formattedApiKey.startsWith('Key '));
  
  try {
    const response = await axios.post(
      'https://gateway.fal.ai/v1/image-analysis',
      { image_url: 'https://picsum.photos/600/400', detail_level: 'high' },
      { 
        headers: {
          'Authorization': formattedApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000
      }
    );
    
    console.log('Success! Status:', response.status);
    console.log('Response has data:', !!response.data);
    console.log('Data keys:', Object.keys(response.data));
  } catch (error) {
    console.error('Error testing FAL AI API:');
    
    if (axios.isAxiosError(error)) {
      console.log('Status:', error.response?.status);
      console.log('Response data:', error.response?.data);
      console.log('Headers:', JSON.stringify(error.response?.headers, null, 2));
    } else {
      console.error(error);
    }
  }
}

testFalAi();
