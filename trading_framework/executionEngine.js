const MARKET_ORDER = 'MARKET';
const LIMIT_ORDER = 'LIMIT';
const BUY = 'BUY';
const SELL = 'SELL';

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parsePositiveInteger(value, fieldName = 'quantity') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive whole number`);
  }
  return parsed;
}

function parseMoney(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return roundMoney(parsed);
}

function normalizeSymbol(symbol, allowedSymbols = []) {
  if (typeof symbol !== 'string' || !symbol.trim()) {
    throw new Error('Stock symbol is required');
  }

  const normalized = symbol.trim().toUpperCase();
  if (allowedSymbols.length > 0 && !allowedSymbols.includes(normalized)) {
    throw new Error(`Unsupported trading symbol: ${normalized}`);
  }

  return normalized;
}

function normalizeOrderRequest({ side, stockSymbol, quantity, limitPrice }, allowedSymbols = []) {
  const normalizedSide = String(side || '').toUpperCase();
  if (![BUY, SELL].includes(normalizedSide)) {
    throw new Error('Order side must be BUY or SELL');
  }

  const normalizedLimitPrice = limitPrice === undefined || limitPrice === null || limitPrice === ''
    ? null
    : parseMoney(limitPrice, 'limitPrice');

  return {
    side: normalizedSide,
    stockSymbol: normalizeSymbol(stockSymbol, allowedSymbols),
    quantity: parsePositiveInteger(quantity),
    orderType: normalizedLimitPrice ? LIMIT_ORDER : MARKET_ORDER,
    limitPrice: normalizedLimitPrice,
  };
}

function simulateExecution({ side, quantity, livePrice, limitPrice }) {
  const normalizedSide = String(side || '').toUpperCase();
  const normalizedQuantity = parsePositiveInteger(quantity);
  const quote = parseMoney(livePrice, 'livePrice');
  const hasLimit = limitPrice !== undefined && limitPrice !== null && limitPrice !== '';
  const normalizedLimit = hasLimit ? parseMoney(limitPrice, 'limitPrice') : null;

  if (![BUY, SELL].includes(normalizedSide)) {
    throw new Error('Order side must be BUY or SELL');
  }

  if (normalizedLimit !== null) {
    const isMarketable =
      normalizedSide === BUY
        ? normalizedLimit >= quote
        : normalizedLimit <= quote;

    if (!isMarketable) {
      const direction = normalizedSide === BUY ? 'at or above' : 'at or below';
      throw new Error(`Limit ${normalizedSide.toLowerCase()} is not marketable. Set limit ${direction} live price ₹${quote.toFixed(2)}.`);
    }
  }

  const executionPrice = quote;
  const total = roundMoney(executionPrice * normalizedQuantity);

  return {
    side: normalizedSide,
    orderType: normalizedLimit === null ? MARKET_ORDER : LIMIT_ORDER,
    executionPrice,
    requestedLimitPrice: normalizedLimit,
    quantity: normalizedQuantity,
    total,
  };
}

function calculateWeightedAverage(existingQuantity, existingAveragePrice, addedQuantity, addedPrice) {
  const oldQty = parsePositiveInteger(existingQuantity, 'existingQuantity');
  const newQty = parsePositiveInteger(addedQuantity, 'addedQuantity');
  const oldAverage = parseMoney(existingAveragePrice, 'existingAveragePrice');
  const price = parseMoney(addedPrice, 'addedPrice');

  return roundMoney(((oldAverage * oldQty) + (price * newQty)) / (oldQty + newQty));
}

module.exports = {
  BUY,
  SELL,
  MARKET_ORDER,
  LIMIT_ORDER,
  roundMoney,
  normalizeOrderRequest,
  simulateExecution,
  calculateWeightedAverage,
};
