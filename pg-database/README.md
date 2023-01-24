The system stores all data in a postgres database. This repo contains the docker image and the flyway migrations to run the database.

Docker

```sh
docker run -d --env-file ../.env -p 5432:5432 docker.io/postgres
```

```sh
cd pg-database
source ../.env
docker build --tag benchmark-migration -f ./Dockerfile.migration .
docker run --rm -v $PWD/sql:/flyway/sql benchmark-migration -url=jdbc:postgresql://host.docker.internal/$POSTGRES_DB -user=$POSTGRES_USER -password=$POSTGRES_PASSWORD migrate
```

In case you run into `java.net.UnknownHostException: host.docker.internal` add `--add-host=host.docker.internal:host-gateway` right after `docker run`.

If you're combining a local postgres installation with docker flyway you have to add to the above `--network host` and change `host.docker.internal` to `localhost`.