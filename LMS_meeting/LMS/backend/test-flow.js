const axios = require('axios');

async function testApi() {
  try {
    // 1. Register a test user
    const email = `test${Date.now()}@test.com`;
    console.log('Registering', email);
    const regRes = await axios.post('http://localhost:5001/api/auth/register', {
      name: 'Test User',
      email: email,
      password: 'password123',
      role: 'student'
    });
    const token = regRes.data.token;
    console.log('Got token:', token.substring(0, 10) + '...');

    // 2. Try biometrics enroll
    console.log('Enrolling...');
    const enrollRes = await axios.post('http://localhost:5001/api/auth/biometrics/enroll', {
      typingPattern: '1,2,3,4,5,6'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Enroll status:', enrollRes.status);
    console.log('Enroll data:', enrollRes.data);
  } catch (error) {
    console.log('API Error Status:', error.response?.status);
    console.log('API Error Data:', error.response?.data);
  }
}

testApi();
