require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Dynamically find paths
const StockCandle = require('../src/models/StockCandle');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const latest = await StockCandle.findOne({ symbol: 'RELIANCE.NS' }).sort({ timestamp: -1 });
    const earliest = await StockCandle.findOne({ symbol: 'RELIANCE.NS' }).sort({ timestamp: 1 });
    const count = await StockCandle.countDocuments({ symbol: 'RELIANCE.NS' });
    
    console.log('RELIANCE.NS Stats:');
    console.log('  Earliest:', earliest ? earliest.timestamp : 'None');
    console.log('  Latest:', latest ? latest.timestamp : 'None');
    console.log('  Count:', count);
    
    const allLatest = await StockCandle.findOne().sort({ timestamp: -1 });
    console.log('Global Latest:', allLatest ? allLatest.timestamp : 'None');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
