import numpy as np

class StockAgents:
    """
    A multi-agent system that evaluates raw market data and outputs a 5D event vector.
    Each dimension represents a normalized [-1, 1] evaluation from a specific agent.
    """
    def __init__(self, lookback_period=14):
        self.lookback = lookback_period

    def evaluate(self, current_candle, historical_candles, macro_candle=None):
        """
        Evaluate the 5 dimensions based on the current candle and recent history.
        Returns a numpy array of shape (5,)
        """
        # 1. Price Agent: Normalized daily return
        price_val = self._price_agent(current_candle)
        
        # 2. Volume Agent: Volume surge compared to historical
        volume_val = self._volume_agent(current_candle, historical_candles)
        
        # 3. Volatility Agent: Normalized daily range
        volatility_val = self._volatility_agent(current_candle, historical_candles)
        
        # 4. Momentum Agent: Distance from Moving Average
        momentum_val = self._momentum_agent(current_candle, historical_candles)
        
        # 5. Macro Agent: Broader market sentiment
        macro_val = self._macro_agent(macro_candle)

        vector = np.array([price_val, volume_val, volatility_val, momentum_val, macro_val], dtype=np.float32)
        
        # Clip to ensure bounds [-1, 1] (optional but good for stable vector space)
        return np.clip(vector, -1.0, 1.0)

    def _price_agent(self, candle):
        if candle['open'] == 0: return 0.0
        return ((candle['close'] - candle['open']) / candle['open']) * 10.0

    def _volume_agent(self, candle, history):
        if not history or len(history) == 0: return 0.0
        avg_vol = np.mean([c['volume'] for c in history])
        if avg_vol == 0: return 0.0
        return (candle['volume'] - avg_vol) / avg_vol

    def _volatility_agent(self, candle, history):
        current_range = candle['high'] - candle['low']
        if not history or len(history) == 0: return 0.0
        
        ranges = [c['high'] - c['low'] for c in history]
        atr = np.mean(ranges)
        
        if atr == 0: return 0.0
        return (current_range - atr) / atr

    def _momentum_agent(self, candle, history):
        if not history or len(history) == 0: return 0.0
        closes = [c['close'] for c in history]
        sma = np.mean(closes)
        if sma == 0: return 0.0
        return ((candle['close'] - sma) / sma) * 10.0

    def _macro_agent(self, macro_candle):
        if not macro_candle or macro_candle['open'] == 0: return 0.0
        return ((macro_candle['close'] - macro_candle['open']) / macro_candle['open']) * 10.0


class NewsAgents:
    """
    Evaluates perception and outputs a 5D vector:
    [DomesticMarket, Peers, InternationalMarket, NewsEvents, TimeRegime]
    """
    def __init__(self):
        pass

    def evaluate(self, symbol, date, news_articles, current_candle=None, historical_candles=None, peer_candles=None, international_candle=None):
        """
        Convert market context and news proxies into a 5D perception vector.
        Returns a numpy array of shape (5,)
        """
        domestic_market = self._domestic_market_agent(current_candle)
        peers = self._peer_agent(peer_candles)
        international_market = self._international_agent(international_candle)
        news_events = self._news_event_agent(news_articles)
        time_regime = self._time_regime_agent(date, historical_candles)

        vector = np.array([
            domestic_market,
            peers,
            international_market,
            news_events,
            time_regime,
        ], dtype=np.float32)

        return np.clip(vector, -1.0, 1.0)

    def _domestic_market_agent(self, candle):
        if not candle or candle.get('open', 0) == 0:
            return 0.0
        return ((candle['close'] - candle['open']) / candle['open']) * 12.0

    def _peer_agent(self, peer_candles):
        if not peer_candles:
            return 0.0
        returns = []
        for candle in peer_candles:
            if candle and candle.get('open', 0) != 0:
                returns.append((candle['close'] - candle['open']) / candle['open'])
        if not returns:
            return 0.0
        return float(np.mean(returns) * 12.0)

    def _international_agent(self, candle):
        if not candle or candle.get('open', 0) == 0:
            return 0.0
        return ((candle['close'] - candle['open']) / candle['open']) * 10.0

    def _news_event_agent(self, news_articles):
        if not news_articles:
            return 0.0

        score = 0.0
        for article in news_articles:
            text = (article.get('title', '') + " " + article.get('content', '')).lower()
            if any(w in text for w in ['surge', 'jump', 'profit', 'beat', 'growth', 'upgrade', 'record', 'order win']):
                score += 0.35
            if any(w in text for w in ['plunge', 'drop', 'loss', 'miss', 'decline', 'downgrade', 'probe', 'fine']):
                score -= 0.35
            if any(w in text for w in ['merger', 'acquisition', 'management', 'policy', 'tariff', 'rate']):
                score += 0.05 if score >= 0 else -0.05
        return score / max(len(news_articles), 1)

    def _time_regime_agent(self, date, historical_candles):
        if not historical_candles or len(historical_candles) < 5:
            return 0.0
        recent = historical_candles[-5:]
        returns = []
        for candle in recent:
            if candle.get('open', 0) != 0:
                returns.append((candle['close'] - candle['open']) / candle['open'])
        if not returns:
            return 0.0
        trend = np.mean(returns) * 10.0
        weekday_bias = 0.03 if getattr(date, 'weekday', lambda: 2)() in [0, 4] else 0.0
        return float(trend + weekday_bias)
