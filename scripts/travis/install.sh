#!/usr/bin/env bash

tsc || {
  echo 'Could not compile with tsc. Exiting with 1.' > /dev/stderr
  exit 1;
}