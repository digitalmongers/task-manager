import "dotenv/config";
import mongoose from "mongoose";

// Use the actual models and repositories
import Task from "./models/Task.js";
import TaskRepository from "./repositories/taskRepository.js";
import { connectDB } from "./config/db.js";

async function verify() {
  await connectDB();
  
  const userId = new mongoose.Types.ObjectId();
  const taskData = {
    title: "Final Verification Task",
    steps: [
      { text: "Step 1", isCompleted: false },
      "Step 2" // Mixed format (string)
    ]
  };

  try {
    console.log("\n[1] Creating Task via Repository...");
    // We manually simulate what TaskService does:
    const parsedSteps = [
      { text: "Step 1", isCompleted: false },
      { text: "Step 2", isCompleted: false }
    ];

    const task = await TaskRepository.createTask({
      ...taskData,
      steps: parsedSteps
    }, userId);

    console.log("Creation Result Steps Count:", task.steps.length);
    task.steps.forEach((s, i) => console.log(`  Step ${i+1}: ${s.text} (ID: ${s._id})`));

    console.log("\n[2] Refetching Task...");
    const refetched = await TaskRepository.findByIdAndUser(task._id, userId);
    console.log("Refetched Steps Count:", refetched.steps.length);
    refetched.steps.forEach((s, i) => console.log(`  Step ${i+1}: ${s.text} (ID: ${s._id})`));

    if (refetched.steps.length === 2 && refetched.steps[1].text === "Step 2") {
      console.log("\n✅ VERIFICATION SUCCESSFUL: Steps are persisting correctly.");
    } else {
      console.log("\n❌ VERIFICATION FAILED: Steps are not as expected.");
    }

  } catch (err) {
    console.error("Error during verification:", err);
  } finally {
    await mongoose.connection.close();
    process.exit();
  }
}

// Silence the logger for this script
process.env.LOG_LEVEL = 'error'; 

verify();
