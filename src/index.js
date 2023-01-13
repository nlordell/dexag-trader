import { delay } from "https://deno.land/std@0.153.0/async/delay.ts";
import * as log from "https://deno.land/std@0.153.0/log/mod.ts";
import { DB } from "https://deno.land/x/sqlite@v3.4.1/mod.ts";
import { ethers } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";
import { Orderbook } from "./orderbook.js";
import {
  getGasPrice,
  getLatestBlockNumber,
  getPrice,
  setup_log,
} from "./utils.js";
import { generateExchangeConfig } from "./config.js";

const POLL_INTERVAL = 5000; // ms

const db = new DB("orders.db");
const provider = new ethers.providers.JsonRpcProvider(
  `https://mainnet.infura.io/v3/${Deno.env.get("INFURA_PROJECT_ID")}`,
);
const orderbook = new Orderbook(db, true);
await setup_log(log);
const exchanges = generateExchangeConfig(db, provider).filter((exchange) =>
  ["zeroex", "ocean", "oneinch", "paraswap", "cowswap"].includes(exchange.name)
);
while (true) {
  try {
    await orderbook.new_orders_update();
    log.debug("starting run for one order");
    const block_number = await getLatestBlockNumber(provider);
    const gasPrice = await getGasPrice();
    const order = orderbook.unprocessedOrders().pop();
    if (order != undefined) {
      const etherPrice = await getPrice(
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      );
      const buyTokenPrice = await getPrice(order.buyToken);
      const sellTokenPrice = await getPrice(order.sellToken);
      if (
        buyTokenPrice != null && sellTokenPrice != null && etherPrice != null
      ) {
        await Promise.all(
          exchanges.map((exchange) =>
            exchange.processOrder(
              order,
              gasPrice,
              block_number,
              etherPrice,
              buyTokenPrice,
              sellTokenPrice,
            )
          ),
        );
      }
      orderbook.mark_as_processed(order);
    }
  } catch (err) {
    log.error(`${err}`);
  }

  log.debug("finished run; sleeping...");
  await delay(POLL_INTERVAL);
}
