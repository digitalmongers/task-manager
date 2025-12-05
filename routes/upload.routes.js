/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: File upload endpoints using Cloudinary
 */

import express from 'express';
import upload from '../middleware/upload.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { uploadSingle, uploadMultiple, uploadFields } from '../controllers/upload.js';

const router = express.Router();

/**
 * @swagger
 * /upload/single:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Upload single file
 *     description: Upload a single image or video file to Cloudinary
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (image or video)
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/single', upload.single('file'), asyncHandler(uploadSingle));

/**
 * @swagger
 * /upload/multiple:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Upload multiple files
 *     description: Upload multiple image or video files to Cloudinary (max 10)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 10
 *                 description: Files to upload (max 10)
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/multiple', upload.array('files', 10), asyncHandler(uploadMultiple));

router.post('/fields', 
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'gallery', maxCount: 5 }
  ]), 
  asyncHandler(uploadFields)
);

export default router;