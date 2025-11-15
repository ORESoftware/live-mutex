export declare const log: {
    info: any;
    warn: any;
    error: any;
    fatal(...args: any[]): never;
    debug(...args: any[]): void;
};
export declare const getClientErrorMessage: (s: string) => string;
export declare const getClientError: (s: string) => Error;
export declare const throwClientError: (s: string) => never;
