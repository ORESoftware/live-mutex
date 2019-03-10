import concurrent.futures
import time
from threading import Timer
import socket
import json
import math

"""
TODO:
https://stackoverflow.com/questions/277922/python-argument-binders
https://stackoverflow.com/questions/16745409/what-does-pythons-socket-recv-return-for-non-blocking-sockets-if-no-data-is-r
"""

executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect(('localhost', 6970))
s.sendall('Hello, world'.encode())

def listen_for_messages():
    rec=''
    while True:
        data = s.recv(1024)
        if not data:
            continue
        rec += data.decode('utf-8')
        print ('Received', repr(data))
        lines = rec.split("\n")
        rec = ''
        size = len(lines)
        i=0
        for line in lines:
            try:
                print ('json load', json.load(line))
            except:
                if i < size:
                    print ('warning, could not parse line:', line);
                    rec+=line
            finally:
                i+=1


callbacks={}

def pow():
    time.sleep(1)
    return 5

def two_args(arg1,arg2):
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
    future = executor.submit(listen_for_messages)
    # print(future.result())
    r = Timer(0.001, two_args, ("arg1","arg2"))
    s = Timer(0.002, n_args, ("OWLS","OWLS","OWLS"))
    r.start()
    s.start()


if __name__ == '__main__':
    main()