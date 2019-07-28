ARG base
FROM $base

# base should be something like 'circleci/node:12'

USER root

WORKDIR "/home/circleci/repo"

RUN npm set unsafe-perm true

RUN npm i -g typescript@3.5.1
RUN npm i -g suman@1.1.51244;

