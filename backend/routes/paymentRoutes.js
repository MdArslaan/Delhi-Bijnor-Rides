const express = require('express');
const router = express.Router();
const { payPremium } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/premium', protect, payPremium);

module.exports = router;
