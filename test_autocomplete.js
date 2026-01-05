import "dotenv/config";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import AIService from "./services/ai/aiService.js";

async function testSmartAutocomplete() {
  await connectDB();
  console.log("✅ Connected to DB\n");

  // Create test user
  const testUser = await User.create({
    firstName: "AutoComplete",
    lastName: "Tester",
    email: `autocomplete.test.${Date.now()}@example.com`,
    password: "Password123!",
  });

  try {
    console.log("[1] Testing AI Smart Autocomplete with minimal input...");
    const result1 = await AIService.generateTaskSuggestions({
      userId: testUser._id,
      title: "Fix bug",
      description: ""
    });

    if (result1.error) {
      console.error("❌ FAILED: AI returned error:", result1.error);
    } else if (!result1.suggestions || !Array.isArray(result1.suggestions)) {
      console.error("❌ FAILED: Response is not an array");
    } else if (result1.suggestions.length === 0) {
      console.error("❌ FAILED: Empty suggestions array");
    } else {
      console.log(`✅ SUCCESS: Received ${result1.suggestions.length} suggestions`);
      console.log("\nSuggestion Titles:");
      result1.suggestions.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.title} (Priority: ${s.suggestedPriority})`);
      });
    }

    console.log("\n[2] Testing with detailed input...");
    const result2 = await AIService.generateTaskSuggestions({
      userId: testUser._id,
      title: "Implement user authentication",
      description: "Need to add login and signup functionality with JWT"
    });

    if (result2.suggestions && result2.suggestions.length > 0) {
      console.log(`✅ SUCCESS: Received ${result2.suggestions.length} suggestions`);
      console.log("\nVariety Check:");
      const uniqueTitles = new Set(result2.suggestions.map(s => s.title));
      const uniquePriorities = new Set(result2.suggestions.map(s => s.suggestedPriority));
      console.log(`  - Unique titles: ${uniqueTitles.size}/5`);
      console.log(`  - Unique priorities: ${uniquePriorities.size}`);
      
      if (uniqueTitles.size >= 4) {
        console.log("✅ PASS: Suggestions are sufficiently distinct");
      } else {
        console.log("⚠️  WARNING: Suggestions may be too similar");
      }
    }

  } catch (err) {
    console.error("❌ Test error:", err.message);
  } finally {
    await User.findByIdAndDelete(testUser._id);
    await import('mongoose').then(m => m.default.connection.close());
    process.exit();
  }
}

testSmartAutocomplete();
