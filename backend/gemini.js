const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config(); // Loads GEMINI_API_KEY from backend/.env

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Export a function so you can use it in other files (like server.js)
async function chatWithGemini(prompt) {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Sorry, I couldn't process that.";
  }
}

module.exports = { chatWithGemini };