import "dotenv/config";
import mongoose from "mongoose";
import Task from "./models/Task.js";
import TaskRepository from "./repositories/taskRepository.js";
import { connectDB } from "./config/db.js";

async function reproduce() {
  await connectDB();
  console.log("Connected to DB");

  const userId = new mongoose.Types.ObjectId();
  const taskData = {
    title: "Test Task with Steps",
    description: "Testing steps persistence",
    steps: [
      { text: "Step 1", isCompleted: false },
      { text: "Step 2", isCompleted: true }
    ]
  };

  try {
    console.log("\n--- Creating Task ---");
    const task = await TaskRepository.createTask(taskData, userId);
    console.log("Created Task Steps:", JSON.stringify(task.steps, null, 2));

    if (task.steps.length === 0) {
      console.error("❌ ERROR: Steps are empty immediately after creation!");
    } else {
      console.log("✅ Steps present after creation.");
    }

    console.log("\n--- Refetching Task (findByIdAndUser) ---");
    const refetchedTask = await TaskRepository.findByIdAndUser(task._id, userId);
    console.log("Refetched Task Steps:", JSON.stringify(refetchedTask.steps, null, 2));

    if (refetchedTask.steps.length === 0) {
      console.error("❌ ERROR: Steps are lost after refetching!");
    } else {
      console.log("✅ Steps present after refetch.");
    }

  } catch (error) {
    console.error("Reproduction failed:", error);
  } finally {
    await mongoose.connection.close();
    process.exit();
  }
}

reproduce();
