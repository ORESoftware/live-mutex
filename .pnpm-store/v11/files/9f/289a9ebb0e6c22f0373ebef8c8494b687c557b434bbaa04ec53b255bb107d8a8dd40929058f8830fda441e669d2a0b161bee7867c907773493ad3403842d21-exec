#!/usr/bin/env bash

sqlite3 "${SUMAN_DATABASE_PATH}"  "CREATE TABLE suman_run_info (run_id INTEGER, suman_id INTEGER, suite_id INTEGER, test_id INTEGER,
 name TEXT, value TEXT);" >> "${SUMAN_DEBUG_LOG_PATH}" 2>&1

sqlite3 "${SUMAN_DATABASE_PATH}" "CREATE TABLE suman_run_id (id INTEGER UNIQUE, run_id INTEGER);" >> "${SUMAN_DEBUG_LOG_PATH}" 2>&1

sqlite3 "${SUMAN_DATABASE_PATH}" "INSERT INTO suman_run_id VALUES (0,1);" >> "${SUMAN_DEBUG_LOG_PATH}" 2>&1

# send this message to both current TTY and to file
echo "all done creating tables" | tee -a  "${SUMAN_DEBUG_LOG_PATH}"
