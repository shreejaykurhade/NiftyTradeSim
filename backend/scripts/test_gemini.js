require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  console.log('Key:', process.env.GOOGLE_API_KEY ? process.env.GOOGLE_API_KEY.substring(0, 10) + '...' : 'MISSING');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const res = await model.generateContent('Say hello in one word.');
    console.log('✅ Gemini works:', res.response.text());
  } catch (e) {
    console.error('❌ Full error:', e.message);
    console.error('Status:', e.status);
  }
}
test();
