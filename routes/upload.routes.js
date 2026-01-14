import express from 'express';
import upload from '../middlewares/upload.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { protect } from '../middlewares/authMiddleware.js';
import { timezoneMiddleware } from '../middlewares/timezoneMiddleware.js';
import { uploadSingle, uploadMultiple, uploadFields } from '../controllers/upload.js';

const router = express.Router();

// Protect all upload routes
router.use(protect);
router.use(timezoneMiddleware);

router.post('/single', upload.single('file'), asyncHandler(uploadSingle));

router.post('/multiple', upload.array('files', 10), asyncHandler(uploadMultiple));

router.post('/fields', 
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'gallery', maxCount: 5 }
  ]), 
  asyncHandler(uploadFields)
);

export default router;
