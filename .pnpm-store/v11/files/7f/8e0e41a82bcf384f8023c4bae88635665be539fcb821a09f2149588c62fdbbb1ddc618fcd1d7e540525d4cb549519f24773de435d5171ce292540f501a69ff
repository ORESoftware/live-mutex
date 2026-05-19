FROM node:10

ENV ores_bash_utils https://raw.githubusercontent.com/oresoftware/npm.bash.utils
RUN  curl -sS -o- $ores_bash_utils/master/assets/install-basics.sh | bash

ENV FORCE_COLOR=1
ENV docker_r2g_in_container=yes
ENV MY_DOCKER_R2G_SEARCH_ROOT="/home/node"

RUN sudo echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER node
RUN mkdir -p /home/node/app/node_modules
RUN mkdir -p /home/node/.docker_r2g_cache
ENV USER="node"
ENV HOME="/home/node"
ENV MY_DOCKER_R2G_SEARCH_ROOT "$HOME"
WORKDIR /home/node/app

RUN sudo chmod -R 777  /home/node

RUN  curl -sS -o- $ores_bash_utils/master/assets/run-non-root-chown.sh | bash
RUN  curl -sS -o- $ores_bash_utils/master/assets/run-npm-config-settings.sh | bash

#COPY package.json .
#COPY .r2g .r2g
#RUN npm install --loglevel=warn -g \
# "https://raw.githubusercontent.com/oresoftware/tarballs/master/tgz/oresoftware/npm.cache.tgz?$(date +%s)"
#RUN update_npm_cache

ARG CACHEBUST=1

RUN npm install --loglevel=warn -g \
 "https://raw.githubusercontent.com/oresoftware/tarballs/master/tgz/oresoftware/docker.r2g.tgz?$(date +%s)"

RUN npm install --loglevel=warn -g \
 "https://raw.githubusercontent.com/oresoftware/tarballs/master/tgz/oresoftware/r2g.tgz?$(date +%s)"


COPY . .

RUN sudo chmod -R 777  /home/node

ENTRYPOINT ["dkr2g", "run"]

