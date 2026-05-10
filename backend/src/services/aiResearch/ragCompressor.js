const { cleanSourceTitle, normalizeWhitespace } = require('./utils');

const STOPWORDS = new Set([
  'about', 'after', 'also', 'from', 'have', 'into', 'market', 'stock', 'that',
  'their', 'this', 'with', 'will', 'india', 'latest', 'news', 'share',
]);

function tokenize(text) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function uniqueSources(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item.url || item.title || '').replace(/\/$/, '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitSentences(text) {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 40 && sentence.length < 260);
}

function scoreEvidence(item, queryTokens) {
  const text = `${item.title || ''} ${item.content || ''}`.toLowerCase();
  const lexical = queryTokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
  return lexical * 3 + Number(item.providerScore || 0);
}

function bestSentence(item, queryTokens) {
  const sentences = splitSentences(item.content || '');
  if (!sentences.length) return cleanSourceTitle(item.title || 'Source reports relevant market context.');

  return sentences
    .map((sentence) => ({
      sentence,
      score: queryTokens.reduce((sum, token) => sum + (sentence.toLowerCase().includes(token) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)[0].sentence;
}

function compressBucket(items, query, namespace, limit = 3) {
  const queryTokens = tokenize(query);
  return uniqueSources(items)
    .map((item) => ({
      ...item,
      score: scoreEvidence(item, queryTokens),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item, index) => ({
      id: `${namespace}-${index + 1}`,
      namespace,
      title: cleanSourceTitle(item.title || item.url || `${namespace} source`),
      url: item.url,
      evidence: bestSentence(item, queryTokens),
      score: Number(item.score || 0),
    }));
}

function buildCompressedRag({ stockName, symbol, sector, domestic, sectorNews, global }) {
  const domesticQuery = `${stockName} ${symbol} earnings result institutional holding management outlook risk`;
  const sectorQuery = `${sector} sector India peers demand margin policy outlook`;
  const globalQuery = `${sector} global macro crude rates currency geopolitical risk`;

  const buckets = {
    domestic: compressBucket(domestic, domesticQuery, 'domestic', 3),
    sector: compressBucket(sectorNews, sectorQuery, 'sector', 3),
    global: compressBucket(global, globalQuery, 'global', 2),
  };

  const allEvidence = [...buckets.domestic, ...buckets.sector, ...buckets.global];
  const promptContext = allEvidence.length
    ? allEvidence.map((item) => `${item.id}: ${item.title} - ${item.evidence}`).join('\n')
    : 'No external evidence retrieved. Use only quote metrics and risk controls.';

  return {
    buckets,
    allEvidence,
    promptContext,
    stats: {
      inputSources: domestic.length + sectorNews.length + global.length,
      retainedEvidence: allEvidence.length,
      estimatedContextChars: promptContext.length,
    },
  };
}

module.exports = { buildCompressedRag };
