
# start with this image as a base
FROM node:5

# add all files from current directory
# ADD ./ /home/web-service-dockerized

RUN mkdir -p /usr/src/app
COPY script.sh /usr/src/app/

# execute bash commands
# RUN cd /home/web-service-dockerized && \
# npm init -y && \
# npm install express --save --save-exact

#RUN cd /usr/src/app && ./script.sh

# expose port 3000 by default
# EXPOSE 3000

# run this command on start by default
# CMD cd /home/web-service-dockerized && \
# node service.js

ENTRYPOINT ["/bin/bash", "/usr/src/app/script.sh"]