CREATE TABLE IF NOT EXISTS parameters (
        uid TEXT PRIMARY KEY,
        gas_price double precision,
        sell_token_price double precision,
        buy_token_price double precision,
        eth_price double precision,
        block_number bigint
      );
