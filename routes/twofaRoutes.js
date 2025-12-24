import express from 'express';
import TwoFAController from '../controllers/twofaController.js';
import { protect } from '../middlewares/authMiddleware.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for 2FA verification attempts
const twoFaLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5,
    message: { 
        success: false, 
        message: 'Too many 2FA attempts, please try again later' 
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Setup 2FA (requires login)
router.post(
    '/setup',
    protect,
    asyncHandler(TwoFAController.setup.bind(TwoFAController))
);

// Verify and Enable 2FA (requires login)
router.post(
    '/verify',
    protect,
    twoFaLimiter,
    asyncHandler(TwoFAController.verifyAndEnable.bind(TwoFAController))
);

// Verify Login (public/semi-public - requires temp token)
router.post(
    '/verify-login',
    twoFaLimiter,
    asyncHandler(TwoFAController.verifyLogin.bind(TwoFAController))
);

// Disable 2FA (requires login)
router.post(
    '/disable',
    protect,
    twoFaLimiter,
    asyncHandler(TwoFAController.disable.bind(TwoFAController))
);

// Regenerate backup codes (requires login)
router.post(
    '/backup-codes/regenerate',
    protect,
    asyncHandler(TwoFAController.regenerateBackupCodes.bind(TwoFAController))
);

export default router;
