require('dotenv').config();
const mongoose = require('mongoose');
const StockCandle = require('../src/models/StockCandle');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const timeframes = ['1D', '1W', '1M'];
    for (const tf of timeframes) {
      const count = await StockCandle.countDocuments({ timeframe: tf });
      const sample = await StockCandle.findOne({ symbol: 'RELIANCE.NS', timeframe: tf }).sort({ timestamp: -1 });
      console.log(`[${tf}] Total Candles: ${count}`);
      console.log(`[${tf}] Reliance Latest: ${sample ? sample.timestamp : 'None'}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
