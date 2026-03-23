const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

let _genAI = null;

function getGemini() {
  if (!_genAI) {
    if (!process.env.GOOGLE_API_KEY) throw new Error("Missing GOOGLE_API_KEY");
    _genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }
  return _genAI;
}

/**
 * Sequential Multi-Agent Flow with Model Fallback
 */
async function getStockSentiment(symbol, stockName, sector) {
  console.log(`🤖 [Step 0] Initializing AI Pipeline for ${symbol}...`);

  try {
    const genAI = getGemini();
    
    // Fallback logic for model selection
    let model = null;
    const modelCandidates = [
      "gemini-1.5-flash", 
      "gemini-1.5-flash-latest", 
      "gemini-2.0-flash-exp", 
      "gemini-2.5-flash",
      "models/gemini-1.5-flash",
      "models/gemini-2.5-flash"
    ];
    
    for (const m of modelCandidates) {
      try {
        const testModel = genAI.getGenerativeModel({ model: m });
        // Minimal test to verify access
        await testModel.generateContent({ contents: [{ role: 'user', parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } });
        model = testModel;
        console.log(`✅ Using Gemini Model: ${m}`);
        break;
      } catch (e) {
        console.log(`⚠️ Model ${m} failed: ${e.message.substring(0, 50)}`);
      }
    }

    if (!model) throw new Error("No accessible Gemini models found for this API key.");

    const tavilyKey = process.env.TAVILY_API_KEY;

    async function searchTavily(query) {
      const res = await axios.post('https://api.tavily.com/search', {
        api_key: tavilyKey,
        query,
        max_results: 5,
        search_depth: "advanced"
      });
      return res.data.results;
    }

    // Agent 1: Domestic Investigator
    console.log('🕵️ [Agent 1] Investigator: Domestic...');
    const dom = await searchTavily(`${symbol} ${stockName} Nifty 50 News India today`);
    const domCtx = dom.map(r => `[${r.title}](${r.url}): ${r.content.substring(0, 700)}`).join('\n');

    // Agent 2: Sectoral Investigator
    console.log('🕵️ [Agent 2] Investigator: Sectoral...');
    const sec = await searchTavily(`Indian ${sector} sector trends and ${stockName} competition`);
    const secCtx = sec.map(r => `[${r.title}](${r.url}): ${r.content.substring(0, 700)}`).join('\n');

    // Agent 3: Global Investigator
    console.log('🕵️ [Agent 3] Investigator: Global...');
    const glob = await searchTavily(`Global ${sector} outlook and world-wide stock performance for ${symbol}`);
    const globCtx = glob.map(r => `[${r.title}](${r.url}): ${r.content.substring(0, 700)}`).join('\n');

    // Agent 4: Analyst
    console.log('📊 [Agent 4] Analyst processing...');
    const analystPrompt = `System: You are an Elite Financial Data Scientist at a top-tier quantitative firm.
      Provide a professional, clean report for ${stockName} (${symbol}).
      
      STRICT FORMATTING RULES:
      - Use ONLY Plain Text. 
      - NO markdown symbols (NO #, NO *, NO **).
      - Section Headers must be ALL-CAPS (e.g., FUNDAMENTAL TRENDS).
      - Use simple dashes '-' for bullets.
      - DO NOT use conversational fillers or "As an AI...".
      
      CONTENT SECTIONS:
      1. FUNDAMENTAL TRENDS: Describe recovery/fluctuations, diversification.
      2. SECTOR COMPARISON: Relative position in the Indian market.
      3. STRATEGIC OUTLOOK: Focus on new energy/growth drivers.
      
      DATA SOURCE:
      DOMESTIC: ${domCtx}
      SECTOR: ${secCtx}
      GLOBAL: ${globCtx}`;
    const analystRes = await model.generateContent(analystPrompt);
    const analysis = analystRes.response.text();

    // Agent 5 & 6: Auditor/Grader
    console.log('⚖️ [Agent 5+6] Auditor & Grader finalizing...');
    const finalPrompt = `Portfolio Manager. Based on analysis: ${analysis.substring(0, 3000)}
      and SEARCH CONTEXT:
      ${domCtx.substring(0, 1000)}
      ${secCtx.substring(0, 1000)}
      ${globCtx.substring(0, 1000)}

      Output ONLY valid JSON.
      LOGIC RULES:
      - overallScore: 0-100 (0=Extreme Bearish, 100=Extreme Bullish).
      - recommendation must match overallScore:
        * 85-100: Strong Buy
        * 65-84: Buy
        * 40-64: Hold
        * 20-39: Sell
        * 0-19: Strong Sell
      - buyScore, sellScore, holdScore: Probabilities (0-100) that must sum to 100.

      JSON STRUCTURE:
      {
        "score": number,
        "buyScore": number,
        "sellScore": number,
        "holdScore": number,
        "recommendation": "String",
        "summary": "2-sentence summary",
        "citations": [{"title": "String", "url": "String"}]
      }`;
    const finalRes = await model.generateContent(finalPrompt);
    const text = finalRes.response.text();
    const result = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());

    console.log('✅ Sentiment Analysis completed for ' + symbol);
    return {
      symbol,
      ...result,
      explanation: analysis,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('❌ Pipeline Error:', err.message);
    throw new Error('Sentiment Analysis failed: ' + err.message);
  }
}

module.exports = { getStockSentiment };
