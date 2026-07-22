const User = require('../models/User');
const Course = require('../models/Course');
const Assignment = require('../models/Assignment');
const Quiz = require('../models/Quiz');

// @desc    Get Admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private (Admin only)
const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const studentsCount = await User.countDocuments({ role: 'student' });
    const teachersCount = await User.countDocuments({ role: 'teacher' });
    const adminsCount = await User.countDocuments({ role: 'admin' });
    const coursesCount = await Course.countDocuments();
    const assignmentsCount = await Assignment.countDocuments();
    const quizzesCount = await Quiz.countDocuments();

    res.json({
      totalUsers,
      studentsCount,
      teachersCount,
      adminsCount,
      coursesCount,
      assignmentsCount,
      quizzesCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users list
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private (Admin only)
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!role || !['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Please provide a valid role' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent changing own role (or safeguard admin status)
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }

    user.role = role;
    await user.save();

    res.json({
      message: 'User role updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete yourself' });
    }

    // If student, remove from all course enrollments
    if (user.role === 'student') {
      await Course.updateMany(
        { studentsEnrolled: user._id },
        { $pull: { studentsEnrolled: user._id } }
      );
    }

    // If teacher, clear course association or delete teacher courses?
    // In a demo we just delete the user.
    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAdminStats,
  getAllUsers,
  updateUserRole,
  deleteUser,
};
