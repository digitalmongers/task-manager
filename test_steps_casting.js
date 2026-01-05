import "dotenv/config";
import mongoose from "mongoose";
import Task from "./models/Task.js";
import { connectDB } from "./config/db.js";

async function testCasting() {
  await connectDB();
  
  const userId = new mongoose.Types.ObjectId();
  
  console.log("\n--- Test 1: Array of Strings ---");
  try {
    const task = new Task({
      user: userId,
      title: "Test Task",
      steps: ["Step 1", "Step 2"]
    });
    console.log("Steps after assignment (strings):", JSON.stringify(task.steps, null, 2));
    await task.validate();
    console.log("Validation passed for strings? Yes");
  } catch (e) {
    console.log("Validation failed for strings? Yes. Error:", e.message);
  }

  console.log("\n--- Test 2: Array of Objects ---");
  try {
    const task = new Task({
      user: userId,
      title: "Test Task",
      steps: [{ text: "Step 1" }, { text: "Step 2" }]
    });
    console.log("Steps after assignment (objects):", JSON.stringify(task.steps, null, 2));
    await task.validate();
    console.log("Validation passed for objects? Yes");
  } catch (e) {
    console.log("Validation failed for objects? Yes. Error:", e.message);
  }

  await mongoose.connection.close();
  process.exit();
}

testCasting();
