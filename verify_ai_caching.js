import "dotenv/config";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import AIService from "./services/ai/aiService.js";
import cacheService from "./services/cacheService.js";

async function verifyCaching() {
  await connectDB();
  console.log("✅ Connected to DB\n");

  // Create test user
  const testUser = await User.create({
    firstName: "Cache",
    lastName: "Tester",
    email: `cache.test.${Date.now()}@example.com`,
    password: "Password123!",
  });

  try {
    // 1. Mock AIService.run temporarily to simulate slow AI
    const originalRun = AIService.run;
    let callCount = 0;
    
    AIService.run = async function() {
      callCount++;
      console.log(`[MOCK] AI Called (Call #${callCount})`);
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s delay
      return JSON.stringify([
        { title: "Test Task 1", suggestedPriority: "high" },
        { title: "Test Task 2", suggestedPriority: "medium" }
      ]);
    };

    const data = {
      userId: testUser._id,
      title: "Optimizing code",
      description: "Working on Redis integration"
    };

    // Clean cache first
    await cacheService.deletePattern(`ai_suggestions:*`);

    console.log("\n[Test 1] First call (should hit AI & cache)...");
    const start1 = Date.now();
    const result1 = await AIService.generateTaskSuggestions(data);
    const end1 = Date.now();
    console.log(`⏱️  First call took: ${end1 - start1}ms`);
    console.log(`📦 Result: Found ${result1.suggestions?.length || 0} suggestions`);

    console.log("\n[Test 2] Second call (should hit CACHE)...");
    const start2 = Date.now();
    const result2 = await AIService.generateTaskSuggestions(data);
    const end2 = Date.now();
    console.log(`⏱️  Second call took: ${end2 - start2}ms`);
    
    // 4. Save report
    const report = {
      test1_time: `${end1 - start1}ms`,
      test2_time: `${end2 - start2}ms`,
      cached: (end2 - start2) < 200 && callCount === 1,
      suggestions_count: result1.suggestions?.length || 0
    };
    
    import('fs').then(fs => {
      fs.writeFileSync('cache_report.json', JSON.stringify(report, null, 2));
      console.log("\n✅ Report written to cache_report.json");
    });

  } catch (err) {
    console.error("❌ Test error:", err.message);
  } finally {
    await User.findByIdAndDelete(testUser._id);
    await cacheService.deletePattern(`ai_suggestions:*`);
    await import('mongoose').then(m => m.default.connection.close());
    process.exit();
  }
}

verifyCaching();
