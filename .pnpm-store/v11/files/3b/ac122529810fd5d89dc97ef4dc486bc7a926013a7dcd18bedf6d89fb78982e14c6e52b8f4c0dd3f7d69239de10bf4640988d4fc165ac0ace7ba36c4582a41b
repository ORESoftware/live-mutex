import { IAssertObj, ITimerObj } from "suman-types/dts/general";
import { IHandleError, IHookObj } from 'suman-types/dts/test-suite';
import { IInjectHookParam } from 'suman-types/dts/params';
import { ITestSuite } from 'suman-types/dts/test-suite';
import { Dictionary } from 'async';
import { ParamBase } from '../base';
export interface IValuesMap {
    [key: string]: true;
}
export declare class InjectParam extends ParamBase implements IInjectHookParam {
    protected __planCalled: boolean;
    protected __valuesMap: IValuesMap;
    protected __suite: ITestSuite;
    protected __values: Array<any>;
    protected __inject: IHookObj;
    protected __assertCount: IAssertObj;
    planCountExpected: number;
    protected __hook: IHookObj;
    constructor(inject: IHookObj, assertCount: IAssertObj, timerObj: ITimerObj, suite: ITestSuite, values: Array<any>, fini: Function, handleError: IHandleError);
    skip(): void;
    onTimeout(): void;
    registerKey(k: string, val: any): Promise<any>;
    registerFnMap(o: Dictionary<any>): Promise<any>;
    registerMap(o: Dictionary<any>): Promise<Array<any>>;
    plan(num: number): any;
    confirm(): void;
}
export interface InjectParam {
    register: typeof InjectParam.prototype.registerKey;
    registerPromisesMap: typeof InjectParam.prototype.registerMap;
    registerPromiseMap: typeof InjectParam.prototype.registerMap;
    registerFnsMap: typeof InjectParam.prototype.registerFnMap;
}
