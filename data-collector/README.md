, DEXag Trader

This repo contains a daemon that monitors the CoW Protocol orderbook and, for
each new order, simulates trading the order amounts on various DEX aggregators.
The simulation records both the expected traded amounts as well as the actual
executed amounts.

## Simulation Details

Simulation is done with an `eth_call` with state overrides. This allows
simulations to work even for traders that haven't approved the required
contracts.

## How to run it:

1. install deno

2. copy .env.example to .env and fill out the variables

```
cd data-collector
export $(grep -v '^#' ../.env | xargs)
```

2. run:

```
make run
```

## How to run it in docker:

```
docker build --tag benchmark-tool -f ./Dockerfile .
docker run -ti --env-file ../.env benchmark-tool
```
