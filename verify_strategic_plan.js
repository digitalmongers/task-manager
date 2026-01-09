import "dotenv/config";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Task from "./models/Task.js";
import VitalTask from "./models/VitalTask.js";
import AIService from "./services/ai/aiService.js";
import AIPlan from "./models/AIPlan.js";

async function verifyStrategicPlanEnhancement() {
  await connectDB();
  console.log("✅ Connected to DB\n");

  // Get or Create a test user
  let testUser = await User.findOne({ email: "strategic.tester@example.com" });
  if (!testUser) {
    testUser = await User.create({
      firstName: "Strategic",
      lastName: "Tester",
      email: "strategic.tester@example.com",
      password: "Password123!",
      plan: 'PRO' // Ensure plan has AI_PLANNER access
    });
  }

  // Create some dummy tasks to plan
  await VitalTask.create([
    { user: testUser._id, title: "Launch Marketing Campaign", description: "Need to reach 10k users" },
    { user: testUser._id, title: "Fix Critical Production Bug", description: "Payment gateway is failing for some users" }
  ]);

  await Task.create([
    { user: testUser._id, title: "Update Documentation", description: "Improve the frontend integration guide" },
    { user: testUser._id, title: "Team Meeting", dueDate: new Date() },
    { user: testUser._id, title: "Code Review", dueDate: new Date() }
  ]);

  // Create some recently completed tasks for learning context
  await Task.create([
    { user: testUser._id, title: "Emails and Slack messages", isCompleted: true, completedAt: new Date(), description: "Communication task" },
    { user: testUser._id, title: "Code Refactor: Auth system", isCompleted: true, completedAt: new Date(), description: "Technical execution" },
    { user: testUser._id, title: "Fixed CSS grid issue", isCompleted: true, completedAt: new Date(), description: "Technical execution" }
  ]);

  try {
    console.log("Generating Strategic Plan with Learning Memory...");
    const plan = await AIService.generateStrategicPlan(testUser._id);
    
    if (plan && plan.content) {
      const content = JSON.parse(plan.content);
      
      console.log("\n--- 🧠 AI Learning Insights ---");
      if (Array.isArray(content.learningInsights)) {
        content.learningInsights.forEach(ins => console.log(`- ${ins}`));
        console.log("✅ SUCCESS: Learning Insights found!");
      } else {
        console.log("❌ FAILED: Learning Insights missing or not an array.");
      }

      console.log("\n--- Workload Balance Insight ---");
      if (content.workloadInsight) {
        console.log(`⚖️ Load: ${content.workloadInsight.todayLoad}`);
        console.log(`🌙 Focus: ${content.workloadInsight.focusQuality}`);
        console.log(`💡 Recommendation: ${content.workloadInsight.recommendation}`);
        console.log("✅ SUCCESS: Workload Insight found!");
      } else {
        console.log("❌ FAILED: Workload Insight missing.");
      }

      console.log("\n--- Generated Plan Risks ---");
      if (Array.isArray(content.risks)) {
        content.risks.forEach((r, i) => {
          console.log(`${i+1}. Risk: ${r.risk || r.issue}`);
          console.log(`   Solution: ${r.solution || r.fix || 'MISSING'}`);
        });
        
        const allHaveSolutions = content.risks.every(r => r.solution || r.fix);
        if (allHaveSolutions) {
          console.log("\n✅ SUCCESS: All risks have solutions!");
        } else {
          console.log("\n❌ FAILED: Some risks are missing solutions.");
        }
      } else {
        console.log("❌ FAILED: Risks is not an array or in wrong format.");
      }
    } else {
      console.log("❌ FAILED: No plan generated.");
    }

  } catch (err) {
    console.error("❌ Test error:", err.message);
  } finally {
    // Cleanup
    await VitalTask.deleteMany({ user: testUser._id });
    await Task.deleteMany({ user: testUser._id });
    await AIPlan.deleteMany({ user: testUser._id });
    // Keep the test user for next time or delete it
    // await User.findByIdAndDelete(testUser._id);
    
    await import('mongoose').then(m => m.default.connection.close());
    process.exit();
  }
}

verifyStrategicPlanEnhancement();
