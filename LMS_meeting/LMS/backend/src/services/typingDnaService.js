const axios = require('axios');

const TYPINGDNA_URL = 'https://api.typingdna.com';

const getAuthHeader = () => {
  const { TYPINGDNA_API_KEY, TYPINGDNA_API_SECRET } = process.env;
  if (!TYPINGDNA_API_KEY || !TYPINGDNA_API_SECRET) {
    throw new Error('TypingDNA credentials not configured on server');
  }
  return 'Basic ' + Buffer.from(`${TYPINGDNA_API_KEY}:${TYPINGDNA_API_SECRET}`).toString('base64');
};

const savePattern = async (userId, typingPattern) => {
  try {
    const authHeader = getAuthHeader();
    const response = await axios.post(
      `${TYPINGDNA_URL}/save/${userId}`,
      new URLSearchParams({ tp: typingPattern }),
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('TypingDNA Save Error:', error.response?.data || error.message);
    if (error.response && error.response.data) {
      return error.response.data;
    }
    throw new Error('Failed to save typing pattern');
  }
};

const verifyPattern = async (userId, typingPattern) => {
  try {
    const authHeader = getAuthHeader();
    const response = await axios.post(
      `${TYPINGDNA_URL}/verify/${userId}`,
      new URLSearchParams({ tp: typingPattern }),
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('TypingDNA Verify Error:', error.response?.data || error.message);
    if (error.response && error.response.data) {
      return error.response.data;
    }
    throw new Error('Failed to verify typing pattern');
  }
};

module.exports = {
  savePattern,
  verifyPattern,
};
