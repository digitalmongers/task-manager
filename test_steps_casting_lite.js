import "dotenv/config";
import mongoose from "mongoose";

// Define a minimal schema for testing
const stepSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCompleted: { type: Boolean, default: false }
});

const taskSchema = new mongoose.Schema({
  title: String,
  steps: [stepSchema]
});

const TestTask = mongoose.model('TestTask', taskSchema);

async function testCasting() {
  console.log("\n--- Test 1: Array of Strings ---");
  try {
    const task = new TestTask({
      title: "Test Task",
      steps: ["Step 1", "Step 2"]
    });
    console.log("Steps after assignment (strings):", JSON.stringify(task.steps, null, 2));
  } catch (e) {
    console.log("Assignment failed for strings. Error:", e.message);
  }

  console.log("\n--- Test 2: Partial Objects ---");
  try {
    const task = new TestTask({
      title: "Test Task",
      steps: [{ text: "Step 1" }, { text: "Step 2" }]
    });
    console.log("Steps after assignment (objects):", JSON.stringify(task.steps, null, 2));
  } catch (e) {
    console.log("Assignment failed for objects. Error:", e.message);
  }

  process.exit();
}

testCasting();
