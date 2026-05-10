import yfinance as yf
import json
import sys
import argparse
import warnings
from datetime import datetime
import pandas as pd

warnings.filterwarnings("ignore", category=FutureWarning)

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

def fetch_data(timeframe="1D", start_date=None, end_date=None):
    interval_map = {"1D": "1d", "1W": "1wk", "1M": "1mo"}
    interval = interval_map.get(timeframe, "1d")
    
    all_data = []
    for stock in stocks:
        try:
            print(f"Downloading {stock} [{timeframe}]...", file=sys.stderr)
            
            kwargs = {"interval": interval, "auto_adjust": True, "progress": False}
            if start_date:
                kwargs["start"] = start_date
            if end_date:
                kwargs["end"] = end_date
            if not start_date and not end_date:
                kwargs["period"] = "max"
                
            df = yf.download(stock, **kwargs)
            if df.empty: continue
            df = normalize_download_frame(df, stock)
            
            for index, row in df.iterrows():
                open_price = scalar(row.get("Open"))
                high_price = scalar(row.get("High"))
                low_price = scalar(row.get("Low"))
                close_price = scalar(row.get("Close"))
                volume = scalar(row.get("Volume", 0))

                if any(value is None for value in [open_price, high_price, low_price, close_price]):
                    continue

                all_data.append({
                    "symbol": stock,
                    "timeframe": timeframe,
                    "timestamp": index.isoformat(),
                    "open": float(open_price),
                    "high": float(high_price),
                    "low": float(low_price),
                    "close": float(close_price),
                    "volume": int(volume or 0)
                })
        except Exception as e:
            print(f"Error {stock}: {e}", file=sys.stderr)
    print(json.dumps(all_data))

def normalize_download_frame(df, stock):
    if isinstance(df.columns, pd.MultiIndex):
        if stock in df.columns.get_level_values(-1):
            df = df.xs(stock, axis=1, level=-1)
        else:
            df.columns = df.columns.get_level_values(0)
    return df

def scalar(value):
    if value is None:
        return None
    if isinstance(value, pd.Series):
        if value.empty:
            return None
        value = value.iloc[0]
    if pd.isna(value):
        return None
    return value

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeframe", default="1D")
    parser.add_argument("--start_date", default=None, help="Start date YYYY-MM-DD")
    parser.add_argument("--end_date", default=None, help="End date YYYY-MM-DD")
    args = parser.parse_args()
    fetch_data(args.timeframe, args.start_date, args.end_date)
