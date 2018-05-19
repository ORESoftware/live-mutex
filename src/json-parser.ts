'use strict';

import * as stream from 'stream';

//////////////////////////////////////////////////

export interface IParsedObject {
  [index: string]: any
}

export const createParser = function () {
  
  let lastLineData = '';
  
  return new stream.Transform({
    
    objectMode: true,
    
    transform(chunk: any, encoding: string, cb: Function) {
      
      let data = String(chunk);
      if (lastLineData) {
        data = lastLineData + data;
      }
      
      let lines = data.split('\n');
      lastLineData = lines.splice(lines.length - 1, 1)[0];
      
      lines.forEach(l => {
        try {
          // l might be an empty string; ignore if so
          l && this.push(JSON.parse(l));
        }
        catch (err) {
          // noop
        }
      });
      
      cb();
      
    },
    
    flush(cb: Function) {
      if (lastLineData) {
        try {
          this.push(JSON.parse(lastLineData));
        }
        catch (err) {
          // noop
        }
      }
      lastLineData = '';
      cb();
    }
  });
  
};

export const createJSONParser = createParser;
export default createParser;