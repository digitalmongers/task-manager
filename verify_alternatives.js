import "dotenv/config";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import AIService from "./services/ai/aiService.js";
import VitalTask from "./models/VitalTask.js";

async function verifyAlternativeStrategies() {
  await connectDB();
  console.log("✅ Connected to DB\n");

  const testUser = await User.findOne({ email: "strategic.tester@example.com" });
  if (!testUser) {
    console.log("❌ Test user not found. Run verify_strategic_plan.js first.");
    process.exit(1);
  }

  try {
    console.log("Generating 🔀 Alternative Strategies...");
    const strategies = await AIService.generateAlternativeStrategies(testUser._id);
    
    if (Array.isArray(strategies) && strategies.length === 3) {
      console.log("\n✅ SUCCESS: Generated exactly 3 strategies!");
      
      strategies.forEach((s, i) => {
        console.log(`\n--- Strategy ${i + 1}: ${s.type} ---`);
        console.log(`Title: ${s.title}`);
        console.log(`Outcome: ${s.expectedOutcome}`);
        console.log(`Risk: ${s.riskLevel}`);
      });
    } else {
      console.log("❌ FAILED: Did not generate 3 strategies.");
      console.log(strategies);
    }

  } catch (err) {
    console.error("❌ Test error:", err.message);
  } finally {
    await import('mongoose').then(m => m.default.connection.close());
    process.exit();
  }
}

verifyAlternativeStrategies();
