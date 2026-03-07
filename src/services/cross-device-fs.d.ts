export class CrossDeviceFS {
    localHostname: string;
    registerDevice(name: any, config: any): Promise<{
        name: any;
        hostname: any;
        user: any;
        sshKeyName: any;
        port: any;
        root: any;
        capabilities: any;
        registeredAt: number;
    }>;
    listDevices(): Promise<any[]>;
    localRead(filePath: any): Promise<string>;
    localWrite(filePath: any, content: any): Promise<{
        written: any;
        size: number;
    }>;
    localLs(dirPath: any): Promise<{
        name: string;
        type: string;
        path: string;
    }[]>;
    localMkdir(dirPath: any): Promise<{
        created: any;
    }>;
    localRm(targetPath: any, recursive?: boolean): Promise<{
        removed: any;
    }>;
    localFind(dirPath: any, pattern: any): Promise<string[]>;
    localGrep(dirPath: any, query: any): Promise<string[]>;
    localExec(command: any, cwd?: string): Promise<{
        stdout: string;
        exitCode: number;
        stderr?: undefined;
    } | {
        stdout: any;
        stderr: any;
        exitCode: any;
    }>;
    _getSSHArgs(deviceName: any): Promise<{
        args: string[];
        keyPath: string | null;
        device: any;
    }>;
    _cleanupTempKey(keyPath: any): void;
    remoteExec(deviceName: any, command: any): Promise<{
        stdout: string;
        exitCode: number;
        stderr?: undefined;
    } | {
        stdout: any;
        stderr: any;
        exitCode: any;
    }>;
    remoteRead(deviceName: any, filePath: any): Promise<any>;
    remoteWrite(deviceName: any, filePath: any, content: any): Promise<{
        written: any;
    }>;
    remoteLs(deviceName: any, dirPath: any): Promise<any>;
    syncToDevice(deviceName: any, localPath: any, remotePath: any): Promise<{
        synced: boolean;
        output: string;
        error?: undefined;
    } | {
        synced: boolean;
        error: any;
        output?: undefined;
    }>;
    syncFromDevice(deviceName: any, remotePath: any, localPath: any): Promise<{
        synced: boolean;
        output: string;
        error?: undefined;
    } | {
        synced: boolean;
        error: any;
        output?: undefined;
    }>;
    read(target: any, filePath: any): Promise<any>;
    write(target: any, filePath: any, content: any): Promise<{
        written: any;
    }>;
    ls(target: any, dirPath: any): Promise<any>;
    exec(target: any, command: any, cwd: any): Promise<{
        stdout: string;
        exitCode: number;
        stderr?: undefined;
    } | {
        stdout: any;
        stderr: any;
        exitCode: any;
    }>;
    getHealth(): {
        localHostname: string;
        registeredDevices: number;
        devices: {
            name: any;
            hostname: any;
            capabilities: any;
        }[];
    };
}
export const crossDeviceFS: CrossDeviceFS;
export function registerCrossDeviceFSRoutes(app: any): void;
//# sourceMappingURL=cross-device-fs.d.ts.map