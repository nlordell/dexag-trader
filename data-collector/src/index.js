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

const POOL_CONNECTIONS = 5;
await setup_log(log);
const node_config = {
  url: Deno.env.get("NODE_URL"),
  password: Deno.env.get("NODE_PASSWORD"),
  user: Deno.env.get("NODE_USER"),
  allowInsecureAuthentication: true,
};
const provider = new ethers.providers.JsonRpcProvider(node_config);

async function run_loop(orderbook, parameterStore, exchanges, provider) {
  await orderbook.new_orders_update();
  const block_number = await getLatestBlockNumber(provider);
  const gasPrice = await getGasPrice();
  const order = (await orderbook.unprocessedOrders()).pop();
  log.debug("Starting to process order:" + order.uid);
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
      try {
        await deadline(
          Promise.all(
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
          ),
          10_000,
        );
      } catch (err) {
        log.error(`Error while quering all exchanges ${err}`);
      }
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
    const dbPool = new Pool(
      {
        database: Deno.env.get("POSTGRES_DB"),
        hostname: Deno.env.get("POSTGRES_HOST"),
        password: Deno.env.get("POSTGRES_PASSWORD"),
        port: Deno.env.get("POSTGRES_PORT"),
        user: Deno.env.get("POSTGRES_USER"),
        tls: {
          enabled: false,
        },
        lazy: true,
      },
      POOL_CONNECTIONS,
    );
    const parameterStore = new ParameterStore(dbPool);
    const orderbook = new Orderbook(dbPool, true);
    const exchanges = generateExchangeConfig(dbPool, provider).filter((
      exchange,
    ) =>
      ["zeroex", "ocean", "oneinch", "paraswap", "cowswap"].includes(
        exchange.name,
      )
    );
    log.debug("starting run for one order");
    await deadline(
      run_loop(orderbook, parameterStore, exchanges, provider),
      20_000,
    );
    log.debug("finished run; sleeping...");
    await dbPool.end();
  } catch (err) {
    log.error(`Error during run loop: ${err}`);
  }

  await delay(POLL_INTERVAL);
}
