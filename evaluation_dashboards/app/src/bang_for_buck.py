import plotly.express as px
import pandas as pd
import src.shared


bang_for_buck_query = """raw_data_filtered as (
      select * from raw_data where executed_buy_amount != 0 or name='cowswap'
      ),
      result_count as (
      select uid, count(*) as number_of_results from raw_data_filtered group by uid
      ),
      ranked_by_ouput as(
      select rf.uid, output_value_usd, name, gas_cost_usd_from_trace_callMany, gas_price,
       rank() over( partition by rf.uid order by output_value_usd DESC ) as rank
       from raw_data_filtered rf left join result_count rc on rc.uid = rf.uid where rc.number_of_results > 2
      ),
      winner as (
       select name, FLOOR(gas_price / 5000000000) * 5, output_value_usd from ranked_by_ouput where rank=1 
       )
      select * from winner"""


def get_bang_for_buck_graph(conn):
    cursor = conn.cursor()
    cursor.execute(
        src.shared.UNION_RAW_DATA_JOINED_WITH_PARAMETER + bang_for_buck_query
    )
    data = pd.DataFrame(cursor.fetchall())
    data = data.rename(columns={0: "exchange", 1: "gas_price", 2: "trade_value"})
    print(data)
    return px.bar(
        data,
        x="exchange",
        color="trade_value",
        animation_frame="gas_price",
        title="Wins per Dex-ag on bang for buck with gas price slider(Gwei)",
    )
