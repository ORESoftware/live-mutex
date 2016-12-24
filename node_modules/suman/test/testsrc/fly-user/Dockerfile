


#http://stackoverflow.com/questions/27701930/add-user-to-docker-container

# start with this image as a base
FROM node:5

RUN npm cache clean

RUN chmod -R 777 $(npm root -g)

RUN echo $NODE_PATH

RUN useradd -ms /bin/bash newuser

USER newuser
WORKDIR /home/newuser

#RUN sudo chown -R $(whoami) $(npm root -g) $(npm root) ~/.npm

COPY script.sh .

ENTRYPOINT ["/bin/bash", "/home/newuser/script.sh"]
