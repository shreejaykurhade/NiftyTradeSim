import yfinance as yf
import json
import sys
from datetime import datetime, timedelta

stocks = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "HINDUNILVR.NS",
    "ICICIBANK.NS", "KOTAKBANK.NS", "SBIN.NS", "BAJFINANCE.NS", "BHARTIARTL.NS",
    "WIPRO.NS", "LT.NS", "ASIANPAINT.NS", "HCLTECH.NS", "AXISBANK.NS",
    "MARUTI.NS", "SUNPHARMA.NS", "TITAN.NS", "ULTRACEMCO.NS", "ONGC.NS",
    "NESTLEIND.NS", "POWERGRID.NS", "NTPC.NS", "M&M.NS", "TECHM.NS",
    "BAJAJFINSV.NS", "DRREDDY.NS", "CIPLA.NS", "TATAMOTORS.NS", "COALINDIA.NS",
    "INDUSINDBK.NS", "EICHERMOT.NS", "HEROMOTOCO.NS", "GRASIM.NS", "DIVISLAB.NS",
    "HINDALCO.NS", "JSWSTEEL.NS", "TATASTEEL.NS", "ADANIPORTS.NS", "TATACONSUM.NS",
    "BRITANNIA.NS", "APOLLOHOSP.NS", "SBILIFE.NS", "HDFCLIFE.NS", "BAJAJ-AUTO.NS",
    "UPL.NS", "SHREECEM.NS", "BPCL.NS", "IOC.NS", "^NSEI"
]

def fetch_data():
    all_data = []

    for stock in stocks:
        try:
            print(f"Downloading {stock}...", file=sys.stderr)
            df = yf.download(stock, period="max", interval='1d', auto_adjust=True, progress=False)
            if df.empty:
                print(f"Empty data for {stock}", file=sys.stderr)
                continue
            
            # Filter to last 11 years (approx 2015-2026) to keep buffer size manageable
            # But we'll just take everything from 2014 onwards
            
            candles = []
            for index, row in df.iterrows():
                candles.append({
                    "symbol": stock,
                    "timestamp": index.isoformat(),
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": int(row["Volume"]) if "Volume" in row else 0
                })
            all_data.extend(candles)
            print(f"  Got {len(candles)} candles", file=sys.stderr)
        except Exception as e:
            print(f"Error {stock}: {e}", file=sys.stderr)

    print(json.dumps(all_data))

if __name__ == "__main__":
    fetch_data()
