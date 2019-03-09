

#### Getting Started Using Docker

Quick way to get started is to launch the broker as a Docker container:

```bash
$ docker run -it -p 6970:6970 oresoftware/live-mutex-broker:latest
```

Then create your Node.js client code:

```typescript
import {Client} from 'live-mutex';
const opts = {port: 6970 , host: 'localhost'};
// check to see if the websocket broker is already running, if not, launch one in this process

const client = new Client(opts);

 // calling ensure before each critical section means that we ensure we have a connected client
 // for shorter lived applications, calling ensure more than once is not as important

 return client.ensure().then(c =>  {   // (c is the same object/ref as client)
    return c.acquire('<key>').then(({key,id}) => {
        return c.release('<key>', id);
     });
 });

```