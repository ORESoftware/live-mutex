export interface IEnvObject {
    [key: string]: string;
}
export interface IPluginValues {
    [key: string]: ISumanWatchPlugin;
}
export interface ISumanWatchPluginModule {
    exportName: string;
    value: ISumanWatchPlugin;
    getValue: (version?: string, input?: Partial<ISumanWatchPlugin>) => ISumanWatchPlugin;
}
export interface ISumanWatchPluginModules {
    [key: string]: ISumanWatchPluginModule;
}
export interface ISumanWatchPlugin {
    version: string;
    execTests?: string;
    pluginName: string;
    isSumanWatchPluginValue: boolean;
    pluginCwd: string;
    pluginEnv: IEnvObject;
    pluginExec: string;
    stdoutStartTranspileRegex: RegExp;
    stdoutEndTranspileRegex: RegExp;
}
export declare const plugins: ISumanWatchPluginModules;
