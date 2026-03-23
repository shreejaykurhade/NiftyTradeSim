const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function test() {
  try {
    const symbol = 'RELIANCE.NS';
    console.log(`Checking ${symbol}...`);
    const quote = await yahooFinance.quote(symbol);
    console.log('Quote:', JSON.stringify(quote, null, 2));
    
    const price = quote.regularMarketPrice || quote.preMarketPrice;
    console.log(`\nExtracted Price: ${price}`);
    console.log(`Market State: ${quote.marketState}`);
  } catch (err) {
    console.error('Test error:', err.message);
  }
}

test();
