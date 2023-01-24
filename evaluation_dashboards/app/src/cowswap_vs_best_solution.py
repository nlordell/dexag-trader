import plotly.express as px
import pandas as pd
import src.shared


diff_query = """
raw_data_filtered as (
      select * from raw_data where executed_buy_amount != 0 or name='cowswap'
      ),
      ranked_by_ouput as(
      select uid, output_value_usd, name, gas_price, 
       rank() over( partition by uid order by output_value_usd DESC ) as rank
       from raw_data_filtered
      ),
      winner as (
      select * from ranked_by_ouput where rank=1
      ),
      difference_to_cowswap as(
      select ro.uid, w.output_value_usd - ro.output_value_usd as diff, ro.gas_price, ro.output_value_usd from ranked_by_ouput ro left join winner w on ro.uid = w.uid 
      where ro.name='cowswap'
      ),
      diff_categories as(
      select (floor(diff/0.5) * 0.5)::TEXT as category,FLOOR(gas_price / 5000000000) * 5 as gas_price, output_value_usd from difference_to_cowswap where diff < 50
      )
      select * from diff_categories
"""


def get_diff_between_winner_and_cowswap_graph(conn):
    cursor = conn.cursor()
    cursor.execute(src.shared.UNION_RAW_DATA_JOINED_WITH_PARAMETER + diff_query)
    data = pd.DataFrame(cursor.fetchall())
    data = data.rename(columns={0: "difference", 1: "gas_price", 2: "trade_value"})
    print(data)
    return px.bar(
        data,
        x="difference",
        color="trade_value",
        animation_frame="gas_price",
        title="The difference between cowswap and the best solution provided (bang for buck in [USD])",
        barmode="group"
    )
