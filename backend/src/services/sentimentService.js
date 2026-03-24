const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sequential 6-Agent Agentic Sentiment Pipeline — HIGH RELIABILITY
 */
async function getStockSentiment(symbol, stockName, sector) {
  console.log(`\n🤖 [Step 0] Initializing Robust AI Pipeline for ${symbol}...`);

  if (!process.env.GOOGLE_API_KEY) throw new Error("Missing GOOGLE_API_KEY in .env");
  if (!process.env.TAVILY_API_KEY) throw new Error("Missing TAVILY_API_KEY in .env");

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

  // ─── TAVILY SEARCH HELPER ──────────────────────────────────────────────────
  async function searchTavily(query, isGlobal = false) {
    const domesticDomains = ["moneycontrol.com", "economictimes.indiatimes.com", "screener.in", "groww.in", "zerodha.com", "livemint.com", "business-standard.com"];
    const globalDomains = ["reuters.com", "bloomberg.com", "investing.com", "marketwatch.com", "finance.yahoo.com", "cnbc.com", "wsj.com"];
    
    try {
      const res = await axios.post('https://api.tavily.com/search', {
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 6,
        search_depth: "advanced",
        include_domains: isGlobal ? globalDomains : domesticDomains
      }, { timeout: 25000 });
      return res.data.results || [];
    } catch (e) {
      console.warn(`   ⚠️ Tavily search failed (${query.substring(0, 30)}...): ${e.message}`);
      try {
        const fallbackRes = await axios.post('https://api.tavily.com/search', {
          api_key: process.env.TAVILY_API_KEY,
          query,
          max_results: 5,
          search_depth: "basic"
        }, { timeout: 15000 });
        return fallbackRes.data.results || [];
      } catch (inner) {
        return [];
      }
    }
  }

  // ─── ROBUST GEMINI CALLER (15s MIN DELAY) ───────────────────────────────
  async function callGemini(prompt, agentLabel) {
    const candidates = [
      "gemini-3.1-flash-lite-preview", 
      "gemini-3.1-pro", 
      "gemini-2.5-flash", 
      "gemini-2.0-flash"
    ];
    
    for (const modelName of candidates) {
      let retries = 2;
      while (retries > 0) {
        try {
          console.log(`   ↳ [${agentLabel}] Calling ${modelName}...`);
          const model = genAI.getGenerativeModel({ model: modelName });
          const res = await model.generateContent(prompt);
          
          console.log(`   ✅ [${agentLabel}] Success! Pausing 15s for rate limit safety...`);
          await sleep(15000); 
          return res.response.text();
        } catch (e) {
          const errMsg = e.message || String(e);
          console.error(`   ⚠️ [${agentLabel}] ${modelName} failed: ${errMsg.substring(0, 150)}`);
          
          const isRateLimit = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
          if (isRateLimit && retries > 1) {
            console.log(`   ⏳ Rate limit detected. Waiting 15s before retry...`);
            await sleep(15000);
            retries--;
          } else {
            console.log(`   🔄 Falling back to next model...`);
            await sleep(2000); 
            break; 
          }
        }
      }
    }
    throw new Error(`[${agentLabel}] All Gemini models failed. Pipeline stopped.`);
  }

  // ─── AGENTS 1, 2, 3: DATA GATHERING ───────────────────────────────────────
  console.log('🕵️  [Agent 1] Gathering Domestic News (Moneycontrol/Screener)...');
  const dom = await searchTavily(`${stockName} ${symbol} NSE India stock news today`, false);
  console.log(`   ✅ Agent 1 complete. Pausing 15s...`);
  await sleep(15000);

  console.log('🕵️  [Agent 2] Gathering Sectoral Insights (Indian Market)...');
  const sec = await searchTavily(`${sector} sector overview India 2025 performance`, false);
  console.log(`   ✅ Agent 2 complete. Pausing 15s...`);
  await sleep(15000);

  console.log('🕵️  [Agent 3] Gathering Global Macro Data (Reuters/Bloomberg)...');
  const glob = await searchTavily(`Global ${sector} market trends impact on ${symbol} stock`, true);
  console.log(`   ✅ Agent 3 complete. Pausing 15s...`);
  await sleep(15000);

  const allCitations = [...dom, ...sec, ...glob]
    .map(r => ({ title: r.title, url: r.url }))
    .filter(c => c.url);

  // ─── LOCAL KEYWORD RAG (ZERO LATENCY) ────────────────────────────────────
  const rawChunks = [
     ...dom.map(r => `[DOMESTIC] ${r.title}: ${r.content || ''}`),
     ...sec.map(r => `[SECTOR] ${r.title}: ${r.content || ''}`),
     ...glob.map(r => `[GLOBAL] ${r.title}: ${r.content || ''}`)
  ].filter(c => c.length > 30);

  function getContext(query, limit = 8) {
     if (rawChunks.length === 0) return "No data available.";
     const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
     const scored = rawChunks.map(chunk => {
        let score = 0;
        const text = chunk.toLowerCase();
        keywords.forEach(k => { if (text.includes(k)) score++; });
        return { text: chunk, score };
     });
     scored.sort((a,b) => b.score - a.score);
     return scored.slice(0, limit).map(s => s.text).join("\n\n---\n");
  }

  // ─── AGENT 4: ANALYST ─────────────────────────────────────────────────────
  console.log('📊 [Agent 4] Analyst processing deep-dive...');
  const domCtx = getContext(`${stockName} domestic news`, 6);
  const secCtx = getContext(`${sector} sector India`, 6);
  const globCtx = getContext(`global market trends ${sector}`, 6);

  const analystPrompt = `System: You are an Elite Financial Data Scientist at a top-tier quantitative firm. 
Provide a COMPREHENSIVE DEEP-DIVE report for ${stockName} (${symbol}). 

STRICT FORMATTING RULES:
- Use ONLY Plain Text. NO markdown symbols (NO #, NO *, NO **).
- Section Headers must be ALL-CAPS (e.g., FUNDAMENTAL TRENDS).
- Length: Be extremely detailed (aim for 800+ words).

CONTENT SECTIONS:
1. FUNDAMENTAL TRENDS: Describe recovery/fluctuations, revenue diversification.
2. SECTOR COMPARISON: Relative position in the Indian market vs peers.
3. STRATEGIC OUTLOOK: Deep-dive into new energy, 5-year growth drivers.

DATA SOURCE:
DOMESTIC: ${domCtx}
SECTOR: ${secCtx}
GLOBAL: ${globCtx}`;

  const analystReport = await callGemini(analystPrompt, 'Agent 4 - Analyst');

  // ─── AGENT 5: AUDITOR ─────────────────────────────────────────────────────
  console.log('🛡️  [Agent 5] Financial Auditor Starting...');
  const totalContext = `${domCtx}\n${secCtx}\n${globCtx}`;
  const auditorPrompt = `Verify the following 800-word analyst report for ${stockName} against data.
KEEP the full length and detail. Fix inaccuracies only. Maintain ALL-CAPS headers.

ANALYST REPORT:
${analystReport}

DATA:
${totalContext}`;

  const auditedReport = await callGemini(auditorPrompt, 'Agent 5 - Auditor');

  // ─── AGENT 6: GRADER ──────────────────────────────────────────────────────
  console.log('⚖️  [Agent 6] Portfolio Grader Starting...');
  const graderPrompt = `Based on audited report, provide final score and summary. JSON ONLY.
Include "citations" array (3-5 items).

AUDITED REPORT:
${auditedReport.substring(0, 1000)} ...

JSON STRUCTURE:
{
  "score": number,
  "recommendation": "Strong Buy/Buy/Hold/Sell/Strong Sell",
  "buyScore": number, "holdScore": number, "sellScore": number,
  "summary": "2-sentence executive summary",
  "citations": [{"title": "String", "url": "String"}]
}`;

  const rawJson = await callGemini(graderPrompt, 'Agent 6 - Grader');
  const jsonStr = rawJson.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const result = JSON.parse(jsonStr);

  if (!result.citations || result.citations.length < 3) {
    result.citations = allCitations.slice(0, 5);
  }

  console.log(`✅ [Complete] ${symbol} -> ${result.recommendation} (${result.score})`);

  return {
    symbol,
    ...result,
    explanation: auditedReport,
    timestamp: new Date().toISOString()
  };
}

module.exports = { getStockSentiment };
