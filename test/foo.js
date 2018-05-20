

const client = new Client(opts);
// calling ensure means that we ensure we have a connected client
client.ensure().then(c => {
  // c === client => true
  return client.acquire('<key>').then({key,id}) => {
    // '<key>' === key => true
    return client.release(key, id);
  });
});