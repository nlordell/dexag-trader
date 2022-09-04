import { delay } from "https://deno.land/std@0.153.0/async/delay.ts";
import * as log from "https://deno.land/std@0.153.0/log/mod.ts";

import { DB } from "https://deno.land/x/sqlite@v3.4.1/mod.ts";
import { ethers } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";

import Trader from "../contracts/Trader.json" assert { type: "json" };

const POLL_INTERVAL = 5000; // ms

await log.setup({
  handlers: {
    console: new log.handlers.ConsoleHandler("DEBUG"),
  },
  loggers: {
    default: {
      level: "DEBUG",
      handlers: ["console"],
    },
  },
});

const db = new DB("orders.db");
const provider = new ethers.providers.JsonRpcProvider(
  `https://mainnet.infura.io/v3/${Deno.env.get("INFURA_PROJECT_ID")}`,
);
const trader = new ethers.utils.Interface(Trader.abi);

class Orderbook {
  constructor() {
    db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        uid TEXT PRIMARY KEY,
        owner TEXT,
        sell_token TEXT,
        buy_token TEXT,
        sell_amount TEXT,
        buy_amount TEXT,
        kind TEXT
      )
    `);
  }

  async update() {
    const response = await fetch("https://api.cow.fi/mainnet/api/v1/auction");
    if (!response.ok) {
      throw new Error(await response.text());
    }

    const { orders } = await response.json();
    db.query(
      `
      INSERT OR IGNORE INTO orders
        (uid, owner, sell_token, buy_token, sell_amount, buy_amount, kind)
      VALUES
        ${orders.map(() => "(?, ?, ?, ?, ?, ?, ?)")}
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
        ])
        .flat(),
    );
  }
}

class Tokens {
  constructor() {
    db.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        address TEXT PRIMARY KEY,
        decimals INTEGER
      )
    `);
  }

  async decimals(addr) {
    const address = ethers.utils.getAddress(addr);
    const rows = db.query(
      `
        SELECT decimals
        FROM tokens
        WHERE address = ?
      `,
      [address],
    );

    if (rows.length > 0) {
      return rows[0][0];
    }

    const token = new ethers.Contract(
      address,
      [`function decimals() external view returns (uint256)`],
      provider,
    );
    const decimals = await token.decimals()
      .then((decimals) => decimals.toNumber())
      .catch(() => 18);

    db.query(
      `
        INSERT OR IGNORE INTO tokens (address, decimals)
        VALUES (?, ?)
      `,
      [address, decimals],
    );

    return decimals;
  }
}

class Exchange {
  constructor(name, swap, options = {}) {
    this.name = name;
    this.swap = swap;
    this.options = {
      sync: true,
      ...options,
    };

    db.query(`
      CREATE TABLE IF NOT EXISTS ${this.name} (
        uid TEXT PRIMARY KEY,
        sell_amount TEXT,
        buy_amount TEXT,
        executed_sell_amount TEXT,
        executed_buy_amount TEXT,
        exchange TEXT,
        data TEXT
      )
    `);
  }

  unprocessedOrders() {
    const rows = db.query(`
      SELECT *
      FROM orders AS o
      LEFT JOIN ${this.name} x ON o.uid = x.uid
      WHERE x.uid IS NULL
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

  async trySwap(order) {
    try {
      return await this.swap(order);
    } catch (err) {
      log.warning(`${this.name} failed to get swap: ${err}`);
      return null;
    }
  }

  async simulateTrade(order, swap) {
    if (!swap) {
      return {
        uid: order.uid,
        sellAmount: ethers.constants.Zero,
        buyAmount: ethers.constants.Zero,
        executedSellAmount: ethers.constants.Zero,
        executedBuyAmount: ethers.constants.Zero,
        exchange: ethers.constants.AddressZero,
        data: "0x",
      };
    }

    const result = await provider
      .send(
        "eth_call",
        [
          {
            from: order.owner,
            to: order.owner,
            data: trader.encodeFunctionData("trade", [
              order.sellToken,
              order.buyToken,
              swap.spender,
              swap.exchange,
              swap.data,
            ]),
          },
          "latest",
          {
            [order.owner]: {
              code: `0x${Trader["bin-runtime"]}`,
            },
          },
        ],
      )
      .catch((err) => {
        if (`${err.body}`.indexOf("execution reverted") >= 0) {
          log.warning(`${this.name} trade reverted`);
          return trader.encodeFunctionResult("trade", [0, 0]);
        } else {
          throw err;
        }
      });

    const [
      executedSellAmount,
      executedBuyAmount,
    ] = trader.decodeFunctionResult("trade", result);

    return {
      uid: order.uid,
      sellAmount: swap.sellAmount,
      buyAmount: swap.buyAmount,
      executedSellAmount,
      executedBuyAmount,
      exchange: swap.exchange,
      data: swap.data,
    };
  }

  storeTrade(trade) {
    db.query(
      `
        INSERT OR IGNORE INTO ${this.name}
          (uid, sell_amount, buy_amount, executed_sell_amount, executed_buy_amount, exchange, data)
        VALUES
          (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        trade.uid,
        trade.sellAmount.toString(),
        trade.buyAmount.toString(),
        trade.executedSellAmount.toString(),
        trade.executedBuyAmount.toString(),
        trade.exchange,
        trade.data,
      ],
    );
  }

  async processOrder(order) {
    const swap = await this.trySwap(order);
    const trade = await this.simulateTrade(order, swap);
    this.storeTrade(trade);

    log.debug(`${this.name} processed ${order.uid}`);
  }

  async process() {
    const orders = this.unprocessedOrders();
    if (this.options.sync) {
      for (const order of orders) {
        await this.processOrder(order);
      }
    } else {
      await Promise.all(orders.map((order) => this.processOrder(order)));
    }
  }
}

async function handleJson(response) {
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return await response.json();
}

const orderbook = new Orderbook();
const tokens = new Tokens();

const exchanges = [
  new Exchange("oneinch", async (order) => {
    if (order.kind !== "sell") {
      return null;
    }

    const params = [
      `fromTokenAddress=${order.sellToken}`,
      `toTokenAddress=${order.buyToken}`,
      `amount=${order.sellAmount}`,
      `fromAddress=${order.owner}`,
      `slippage=1`,
      `disableEstimate=true`,
    ].join("&");
    const [spender, swap] = await Promise.all([
      fetch("https://api.1inch.io/v4.0/1/approve/spender").then(handleJson),
      fetch(`https://api.1inch.io/v4.0/1/swap?${params}`).then(handleJson),
    ]);

    return {
      spender: ethers.utils.getAddress(spender.address),
      exchange: ethers.utils.getAddress(swap.tx.to),
      data: swap.tx.data,
      sellAmount: ethers.BigNumber.from(swap.fromTokenAmount),
      buyAmount: ethers.BigNumber.from(swap.toTokenAmount),
    };
  }),

  new Exchange("zeroex", async (order) => {
    const params = [
      `sellToken=${order.sellToken}`,
      `buyToken=${order.buyToken}`,
      order.kind === "sell"
        ? `sellAmount=${order.sellAmount}`
        : `buyAmount=${order.buyAmount}`,
      `slippagePercentage=0.005`,
      `takerAddress=${order.owner}`,
      `skipValidation=true`,
    ].join("&");
    const quote = await fetch(`https://api.0x.org/swap/v1/quote?${params}`)
      .then(handleJson);

    return {
      spender: ethers.utils.getAddress(quote.allowanceTarget),
      exchange: ethers.utils.getAddress(quote.to),
      data: quote.data,
      sellAmount: ethers.BigNumber.from(quote.sellAmount),
      buyAmount: ethers.BigNumber.from(quote.buyAmount),
    };
  }),

  new Exchange("paraswap", async (order) => {
    const params = [
      `srcToken=${order.sellToken}`,
      `srcDecimals=${await tokens.decimals(order.sellToken)}`,
      `destToken=${order.buyToken}`,
      `destDecimals=${await tokens.decimals(order.buyToken)}`,
      order.kind === "sell"
        ? `amount=${order.sellAmount}`
        : `amount=${order.buyAmount}`,
      `side=${order.kind.toUpperCase()}`,
      `network=1`,
      `userAddress=${order.owner}`,
    ].join("&");
    const price = await fetch(`https://apiv5.paraswap.io/prices?${params}`)
      .then(handleJson);
    const amount = order.kind === "sell"
      ? { srcAmount: price.priceRoute.srcAmount }
      : { destAmount: price.priceRoute.destAmount };
    const transaction = await fetch(
      `https://apiv5.paraswap.io/transactions/1?ignoreChecks=true`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          srcToken: price.priceRoute.srcToken,
          srcDecimals: price.priceRoute.srcDecimals,
          destToken: price.priceRoute.destToken,
          destDecimals: price.priceRoute.destDecimals,
          ...amount,
          side: order.kind.toUpperCase(),
          slippage: 100,
          priceRoute: price.priceRoute,
          userAddress: order.owner,
          deadline: 0xffffffff,
        }),
      },
    ).then(handleJson);

    return {
      spender: ethers.utils.getAddress(price.priceRoute.tokenTransferProxy),
      exchange: ethers.utils.getAddress(transaction.to),
      data: transaction.data,
      sellAmount: ethers.BigNumber.from(price.priceRoute.srcAmount),
      buyAmount: ethers.BigNumber.from(price.priceRoute.destAmount),
    };
  }),
];

while (true) {
  try {
    log.debug("starting run");

    await orderbook.update();
    await Promise.all(exchanges.map((exchange) => exchange.process()));
  } catch (err) {
    log.error(`${err}`);
  }

  log.debug("finished run; sleeping...");
  await delay(POLL_INTERVAL);
}
