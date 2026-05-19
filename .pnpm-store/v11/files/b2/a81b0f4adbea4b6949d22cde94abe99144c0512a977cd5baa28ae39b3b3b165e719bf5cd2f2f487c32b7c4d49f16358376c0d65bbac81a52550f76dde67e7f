import { ITestSuite } from 'suman-types/dts/test-suite';
import { ITestSuiteMakerOpts } from 'suman-types/dts/test-suite-maker';
import { IAfterObj } from 'suman-types/dts/after';
import { IAfterEachFn, IAfterFn, IBeforeEachFn, IBeforeFn, IDescribeFn } from "../s";
export interface ISumanSymbols {
    [key: string]: symbol;
}
export interface TestSuiteMethods {
    after: IAfterFn;
    afterEach: IAfterEachFn;
    before: IBeforeFn;
    beforeEach: IBeforeEachFn;
    describe: IDescribeFn;
}
export declare const TestBlockSymbols: ISumanSymbols;
export declare class TestBlockBase {
    getInjections(): any;
    getChildren(): any;
    getTests(): any;
    getParallelTests(): any;
    getBefores(): any;
    getBeforeBlocks(): any;
    getBeforesFirst(): any;
    getBeforesLast(): any;
    getBeforeEaches(): any;
    getAftersFirst(): any;
    getAftersLast(): any;
    getAfters(): any;
    getAfterBlocks(): any;
    getAfterEaches(): any;
    getAfterBlockList(): Array<IAfterObj>;
    getBeforeBlockList(): any[];
    resume(): void;
    startSuite(): any;
    toString(): string;
    invokeChildren(val: any, start: Function): void;
    bindExtras(): this;
    mergeBefores(): void;
    mergeAfters(): void;
    getHooks(): TestSuiteMethods;
}
export declare class TestBlock extends TestBlockBase {
    opts: Object;
    testId: number;
    childCompletionCount: number;
    allChildBlocksCompleted: boolean;
    isSetupComplete: boolean;
    parallel: boolean;
    skipped: boolean;
    fixed: boolean;
    only: boolean;
    filename: string;
    getAfterAllParentHooks: Function;
    completedChildrenMap: Map<ITestSuite, boolean>;
    parent?: ITestSuite;
    describe: Function;
    context: Function;
    suite: Function;
    before: Function;
    beforeAll: Function;
    beforeEach: Function;
    after: Function;
    afterAll: Function;
    afterEach: Function;
    it: Function;
    test: Function;
    testBlockMethodCache: Object;
    constructor(obj: ITestSuiteMakerOpts);
    set(k: any, v: any): any;
    get(k?: any): any;
    getValues(...args: Array<string>): any[];
    getMap(...args: Array<string>): any;
    getAfterAllParentHooks(): any;
    getInjectedValue(key: string): any;
    getInjectedValues(...args: string[]): any[];
    getInjectedMap(...args: string[]): any;
    getSourced(): any;
    getSourcedValue(v: string): any;
    getSourcedValues(...args: string[]): any[];
    getSourcedMap(...args: string[]): any;
}
