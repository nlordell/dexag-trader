import erc20 from "../contracts/erc20.json" assert { type: "json" };
import { ethers } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";
import * as log from "https://deno.land/std@0.153.0/log/mod.ts";

export async function calculate_output_via_trace_callMany(
  provider,
  order,
  swap,
  block_number,
) {
  const tokenContract = new ethers.Contract(
    ethers.utils.getAddress(order.sellToken),
    erc20,
    provider,
  );
  const tx = { data: swap.data, to: swap.exchange };
  try {
    const approveTx = {
      ...(await tokenContract.populateTransaction.approve(
        swap.spender,
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      )),
      from: swap.from,
    };
    const callParams = [
      [approveTx, tx].filter(Boolean).map((tx) => [
        {
          from: order.owner,
          to: tx.to,
          data: tx.data,
        },
        ["trace"],
      ]),
      block_number,
    ];
    const res = await provider.send("trace_callMany", callParams);
    const swapTx = res[res.length - 1];
    return {
      gas: ethers.BigNumber.from(swapTx.trace[0].result.gasUsed).add(
        ethers.BigNumber.from("21000"),
      ).toString(), // ignores calldata and accesslist costs
      isFailed: swapTx.trace[0]?.error === "Reverted",
    };
  } catch (e) {
    log.warning(
      "could not create gas estimation from trace_callMany, due to:" + e,
    );
    return null;
  }
}
