const { execSync } = require('child_process');
const path = require('path');
const StockCandle = require('../models/StockCandle');

async function seedHistoricalData() {
  const timeframes = ['1W', '1M', '1D'];
  
  for (const tf of timeframes) {
    console.log(`⏳ Starting historical data seed for [${tf}] via Python Bridge...`);
    
    try {
      const pythonScript = path.join(__dirname, '..', '..', 'scripts', 'fetch_data.py');
      // Buffer for 30 years * 50 stocks (each candle ~150 chars)
      const result = execSync(`python "${pythonScript}" --timeframe ${tf}`, { maxBuffer: 300 * 1024 * 1024 });
      const candles = JSON.parse(result.toString());
      
      if (!candles || candles.length === 0) {
        console.warn(`⚠️ No data returned for [${tf}].`);
        continue;
      }

      console.log(`📦 Received ${candles.length} candles for [${tf}]. Importing to MongoDB...`);

      for (let i = 0; i < candles.length; i += 5000) {
        const batch = candles.slice(i, i + 5000);
        const ops = batch.map((c) => ({
          updateOne: {
            filter: { symbol: c.symbol, timeframe: c.timeframe, timestamp: new Date(c.timestamp) },
            update: { $set: {
              symbol: c.symbol,
              timeframe: c.timeframe,
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
        console.log(`  [${tf}] Progress: ${i + batch.length}/${candles.length}`);
      }
    } catch (err) {
      console.error(`❌ Python Bridge failed for [${tf}]:`, err.message);
      if (err.stderr) console.error('Python Error:', err.stderr.toString());
    }
  }
  console.log('✅ Multi-timeframe seed complete!');
}

module.exports = { seedHistoricalData };
