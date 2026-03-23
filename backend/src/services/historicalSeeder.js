const { execSync } = require('child_process');
const path = require('path');
const StockCandle = require('../models/StockCandle');

async function seedHistoricalData() {
  console.log('⏳ Starting historical data seed via Python Bridge (yfinance)...');
  
  try {
    const pythonScript = path.join(__dirname, '..', '..', 'scripts', 'fetch_data.py');
    console.log(`🚀 Executing: python ${pythonScript}`);
    
    // This will take a while, Increase buffer for 10 years of 50 stocks (~3MB of JSON)
    const result = execSync(`python "${pythonScript}"`, { maxBuffer: 200 * 1024 * 1024 });
    const candles = JSON.parse(result.toString());
    
    if (!candles || candles.length === 0) {
      console.warn('⚠️ No data returned from Python bridge.');
      return;
    }

    console.log(`📦 Received ${candles.length} candles. Importing to MongoDB...`);

    // Bulk upsert in batches of 5000 for speed
    for (let i = 0; i < candles.length; i += 5000) {
      const batch = candles.slice(i, i + 5000);
      const ops = batch.map((c) => ({
        updateOne: {
          filter: { symbol: c.symbol, timeframe: '1D', timestamp: new Date(c.timestamp) },
          update: { $set: {
            symbol: c.symbol,
            timeframe: '1D',
            timestamp: new Date(c.timestamp),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume
          }},
          upsert: true,
        },
      }));
      await StockCandle.bulkWrite(ops);
      console.log(`  Progress: ${i + batch.length}/${candles.length}`);
    }

    console.log('✅ Python Bridge seed complete!');
  } catch (err) {
    console.error('❌ Python Bridge failed:', err.message);
    if (err.stderr) console.error('Python Error:', err.stderr.toString());
  }
}

module.exports = { seedHistoricalData };



function getPeriodStartDate(range) {
  const years = parseInt(range);
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { seedHistoricalData };
