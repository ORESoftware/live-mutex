FROM node:11

RUN apt-get -y update
RUN apt-get -y install sudo
RUN sudo apt-get -y update
RUN apt-get install -y netcat
RUN apt-get install -y rsync

ENV live_mutex_host "0.0.0.0"
ENV live_mutex_port 6970
ENV FORCE_COLOR=1

RUN sudo echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER node
RUN mkdir -p /home/node/app/node_modules
ENV USER="node"
ENV HOME="/home/node"
WORKDIR "/home/node/app"

RUN sudo chmod -R 777  /home/node
#RUN sudo chown -R $(whoami) $(npm config get prefix)/lib
#RUN sudo chown -R $(whoami) $(npm config get prefix)/lib/node_modules
#RUN sudo chown -R $(whoami) $(npm config get prefix)/bin
#RUN sudo chown -R $(whoami) $(npm config get prefix)/share
#RUN sudo chown -R $(whoami) /usr/local/lib
#RUN sudo chown -R $(whoami) /usr/local/etc

RUN npm set cache-min 9999999
RUN npm set progress=false

COPY package.json .
#COPY assets .
COPY . .
RUN npm install --production
COPY . .

RUN sudo chmod -R 777  /home/node

ARG CACHEBUST=1

ENTRYPOINT node dist/lm-start-server.js

