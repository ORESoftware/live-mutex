export interface LogEntry {
    type: 'warning' | 'error' | 'info';
    source: 'broker' | 'client' | 'rw-client';
    message: string;
    timestamp: number;
}
export declare function enableLogCapture(): void;
export declare function disableLogCapture(): void;
export declare function getCapturedLogs(): LogEntry[];
export declare function clearCapturedLogs(): void;
export declare function printCapturedLogs(): void;
export declare function attachToBroker(broker: any): void;
export declare function attachToClient(client: any): void;
export declare function attachToRWClient(client: any): void;
export declare function captureBrokerLogs(broker: any): void;
export declare function captureClientLogs(client: any): void;
export declare function captureLogs(broker?: any, client?: any): void;
