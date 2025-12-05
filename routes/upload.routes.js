import express from 'express';
import upload from '../middlewares/upload.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { uploadSingle, uploadMultiple, uploadFields } from '../controllers/upload.js';

const router = express.Router();

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
