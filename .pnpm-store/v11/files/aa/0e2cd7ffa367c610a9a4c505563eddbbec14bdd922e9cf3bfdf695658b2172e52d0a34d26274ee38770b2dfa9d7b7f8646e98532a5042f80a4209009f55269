/// <reference types="socket.io-client" />
import { ISumanChildProcess } from "suman-types/dts/runner";
export interface ICpHash {
    [key: string]: ISumanChildProcess;
}
export interface ISocketHash {
    [key: string]: SocketIOClient.Socket;
}
export interface IGanttData {
    uuid: String;
    fullFilePath: string;
    shortFilePath: string;
    filePathFromProjectRoot: string;
    transformStartDate: number;
    transformEndDate: number;
    startDate: number;
    endDate: number;
}
export interface IGanttHash {
    [key: string]: IGanttData;
}
export declare const cpHash: ICpHash;
export declare const socketHash: ISocketHash;
export declare const ganttHash: IGanttHash;
