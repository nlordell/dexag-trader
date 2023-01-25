UNION_RAW_DATA = """with 
      pre_raw_data as (
        SELECT *, 'ocean' as name
        FROM ocean
        UNION ALL 
        SELECT *, 'oneinch' as name
        FROM oneinch
        UNION ALL
        SELECT *, 'zeroex' as name
        FROM zeroex
        UNION ALL
        SELECT *, 'paraswap' as name
        FROM paraswap
        UNION ALL
        SELECT *, 'cowswap' as name
        FROM cowswap
        ), """
UNION_RAW_DATA_JOINED_WITH_PARAMETER = (
    UNION_RAW_DATA
    + """ raw_data as (
        select pa.uid, sell_amount, buy_amount, executed_sell_amount, executed_buy_amount, exchange, name, data, output_value_usd, gas_cost_usd, gas_price, sell_token_price, buy_token_price, eth_price, block_number from pre_raw_data prd inner join parameters pa on pa.uid = prd.uid
      ),"""
)