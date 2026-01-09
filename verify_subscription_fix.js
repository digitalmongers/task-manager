import "dotenv/config";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import { createSubscription } from "./controllers/paymentController.js";

// Mocking express-async-handler and res/req
const mockRes = {
  status: function(code) { this.statusCode = code; return this; },
  json: function(data) { this.data = data; return this; }
};

import RazorpayService from "./services/razorpayService.js";

// Mock RazorpayService.createSubscription
const originalCreateSub = RazorpayService.createSubscription;
RazorpayService.createSubscription = async (userId, planKey, billingCycle) => {
  console.log(`[MOCK] Creating Subscription for ${planKey} ${billingCycle}`);
  return { id: "sub_test_123", status: "created" };
};

async function verifySubscriptionFix() {
  await connectDB();
  console.log("✅ Connected to DB\n");

  // Get a test user
  let user = await User.findOne({ email: "strategic.tester@example.com" });
  if (!user) {
    console.log("❌ Test user not found. Run previous verification first.");
    process.exit(1);
  }

  // Set user to TEAM MONTHLY Active
  user.plan = "TEAM";
  user.billingCycle = "MONTHLY";
  user.subscriptionStatus = "active";
  await user.save();
  console.log("Setting user to: TEAM MONTHLY (active)");

  const reqUpgrade = {
    user: { _id: user._id },
    body: { planKey: "TEAM", billingCycle: "YEARLY" }
  };

  const reqSame = {
    user: { _id: user._id },
    body: { planKey: "TEAM", billingCycle: "MONTHLY" }
  };

  try {
    console.log("\nScenario 1: Upgrade from TEAM MONTHLY to TEAM YEARLY");
    // We expect this NOT to throw an error now
    await createSubscription(reqUpgrade, mockRes, (err) => { if (err) throw err; });
    console.log("✅ SUCCESS: Transition allowed!");

    console.log("\nScenario 2: Try to subscribe to TEAM MONTHLY again");
    // We expect this to THROW a badRequest error
    try {
      await createSubscription(reqSame, mockRes, (err) => { if (err) throw err; });
      console.log("❌ FAILED: Duplicate subscription was allowed.");
    } catch (err) {
      console.log(`✅ SUCCESS: Correctly blocked with error: "${err.message}"`);
    }

  } catch (err) {
    console.error("❌ Test error:", err.message);
  } finally {
    await import('mongoose').then(m => m.default.connection.close());
    process.exit();
  }
}

verifySubscriptionFix();
