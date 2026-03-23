const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:5000/api/candles/RELIANCE.NS?timeframe=1D&limit=3000');
    const data = res.data.data;
    if (data && data.length > 0) {
      console.log('Count:', data.length);
      console.log('First Date:', new Date(data[0].time * 1000).toISOString());
      console.log('Last Date:', new Date(data[data.length - 1].time * 1000).toISOString());
    } else {
      console.log('No data');
    }
  } catch (err) {
    console.error('API Error:', err.message);
  }
}

test();
