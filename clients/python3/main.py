import concurrent.futures
import time
from threading import Timer
import socket
import json
import uuid
import math
import sys
import logging
import atexit

MAX_FENCING_TOKEN = 9_007_199_254_740_991


class InvalidFencingTokenError(ValueError):
    pass


def fencing_token_from_response(response):
    value = response.get('fencingToken')
    if isinstance(value, bool):
        raise InvalidFencingTokenError('fencingToken must be a positive exact integer')
    if isinstance(value, int):
        token = value
    elif isinstance(value, str) and value.isdigit() and (value == '0' or not value.startswith('0')):
        token = int(value, 10)
    else:
        raise InvalidFencingTokenError('fencingToken must be a positive exact integer')
    if token < 1 or token > MAX_FENCING_TOKEN:
        raise InvalidFencingTokenError('fencingToken outside authority domain')
    return token

"""
TODO:
https://stackoverflow.com/questions/277922/python-argument-binders
https://stackoverflow.com/questions/16745409/what-does-pythons-socket-recv-return-for-non-blocking-sockets-if-no-data-is-r
https://en.wikipedia.org/wiki/Monitor_%28synchronization%29#Blocking_condition_variables
"""

executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)
callbacks = {}


def pow():
    time.sleep(1)
    return 5


def two_args(arg1, arg2):
    print(arg1)
    print(arg2)


def n_args(*args):
    for each in args:
        print(each)


def make_cylinder_volume_func(r):
    def volume(h):
        return math.pi * r * r * h
    return volume


def main():
    logging.info('I do not get it.')


def mainx():
    future = executor.submit(listen_for_messages)
    r = Timer(0.001, two_args, ("arg1", "arg2"))
    s = Timer(0.002, n_args, ("OWLS", "OWLS", "OWLS"))
    r.start()
    s.start()


if __name__ == '__main__':
    main()


class LMXClient:

    def __init__(self, port, host):
        self.s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.host = host
        self.connected = False
        self.port = port
        self.future = None
        self.resolutions = {}
        self.timeouts = {}

    def handle_exit(self):
        self.disconnect()

    def disconnect(self):
        self.connected = False
        self.s.close()
        print("closed the socket.")

    def send_message(self, d):
        data = (json.dumps(d) + '\n').encode()
        self.s.sendall(data)

    def connect(self):
        self.s.connect((self.host, self.port))
        self.connected = True
        self.future = executor.submit(self.listen_for_messages)
        return self

    def lock(self, key, cb):
        call_id = uuid.uuid4()
        lock_data = {
            'keepLocksAfterDeath': False,
            'retryCount': 2,
            'uuid': str(call_id),
            'key': key,
            'type': 'lock',
            'ttl': 3000,
            'rwStatus': None,
            'max': 1
        }
        self.timeouts[str(call_id)] = None
        self.resolutions[str(call_id)] = self.make_lock_acquired
        self.send_message(lock_data)

    def make_lock_acquired(self, error, response):
        if error is not None:
            raise RuntimeError(error)
        # A successful grant is authority-bearing. Preserve the exact broker
        # token and fail closed instead of synthesizing/rounding authority.
        response['fencing_token'] = fencing_token_from_response(response)
        print('lock was acquired with fencing token:', response['fencing_token'])

    def unlock(self, trick):
        self.tricks.append(trick)

    def on_data(self, d):
        print('json load', d)
        request_uuid = d['uuid']
        if request_uuid is None:
            logging.warning('Function and timeout both exist => Live-Mutex implementation error.')
            return
        fn = self.resolutions[request_uuid]
        to = self.timeouts[request_uuid]
        self.resolutions.pop(request_uuid, None)
        self.timeouts.pop(request_uuid, None)
        if fn is not None and to is not None:
            logging.warning('Function and timeout both exist => Live-Mutex implementation error.')
        if to is not None:
            logging.warning('Client side lock/unlock request timed-out.')
            return
        if fn is not None:
            if "error" not in d:
                d["error"] = None
            fn(d['error'], d)
            return
        print("nothing matched, hmmm")

    def listen_for_messages(self):
        print('listening for socket messages...')
        rec = ''
        while self.connected is True:
            data = self.s.recv(10)
            if not data:
                logging.warning('no data :(')
                continue
            rec += data.decode('utf-8')
            lines = rec.split("\n")
            rec = ''
            size = len(lines)
            i = 0
            for line in lines:
                json_str = None
                try:
                    json_str = json.loads(line)
                except Exception:
                    if i < size - 1:
                        logging.warning('warning, could not parse line: %s', line)
                    if i == size - 1:
                        rec += line
                finally:
                    if json_str is not None:
                        self.on_data(json_str)
                    i += 1
