import redisClient from "./config/redis.js";

console.log("Starting Redis Verification...");

redisClient.on("ready", async () => {
  console.log("VERIFICATION SUCCESS: Redis is ready.");
  try {
      await redisClient.set("verify_test_key", "hello");
      const val = await redisClient.get("verify_test_key");
      console.log(`Cache Test: Wrote 'hello', got '${val}'`);
      await redisClient.del("verify_test_key");
      await redisClient.quit();
      console.log("Connection closed.");
      process.exit(0);
  } catch(e) {
      console.error("Cache OP failed:", e);
      process.exit(1);
  }
});

redisClient.on("error", (err) => {
  console.error("VERIFICATION FAILED: Redis error:", err.message);
  if (!err.message.includes("READONLY")) {
      process.exit(1);
  }
});

// Timeout
setTimeout(() => {
    console.error("VERIFICATION TIMEOUT: Redis did not connect in 5s");
    process.exit(1);
}, 5000);
