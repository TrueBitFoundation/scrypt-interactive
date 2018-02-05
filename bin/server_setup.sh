
#!/bin/bash

# NOTE: This is not an automated script.
# Rather, it's the sequence of commands that were used to setup the geth Ropsten linux server.
# They will occasionally require provide prompts for input.

# initial server setup

sudo apt-get -y update
sudo apt-get -y upgrade

USR="truebit"
adduser $USR
usermod -aG sudo $USR
# To automate above, need to allow $USR to run sudo without typing password
# refer to this: https://askubuntu.com/questions/192050/how-to-run-sudo-command-with-no-password

su - $USR
mkdir ~/.ssh
chmod 700 ~/.ssh  # set the permissions to only this user into it
vim ~/.ssh/authorized_keys
# step 1 – vim and paste in your public key.
# step 2 – paste in the public key of the app server.
# automate the above.

chmod 600 ~/.ssh/authorized_keys  # set the permissions so only this user is allowed to access it
# check that you can ssh into server with $USR account

sudo sed -i -e "s/PermitRootLogin yes/PermitRootLogin no/" /etc/ssh/sshd_config
sudo sed -i -e "s/PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config
sudo service ssh restart

#-------------------------------------

# add swap space
# basically following this structure: https://www.digitalocean.com/community/tutorials/how-to-add-swap-on-ubuntu-14-04

# check current setup
sudo swapon -s
free -m
df -h

# create swap file
sudo fallocate -l 8G /swapfile
ls -lh /swapfile # verify
sudo chmod 600 /swapfile
ls -lh /swapfile # verify
sudo mkswap /swapfile
sudo swapon /swapfile
sudo swapon -s # verify
free -m

# make the swap file permanent
sudo vim /etc/fstab
# add this line to bottom of file:
/swapfile   none    swap    sw    0   0

# upate swap configs
sudo sysctl vm.swappiness=10
sudo sysctl vm.vfs_cache_pressure=50

sudo vim /etc/sysctl.conf
# at the bottom add:
vm.swappiness=10
vm.vfs_cache_pressure = 50

#----------------------------------

# installed sina's dotfiles :)
# follow the directions
git clone git@github.com:sinahab/dotfiles.git

# install tmux
sudo apt-get install tmux

#----------------------------------

# install geth
sudo apt-get install software-properties-common
sudo add-apt-repository -y ppa:ethereum/ethereum
sudo apt-get update
sudo apt-get install ethereum

sudo apt install geth

# to run on the Ropsten network: https://github.com/ethereum/ropsten
geth --testnet --fast --bootnodes "enode://20c9ad97c081d63397d7b685a412227a40e23c8bdc6688c6f37e97cfbc22d2b4d1db1510d8f61e6a8866ad7f0e17c02b14182d37ea7c3c8b9c2683aeb6b733a1@52.169.14.227:30303,enode://6ce05930c72abc632c58e2e4324f7c7ea478cec0ed4fa2528982cf34483094e9cbc9216e7aa349691242576d552a2a56aaeae426c5303ded677ce455ba1acd9d@13.84.180.240:30303"

# to run on teh Rinkeby network: https://gist.github.com/cryptogoth/10a98e8078cfd69f7ca892ddbdcf26bc
geth --rinkeby

#----------------------------------

# install parity

sudo apt-get install build-essential openssl libssl-dev libudev-dev

# download the latest stable release:
wget https://parity-downloads-mirror.parity.io/v1.8.8/x86_64-unknown-linux-gnu/parity_1.8.8_amd64.deb
sudo apt install ./parity_1.8.8_amd64.deb

# follow the README:
# kill this after ~ 5 seconds, when the dev db is setup.
parity --chain dev

#----------------------------------

# install postgres
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# give your user the ability to execute commands as postgres user
# by giving it the right permissions in pg_hba.conf
sudo vim /etc/postgresql/9.5/main/pg_hba.conf
# set METHOD to trust for all local connections – for now..

# restart postgres
sudo service postgresql restart

#----------------------------------

# clone the scrypt-interactive repo
git clone git@github.com:TrueBitFoundation/scrypt-interactive.git

# install node – @TODO: use nvm in the future
curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y build-essential

#----------------------------------

# go through the README installation directions:
cd scrypt-interactive

# install node modules
npm install
sudo npm install -g sequelize-cli
sudo npm install -g truffle

# setup the dbs
sequelize db:create
sequelize db:migrate
NODE_ENV=test sequelize db:create
NODE_ENV=test sequelize db:migrate

# compile the contracts – 
truffle compile

