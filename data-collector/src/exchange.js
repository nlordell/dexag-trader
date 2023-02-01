import * as log from "https://deno.land/std@0.153.0/log/mod.ts";
import { ethers } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";
import Trader from "../contracts/Trader.json" assert { type: "json" };
import { calculate_output_via_eth_call } from "./simulate_eth_call.js";
import { calculate_output_via_trace_callMany } from "./simulate_trace_callMany.js";
import { Tokens } from "./tokens.js";

export class Exchange {
  constructor(name, db, provider, swap, options = {}) {
    this.name = name;
    this.provider = provider;
    this.swap = swap;
    this.db = db;
    this.trader = new ethers.utils.Interface(Trader.abi);
    this.tokens = new Tokens(db, provider);
    this.options = {
      sync: true,
      freshStart: true,
      ...options,
    };
  }

  async trySwap(order, gasPrice, ethPrice, sellTokenPrice) {
    try {
      return await this.swap(
        order,
        gasPrice,
        ethPrice,
        sellTokenPrice,
        this.tokens,
      );
    } catch (err) {
      log.warning(`${this.name} failed to get swap: ${err}`);
      return null;
    }
  }

  async simulateTrade(order, swap, block_number, gasPrice, ethPrice) {
    if (!swap) {
      return {
        uid: order.uid,
        sellAmount: ethers.constants.Zero,
        buyAmount: ethers.constants.Zero,
        outputValueputValuexecutedSellAmount: ethers.constants.Zero,
        executedBuyAmount: ethers.constants.Zero,
        exchange: ethers.constants.AddressZero,
        data: "0x",
      };
    }
    if (this.name == "cowswap") {
      // coswap trade intentions can not be simulated
      return {
        uid: order.uid,
        sellAmount: swap.sellAmount,
        buyAmount: swap.buyAmount,
        executedSellAmount: ethers.constants.Zero,
        executedBuyAmount: ethers.constants.Zero,
        exchange: ethers.constants.AddressZero,
        data: "0x",
        gasCost: swap.feeUsd,
      };
    }
    const trace_provider = new ethers.providers.JsonRpcProvider(
      `${
        Deno.env.get(
          "NODE_URL",
        )
      }`,
    );
    const estimation_result = await calculate_output_via_trace_callMany(
      trace_provider,
      order,
      swap,
      block_number,
    );

    const [executedSellAmount, executedBuyAmount, gasUsed] =
      await calculate_output_via_eth_call(
        this.name,
        this.trader,
        this.provider,
        order,
        swap,
        block_number,
      );
    const gasCost = gasUsed == null ? null : (gasUsed * gasPrice) / ethPrice;
    const gasCostTraceCall = estimation_result == null
      ? null
      : (parseInt(estimation_result.gas, 10) * gasPrice) / ethPrice;
    log.debug(
      "gas costs from trader contract for tx on " + this.name + ": " + gasCost,
    );
    log.debug(
      "gas costs from trace_call simulation on " +
        this.name +
        ": " +
        gasCostTraceCall,
    );

    return {
      uid: order.uid,
      sellAmount: swap.sellAmount,
      buyAmount: swap.buyAmount,
      executedSellAmount,
      executedBuyAmount,
      exchange: swap.exchange,
      data: swap.data,
      gasCost,
      gasCostTraceCall,
      is_reverted: gasUsed == 0 ? true : false,
    };
  }

  async storeTrade(trade, outPutValueInDollar, feeUsd) {
    const client = await this.db.connect();
    await client.queryArray(
      `
        INSERT INTO ${this.name}
          (uid, sell_amount, buy_amount, executed_sell_amount, executed_buy_amount, exchange, data, gas_cost_usd, output_value_usd)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (uid) DO NOTHING
      `,
      [
        trade.uid,
        trade.sellAmount.toString(),
        trade.buyAmount.toString(),
        trade.executedSellAmount.toString(),
        trade.executedBuyAmount.toString(),
        trade.exchange,
        trade.data,
        feeUsd,
        outPutValueInDollar,
      ],
    );
    client.release();
  }

  async processOrder(
    order,
    gasPrice,
    block_number,
    etherPrice,
    buyTokenPrice,
    sellTokenPrice,
  ) {
    const swap = await this.trySwap(
      order,
      gasPrice,
      etherPrice,
      sellTokenPrice,
    );
    if (swap != null) {
      const feeUsd = swap.feeUsd;
      const trade = await this.simulateTrade(
        order,
        swap,
        block_number,
        gasPrice,
        etherPrice,
      );
      let outPutValue = 0;
      if (this.name == "cowswap") {
        outPutValue = trade.buyAmount / buyTokenPrice;
      } else {
        outPutValue = trade.executedBuyAmount / buyTokenPrice - feeUsd;
      }
      await this.storeTrade(trade, outPutValue, feeUsd);
      log.debug(`${this.name} processed ${order.uid}`);
    }
  }
}
