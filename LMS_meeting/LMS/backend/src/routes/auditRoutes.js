const express = require('express');
const router = express.Router({ mergeParams: true });
const { getSessionAuditLogs, createAuditLog } = require('../controllers/auditController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getSessionAuditLogs)
  .post(protect, createAuditLog);

module.exports = router;
