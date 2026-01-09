import "dotenv/config";
import AIService from "./services/ai/aiService.js";

console.log("OPENAI_API_KEY from process.env:", process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + "..." : "undefined");
console.log("AI Service enabled:", AIService.isEnabled());
