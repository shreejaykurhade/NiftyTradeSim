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
    Evaluates news sentiment and outputs a 5D sentiment vector:
    [Bullish, Bearish, Neutral, Subjectivity, MacroImpact]
    """
    def __init__(self):
        pass

    def evaluate(self, symbol, date, news_articles):
        """
        Convert news articles into a 5D vector.
        In a full implementation, this uses an LLM (like Gemini/OpenAI) to score the articles.
        For now, we simulate the sentiment calculation if articles are empty.
        Returns a numpy array of shape (5,)
        """
        if not news_articles or len(news_articles) == 0:
            return np.zeros(5, dtype=np.float32)

        bullish_score = 0.0
        bearish_score = 0.0
        neutral_score = 0.0
        subjectivity = 0.0
        macro_impact = 0.0

        # Simple keyword heuristic if no LLM is directly invoked per article here
        for article in news_articles:
            text = article.get('title', '').lower() + " " + article.get('content', '').lower()
            
            # 1. Bullish Agent
            if any(w in text for w in ['surge', 'jump', 'up', 'profit', 'beat', 'growth']):
                bullish_score += 0.5
                
            # 2. Bearish Agent
            if any(w in text for w in ['plunge', 'drop', 'down', 'loss', 'miss', 'decline']):
                bearish_score += 0.5
                
            # 3. Neutral Agent (fact reporting vs opinion)
            if any(w in text for w in ['announces', 'reports', 'declares', 'scheduled']):
                neutral_score += 0.5
                
            # 4. Subjectivity Agent (opinion words)
            if any(w in text for w in ['believe', 'expect', 'might', 'could', 'opinion']):
                subjectivity += 0.5
                
            # 5. Macro Impact Agent
            if any(w in text for w in ['economy', 'fed', 'rate', 'inflation', 'gdp', 'market']):
                macro_impact += 0.5

        n = len(news_articles)
        vector = np.array([
            bullish_score / n,
            bearish_score / n,
            neutral_score / n,
            subjectivity / n,
            macro_impact / n
        ], dtype=np.float32)

        return np.clip(vector, -1.0, 1.0)

