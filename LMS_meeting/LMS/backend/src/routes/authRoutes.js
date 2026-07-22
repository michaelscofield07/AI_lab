const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  enrollBiometrics,
  verifyBiometrics
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.post('/biometrics/enroll', protect, enrollBiometrics);
router.post('/biometrics/verify', protect, verifyBiometrics);

module.exports = router;
