export function formatCurrency(value, options = {}) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
  }).format(amount);
}

export function formatNumber(value, options = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return new Intl.NumberFormat('en-IN', options).format(Number(value));
}

export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  const amount = Number(value);
  return `${amount > 0 ? '+' : ''}${amount.toFixed(2)}%`;
}

export function compactVolume(value) {
  const amount = Number(value || 0);
  if (!amount) return '--';
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)}Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return formatNumber(amount);
}

export function cleanSymbol(symbol = '') {
  return symbol.replace('.NS', '');
}
