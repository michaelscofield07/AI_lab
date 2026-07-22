require('dotenv').config({ path: './.env' });
const axios = require('axios');

async function testTypingDNA() {
  const TYPINGDNA_URL = 'https://api.typingdna.com';
  const { TYPINGDNA_API_KEY, TYPINGDNA_API_SECRET } = process.env;
  
  if (!TYPINGDNA_API_KEY) {
    console.log("No API KEY");
    return;
  }
  
  const authHeader = 'Basic ' + Buffer.from(`${TYPINGDNA_API_KEY}:${TYPINGDNA_API_SECRET}`).toString('base64');
  
  try {
    const response = await axios.post(
      `${TYPINGDNA_URL}/save/testuser123`,
      new URLSearchParams({ tp: "1,2,3,4,5,6" }), // dummy pattern
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    console.log("Success:", response.data);
  } catch (error) {
    console.log("Error status:", error.response?.status);
    console.log("Error data:", error.response?.data);
    console.log("Error message:", error.message);
  }
}

testTypingDNA();
