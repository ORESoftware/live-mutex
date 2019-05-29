FROM node:11

ENV live_mutex_host "0.0.0.0"
ENV live_mutex_port 6970
ENV FORCE_COLOR=1

USER root

WORKDIR "/app"

COPY package.json .
COPY package-lock.json .
COPY assets/postinstall.sh assets/postinstall.sh

RUN npm i --production

COPY . .

ARG CACHEBUST=1

ENTRYPOINT ["node", "dist/lm-start-server.js"]
CMD []

