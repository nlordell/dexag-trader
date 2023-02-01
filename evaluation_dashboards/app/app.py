import os
from dash import Dash, html, dcc
import psycopg2
from src.bang_for_buck import get_bang_for_buck_graph
from src.cowswap_vs_best_solution import get_diff_between_winner_and_cowswap_graph

debug = False if os.environ["DASH_DEBUG_MODE"] == "False" else True
#establishing the connection
conn = psycopg2.connect(
   database=os.environ["POSTGRES_DB"], user=os.environ["POSTGRES_USER"], password=os.environ["POSTGRES_PASSWORD"], host=os.environ["POSTGRES_HOST"], port=os.environ["POSTGRES_PORT"]
   )
#Setting auto commit false
conn.autocommit = True
app = Dash(__name__)
server = app.server

bang_for_buck_graph = get_bang_for_buck_graph(conn)
diff_graph = get_diff_between_winner_and_cowswap_graph(conn)

app.layout = html.Div(
    children=[
        html.H1(
            children=f"Different graphs for the price estimation comparision between dex-aggregators"
        ),
        dcc.Graph(id="bang_for_buck", figure=bang_for_buck_graph),
        dcc.Graph(id="diff_to_cowswap", figure=diff_graph),
        ]
)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port="8050", debug=debug)
