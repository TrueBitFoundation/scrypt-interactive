
## Setting up the client

The specific commands used to setup our Ubuntu 16.04 server can be found [here](https://github.com/TrueBitFoundation/scrypt-interactive/blob/master/bin/server_setup.sh).

More general directions follow:

```bash
# Install the latest stable release of the Parity Ethereum client. 
# You can look for the binary [here](https://github.com/paritytech/parity/releases).

# make sure it's executable
chmod 755 ./parity

# Initialize the parity development chain database with
# kill this after the dev db is setup (a few seconds).
parity --chain dev

# run parity
npm run parity

# Ensure you have the latest version of node installed (currently v9.4.0).

# Then install npm packages deps:
npm install
npm install -g sequelize-cli
npm install -g truffle

# Install postgres and run it on the default port `5432`:
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# give you user the ability to execute commands as postgres user
# by giving it the right permissions in pg_hba.conf

# Bootstrap your database with:
sequelize db:create
sequelize db:migrate
NODE_ENV=test sequelize db:create
NODE_ENV=test sequelize db:migrate

# Configure your client by updating the `.env` file, as follows:
#
# export WEB3_HTTP_PROVIDER=http://localhost:8545
# export WEB3_PARITY_PROVIDER=http://localhost:4242
# export DOGE_RELAY_ADDRESS=0x0
# export SCRYPT_VERIFIER_ADDRESS=0x0
# export SCRYPT_RUNNER_ADDRESS=0x0
# export CLAIM_MANAGER_ADDRESS=0x0
```

