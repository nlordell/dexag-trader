FROM denoland/deno:1.29.4

ENV DASH_DEBUG_MODE False
COPY . /data-collector
WORKDIR /data-collector
CMD ["/bin/bash", "-c", "deno run --allow-all src/index.js"]
