const { GoogleGenerativeAI } = require('@google/generative-ai');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiJson(prompt) {
  if (!process.env.GOOGLE_API_KEY) return null;

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const candidates = ['gemini-2.5-flash', 'gemini-2.0-flash'];

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const response = await model.generateContent(prompt);
      const text = response.response.text().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return JSON.parse(text);
    } catch (err) {
      console.warn(`Gemini report model ${modelName} failed: ${err.message}`);
      await sleep(1000);
    }
  }

  return null;
}

function buildResearchPrompt({ symbol, stockName, sector, quote, rag }) {
  return `You are a senior Indian equity research analyst building a paper-trading research report.
Return STRICT JSON only. No markdown fences.
Use clean plain text only. Do not use markdown bullets, asterisks, tables, emojis, HTML, copied webpage tables, or raw source excerpts.
Use only the compact evidence cards below. Do not invent sources.

Stock: ${stockName}
Symbol: ${symbol}
Sector: ${sector}
Quote JSON: ${JSON.stringify(quote)}

COMPACT RAG EVIDENCE:
${rag.promptContext}

Required JSON shape:
{
  "score": number from 0 to 100,
  "recommendation": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
  "buyScore": number,
  "holdScore": number,
  "sellScore": number,
  "summary": "2 concise sentences",
  "explanation": "Professional plain-text report with sections: EXECUTIVE VIEW, PERCEPTION, SECTOR CONTEXT, RISKS, PAPER-TRADE PLAN",
  "sections": {
    "marketSnapshot": ["string"],
    "perception": ["string"],
    "catalysts": ["string"],
    "risks": ["string"],
    "actionPlan": ["string"]
  },
  "citations": [{"title": "string", "url": "string"}]
}`;
}

module.exports = {
  buildResearchPrompt,
  callGeminiJson,
};
