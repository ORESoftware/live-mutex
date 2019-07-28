'use strict';


export const compareVersions = (clientVersion: string, brokerVersion: string) => {
  
  if(!(clientVersion && typeof clientVersion === 'string')){
    throw new Error(`The client version is not defined as string: '${clientVersion}'`);
  }
  
  if(!(brokerVersion && typeof brokerVersion === 'string')){
    throw new Error(`The broker version is not defined as string: '${brokerVersion}'`);
  }
  
  const [majorA, minorA] = clientVersion.split('.');
  const [majorB, minorB] = brokerVersion.split('.');
  
  if(majorA !== majorB){
    throw `Major versions are different - client version:${clientVersion}, server version:${brokerVersion}`;
  }
  
  const minorAInt = Number.parseInt(minorA.charAt(0));
  const minorBInt = Number.parseInt(minorB.charAt(0));
  
  if(Math.abs(minorAInt - minorBInt) > 0){
    throw `Minor versions are different - client version:${clientVersion}, server version:${brokerVersion}`;
  }
  
};

