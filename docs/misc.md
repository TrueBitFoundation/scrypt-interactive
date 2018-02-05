
Here are some odds and ends:

## Geth Docker Image Testing

Want to test against a more reasonable test chain?

```
git clone git@github.com:livepeer/docker-livepeer.git
cd docker-livepeer/geth-dev

# replace the latest tag with v1.7.3
s/latest/v1.7.3/g Dockerfile

docker build . -t geth-dev

docker run \
    --name geth-dev --rm -d \
    -p 8545:8545 \
    geth-dev

docker logs -f :container-id
```

## Doge-Ethereum Bounty Split Contract

We're splitting the bounty with additional developers via smart contract.

The bounty contract is deployed at: `0x1ed3e252dcb6d540947d2d63a911f56733d55681`

