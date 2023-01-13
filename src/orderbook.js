import { ethers } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";

export class Orderbook {
  constructor(db, freshStart) {
    this.db = db;
    if (freshStart) {
      db.query(`drop table orders`);
    }
    db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        uid TEXT PRIMARY KEY,
        owner TEXT,
        sell_token TEXT,
        buy_token TEXT,
        sell_amount TEXT,
        buy_amount TEXT,
        kind TEXT,
        is_processed INTEGER
      )
    `);
  }

  mark_as_processed(order) {
    this.db.query(
      `
      Update orders 
      SET is_processed = 1 WHERE uid = ?
      `,
      [`${order.uid}`]
    );
  }

  unprocessedOrders() {
    const rows = this.db.query(`
      SELECT *
      FROM orders AS o
      WHERE is_processed = 0
    `);

    return rows.map((row) => ({
      uid: row[0],
      owner: ethers.utils.getAddress(row[1]),
      sellToken: ethers.utils.getAddress(row[2]),
      buyToken: ethers.utils.getAddress(row[3]),
      sellAmount: ethers.BigNumber.from(row[4]),
      buyAmount: ethers.BigNumber.from(row[5]),
      kind: row[6],
    }));
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
    this.db.query(
      `
      INSERT OR IGNORE INTO orders
        (uid, owner, sell_token, buy_token, sell_amount, buy_amount, kind, is_processed)
      VALUES ${orders.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)")}
    `,
      orders
        .map((o) => [
          o.uid,
          ethers.utils.getAddress(o.owner),
          ethers.utils.getAddress(o.sellToken),
          ethers.utils.getAddress(o.buyToken),
          o.sellAmount,
          o.buyAmount,
          o.kind,
          0,
        ])
        .flat()
    );
  }
}
