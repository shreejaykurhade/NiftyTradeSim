const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const StockCandle = require('../src/models/StockCandle');

async function audit() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('--- Historical Data Audit ---');
  
  const stats = await StockCandle.aggregate([
    {
      $group: {
        _id: "$symbol",
        minDate: { $min: "$timestamp" },
        maxDate: { $max: "$timestamp" },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  console.table(stats.map(s => ({
    Symbol: s._id,
    From: s.minDate.toISOString().split('T')[0],
    To: s.maxDate.toISOString().split('T')[0],
    Count: s.count
  })));

  mongoose.disconnect();
}
audit();
