
Note this sub-repo is only a temporary repo. It might have to be managed in another repo of all the dashly deployments for cowswap

In order to serve the data, run:
1. create your own .env file by copying .env.example
2. run the following commands
```
source ../.env
docker build -f Dockerfile.dev -t docker-dashboard .
docker run --env-file ./.env -p 8050:8050 -v "$(pwd)"/app:/app --rm docker-dashboard
```
and then visit your local browser:
`http://localhost:8050`

and for the production setup:
```
source ../.env
docker build -f Dockerfile -t docker-dashboard-prod .
docker run --env-file ../.env -p 8050:8050 --rm docker-dashboard-prod
```

