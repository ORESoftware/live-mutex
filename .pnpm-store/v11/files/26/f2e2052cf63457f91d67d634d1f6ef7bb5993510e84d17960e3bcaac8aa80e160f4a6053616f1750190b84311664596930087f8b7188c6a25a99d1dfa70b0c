import { ChildProcess } from "child_process";
export interface ISumanRunOptions {
    env?: Object;
    useGlobalVersion?: boolean;
    useLocalVersion?: boolean;
    args: Array<string>;
    pauseStdio: boolean;
    files: Array<string>;
}
export interface ISumanRunRet {
    sumanProcess: ChildProcess;
}
export interface ISumanRunFn {
    (runOptions: ISumanRunOptions): Promise<ISumanRunRet>;
    cb?: (runOptions: ISumanRunOptions, cb: Function) => void;
}
export declare const run: () => ISumanRunFn;
