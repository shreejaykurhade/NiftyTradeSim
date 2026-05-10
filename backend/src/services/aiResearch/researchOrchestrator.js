const { DOMESTIC_DOMAINS, GLOBAL_DOMAINS } = require('./constants');
const { buildResearchPrompt, callGeminiJson } = require('./llmClient');
const { fetchQuoteContext } = require('./quoteProvider');
const { buildCompressedRag } = require('./ragCompressor');
const { deterministicReport } = require('./reportBuilder');
const { normalizeAiReport } = require('./schema');
const { fetchSearchResults } = require('./searchProvider');

async function gatherResearch(symbol, stockName, sector) {
  const [quote, domestic, sectorNews, global] = await Promise.all([
    fetchQuoteContext(symbol),
    fetchSearchResults(`${stockName} ${symbol} latest stock news India NSE`, DOMESTIC_DOMAINS, 'domestic'),
    fetchSearchResults(`${sector} sector India outlook peers market performance`, DOMESTIC_DOMAINS, 'sector'),
    fetchSearchResults(`global market macro ${sector} impact India equities ${stockName}`, GLOBAL_DOMAINS, 'global'),
  ]);

  const rag = buildCompressedRag({
    stockName,
    symbol,
    sector,
    domestic,
    sectorNews,
    global,
  });

  return { quote, domestic, sectorNews, global, rag };
}

async function getStockSentiment(symbol, stockName, sector) {
  const research = await gatherResearch(symbol, stockName, sector);
  const fallback = deterministicReport(symbol, stockName, sector, research);
  const prompt = buildResearchPrompt({
    symbol,
    stockName,
    sector,
    quote: research.quote,
    rag: research.rag,
  });

  const aiReport = await callGeminiJson(prompt);
  const result = normalizeAiReport(aiReport, fallback, research);

  console.log(
    `AI report generated for ${symbol}: ${result.recommendation} (${result.score}) via ${result.dataQuality.aiSynthesis}; RAG ${research.rag.stats.retainedEvidence}/${research.rag.stats.inputSources}, ${research.rag.stats.estimatedContextChars} chars`
  );

  return result;
}

module.exports = {
  gatherResearch,
  getStockSentiment,
};
