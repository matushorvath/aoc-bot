# Problem: Package tdl-tdlib-addon contains a native module, that must be built on Amazon Linux 2.
# Otherwise it will be linked to a more recent glibc than Amazon Linux 2 contains, and will fail at runtime.
#
# Solution: Run `npm install` in an Amazon Linux 2 docker. For that we need to install the dev tools.

# docker build -t aoc-bot-build .
# docker run --rm -it --volume "$(pwd):/aoc-bot" aoc-bot-build /bin/bash
# docker run --rm -it --volume "$(pwd):/aoc-bot" ghcr.io/matushorvath/aoc-bot-build /bin/bash
# cd /aoc-bot && rm -rf node_modules && npm install

FROM amazonlinux:2

# Add node.js package source
RUN curl -sL https://rpm.nodesource.com/setup_16.x | bash -

# Install development tools
RUN yum -y install gcc gcc-c++ gzip jq make nodejs python3 unzip util-linux tar zip

# Install AWS CLI v2
RUN curl -sL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o awscliv2.zip
RUN unzip awscliv2.zip && ./aws/install

# Install node-gyp
RUN npm install -g node-gyp
