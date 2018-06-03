
int i = 1;
setsockopt( iSock, IPPROTO_TCP, TCP_QUICKACK, (void *)&i, sizeof(i));