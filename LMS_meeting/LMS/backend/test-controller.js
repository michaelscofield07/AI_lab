const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const { enrollBiometrics } = require('./src/controllers/authController');

async function testController() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/lms');

  const req = {
    user: { _id: new mongoose.Types.ObjectId() },
    body: { typingPattern: "1,2,3,4,5,6" } // Invalid pattern to trigger 445
  };

  const res = {
    status: function(code) {
      console.log('Status set to:', code);
      return this;
    },
    json: function(data) {
      console.log('Response JSON:', data);
      return this;
    }
  };

  try {
    await enrollBiometrics(req, res);
  } catch (err) {
    console.error("Uncaught error:", err);
  }

  mongoose.disconnect();
}

testController();
