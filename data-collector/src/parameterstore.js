export class ParameterStore {
  constructor(db) {
    this.db = db;
  }

  async store(
    order,
    ethPrice,
    sellTokenPrice,
    buyTokenPrice,
    gasPrice,
    blockNumber,
  ) {
    const client = await this.db.connect(); // 19 connections are still available
    await client.queryArray(
      `
      INSERT INTO parameters
        (uid, gas_price, sell_token_price, buy_token_price, eth_price, block_number)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (uid) DO Nothing
    `,
      [
        order.uid,
        gasPrice,
        sellTokenPrice,
        buyTokenPrice,
        ethPrice,
        parseInt(blockNumber, 16),
      ],
    );
    client.release();
  }
}
