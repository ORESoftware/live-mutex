import { IHandleError, IHookObj } from 'suman-types/dts/test-suite';
import { IAllHookParam } from 'suman-types/dts/params';
import { IAssertObj, ITimerObj } from "suman-types/dts/general";
import { ParamBase } from '../base';
export declare class AllHookParam extends ParamBase implements IAllHookParam {
    protected __planCalled: boolean;
    protected __assertCount: IAssertObj;
    protected planCountExpected: number;
    protected __hook: IHookObj;
    constructor(hook: IHookObj, assertCount: IAssertObj, handleError: IHandleError, fini: Function, timerObj: ITimerObj);
    onTimeout(): void;
    skip(): void;
    plan(num: number): any;
    confirm(): void;
}
