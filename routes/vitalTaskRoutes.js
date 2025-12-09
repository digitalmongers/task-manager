import express from 'express';
import VitalTaskController from '../controllers/vitalTaskController.js';
import { protect } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validate.js';
import upload from '../middlewares/upload.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {
  createVitalTaskSchema,
  updateVitalTaskSchema,
} from '../validators/vitalTask.validation.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/vital-tasks/stats/me
 * @desc    Get vital task statistics
 * @access  Private
 */
router.get('/stats/me', asyncHandler(VitalTaskController.getVitalTaskStats));

/**
 * @route   POST /api/vital-tasks
 * @desc    Create new vital task
 * @access  Private
 */
router.post(
  '/',
  validate(createVitalTaskSchema),
  asyncHandler(VitalTaskController.createVitalTask)
);

/**
 * @route   GET /api/vital-tasks
 * @desc    Get all vital tasks for user
 * @access  Private
 */
router.get('/', asyncHandler(VitalTaskController.getAllVitalTasks));

/**
 * @route   GET /api/vital-tasks/:id
 * @desc    Get single vital task
 * @access  Private
 */
router.get('/:id', asyncHandler(VitalTaskController.getVitalTaskById));

/**
 * @route   PATCH /api/vital-tasks/:id
 * @desc    Update vital task
 * @access  Private
 */
router.patch(
  '/:id',
  validate(updateVitalTaskSchema),
  asyncHandler(VitalTaskController.updateVitalTask)
);

/**
 * @route   DELETE /api/vital-tasks/:id
 * @desc    Delete vital task
 * @access  Private
 */
router.delete('/:id', asyncHandler(VitalTaskController.deleteVitalTask));

/**
 * @route   POST /api/vital-tasks/:id/toggle-complete
 * @desc    Toggle vital task completion
 * @access  Private
 */
router.post('/:id/toggle-complete', asyncHandler(VitalTaskController.toggleComplete));

/**
 * @route   POST /api/vital-tasks/:id/image
 * @desc    Upload vital task image
 * @access  Private
 */
router.post(
  '/:id/image',
  upload.single('image'),
  asyncHandler(VitalTaskController.uploadVitalTaskImage)
);

/**
 * @route   DELETE /api/vital-tasks/:id/image
 * @desc    Delete vital task image
 * @access  Private
 */
router.delete('/:id/image', asyncHandler(VitalTaskController.deleteVitalTaskImage));

/**
 * @route   POST /api/vital-tasks/:id/restore
 * @desc    Restore deleted vital task
 * @access  Private
 */
router.post('/:id/restore', asyncHandler(VitalTaskController.restoreVitalTask));

/**
 * @route   POST /api/vital-tasks/:id/convert-to-regular
 * @desc    Convert vital task to regular task
 * @access  Private
 */
router.post('/:id/convert-to-regular', asyncHandler(VitalTaskController.convertToRegularTask));

export default router;
