export interface ISumanFilesDoNotMatch {
    filename: string;
    regexType: string;
    regex: string;
}
export interface IGetFilePathObj {
    files: Array<string>;
    nonJSFile: boolean;
    filesThatDidNotMatch: Array<ISumanFilesDoNotMatch>;
}
export interface IGetFilePathCB {
    (err: Error | null | undefined, obj: IGetFilePathObj): void;
}
export declare const getFilePaths: (dirs: string[], cb: IGetFilePathCB) => void;
export declare const findFilesToRun: (dirs: string[], cb: IGetFilePathCB) => void;
