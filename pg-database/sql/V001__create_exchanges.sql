CREATE TABLE IF NOT EXISTS exchange (
        uid TEXT NOT NUlL,
        name TEXT NOT NULL,
        sell_amount numeric(78,0),
        buy_amount numeric(78,0),
        executed_sell_amount numeric(78,0),
        executed_buy_amount numeric(78,0),
        exchange TEXT,
        data TEXT,
        output_value_usd double precision,
        gas_cost_usd_from_trader_contract double precision,
        gas_cost_usd_from_trace_callMany double precision,
        PRIMARY KEY (uid, name)
      );
