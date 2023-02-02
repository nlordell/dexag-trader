UNION_RAW_DATA_JOINED_WITH_PARAMETER = """with raw_data as (
        select pa.uid, sell_amount, buy_amount, executed_sell_amount, executed_buy_amount, exchange, name, data, output_value_usd, gas_cost_usd_from_trader_contract, gas_cost_usd_from_trace_callMany, gas_price, sell_token_price, buy_token_price, eth_price, block_number from exchange prd inner join parameters pa on pa.uid = prd.uid
      ),"""

