const { REPORT_VERSION } = require('./constants');
const { clamp, cleanText, recommendationFromScore } = require('./utils');

function asStringArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 6);
  }
  if (typeof value === 'string' && value.trim()) return [cleanText(value)];
  return fallback;
}

function normalizeSections(sections = {}, fallbackSections = {}) {
  return {
    marketSnapshot: asStringArray(sections.marketSnapshot, fallbackSections.marketSnapshot || []),
    perception: asStringArray(sections.perception, fallbackSections.perception || []),
    catalysts: asStringArray(sections.catalysts, fallbackSections.catalysts || []),
    risks: asStringArray(sections.risks, fallbackSections.risks || []),
    actionPlan: asStringArray(sections.actionPlan, fallbackSections.actionPlan || []),
  };
}

function normalizeCitations(citations = [], fallback = []) {
  const seen = new Set();
  const merged = [...(Array.isArray(citations) ? citations : []), ...fallback];
  return merged
    .filter((item) => item?.url)
    .filter((item) => {
      const key = String(item.url).replace(/\/$/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((item) => ({
      title: String(item.title || item.url).trim(),
      url: String(item.url).trim(),
    }));
}

function normalizeAiReport(aiReport, fallback, research) {
  if (!aiReport || typeof aiReport !== 'object') return fallback;

  const score = Math.round(clamp(aiReport.score ?? fallback.score));
  return {
    ...fallback,
    ...aiReport,
    score,
    recommendation: aiReport.recommendation || recommendationFromScore(score),
    buyScore: Math.round(clamp(aiReport.buyScore ?? fallback.buyScore)),
    holdScore: Math.round(clamp(aiReport.holdScore ?? fallback.holdScore)),
    sellScore: Math.round(clamp(aiReport.sellScore ?? fallback.sellScore)),
    summary: cleanText(aiReport.summary || fallback.summary),
    explanation: cleanText(aiReport.explanation || fallback.explanation),
    sections: normalizeSections(aiReport.sections, fallback.sections),
    citations: normalizeCitations(aiReport.citations, fallback.citations),
    quote: fallback.quote,
    dataQuality: {
      ...fallback.dataQuality,
      aiSynthesis: 'gemini',
      domesticSources: research.domestic.length,
      sectorSources: research.sectorNews.length,
      globalSources: research.global.length,
      ragInputSources: research.rag.stats.inputSources,
      ragRetainedEvidence: research.rag.stats.retainedEvidence,
      ragContextChars: research.rag.stats.estimatedContextChars,
    },
    reportVersion: REPORT_VERSION,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  normalizeAiReport,
  normalizeCitations,
};
