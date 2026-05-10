const YahooFinance = require('yahoo-finance2').default;

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function fetchQuoteContext(symbol) {
  try {
    const quote = await yahooFinance.quote(symbol);
    return {
      price: quote.regularMarketPrice || quote.postMarketPrice || quote.preMarketPrice || null,
      previousClose: quote.regularMarketPreviousClose || null,
      open: quote.regularMarketOpen || null,
      dayHigh: quote.regularMarketDayHigh || null,
      dayLow: quote.regularMarketDayLow || null,
      change: quote.regularMarketChange || null,
      changePct: quote.regularMarketChangePercent || null,
      volume: quote.regularMarketVolume || null,
      marketCap: quote.marketCap || null,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow || null,
      trailingPE: quote.trailingPE || null,
      forwardPE: quote.forwardPE || null,
      currency: quote.currency || 'INR',
      exchange: quote.fullExchangeName || quote.exchange || 'NSE',
      source: 'Yahoo Finance',
    };
  } catch (err) {
    return { source: 'Unavailable', error: err.message };
  }
}

module.exports = { fetchQuoteContext };
