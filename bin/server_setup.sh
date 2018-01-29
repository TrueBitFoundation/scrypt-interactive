
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

# install tmux
sudo apt-get install tmux

#----------------------------------

# install geth
sudo apt-get install software-properties-common
sudo add-apt-repository -y ppa:ethereum/ethereum
sudo apt-get update
sudo apt-get install ethereum

# boot Ropsten blockchain: https://github.com/ethereum/ropsten
geth --testnet --fast --bootnodes "enode://20c9ad97c081d63397d7b685a412227a40e23c8bdc6688c6f37e97cfbc22d2b4d1db1510d8f61e6a8866ad7f0e17c02b14182d37ea7c3c8b9c2683aeb6b733a1@52.169.14.227:30303,enode://6ce05930c72abc632c58e2e4324f7c7ea478cec0ed4fa2528982cf34483094e9cbc9216e7aa349691242576d552a2a56aaeae426c5303ded677ce455ba1acd9d@13.84.180.240:30303"

