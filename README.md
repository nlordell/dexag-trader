# DEXag Trader

This repo contains a daemon that monitors the CoW Protocol orderbook and, for each new order, simulates trading the order amounts on various DEX aggregators.
The simulation records both the expected traded amounts as well as the actual executed amounts.

## Simulation Details

Simulation is done with an `eth_call` with state overrides.
This allows simulations to work even for traders that haven't approved the required contracts.

## Output

The daemon writes to an SQLite database `orders.db`.
It includes details of the original CoW Protocol order and trade simulation results for each DEX aggregator.
