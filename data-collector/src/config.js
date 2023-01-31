import { ethers } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";
import { Exchange } from "./exchange.js";
import { handleJson } from "./utils.js";

export function generateExchangeConfig(db, provider) {
  return [
    new Exchange("ocean", db, provider, async (order, gasPrice, ethPrice) => {
      if (order.kind !== "sell") {
        return null;
      }
      // based on the following call from defi lama
      // https://ethapi.openocean.finance/v2/1/swap?inTokenAddress=0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2&outTokenAddress=0x6b175474e89094c44da98b954eedeac495271d0f&amount=10000000000000000000&gasPrice=244549634&slippage=50&account=0x06cd12cECE75D65dD33068dcd26627A42aF6dF3E&referrer=0x5521c3dfd563d48ca64e132324024470f3498526
      const params = [
        `inTokenAddress=${order.sellToken}`,
        `outTokenAddress=${order.buyToken}`,
        `amount=${order.sellAmount}`,
        `gasPrice=${gasPrice}`,
        `slippage=50`,
        `account=${order.owner}`,
      ].join("&");
      const swap = await fetch(
        `https://ethapi.openocean.finance/v2/1/swap?${params}`,
      ).then(handleJson);

      return {
        spender: ethers.utils.getAddress(
          "0x6352a56caadc4f1e25cd6c75970fa768a3304e64",
        ),
        exchange: ethers.utils.getAddress(swap.to),
        data: swap.data,
        feeUsd: (swap.estimatedGas * gasPrice) / ethPrice,
        sellAmount: ethers.BigNumber.from(swap.inAmount),
        buyAmount: ethers.BigNumber.from(swap.outAmount),
      };
    }),
    new Exchange("oneinch", db, provider, async (order, gasPrice, ethPrice) => {
      if (order.kind !== "sell") {
        return null;
      }
      // based on the following requests from defi lama
      // https://api.1inch.io/v4.0/1/swap?fromTokenAddress=0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2&toTokenAddress=0x6b175474e89094c44da98b954eedeac495271d0f&amount=10000000000000000000&fromAddress=0x06cd12cECE75D65dD33068dcd26627A42aF6dF3E&slippage=0.5&referrerAddress=0x08a3c2A819E3de7ACa384c798269B3Ce1CD0e437&disableEstimate=true
      // https://api.1inch.io/v4.0/1/quote?fromTokenAddress=0xdac17f958d2ee523a2206206994597c13d831ec7&toTokenAddress=0x6b175474e89094c44da98b954eedeac495271d0f&amount=10000000&slippage=0.5
      const params = [
        `fromTokenAddress=${order.sellToken}`,
        `toTokenAddress=${order.buyToken}`,
        `amount=${order.sellAmount}`,
        `fromAddress=${order.owner}`,
        `gasPrice=${gasPrice}`,
        `slippage=1`,
        `disableEstimate=true`,
      ].join("&");
      const params2 = [
        `fromTokenAddress=${order.sellToken}`,
        `toTokenAddress=${order.buyToken}`,
        `amount=${order.sellAmount}`,
        `gasPrice=${gasPrice}`,
        `fromAddress=${order.owner}`,
        `slippage=0.5`,
      ].join("&");
      const [spender, swap, quote] = await Promise.all([
        fetch("https://api.1inch.io/v4.0/1/approve/spender").then(handleJson),
        fetch(`https://api.1inch.io/v4.0/1/swap?${params}`).then(handleJson),
        fetch(`https://api.1inch.io/v4.0/1/quote?${params2}`).then(handleJson),
      ]);
      return {
        spender: ethers.utils.getAddress(spender.address),
        exchange: ethers.utils.getAddress(swap.tx.to),
        data: swap.tx.data,
        feeUsd: (quote.estimatedGas * gasPrice) / ethPrice,
        sellAmount: ethers.BigNumber.from(swap.fromTokenAmount),
        buyAmount: ethers.BigNumber.from(swap.toTokenAmount),
      };
    }),
    new Exchange("zeroex", db, provider, async (order, gasPrice, ethPrice) => {
      // based on the following calls from defi lama and adding the gas price
      // https://api.0x.org/swap/v1/quote?buyToken=0x6b175474e89094c44da98b954eedeac495271d0f&sellToken=0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2&sellAmount=10000000000000000000&slippagePercentage=0.005&affiliateAddress=0x08a3c2A819E3de7ACa384c798269B3Ce1CD0e437&enableSlippageProtection=false
      const params = [
        `sellToken=${order.sellToken}`,
        `buyToken=${order.buyToken}`,
        order.kind === "sell"
          ? `sellAmount=${order.sellAmount}`
          : `buyAmount=${order.buyAmount}`,
        `slippagePercentage=0.005`,
        `takerAddress=${order.owner}`,
        `gasPrice=${gasPrice}`,
        `skipValidation=true`,
        `enableSlippageProtection=false`,
      ].join("&");
      const quote = await fetch(
        `https://api.0x.org/swap/v1/quote?${params}`,
      ).then(handleJson);

      return {
        spender: ethers.utils.getAddress(quote.allowanceTarget),
        exchange: ethers.utils.getAddress(quote.to),
        data: quote.data,
        feeUsd: (quote.estimatedGas * gasPrice) / ethPrice,
        sellAmount: ethers.BigNumber.from(quote.sellAmount),
        buyAmount: ethers.BigNumber.from(quote.buyAmount),
      };
    }),
    new Exchange(
      "paraswap",
      db,
      provider,
      async (order, gasPrice, ethPrice, _sellTokenPrice, tokens) => {
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
        const price = await fetch(
          `https://apiv5.paraswap.io/prices?${params}`,
        ).then(handleJson);
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
              gasPrice: gasPrice,
              deadline: 0xffffffff,
            }),
          },
        ).then(handleJson);
        return {
          spender: ethers.utils.getAddress(price.priceRoute.tokenTransferProxy),
          exchange: ethers.utils.getAddress(transaction.to),
          data: transaction.data,
          feeUsd: (price.priceRoute.gasCost * gasPrice) / ethPrice,
          sellAmount: ethers.BigNumber.from(price.priceRoute.srcAmount),
          buyAmount: ethers.BigNumber.from(price.priceRoute.destAmount),
        };
      },
    ),
    new Exchange(
      "cowswap",
      db,
      provider,
      async (order, _gasPrice, _ethPrice, sellTokenPrice) => {
        const data = {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sellToken: order.sellToken,
            buyToken: order.buyToken,
            appData:
              "0xf249b3db926aa5b5a1b18f3fec86b9cc99b9a8a99ad7e8034242d2838ae97422",
            buyTokenBalance: "erc20",
            from: "0x06cd12cECE75D65dD33068dcd26627A42aF6dF3E",
            kind: "sell",
            partiallyFillable: false,
            sellAmountBeforeFee: order.sellAmount.toString(),
            sellTokenBalance: "erc20",
            signingScheme: "ethsign",
          }),
        };
        const quote = await fetch(
          `https://api.cow.fi/mainnet/api/v1/quote`,
          data,
        ).then(handleJson);
        return {
          spender: null,
          exchange: null,
          data: null,
          feeUsd: quote.quote.feeAmount / sellTokenPrice,
          sellAmount: quote.quote.sellAmount,
          buyAmount: quote.quote.buyAmount,
        };
      },
    ),
  ];
}
