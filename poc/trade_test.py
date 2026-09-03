import MetaTrader5 as mt5
import time

# Connect to the specific portable instance for the Master account
master_path = r"C:\Users\Plaiz\MT5_Instances\943e6a4b-07fc-4754-9a3e-440b6dfa0bb0\terminal64.exe"

if not mt5.initialize(path=master_path):
    print("initialize() failed, error code =", mt5.last_error())
    quit()

# Prepare the request for a BUY order
symbol = "EURUSDm"
lot = 0.01

if not mt5.symbol_select(symbol, True):
    print(f"Failed to select {symbol}")
    mt5.shutdown()
    quit()

price = mt5.symbol_info_tick(symbol).ask
request = {
    "action": mt5.TRADE_ACTION_DEAL,
    "symbol": symbol,
    "volume": lot,
    "type": mt5.ORDER_TYPE_BUY,
    "price": price,
    "sl": price - 0.0005,
    "tp": 0.0,
    "deviation": 20,
    "magic": 234000,
    "comment": "Test Master Trade",
    "type_time": mt5.ORDER_TIME_GTC,
    "type_filling": mt5.ORDER_FILLING_IOC,
}

# Send the order
result = mt5.order_send(request)
if result.retcode != mt5.TRADE_RETCODE_DONE:
    print(f"Order failed, retcode={result.retcode}")
else:
    print(f"Order successful! Ticket: {result.order}")

mt5.shutdown()
