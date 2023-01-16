export class ParameterStore {
  constructor(db, freshStart) {
    this.db = db;
    if (freshStart) {
      db.query(`drop table parameters`);
    }
    db.query(`
      CREATE TABLE IF NOT EXISTS parameters (
        uid TEXT PRIMARY KEY,
        gas_price TEXT,
        sell_token_price TEXT,
        buy_token_price TEXT,
        eth_price TEXT,
        block_number TEXT
      )
    `);
  }

  store(order, ethPrice, sellTokenPrice, buyTokenPrice, gasPrice, blockNumber) {
    this.db.query(
      `
      INSERT OR REPLACE INTO parameters
        (uid, gas_price, sell_token_price, buy_token_price, eth_price, block_number)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        `${order.uid}`,
        gasPrice,
        sellTokenPrice,
        buyTokenPrice,
        ethPrice,
        blockNumber,
      ],
    );
  }
}
