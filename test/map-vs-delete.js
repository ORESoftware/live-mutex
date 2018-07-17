

{
    const obj = {};

    const start = Date.now();

    for(let i =0; i < 1000000; i++){
        obj['foo'] = true;
        delete obj['foo'];
    }

    console.log('done after:', Date.now() - start);

}



{
    const m = new Map();

    const start = Date.now();

    for(let i =0; i < 1000000; i++){
        m.set('foo',true);
        m.delete('foo');
    }

    console.log('done after:', Date.now() - start);

}
