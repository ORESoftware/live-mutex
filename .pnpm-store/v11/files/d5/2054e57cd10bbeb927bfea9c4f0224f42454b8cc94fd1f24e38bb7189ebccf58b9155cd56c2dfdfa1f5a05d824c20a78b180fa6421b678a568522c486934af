import { ISumanOpts, ISumanConfig } from 'suman-types/dts/global';
export interface ISumanWatchResult {
    code: number;
    stdout: string;
    stderr: string;
}
export interface ISumanTransformResult {
    stdout: string;
    stderr: string;
    code: number;
    path: string;
}
export interface ISumanTranspileData {
    cwd: string;
    basePath: string;
    bashFilePath: string;
}
export declare const makeRun: (projectRoot: string, $paths: string[], sumanOpts: ISumanOpts) => (sumanConfig: ISumanConfig, isRunNow: boolean, cb?: Function) => void;
