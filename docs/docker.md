Problem
-------

Package tdl-tdlib-addon contains a native module, that must be built on Amazon Linux 2.
Otherwise it will be linked to a more recent glibc than Amazon Linux 2 contains, and will fail at runtime.

Solution
--------

Run `npm install` in an Amazon Linux 2 docker. For that we need to install a dev environment in docker.

docker run -it --volume "$(pwd):/aoc-bot" amazonlinux:2 /bin/bash

yum -y groupinstall "Development Tools"
yum -y install python3

useradd user
su - user

touch ~/.profile
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 16

npm install -g node-gyp

cd /aoc-bot
rm -rf node_modules
npm install
