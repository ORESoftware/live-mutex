
#http://stackoverflow.com/questions/27701930/add-user-to-docker-container

# start with this image as a base
FROM node:5

RUN npm cache clean

ARG s

ARG sname

RUN echo $s
RUN echo $sname

ENV sname $sname
ENV SUMAN_POSTINSTALL_IS_DAEMON=yes

RUN chmod -R 777 $(npm root -g)

RUN useradd -ms /bin/bash newuser

USER newuser
WORKDIR /home/newuser

COPY $s .

ENTRYPOINT /bin/bash /home/newuser/$sname
