import { IAssertObj, ITimerObj } from "suman-types/dts/general";
import { IHandleError, IHookObj } from 'suman-types/dts/test-suite';
import { IEachHookParam } from 'suman-types/dts/params';
import { ParamBase } from '../base';
export declare class EachHookParam extends ParamBase implements IEachHookParam {
    protected __planCalled: boolean;
    protected __assertCount: IAssertObj;
    protected planCountExpected: number;
    protected __hook: IHookObj;
    constructor(hook: IHookObj, assertCount: IAssertObj, handleError: IHandleError, fini: Function, timerObj: ITimerObj);
    skip(): void;
    onTimeout(): void;
    plan(num: number): any;
    confirm(): void;
}
