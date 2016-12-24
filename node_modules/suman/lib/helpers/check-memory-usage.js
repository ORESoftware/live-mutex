'use striiict';


var maxMem = global.maxMem = {
  heapTotal: 0,
  heapUsed: 0
};


if (global.sumanConfig.checkMemoryUsage) {

  setInterval(function () {

    const m = process.memoryUsage();
    if (m.heapTotal > maxMem.heapTotal) {
      maxMem.heapTotal = m.heapTotal;
    }
    if (m.heapUsed > maxMem.heapUsed) {
      maxMem.heapUsed = m.heapUsed;
    }

  }, 100);

}