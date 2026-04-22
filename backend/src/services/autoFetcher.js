const { execSync } = require('child_process');
const path = require('path');
const StockCandle = require('../models/StockCandle');

async function autoFetchMissingData() {
  console.log('🔍 Checking for missing historical market data...');
  try {
    // Find the latest candle in the database
    const latestCandle = await StockCandle.findOne({ timeframe: '1D' }).sort({ timestamp: -1 });
    
    if (!latestCandle) {
      console.log('⚠️ No data found in DB. Full seed required. Please run seed script.');
      return;
    }

    const lastDate = new Date(latestCandle.timestamp);
    const today = new Date();
    
    // Normalize to midnight UTC for comparison
    lastDate.setUTCHours(0, 0, 0, 0);
    const todayNormalized = new Date(today);
    todayNormalized.setUTCHours(0, 0, 0, 0);
    
    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((todayNormalized - lastDate) / oneDay);
    
    if (diffDays <= 1) {
      console.log('✅ Market data is up to date.');
      return;
    }

    // Format dates for yfinance (YYYY-MM-DD)
    // We add 1 day to lastDate to start fetching from the next missing day
    const startDateObj = new Date(lastDate.getTime() + oneDay);
    const start_date = startDateObj.toISOString().split('T')[0];
    
    // Add 1 day to today because yfinance 'end' is exclusive
    const endDateObj = new Date(todayNormalized.getTime() + oneDay);
    const end_date = endDateObj.toISOString().split('T')[0];

    console.log(`⏳ Fetching missing data from ${start_date} to ${end_date}...`);
    
    const pythonScript = path.join(__dirname, '..', '..', 'scripts', 'fetch_data.py');
    const result = execSync(`python "${pythonScript}" --timeframe 1D --start_date ${start_date} --end_date ${end_date}`, { maxBuffer: 50 * 1024 * 1024 });
    const candles = JSON.parse(result.toString());
    
    if (!candles || candles.length === 0) {
      console.log('✅ No new data available to fetch.');
      return;
    }

    console.log(`📦 Received ${candles.length} new candles. Importing to MongoDB...`);
    
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
    }
    
    console.log('✅ Missing market data successfully backfilled.');
  } catch (err) {
    console.error('❌ Auto fetch failed:', err.message);
    if (err.stderr) console.error('Python Error:', err.stderr.toString());
  }
}

module.exports = { autoFetchMissingData };
