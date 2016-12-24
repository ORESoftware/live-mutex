/**
 * Created by Olegzandr on 11/8/16.
 */


module.exports = function async(makeGenerator, ctx) {

  return function () {

    const generator = makeGenerator.apply(ctx, arguments);

    function handle(result) {

      // result => { done: [Boolean], value: [Object] }
      if (result.done) {
        return Promise.resolve(result.value);
      }
      else {
        return Promise.resolve(result.value).then(function (res) {
          return handle(generator.next(res));
        }, function (e) {
          return handle(generator.throw(e));
        });
      }
    }

    try {
      return handle(generator.next());
    } catch (e) {
      return Promise.reject(e);
    }
  }
};