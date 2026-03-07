export class IPClassificationEngine {
    constructor(projectRoot: any);
    projectRoot: any;
    scanResults: any[];
    /**
     * Classify a file by its path
     * @param {string} filePath - Relative path from project root
     * @returns {Object} Classification result
     */
    classifyFile(filePath: string): Object;
    /**
     * Scan project and classify all files
     * @returns {Object} Scan results grouped by classification level
     */
    scanProject(): Object;
    /**
     * Add PROPRIETARY headers to classified files
     * @param {string} minLevel - Minimum level to add headers to ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')
     * @returns {Object} { modified, skipped, errors }
     */
    addProprietaryHeaders(minLevel?: string): Object;
    /**
     * Verify no classified files leak into dist/npm
     * @returns {Object} { safe, violations }
     */
    auditPublishSafety(): Object;
}
export namespace IP_LEVELS {
    namespace PUBLIC {
        let level: number;
        let label: string;
        let description: string;
        let license: string;
        let canPublish: boolean;
        let canOpenSource: boolean;
    }
    namespace INTERNAL {
        let level_1: number;
        export { level_1 as level };
        let label_1: string;
        export { label_1 as label };
        let description_1: string;
        export { description_1 as description };
        let license_1: string;
        export { license_1 as license };
        let canPublish_1: boolean;
        export { canPublish_1 as canPublish };
        let canOpenSource_1: boolean;
        export { canOpenSource_1 as canOpenSource };
    }
    namespace CONFIDENTIAL {
        let level_2: number;
        export { level_2 as level };
        let label_2: string;
        export { label_2 as label };
        let description_2: string;
        export { description_2 as description };
        let license_2: string;
        export { license_2 as license };
        let canPublish_2: boolean;
        export { canPublish_2 as canPublish };
        let canOpenSource_2: boolean;
        export { canOpenSource_2 as canOpenSource };
    }
    namespace RESTRICTED {
        let level_3: number;
        export { level_3 as level };
        let label_3: string;
        export { label_3 as label };
        let description_3: string;
        export { description_3 as description };
        let license_3: string;
        export { license_3 as license };
        let canPublish_3: boolean;
        export { canPublish_3 as canPublish };
        let canOpenSource_3: boolean;
        export { canOpenSource_3 as canOpenSource };
    }
}
export const FILE_CLASSIFICATIONS: {
    'src/heady-conductor.js': {
        level: number;
        label: string;
        description: string;
        license: string;
        canPublish: boolean;
        canOpenSource: boolean;
    };
    'src/security/pqc.js': {
        level: number;
        label: string;
        description: string;
        license: string;
        canPublish: boolean;
        canOpenSource: boolean;
    };
    'src/security/handshake.js': {
        level: number;
        label: string;
        description: string;
        license: string;
        canPublish: boolean;
        canOpenSource: boolean;
    };
    'src/security/secret-rotation.js': {
        level: number;
        label: string;
        description: string;
        license: string;
        canPublish: boolean;
        canOpenSource: boolean;
    };
    'src/security/env-validator.js': {
        level: number;
        label: string;
        description: string;
        license: string;
        canPublish: boolean;
        canOpenSource: boolean;
    };
    'src/security/ip-classification.js': {
        level: number;
        label: string;
        description: string;
        license: string;
        canPublish: boolean;
        canOpenSource: boolean;
    };
    'heady-hive-sdk/': {
        level: number;
        label: string;
        description: string;
        license: string;
        canPublish: boolean;
        canOpenSource: boolean;
    };
    'bin/': {
        level: number;
        label: string;
        description: string;
        license: string;
        canPublish: boolean;
        canOpenSource: boolean;
    };
    'dist/': {
        level: number;
        label: string;
        description: string;
        license: string;
        canPublish: boolean;
        canOpenSource: boolean;
    };
};
export const DIR_CLASSIFICATIONS: {
    pattern: RegExp;
    level: {
        level: number;
        label: string;
        description: string;
        license: string;
        canPublish: boolean;
        canOpenSource: boolean;
    };
}[];
export const PROPRIETARY_HEADER_JS: "/**\n * \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n * \u2551  PROPRIETARY AND CONFIDENTIAL \u2014 HEADYSYSTEMS INC.                  \u2551\n * \u2551  Copyright \u00A9 2024-2026 HeadySystems Inc. All Rights Reserved.      \u2551\n * \u2551                                                                     \u2551\n * \u2551  This file contains trade secrets of HeadySystems Inc.              \u2551\n * \u2551  Unauthorized copying, distribution, or use is strictly prohibited  \u2551\n * \u2551  and may result in civil and criminal penalties.                    \u2551\n * \u2551                                                                     \u2551\n * \u2551  Protected under the Defend Trade Secrets Act (18 U.S.C. \u00A7 1836)  \u2551\n * \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n */\n";
//# sourceMappingURL=ip-classification.d.ts.map