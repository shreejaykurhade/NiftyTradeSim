import yfinance as yf
import json
import sys

stock = "RELIANCE.NS"
try:
    df = yf.download(stock, period="max", interval='1d', auto_adjust=True, progress=False)
    if not df.empty:
        print(f"Ticker: {stock}")
        print(f"Earliest: {df.index[0]}")
        print(f"Latest: {df.index[-1]}")
        print(f"Total Rows: {len(df)}")
    else:
        print("Empty DF")
except Exception as e:
    print(f"Error: {e}")
