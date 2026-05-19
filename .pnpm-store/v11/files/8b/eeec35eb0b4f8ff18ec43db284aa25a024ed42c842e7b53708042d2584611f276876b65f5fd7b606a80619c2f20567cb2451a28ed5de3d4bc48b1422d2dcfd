import { ITimerObj } from "suman-types/dts/general";
import { ITestDataObj } from 'suman-types/dts/it';
import { IHandleError } from 'suman-types/dts/test-suite';
import { ITestCaseParam } from 'suman-types/dts/params';
import { ParamBase } from '../base';
export interface IAssertCount {
    num: number;
}
export declare class TestCaseParam extends ParamBase implements ITestCaseParam {
    protected __planCalled: boolean;
    protected __assertCount: IAssertCount;
    protected planCountExpected: number;
    protected value: Object;
    protected data: Object;
    protected testId: number;
    protected desc: string;
    protected title: string;
    protected __test: ITestDataObj;
    constructor(test: ITestDataObj, assertCount: IAssertCount, handleError: IHandleError, fini: Function, timerObj: ITimerObj);
    skip(): void;
    onTimeout(): void;
    __inheritedSupply(target: any, prop: PropertyKey, value: any, receiver: any): boolean;
    plan(num: number): void;
    confirm(): void;
}
