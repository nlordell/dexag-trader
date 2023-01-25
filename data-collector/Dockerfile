FROM denoland/deno:1.29.4

COPY . /data-collector
WORKDIR /data-collector

RUN apt-get update &&\
    apt-get install -y ca-certificates tini
ENTRYPOINT ["tini", "--"]
# CMD ["/bin/bash", "-c", "deno run --allow-all src/index.js"]
