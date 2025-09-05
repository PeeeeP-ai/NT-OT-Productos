const axios = require('axios');

async function testEndpoint() {
  try {
    console.log('Testing endpoint...');

    const response = await axios.post('http://localhost:4000/execute-sql', {
      query: 'SELECT 1 as test'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response:', response.data);

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testEndpoint();
