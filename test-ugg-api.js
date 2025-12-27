/**
 * UGG Demandware API 테스트
 */

async function testUGGAPI() {
  console.log('🔍 Testing UGG Demandware API endpoints...\n');

  const productId = '1117659';
  const baseUrl = 'https://www.ugg.com/on/demandware.store/Sites-UGG-US-Site/en_US';

  const endpoints = [
    {
      name: 'Product-Variation',
      url: `${baseUrl}/Product-Variation?pid=${productId}&Quantity=1`,
    },
    {
      name: 'Product-Show',
      url: `${baseUrl}/Product-Show?pid=${productId}`,
    },
    {
      name: 'Component-GetSliderImages',
      url: `${baseUrl}/Component-GetSliderImages?pid=${productId}&includeImages=true`,
    },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);

    try {
      const response = await fetch(endpoint.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.ugg.com/women-slippers/cozy-slipper/1117659.html',
        },
      });

      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log(`Content-Type: ${response.headers.get('content-type')}`);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType?.includes('application/json')) {
          data = await response.json();
          console.log('✅ JSON Response:');
          console.log(JSON.stringify(data, null, 2).substring(0, 500));
        } else {
          const text = await response.text();
          console.log('📄 Text Response (first 500 chars):');
          console.log(text.substring(0, 500));
        }
      } else {
        const text = await response.text();
        console.log('❌ Error Response:');
        console.log(text.substring(0, 300));
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log(`Stack: ${error.stack}`);
    }

    console.log('---');
  }
}

testUGGAPI().catch(console.error);
