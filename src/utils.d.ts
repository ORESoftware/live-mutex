import { EVCb } from "./shared-internal";
export declare const launchSocketServer: (opts: any, cb: EVCb<any>) => void;
export declare const launchSocketServerp: (opts: any) => Promise<any>;
export declare const conditionallyLaunchSocketServer: (opts: any, cb: EVCb<any>) => void;
export declare const conditionallyLaunchSocketServerp: (opts: any) => Promise<any>;
export declare const launchBrokerInChildProcess: (opts: any, cb: EVCb<any>) => void;
export declare const launchBrokerInChildProcessp: (opts: any) => Promise<any>;
