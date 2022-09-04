.PHONY: run
run: contracts/Trader.json
	deno run \
		--allow-env=INFURA_PROJECT_ID \
		--allow-net=api.cow.fi,mainnet.infura.io,api.1inch.io,api.0x.org,apiv5.paraswap.io \
		--allow-read=orders.db,orders.db-journal \
		--allow-write=orders.db,orders.db-journal \
		src/index.js

contracts/%.json: contracts/%.sol
	docker run -it --rm \
		-v "$(abspath contracts):/contracts" -w "/contracts" \
		ethereum/solc:0.8.16 \
		--overwrite --metadata-hash none --optimize --optimize-runs 1000000 \
		--combined-json abi,bin-runtime $(notdir $<) \
		| jq '.contracts["$(notdir $<):$(basename $(notdir $<))"]' \
		> $@
