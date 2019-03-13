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
    # print(future.result())
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
        # atexit.register(self.handle_exit)

    def handle_exit(self):
        self.disconnect()

    def disconnect(self):
        self.connected = False
        self.s.close()
        print ("closed the socket.")

    def send_message(self, d):
        data = (json.dumps(d) + '\n').encode()
        # data=json.dumps(d)
        logging.warning(data)
        self.s.sendall(data)
        # self.s.sendall('bop'.encode())

    def connect(self):
        self.s.connect(('localhost', 6970))
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
        # self.resolutions[str(call_id)] = self.make_lock_acquired(cb)
        self.resolutions[str(call_id)] = self.make_lock_acquired
        logging.warning(repr(self.resolutions))
        self.send_message(lock_data)

    def make_lock_acquired(self, cb, bar):
        print('lock was acquired.')
        # cb()
        # def on_lock_acquired(a,b):
        #     print(a,b)
        #     print('lock was acquired.')
        #     cb(None,"acquired")
        # return on_lock_acquired

    def unlock(self, trick):
        self.tricks.append(trick)

    def on_data(self, d):

        print ('json load', d)

        uuid = d['uuid']

        print ('here is uuid:', uuid)

        if uuid is None:
            logging.warning('warning', 'Function and timeout both exist => Live-Mutex implementation error.')
            return

        print(self.resolutions)

        fn = self.resolutions[uuid]

        print ('after fn:', fn)
        to = self.timeouts[uuid]

        print ('after to:', to)
        self.resolutions.pop(uuid, None)
        self.timeouts.pop(uuid, None)

        print('here is fn:', fn)
        print ('here is to:', to)

        if fn is not None and to is not None:
            logging.warning('warning', 'Function and timeout both exist => Live-Mutex implementation error.')

        if to is not None:
            logging.warning('warning', 'Client side lock/unlock request timed-out.')
            return

        if fn is not None:
            print('ok we are running the func')
            # fn(d.error, d)

            # if 'error' not in d:
            #     d.error=None

            # d.error = None


            # if not hasattr(d,'error'):
            #     d.error=None

            if "error" not in d:
                d["error"]=None

            setattr(d,'error',None)

            try:
                print('about to run the func')
                fn(d['error'], d)
                print('ran the func 1')
            except:
                print("Unexpected error:", sys.exc_info())
            print('ran the func 2')
            return

        print("nothing matched, hmmm")

    def listen_for_messages(self):
        logging.warning('listening for socket messages...')
        rec = ''
        while self.connected is True:
            data = self.s.recv(10)
            if not data:
                logging.warning('no data :(')
                continue
            rec += data.decode('utf-8')
            logging.info('Received', repr(data))
            lines = rec.split("\n")
            rec = ''
            size = len(lines)
            # logging.warning('SIZE SIZE SIZE:',size)
            i = 0
            for line in lines:
                json_str = None
                try:
                    # logging.warning('line:', str(line))
                    json_str = json.loads(line)
                except:
                    if i < size - 1:
                        logging.warning('warning, could not parse line:', line)
                    if i == size - 1:
                        # if it is the last element, we can keep it, since it might not be complete
                        rec += line
                finally:
                    if json_str is not None:
                        self.on_data(json_str)
                    i += 1


client = LMXClient(6970, 'localhost')
client.connect()


def on_lock_acquired():
    print ('lock was acquired 2.')
    # client.disconnect()


client.lock('foo', on_lock_acquired)
