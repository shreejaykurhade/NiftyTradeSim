import yfinance as yf
import json
import sys
import argparse
from datetime import datetime

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

def fetch_data(timeframe="1D"):
    interval_map = {"1D": "1d", "1W": "1wk", "1M": "1mo"}
    interval = interval_map.get(timeframe, "1d")
    
    all_data = []
    for stock in stocks:
        try:
            print(f"Downloading {stock} [{timeframe}]...", file=sys.stderr)
            df = yf.download(stock, period="max", interval=interval, auto_adjust=True, progress=False)
            if df.empty: continue
            
            for index, row in df.iterrows():
                all_data.append({
                    "symbol": stock,
                    "timeframe": timeframe,
                    "timestamp": index.isoformat(),
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": int(row["Volume"]) if "Volume" in row else 0
                })
        except Exception as e:
            print(f"Error {stock}: {e}", file=sys.stderr)
    print(json.dumps(all_data))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeframe", default="1D")
    args = parser.parse_args()
    fetch_data(args.timeframe)
