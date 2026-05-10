const RANGE_SECONDS = {
  '1D': 24 * 60 * 60,
  '5D': 5 * 24 * 60 * 60,
  '1W': 7 * 24 * 60 * 60,
  '1M': 30 * 24 * 60 * 60,
  '3M': 90 * 24 * 60 * 60,
  '6M': 180 * 24 * 60 * 60,
  '1Y': 365 * 24 * 60 * 60,
  '3Y': 3 * 365 * 24 * 60 * 60,
  '5Y': 5 * 365 * 24 * 60 * 60,
};

function toUnixSeconds(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return value > 100000000000 ? Math.floor(value / 1000) : Math.floor(value);
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return toUnixSeconds(numeric);
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
  }

  if (typeof value === 'object' && 'year' in value && 'month' in value && 'day' in value) {
    return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 1000);
  }

  return null;
}

export function normalizeCandles(candles = []) {
  const byTime = new Map();

  candles.forEach((candle) => {
    const time = toUnixSeconds(candle.time ?? candle.timestamp ?? candle.date);
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);

    if (!time || ![open, high, low, close].every(Number.isFinite)) return;

    byTime.set(time, {
      time,
      open,
      high: Math.max(open, high, low, close),
      low: Math.min(open, high, low, close),
      close,
      volume: Number(candle.volume || 0),
    });
  });

  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

export function getVisibleRange(candles, range) {
  if (!candles.length || range === 'ALL') return null;

  const lastTime = candles[candles.length - 1].time;
  const diff = RANGE_SECONDS[range] || RANGE_SECONDS['1Y'];

  return {
    from: Math.max(candles[0].time, lastTime - diff),
    to: lastTime + Math.floor(diff * 0.03),
  };
}

export function getBucketStart(time, timeframe) {
  const date = new Date(toUnixSeconds(time) * 1000);

  if (timeframe === '1W') {
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 1);
    date.setUTCHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
  }

  if (timeframe === '1M') {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
  }

  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

export function buildLiveCandle(lastCandle, liveUpdate, timeframe) {
  const price = Number(liveUpdate?.price);
  if (!Number.isFinite(price)) return null;

  const updateTime = getBucketStart(liveUpdate.time || Date.now() / 1000, timeframe);

  if (lastCandle && updateTime <= lastCandle.time) {
    return {
      ...lastCandle,
      close: price,
      high: Math.max(Number(lastCandle.high), Number(liveUpdate.high || price), price),
      low: Math.min(Number(lastCandle.low), Number(liveUpdate.low || price), price),
      volume: Number(liveUpdate.volume || lastCandle.volume || 0),
    };
  }

  return {
    time: updateTime,
    open: Number(liveUpdate.open || price),
    high: Math.max(Number(liveUpdate.high || price), price),
    low: Math.min(Number(liveUpdate.low || price), price),
    close: price,
    volume: Number(liveUpdate.volume || 0),
  };
}
