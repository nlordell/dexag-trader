CREATE TABLE IF NOT EXISTS cowswap (
        uid TEXT PRIMARY KEY,
        sell_amount numeric(78,0),
        buy_amount numeric(78,0),
        executed_sell_amount numeric(78,0),
        executed_buy_amount numeric(78,0),
        exchange TEXT,
        data TEXT,
        output_value_usd double precision,
        gas_cost_usd double precision
      );
CREATE TABLE IF NOT EXISTS paraswap (
        uid TEXT PRIMARY KEY,
        sell_amount numeric(78,0),
        buy_amount numeric(78,0),
        executed_sell_amount numeric(78,0),
        executed_buy_amount numeric(78,0),
        exchange TEXT,
        data TEXT,
        output_value_usd double precision,
        gas_cost_usd double precision
      );
CREATE TABLE IF NOT EXISTS zeroex (
        uid TEXT PRIMARY KEY,
        sell_amount numeric(78,0),
        buy_amount numeric(78,0),
        executed_sell_amount numeric(78,0),
        executed_buy_amount numeric(78,0),
        exchange TEXT,
        data TEXT,
        output_value_usd double precision,
        gas_cost_usd double precision
      );
CREATE TABLE IF NOT EXISTS oneinch (
        uid TEXT PRIMARY KEY,
        sell_amount numeric(78,0),
        buy_amount numeric(78,0),
        executed_sell_amount numeric(78,0),
        executed_buy_amount numeric(78,0),
        exchange TEXT,
        data TEXT,
        output_value_usd double precision,
        gas_cost_usd double precision
      );
CREATE TABLE IF NOT EXISTS ocean (
        uid TEXT PRIMARY KEY,
        sell_amount numeric(78,0),
        buy_amount numeric(78,0),
        executed_sell_amount numeric(78,0),
        executed_buy_amount numeric(78,0),
        exchange TEXT,
        data TEXT,
        output_value_usd double precision,
        gas_cost_usd double precision
      );
