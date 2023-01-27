import { ethers } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";

export class Orderbook {
  constructor(db) {
    this.db = db;
  }

  async mark_as_processed(order) {
    const client = await this.db.connect();
    await client.queryArray(
      `
        Update orders 
        SET is_processed = true WHERE uid = $1
        `,
      [order.uid],
    );
    client.release();
  }

  async unprocessedOrders() {
    const client = await this.db.connect();
    const queryResult = await client.queryArray(
      `
      SELECT *
      FROM orders AS o
      WHERE is_processed = false
      `,
      [],
    );
    client.release();

    const singleResults = queryResult.rows.map((row) => ({
      uid: row[0],
      owner: ethers.utils.getAddress(row[1]),
      sellToken: ethers.utils.getAddress(row[2]),
      buyToken: ethers.utils.getAddress(row[3]),
      sellAmount: ethers.BigNumber.from(row[4]),
      buyAmount: ethers.BigNumber.from(row[5]),
      kind: row[6],
    }));
    return singleResults;
  }

  async new_orders_update() {
    const response = await fetch("https://api.cow.fi/mainnet/api/v1/auction");
    if (!response.ok) {
      throw new Error(await response.text());
    }

    let { orders } = await response.json();
    // Currently, most orders in the auction are limit orders between stable coins
    // for more variety of orders, one could filter for market ordesr
    // orders = orders.filter(order => order.class == 'market')
    // we look only for sell orders, as not all dex-ags support buy orders
    orders = orders.filter((order) => order.kind == "sell");
    const client = await this.db.connect();
    for (const order of orders) {
      await client.queryArray(
        `
      INSERT INTO orders
        (uid, owner, sell_token, buy_token, sell_amount, buy_amount, kind, is_processed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFlICT (uid) DO NOTHING
    `,
        [
          order.uid,
          ethers.utils.getAddress(order.owner),
          ethers.utils.getAddress(order.sellToken),
          ethers.utils.getAddress(order.buyToken),
          order.sellAmount,
          order.buyAmount,
          order.kind,
          false,
        ],
      );
    }
    client.release();
  }
}
