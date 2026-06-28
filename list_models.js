require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    // Note: The SDK currently does not expose a listModels method directly on the genAI instance
    // in v0.21.0 in a standardized way. We can fetch it via REST.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    console.log("AVAILABLE MODELS:");
    data.models.forEach(m => console.log(m.name));
  } catch(e) {
    console.error(e);
  }
}
run();
