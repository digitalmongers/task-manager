import expressAsyncHandler from 'express-async-handler';
import RazorpayService from '../services/razorpayService.js';
import Payment from '../models/Payment.js';
import { TOPUP_PACKAGES } from '../config/aiConfig.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

/**
 * @desc    Get available top-up packages
 * @route   GET /api/topups/packages
 * @access  Private
 */
export const getTopupPackages = expressAsyncHandler(async (req, res) => {
  // Return packages with pricing info
  const packages = Object.keys(TOPUP_PACKAGES).map(key => ({
    id: key,
    ...TOPUP_PACKAGES[key]
  }));

  res.json({
    success: true,
    packages
  });
});

/**
 * @desc    Create Razorpay order for top-up purchase
 * @route   POST /api/topups/create-order
 * @access  Private
 */
export const createTopupOrder = expressAsyncHandler(async (req, res) => {
  const { topupPackage } = req.body;
  const userId = req.user._id;

  // Validate package selection
  if (!topupPackage || !TOPUP_PACKAGES[topupPackage]) {
    throw ApiError.badRequest('Invalid top-up package selected');
  }

  const packageInfo = TOPUP_PACKAGES[topupPackage];

  // Create Razorpay order
  const order = await RazorpayService.createTopupOrder(userId, topupPackage);

  // Log top-up order creation in database
  await Payment.create({
    user: userId,
    purchaseType: 'topup',
    topupPackage: topupPackage,
    amount: packageInfo.price,
    currency: packageInfo.currency,
    razorpayOrderId: order.id,
    boostsAdded: packageInfo.boosts,
    status: 'created',
  });

  Logger.info('Top-up order created', {
    userId,
    package: topupPackage,
    orderId: order.id,
    boosts: packageInfo.boosts
  });

  res.status(201).json({
    success: true,
    order,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    packageInfo: {
      name: packageInfo.name,
      boosts: packageInfo.boosts,
      price: packageInfo.price,
      currency: packageInfo.currency
    }
  });
});
