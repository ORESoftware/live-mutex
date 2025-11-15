import { LMXLockRequestError, LMXUnlockRequestError } from "./shared-internal";
import { LMXClientError } from "./shared-internal";
export declare class LMXClientException {
    code: LMXClientError;
    message: string;
    key: string;
    id: string;
    stack: string;
    originalError: any;
    constructor(key: string, id: string, code: LMXClientError, message: string, originalError: any);
}
export declare class LMXClientLockException {
    code: LMXLockRequestError;
    message: string;
    key: string;
    id: string;
    stack: string;
    constructor(key: string, id: string, code: LMXLockRequestError, message: string);
}
export declare class LMXClientUnlockException {
    code: LMXUnlockRequestError;
    message: string;
    key: string;
    id: string;
    stack: string;
    constructor(key: string, id: string, code: LMXUnlockRequestError, message: string);
}
