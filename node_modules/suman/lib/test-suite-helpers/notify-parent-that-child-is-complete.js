
//npm
const async = require('async');

module.exports = function (suman, gracefulExit, handleBeforesAndAfters) {

  return function notifyParentThatChildIsComplete (parentTestId, childTestId, cb) {

    var parent = null;
    const allDescribeBlocks = suman.allDescribeBlocks;

    for (var i = 0; i < allDescribeBlocks.length; i++) {
      var temp = allDescribeBlocks[ i ];
      if (temp.testId === parentTestId) {
        parent = temp;
        break;
      }
    }

    if (!parent) { //note: root suite has no parent
      throw new Error('No parent defined for child, should not happen.');
    }
    else {
      var lastChild = parent.getChildren()[ parent.getChildren().length - 1 ];
      if (lastChild.testId === childTestId) {
        async.mapSeries(parent.getAfters(), handleBeforesAndAfters, function complete (err, results) {
          gracefulExit(results, null, function () {
            if (parent.parent) {
              notifyParentThatChildIsComplete(parent.parent.testId, parent.testId, cb);
            } else {
              cb(null);
            }
          });
        });
      } else {
        cb(null);
      }
    }
  }
};