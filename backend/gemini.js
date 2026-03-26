require('dotenv').config();

let model;
let unavailableReason;

function getGeminiModel() {
  if (model) {
    return model;
  }

  if (unavailableReason) {
    return null;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    unavailableReason = 'Gemini is not configured. Set GEMINI_API_KEY to enable /api/ai/chat.';
    return null;
  }

  let GoogleGenerativeAI;
  try {
    ({ GoogleGenerativeAI } = require('@google/generative-ai'));
  } catch (error) {
    unavailableReason = 'Gemini SDK is unavailable. Run npm install to restore @google/generative-ai.';
    console.error('Gemini SDK load failed:', error);
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  });

  return model;
}

async function chatWithGemini(prompt) {
  const activeModel = getGeminiModel();

  if (!activeModel) {
    const error = new Error(unavailableReason || 'Gemini is unavailable.');
    error.code = 'GEMINI_UNAVAILABLE';
    throw error;
  }

  try {
    const result = await activeModel.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini Error:', error);
    throw error;
  }
}

module.exports = { chatWithGemini };
