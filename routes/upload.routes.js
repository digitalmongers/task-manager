/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: File upload endpoints using Cloudinary
 */

import express from 'express';
import upload from '../middleware/upload.js';
import asyncHandler from '../middleware/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: File uploaded successfully
 *                 data:
 *                   $ref: '#/components/schemas/FileUpload'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/single', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('File is required');
  }

  ApiResponse.success(res, 200, 'File uploaded successfully', {
    url: req.file.path,
    publicId: req.file.filename,
    format: req.file.format,
    resourceType: req.file.resourceType,
    size: req.file.size,
  });
}));

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Files uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     files:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FileUpload'
 *                     count:
 *                       type: integer
 *                       example: 3
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/multiple', upload.array('files', 10), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('No files uploaded');
  }

  const uploadedFiles = req.files.map(file => ({
    url: file.path,
    publicId: file.filename,
    format: file.format,
    resourceType: file.resourceType,
    size: file.size,
  }));

  ApiResponse.success(res, 200, 'Files uploaded successfully', {
    files: uploadedFiles,
    count: uploadedFiles.length,
  });
}));

/**
 * @swagger
 * /upload/fields:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Upload files from multiple fields
 *     description: Upload files from different form fields (avatar and gallery)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image (max 1)
 *               gallery:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 5
 *                 description: Gallery images (max 5)
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Files uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     avatar:
 *                       $ref: '#/components/schemas/FileUpload'
 *                     gallery:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FileUpload'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/fields', 
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'gallery', maxCount: 5 }
  ]), 
  asyncHandler(async (req, res) => {
    const response = {
      avatar: req.files.avatar ? {
        url: req.files.avatar[0].path,
        publicId: req.files.avatar[0].filename,
      } : null,
      gallery: req.files.gallery ? req.files.gallery.map(f => ({
        url: f.path,
        publicId: f.filename,
      })) : [],
    };

    ApiResponse.success(res, 200, 'Files uploaded successfully', response);
  })
);

export default router;
