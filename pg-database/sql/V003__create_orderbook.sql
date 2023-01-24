CREATE TABLE IF NOT EXISTS orders (
        uid TEXT PRIMARY KEY,
        owner TEXT,
        sell_token TEXT,
        buy_token TEXT,
        sell_amount numeric(78,0),
        buy_amount numeric(78,0),
        kind TEXT,
        is_processed boolean
      );
