function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function pct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number(value).toFixed(2);
}

function recommendationFromScore(score) {
  if (score >= 78) return 'Strong Buy';
  if (score >= 62) return 'Buy';
  if (score >= 42) return 'Hold';
  if (score >= 25) return 'Sell';
  return 'Strong Sell';
}

function cleanSourceTitle(title = '') {
  return String(title)
    .replace(/\s+/g, ' ')
    .replace(/\s*[-|]\s*(The Economic Times|Moneycontrol\.com|Yahoo Finance|Livemint|Business Standard).*$/i, '')
    .trim();
}

function cleanText(text = '') {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\|[^\n]*\|/g, '')
    .replace(/^\s*-{2,}\s*$/gm, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^[-•]\s+/gm, '')
    .replace(/^(EXECUTIVE VIEW|PERCEPTION|MARKET PERCEPTION|SECTOR CONTEXT|SECTOR AND PEER CONTEXT|GLOBAL AND MACRO CONTEXT|RISKS|VALUATION AND RISK|PAPER-TRADE PLAN|RISK CONTROL):\s*/gmi, '$1\n')
    .replace(/\b(Image|Arrow|Exclusive|Leaders Speak|Events|Awards)\b/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeWhitespace(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  clamp,
  cleanSourceTitle,
  cleanText,
  normalizeWhitespace,
  pct,
  recommendationFromScore,
};
