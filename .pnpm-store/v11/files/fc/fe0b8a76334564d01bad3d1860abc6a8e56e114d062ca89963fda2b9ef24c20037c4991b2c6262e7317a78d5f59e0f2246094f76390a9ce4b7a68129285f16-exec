

## @oresoftware / linked-queue

### Constant time queue

This an implementation of a FIFO queue, where all methods/operations are constant in time complexity.

The key proposition of this library is that it will allow you to remove or insert items from/in the middle of the queue,
in constant time. It also allows you to add/remove items to/from the front of the queue in constant time.  Whereas, `Array.prototype.shift/Array.prototype.unshift`
are O(N), because they have to update the indices of the entire array, etc.

Because any FIFO queue implementation using a basic JavaScript array will need to call either `Array.prototype.shift` or `Array.prototype.unshift`,
you might see a performance improvement right away when using big arrays, even if you don't need to insert or delete from the middle of your array.

<br>

## Installation

```bash
npm i @oresoftware/linked-queue
```

<br>

## Examples

```js
const {LinkedQueue} from '@oresoftware/linked-queue';
const q = new LinkedQueue();

q.enq({task:'foo'});       // adds item to the end/tail of the queue
q.enqueue({task:'bar'});   // adds item to the end/tail of the queue
q.push({task:'far'});      // adds item to the end/tail of the queue

q.enq('foo', {task:'bbb'}); // adds item to the end/tail of the queue, with id/key = 'foo'
q.get('foo'); // => {key: 'foo', value: {task:'bbb'}}


q.enq({whatever:'is clever'}, {task:'bbb'}); // adds task to the end/tail of the queue, with id/key = {whatever:'is clever'}


q.deq();      // => removes and returns the head of the queue, or null.
q.dequeue();  // => removes and returns the head of the queue, or null.
q.shift();    // => removes and returns the head of the queue, or null.


q.peek(); // => returns the head of the queue, but does not remove it.

```

<br>

## More features

### Removing/deleting items from the queue in constant time

This is a FIFO queue, but if you wanted to dequeue a item that was not the head of the queue, instead of using `q.deq()`, you
could just use `q.remove(id)`. Where id is the key/id of the item you wish to retrieve. And this would be
in constant time. Removing items from the queue is useful if certain items in the queue have been obviated or are stale, etc.

### Inserting items into the queue in constant time

Removing from the middle of the queue is an important feature - inserting items into the queue in linear time is also
important. You can insert items into the queue in a certain location, in constant time, by using:

```js
q.insertInFrontOf(k1, k2, v);
q.insertBehind(k1, k2, v);
```

### Inserting in non-constant time
```js
q.insertAtIndex(index, k, v);
```

<br>

## Further explanation

A simple example of why this works is, with an array, each shift/unshift call is O(N), so the following takes 80 seconds!

```js
const values = [];

const t = Date.now();

for (let i = 0; i < 100000; i++) {
  values.unshift({});
}

console.log('total time:', Date.now() - t); // takes almost 80 seconds!
```

However if we add to the front of a queue, with this library, it takes just 60ms.<br>
More than 2 orders of magnitude difference. Huge.

```js
const {LinkedQueue} = require('@oresoftware/linked-queue');

const q = new LinkedQueue();

const t = Date.now();

for (let i = 0; i < 100000; i++) {
  q.addToFront({});
}

console.log('total time:', Date.now() - t);  // just 60 milliseconds!
```
