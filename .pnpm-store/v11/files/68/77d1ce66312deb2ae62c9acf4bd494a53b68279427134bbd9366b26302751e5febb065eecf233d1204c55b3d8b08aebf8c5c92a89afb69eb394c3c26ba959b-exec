# start with this image as a base
FROM node:7

#RUN npm cache clean

RUN apt-get update && \
      apt-get -y install sudo

RUN sudo apt-get install -y sqlite3 libsqlite3-dev

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN npm config --global set color false
RUN npm --global set progress=false
RUN npm set progress=false

COPY package.json .
RUN npm install --only=production --silent

RUN echo "reinstalling 3"
#RUN sudo chown -R $(whoami) $(npm config get prefix)
#RUN sudo chmod -R 777 $(npm root -g)
RUN npm install --only=production -g --unsafe-perm=false "github:sumanjs/suman#rebase_branch"

RUN echo "rebuilding 1"
COPY . .

#CMD ["node","/usr/src/app/node_modules/suman/cli.js"]

ENTRYPOINT ["suman"]

#ENTRYPOINT ["sudo","suman"]
