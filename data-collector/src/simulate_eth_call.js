import Trader from "../contracts/Trader.json" assert { type: "json" };
import { ethers } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";
import * as log from "https://deno.land/std@0.153.0/log/mod.ts";

export async function calculate_output_via_eth_call(
  nameOfexchange,
  trader,
  provider,
  order,
  swap,
  block_number,
) {
  try {
    const eth_call_promise = provider
      .send("eth_call", [
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
        block_number,
        {
          [order.owner]: {
            code: `0x${Trader["bin-runtime"]}`,
          },
        },
      ])
      .catch((err) => {
        if (`${err.body}`.indexOf("execution reverted") >= 0) {
          log.warning(`${nameOfexchange} trade reverted`);
          return trader.encodeFunctionResult("trade", [0, 0, 0]);
        } else {
          throw err;
        }
      });

    const eth_call_result = await eth_call_promise;

    const [executedSellAmount, executedBuyAmount, gasUsed] = trader
      .decodeFunctionResult("trade", eth_call_result);

    const txInitiationCost = ethers.BigNumber.from("21000");
    const txUnnecessaryContractJump = ethers.BigNumber.from("2000");
    const totalGasUsed = gasUsed.add(
      txInitiationCost.sub(txUnnecessaryContractJump),
    );

    return [executedSellAmount, executedBuyAmount, totalGasUsed];
  } catch (e) {
    log.warning("Could not create gas esitmation from eth_call due to" + e);
    return null;
  }
}
