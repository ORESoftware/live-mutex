import { TDescribeHook } from "suman-types/dts/describe";
import { TBeforeEachHook } from "suman-types/dts/before-each";
import { TAfterEachHook } from "suman-types/dts/after-each";
import { TBeforeHook } from "suman-types/dts/before";
import { TAfterHook } from "suman-types/dts/after";
import { ItHook } from "suman-types/dts/it";
export declare class DefineObject {
    protected exec: any;
    protected opts: any;
    constructor(desc: string, exec: any);
    inject(): this;
    plan(v: number): this;
    desc(v: string): this;
    title(v: string): this;
    name(v: string): this;
    description(v: string): this;
    skip(v: boolean): this;
    only(v: boolean): this;
    parallel(v: boolean): this;
    series(v: boolean): this;
    mode(v: string): this;
    timeout(v: number): this;
}
export interface IDefineObject {
    new (desc: string, exec: any): this;
}
export declare class DefineObjectTestOrHook extends DefineObject {
    throws(v: string | RegExp): this;
    cb(v: boolean): this;
    fatal(v: boolean): this;
    events(): this;
    successEvents(...args: (string | Array<string>)[]): this;
    successEvent(...args: string[]): this;
    errorEvents(...args: (Array<string> | string)[]): this;
    errorEvent(...args: string[]): this;
}
export declare class DefineOptionsInjectHook extends DefineObjectTestOrHook {
    run(fn: TBeforeEachHook | TAfterEachHook): this;
}
export declare class DefineObjectAllHook extends DefineObjectTestOrHook {
    first(v: boolean): this;
    last(v: boolean): this;
    always(v: boolean): this;
    run(fn: TBeforeHook | TAfterHook): this;
}
export declare class DefineObjectEachHook extends DefineObjectTestOrHook {
    fatal(v: boolean): this;
    run(fn: TBeforeEachHook | TAfterEachHook): this;
}
export declare class DefineObjectTestCase extends DefineObjectTestOrHook {
    run(fn: ItHook): this;
}
export declare class DefineObjectContext extends DefineObject {
    source(...args: string[]): this;
    names(...args: string[]): this;
    run(fn: TDescribeHook): this;
}
