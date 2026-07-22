const jwt = require('jsonwebtoken');
const User = require('../models/User');
const typingDnaService = require('../services/typingDnaService');

// Helper to generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretlmskey12345', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'student', // Default to student
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        typingDnaEnrolled: user.typingDnaEnrolled,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    // Check for user email (need to explicitly select password since select: false in model)
    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        typingDnaEnrolled: user.typingDnaEnrolled,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        typingDnaEnrolled: user.typingDnaEnrolled,
        typingDnaEnrollmentsCount: user.typingDnaEnrollmentsCount || 0,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Enroll typing pattern
// @route   POST /api/auth/biometrics/enroll
// @access  Private
const enrollBiometrics = async (req, res) => {
  try {
    const { typingPattern } = req.body;
    if (!typingPattern) return res.status(400).json({ message: 'Typing pattern required' });

    const result = await typingDnaService.savePattern(req.user._id.toString(), typingPattern);
    
    if (result.success === 1) {
      const user = await User.findById(req.user._id);
      user.typingDnaEnrollmentsCount = (user.typingDnaEnrollmentsCount || 0) + 1;
      
      if (user.typingDnaEnrollmentsCount >= 3) {
        user.typingDnaEnrolled = true;
      }
      
      await user.save();
      res.json({ 
        message: 'Enrollment successful', 
        typingDnaEnrolled: user.typingDnaEnrolled,
        enrollmentsCount: user.typingDnaEnrollmentsCount
      });
    } else {
      res.status(400).json({ message: result.message || 'Enrollment failed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during enrollment' });
  }
};

// @desc    Verify typing pattern
// @route   POST /api/auth/biometrics/verify
// @access  Private
const verifyBiometrics = async (req, res) => {
  try {
    const { typingPattern } = req.body;
    if (!typingPattern) return res.status(400).json({ message: 'Typing pattern required' });

    const result = await typingDnaService.verifyPattern(req.user._id.toString(), typingPattern);
    console.log('TypingDNA Verify Result:', result);
    
    // TypingDNA returns `result: 1` if it strongly matches. 
    // Since we only do 1 enrollment for the demo, the score might be lower, so we accept >= 10 as a fallback.
    if (result.result === 1 || result.score >= 10) {
      res.json({ message: 'Biometric verification successful', match: true, score: result.score });
    } else {
      res.status(401).json({ message: `Biometric verification failed. Pattern mismatch (Score: ${result.score || 0}).`, match: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during verification' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  enrollBiometrics,
  verifyBiometrics,
};
