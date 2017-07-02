import { CWebSocket } from './uws';
export interface IBrokerOpts {
    lockExpiresAfter: number;
    timeoutToFindNewLockholder: number;
    host: string;
    port: number;
}
export declare type IErrorFirstCB = (err: Error | null | undefined | string, val?: any) => void;
export interface IBrokerSend {
    (ws: CWebSocket, data: any, cb?: IErrorFirstCB): void;
}
export interface IUuidWSHash {
    [key: string]: CWebSocket;
}
