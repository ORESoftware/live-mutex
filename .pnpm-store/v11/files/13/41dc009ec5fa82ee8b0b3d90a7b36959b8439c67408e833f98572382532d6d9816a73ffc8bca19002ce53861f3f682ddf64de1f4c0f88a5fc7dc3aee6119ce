import { ITestSuite } from "suman-types/dts/test-suite";
import { ISumanConfig, ISumanOpts } from "suman-types/dts/global";
import { ISumanInputs } from "suman-types/dts/suman";
import { IInitOpts } from "suman-types/dts/index-init";
import { ITestDataObj } from "suman-types/dts/it";
export interface ITestBlockMethodCache {
    [key: string]: Object;
}
export declare class Suman {
    ctx?: ITestSuite;
    supply: Object;
    private __supply;
    testBlockMethodCache: Map<Function, ITestBlockMethodCache>;
    iocData: Object;
    force: boolean;
    fileName: string;
    opts: ISumanOpts;
    config: ISumanConfig;
    slicedFileName: string;
    timestamp: number;
    sumanId: number;
    allDescribeBlocks: Array<ITestSuite>;
    describeOnlyIsTriggered: boolean;
    deps: Array<string>;
    usingLiveSumanServer: boolean;
    numHooksSkipped: number;
    numHooksStubbed: number;
    numBlocksSkipped: number;
    rootSuiteDescription: string;
    dateSuiteFinished: number;
    dateSuiteStarted: number;
    filename: string;
    itOnlyIsTriggered: boolean;
    extraArgs: Array<string>;
    sumanCompleted: boolean;
    desc: string;
    getQueue: Function;
    constructor(obj: ISumanInputs);
    getTableData(): void;
    logFinished($exitCode: number, skippedString: string, cb: Function): void;
    logResult(test: ITestDataObj): void;
}
export declare type ISuman = Suman;
export declare const makeSuman: ($module: NodeModule, opts: IInitOpts, sumanOpts: Partial<ISumanOpts>, sumanConfig: Partial<ISumanConfig>) => any;
