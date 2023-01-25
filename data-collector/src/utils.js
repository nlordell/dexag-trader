import * as log from "https://deno.land/std@0.153.0/log/mod.ts";

export async function getGasPrice() {
  const result = await fetch("https://ethapi.openocean.finance/v2/1/gas-price")
    .then(handleJson);
  return result.base;
}

export async function getLatestBlockNumber(provider) {
  const result = await provider
    .send(
      "eth_blockNumber",
    )
    .catch((err) => {
      throw err;
    });
  return result;
}

export async function handleJson(response) {
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return await response.json();
}

export async function getPrice(token) {
  // gets the amount of token that are worth 1 dollar
  // by querying oneinch by selling 100 dollar
  if (token.toLowerCase() == "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48") {
    return 1000000;
  }
  const params = [
    `fromTokenAddress=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`,
    `toTokenAddress=${token}`,
    `amount=100000000`,
    `fromAddress=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`,
    `slippage=1`,
    `disableEstimate=true`,
  ].join("&");
  try {
    const swapResult = await fetch(`https://api.1inch.io/v4.0/1/swap?${params}`)
      .then(handleJson);
    return swapResult.toTokenAmount / 100.0;
  } catch (err) {
    log.warning(`Failed to get initial price`, err);
    return null;
  }
}

export async function setup_log(log) {
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
}
