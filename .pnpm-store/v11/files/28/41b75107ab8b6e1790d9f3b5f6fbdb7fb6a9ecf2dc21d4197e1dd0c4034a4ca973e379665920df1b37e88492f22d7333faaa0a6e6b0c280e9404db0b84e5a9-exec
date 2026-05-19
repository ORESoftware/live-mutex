#!/usr/bin/env bash

function suman_trap_and_kill_child_jobs {
    trap 'jobs -p | xargs kill -9' SIGINT SIGTERM EXIT
}
