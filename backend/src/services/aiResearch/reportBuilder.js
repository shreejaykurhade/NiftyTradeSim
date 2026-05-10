const { REPORT_VERSION } = require('./constants');
const { normalizeCitations } = require('./schema');
const { clamp, pct, recommendationFromScore } = require('./utils');

function sourceThemes(evidence = [], fallback) {
  const titles = evidence.map((item) => item.title).filter(Boolean).slice(0, 3);
  return titles.length ? titles.join('; ') : fallback;
}

function buildExplanation({ stockName, sector, quote, priceLine, rangeLine, score, recommendation, rag }) {
  const valuationLine = quote.trailingPE
    ? `Valuation is anchored by a trailing P/E near ${Number(quote.trailingPE).toFixed(2)}, so the score does not assume upside without earnings confirmation.`
    : 'Valuation data is incomplete, so the score gives more weight to price action, source quality, and risk control.';
  const volumeLine = quote.volume
    ? `Latest reported volume is ${Number(quote.volume).toLocaleString('en-IN')}, which should be checked against the chart before taking a paper position.`
    : 'Volume data is unavailable, so liquidity confirmation should come from the chart before any paper trade.';

  return [
    'EXECUTIVE VIEW',
    `${priceLine} ${rangeLine} The composite research score is ${score}/100, resulting in a ${recommendation} view for paper-trading decision support.`,
    '',
    'MARKET PERCEPTION',
    `Domestic evidence points to: ${sourceThemes(rag.buckets.domestic, 'limited fresh domestic company-specific coverage')}.`,
    '',
    'SECTOR AND PEER CONTEXT',
    `For the ${sector} sector, the report is watching: ${sourceThemes(rag.buckets.sector, 'limited sector evidence')}.`,
    '',
    'GLOBAL AND MACRO CONTEXT',
    `International and macro evidence highlights: ${sourceThemes(rag.buckets.global, 'limited global macro evidence')}.`,
    '',
    'VALUATION AND RISK',
    `${valuationLine} ${volumeLine}`,
    '',
    'PAPER-TRADE PLAN',
    recommendation.includes('Buy')
      ? 'A paper long trade should wait for chart confirmation, controlled position sizing, and a clear invalidation level below recent support.'
      : recommendation.includes('Sell')
        ? 'A paper sell or avoid decision should be confirmed by weak price structure, poor sector breadth, and failure to reclaim resistance.'
        : 'A hold decision means the setup is not strong enough for aggressive action; wait for cleaner momentum or better valuation asymmetry.',
  ].join('\n');
}

function deterministicReport(symbol, stockName, sector, research) {
  const quote = research.quote || {};
  const dayMove = Number(quote.changePct || 0);
  const rangePosition = quote.fiftyTwoWeekHigh && quote.fiftyTwoWeekLow && quote.price
    ? ((quote.price - quote.fiftyTwoWeekLow) / (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow)) * 100
    : 50;
  const valuationPenalty = quote.trailingPE && quote.trailingPE > 45 ? -8 : quote.trailingPE && quote.trailingPE < 18 ? 5 : 0;
  const momentumScore = clamp(50 + dayMove * 4 + (rangePosition - 50) * 0.25, 0, 100);
  const sourceScore = clamp(45 + Math.min(research.rag.allEvidence.length, 8) * 4, 0, 100);
  const riskScore = clamp(50 - Math.abs(dayMove) * 3 - Math.max(0, rangePosition - 85) * 0.3 - Math.max(0, 15 - rangePosition) * 0.4, 0, 100);
  const score = Math.round(clamp((momentumScore * 0.35) + (sourceScore * 0.25) + (riskScore * 0.25) + 15 + valuationPenalty));
  const recommendation = recommendationFromScore(score);
  const sellScore = Math.round(clamp(100 - score + Math.abs(dayMove) * 2, 0, 100));
  const buyScore = Math.round(clamp(score, 0, 100));
  const holdScore = Math.round(clamp(100 - Math.abs(score - 50) * 1.35, 0, 100));
  const priceLine = quote.price
    ? `${stockName} is trading near ${quote.currency || 'INR'} ${Number(quote.price).toFixed(2)}, with a daily move of ${pct(dayMove)}%.`
    : `${stockName} price data is currently limited, so this report leans more heavily on source coverage and risk controls.`;
  const rangeLine = quote.fiftyTwoWeekHigh && quote.fiftyTwoWeekLow
    ? `The stock is around ${rangePosition.toFixed(0)}% of its 52-week range.`
    : '52-week range data is unavailable, so range positioning is treated as neutral.';
  const citations = normalizeCitations(
    research.rag.allEvidence.map((item) => ({ title: item.title, url: item.url })),
    []
  );

  return {
    symbol,
    score,
    recommendation,
    buyScore,
    holdScore,
    sellScore,
    summary: `${priceLine} The model rates the setup as ${recommendation} because momentum, compressed evidence, valuation context, and risk balance produce a ${score}/100 composite score.`,
    explanation: buildExplanation({ stockName, sector, quote, priceLine, rangeLine, score, recommendation, rag: research.rag }),
    sections: {
      marketSnapshot: [
        priceLine,
        rangeLine,
        quote.volume ? `Latest reported volume is ${Number(quote.volume).toLocaleString('en-IN')}.` : 'Volume data is unavailable.',
      ],
      perception: [
        research.rag.buckets.domestic.length ? `Domestic evidence retained: ${research.rag.buckets.domestic.length} compact items.` : 'Domestic news coverage is thin for this request.',
        research.rag.buckets.global.length ? `Global evidence retained: ${research.rag.buckets.global.length} compact items.` : 'Global source coverage was unavailable, so macro context is neutral.',
      ],
      catalysts: [
        'Fresh earnings commentary, order wins, sector upgrades, or policy changes can improve the score.',
        `${sector} peer strength should be checked before increasing exposure.`,
      ],
      risks: [
        'Avoid treating one report as a trade trigger without chart confirmation.',
        'High gap moves, low liquidity, and broad-market selloffs can invalidate the setup quickly.',
      ],
      actionPlan: [
        score >= 62 ? 'Paper-buy only after price confirms strength above recent intraday structure.' : 'Wait for confirmation before taking a directional paper trade.',
        'Use position sizing and review existing portfolio exposure before placing the order.',
      ],
    },
    quote,
    citations,
    dataQuality: {
      quote: quote.source === 'Yahoo Finance' ? 'available' : 'limited',
      domesticSources: research.domestic.length,
      sectorSources: research.sectorNews.length,
      globalSources: research.global.length,
      ragInputSources: research.rag.stats.inputSources,
      ragRetainedEvidence: research.rag.stats.retainedEvidence,
      ragContextChars: research.rag.stats.estimatedContextChars,
      aiSynthesis: 'deterministic-fallback',
    },
    reportVersion: REPORT_VERSION,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { deterministicReport };
