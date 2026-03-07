export class XetStorageEngine {
    constructor(opts?: {});
    hfToken: any;
    org: any;
    datasetTemplate: any;
    enabled: boolean;
    baseUrl: string;
    maxDirectUploadBytes: number;
    _log(level: any, msg: any): void;
    /**
     * Ensures the target dataset repository exists on HF.
     * Creates it if it doesn't.
     */
    _ensureDataset(repoName: any): Promise<boolean>;
    /**
     * Syncs a single file to Hugging Face Datasets utilizing the Commit API.
     * This is optimal for updating configuration states and vector shards.
     */
    syncFileToXet(datasetName: any, localFilePath: any, targetPathInRepo: any, commitMessage?: string): Promise<{
        success: boolean;
        reason: string;
        commitHash?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        commitHash: any;
        reason?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        reason?: undefined;
        commitHash?: undefined;
    }>;
    /**
     * Sync an entire directory recursively to Xet
     * Pushes all files in a single commit via the HF API
     */
    syncDirectoryToXet(datasetName: any, localDirPath: any, targetDirInRepo: any, commitMessage?: string): Promise<{
        success: boolean;
        reason: string;
        files?: undefined;
        filesSynced?: undefined;
        commitHash?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        files: number;
        reason?: undefined;
        filesSynced?: undefined;
        commitHash?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        filesSynced: number;
        commitHash: any;
        reason?: undefined;
        files?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        reason?: undefined;
        files?: undefined;
        filesSynced?: undefined;
        commitHash?: undefined;
    }>;
    /**
     * Retrieves a file from Xet dataset and writes it locally.
     */
    pullFileFromXet(datasetName: any, repoFilePath: any, localDestPath: any): Promise<any>;
}
export const xetStorageEngine: XetStorageEngine;
//# sourceMappingURL=xet-storage-engine.d.ts.map