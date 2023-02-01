import { delay } from "https://deno.land/std@0.153.0/async/delay.ts";
import * as log from "https://deno.land/std@0.153.0/log/mod.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { ethers } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";
import { Orderbook } from "./orderbook.js";
import {
  getGasPrice,
  getLatestBlockNumber,
  getPrice,
  setup_log,
} from "./utils.js";
import { ParameterStore } from "./parameterstore.js";
import { generateExchangeConfig } from "./config.js";
import { deadline } from "https://deno.land/std/async/mod.ts";

const POLL_INTERVAL = 5000; // ms

const POOL_CONNECTIONS = 20;
const dbPool = new Pool(
  {
    database: Deno.env.get("POSTGRES_DB"),
    hostname: Deno.env.get("POSTGRES_HOST"),
    password: Deno.env.get("POSTGRES_PASSWORD"),
    port: Deno.env.get("POSTGRES_PORT"),
    user: Deno.env.get("POSTGRES_USER"),
  },
  POOL_CONNECTIONS,
);

const provider = new ethers.providers.JsonRpcProvider(
  `${Deno.env.get("NODE_URL")}`,
);
const parameterStore = new ParameterStore(dbPool);
const orderbook = new Orderbook(dbPool, true);
await setup_log(log);
const exchanges = generateExchangeConfig(dbPool, provider).filter((exchange) =>
  ["zeroex", "ocean", "oneinch", "paraswap", "cowswap"].includes(exchange.name)
);
async function run_loop() {
  await orderbook.new_orders_update();
  log.debug("starting run for one order");
  const block_number = await getLatestBlockNumber(provider);
  const gasPrice = await getGasPrice();
  const order = (await orderbook.unprocessedOrders()).pop();
  if (order != undefined) {
    const etherPrice = await getPrice(
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    );
    const buyTokenPrice = await getPrice(order.buyToken);
    const sellTokenPrice = await getPrice(order.sellToken);
    if (
      buyTokenPrice != null &&
      sellTokenPrice != null &&
      etherPrice != null
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
    await parameterStore.store(
      order,
      etherPrice,
      sellTokenPrice,
      buyTokenPrice,
      gasPrice,
      block_number,
    );
    await orderbook.mark_as_processed(order);
  }
}
while (true) {
  try {
    await deadline(run_loop(), 100_000);
  } catch (err) {
    log.error(`${err}`);
  }

  log.debug("finished run; sleeping...");
  await delay(POLL_INTERVAL);
}
