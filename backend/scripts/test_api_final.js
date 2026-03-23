const axios = require('axios');

async function test() {
  const timeframes = ['1D', '1W', '1M'];
  for (const tf of timeframes) {
    try {
      const res = await axios.get(`http://localhost:5000/api/candles/RELIANCE.NS?timeframe=${tf}&limit=15000`);
      const data = res.data.data;
      console.log(`[${tf}] Count:`, data.length);
      if (data.length > 0) {
        console.log(`[${tf}] First:`, new Date(data[0].time * 1000).toISOString(), 'Close:', data[0].close);
        console.log(`[${tf}] Last:`, new Date(data[data.length - 1].time * 1000).toISOString(), 'Close:', data[data.length - 1].close);
      }
    } catch (err) {
      console.error(`[${tf}] API Error:`, err.message);
    }
  }
}

test();
