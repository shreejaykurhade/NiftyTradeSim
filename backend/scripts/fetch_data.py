import yfinance as yf
import json
import sys
from datetime import datetime, timedelta

stocks = [
    "RELIANCE.NS","TCS.NS","INFY.NS","HDFCBANK.NS","ICICIBANK.NS",
    "SBIN.NS","ITC.NS","LT.NS","AXISBANK.NS","HINDUNILVR.NS",
    "KOTAKBANK.NS","BAJFINANCE.NS","BHARTIARTL.NS","ASIANPAINT.NS",
    "MARUTI.NS","SUNPHARMA.NS","NTPC.NS","TITAN.NS","ULTRACEMCO.NS",
    "ONGC.NS","ADANIENT.NS","ADANIPORTS.NS","COALINDIA.NS","DRREDDY.NS",
    "EICHERMOT.NS","GRASIM.NS","HCLTECH.NS","HEROMOTOCO.NS","HINDALCO.NS",
    "INDUSINDBK.NS","JSWSTEEL.NS","M&M.NS","NESTLEIND.NS","POWERGRID.NS",
    "SBILIFE.NS","SHRIRAMFIN.NS","TATACONSUM.NS","TATAMOTORS.NS",
    "TATASTEEL.NS","TECHM.NS","UPL.NS","WIPRO.NS","BPCL.NS","BRITANNIA.NS",
    "CIPLA.NS","DIVISLAB.NS","APOLLOHOSP.NS","HDFCLIFE.NS","BAJAJ-AUTO.NS","SHREECEM.NS","BPCL.NS","IOC.NS"
]

def fetch_data():
    start_date = "2014-01-01"
    all_data = []

    for stock in stocks:
        try:
            print(f"Downloading {stock}...", file=sys.stderr)
            # Use period="max" or a very old start date
            df = yf.download(stock, start=start_date, interval='1d', auto_adjust=True, progress=False)
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
