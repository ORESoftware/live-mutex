FROM node:12.3.1-alpine

ENV live_mutex_host "0.0.0.0"
ENV live_mutex_port 6970
ENV lmx_in_docker='yes'

ENV FORCE_COLOR=1

USER root

WORKDIR "/app"

COPY package.json .
COPY package-lock.json .
COPY assets assets

RUN npm i --production

COPY . .

ARG CACHEBUST=1

ENTRYPOINT ["node", "dist/lm-start-server.js"]
CMD []

