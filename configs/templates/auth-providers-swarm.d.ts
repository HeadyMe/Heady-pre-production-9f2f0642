export namespace AUTH_PROVIDERS {
    namespace github {
        let id: string;
        let name: string;
        let category: string;
        let protocol: string;
        let scopes: string[];
        namespace endpoints {
            let authorize: string;
            let token: string;
            let userinfo: string;
        }
        let color: string;
        let icon: string;
        let sshSupport: boolean;
        let gpgSupport: boolean;
    }
    namespace gitlab {
        let id_1: string;
        export { id_1 as id };
        let name_1: string;
        export { name_1 as name };
        let category_1: string;
        export { category_1 as category };
        let protocol_1: string;
        export { protocol_1 as protocol };
        let scopes_1: string[];
        export { scopes_1 as scopes };
        export namespace endpoints_1 {
            let authorize_1: string;
            export { authorize_1 as authorize };
            let token_1: string;
            export { token_1 as token };
            let userinfo_1: string;
            export { userinfo_1 as userinfo };
        }
        export { endpoints_1 as endpoints };
        let color_1: string;
        export { color_1 as color };
        let icon_1: string;
        export { icon_1 as icon };
        let sshSupport_1: boolean;
        export { sshSupport_1 as sshSupport };
        let gpgSupport_1: boolean;
        export { gpgSupport_1 as gpgSupport };
    }
    namespace bitbucket {
        let id_2: string;
        export { id_2 as id };
        let name_2: string;
        export { name_2 as name };
        let category_2: string;
        export { category_2 as category };
        let protocol_2: string;
        export { protocol_2 as protocol };
        let scopes_2: string[];
        export { scopes_2 as scopes };
        export namespace endpoints_2 {
            let authorize_2: string;
            export { authorize_2 as authorize };
            let token_2: string;
            export { token_2 as token };
            let userinfo_2: string;
            export { userinfo_2 as userinfo };
        }
        export { endpoints_2 as endpoints };
        let color_2: string;
        export { color_2 as color };
        let icon_2: string;
        export { icon_2 as icon };
        let sshSupport_2: boolean;
        export { sshSupport_2 as sshSupport };
    }
    namespace google {
        let id_3: string;
        export { id_3 as id };
        let name_3: string;
        export { name_3 as name };
        let category_3: string;
        export { category_3 as category };
        let protocol_3: string;
        export { protocol_3 as protocol };
        let scopes_3: string[];
        export { scopes_3 as scopes };
        export namespace endpoints_3 {
            let authorize_3: string;
            export { authorize_3 as authorize };
            let token_3: string;
            export { token_3 as token };
            let userinfo_3: string;
            export { userinfo_3 as userinfo };
        }
        export { endpoints_3 as endpoints };
        let color_3: string;
        export { color_3 as color };
        let icon_3: string;
        export { icon_3 as icon };
    }
    namespace microsoft {
        let id_4: string;
        export { id_4 as id };
        let name_4: string;
        export { name_4 as name };
        let category_4: string;
        export { category_4 as category };
        let protocol_4: string;
        export { protocol_4 as protocol };
        let scopes_4: string[];
        export { scopes_4 as scopes };
        export namespace endpoints_4 {
            let authorize_4: string;
            export { authorize_4 as authorize };
            let token_4: string;
            export { token_4 as token };
            let userinfo_4: string;
            export { userinfo_4 as userinfo };
        }
        export { endpoints_4 as endpoints };
        let color_4: string;
        export { color_4 as color };
        let icon_4: string;
        export { icon_4 as icon };
    }
    namespace amazon {
        let id_5: string;
        export { id_5 as id };
        let name_5: string;
        export { name_5 as name };
        let category_5: string;
        export { category_5 as category };
        let protocol_5: string;
        export { protocol_5 as protocol };
        let scopes_5: string[];
        export { scopes_5 as scopes };
        export namespace endpoints_5 {
            let authorize_5: string;
            export { authorize_5 as authorize };
            let token_5: string;
            export { token_5 as token };
            let userinfo_5: string;
            export { userinfo_5 as userinfo };
        }
        export { endpoints_5 as endpoints };
        let color_5: string;
        export { color_5 as color };
        let icon_5: string;
        export { icon_5 as icon };
    }
    namespace apple {
        let id_6: string;
        export { id_6 as id };
        let name_6: string;
        export { name_6 as name };
        let category_6: string;
        export { category_6 as category };
        let protocol_6: string;
        export { protocol_6 as protocol };
        let scopes_6: string[];
        export { scopes_6 as scopes };
        export namespace endpoints_6 {
            let authorize_6: string;
            export { authorize_6 as authorize };
            let token_6: string;
            export { token_6 as token };
            let userinfo_6: null;
            export { userinfo_6 as userinfo };
        }
        export { endpoints_6 as endpoints };
        let color_6: string;
        export { color_6 as color };
        let icon_6: string;
        export { icon_6 as icon };
        export let usesIdToken: boolean;
    }
    namespace facebook {
        let id_7: string;
        export { id_7 as id };
        let name_7: string;
        export { name_7 as name };
        let category_7: string;
        export { category_7 as category };
        let protocol_7: string;
        export { protocol_7 as protocol };
        let scopes_7: string[];
        export { scopes_7 as scopes };
        export namespace endpoints_7 {
            let authorize_7: string;
            export { authorize_7 as authorize };
            let token_7: string;
            export { token_7 as token };
            let userinfo_7: string;
            export { userinfo_7 as userinfo };
        }
        export { endpoints_7 as endpoints };
        let color_7: string;
        export { color_7 as color };
        let icon_7: string;
        export { icon_7 as icon };
    }
    namespace instagram {
        let id_8: string;
        export { id_8 as id };
        let name_8: string;
        export { name_8 as name };
        let category_8: string;
        export { category_8 as category };
        let protocol_8: string;
        export { protocol_8 as protocol };
        let scopes_8: string[];
        export { scopes_8 as scopes };
        export namespace endpoints_8 {
            let authorize_8: string;
            export { authorize_8 as authorize };
            let token_8: string;
            export { token_8 as token };
            let userinfo_8: string;
            export { userinfo_8 as userinfo };
        }
        export { endpoints_8 as endpoints };
        let color_8: string;
        export { color_8 as color };
        let icon_8: string;
        export { icon_8 as icon };
    }
    namespace tiktok {
        let id_9: string;
        export { id_9 as id };
        let name_9: string;
        export { name_9 as name };
        let category_9: string;
        export { category_9 as category };
        let protocol_9: string;
        export { protocol_9 as protocol };
        let scopes_9: string[];
        export { scopes_9 as scopes };
        export namespace endpoints_9 {
            let authorize_9: string;
            export { authorize_9 as authorize };
            let token_9: string;
            export { token_9 as token };
            let userinfo_9: string;
            export { userinfo_9 as userinfo };
        }
        export { endpoints_9 as endpoints };
        let color_9: string;
        export { color_9 as color };
        let icon_9: string;
        export { icon_9 as icon };
    }
    namespace twitter {
        let id_10: string;
        export { id_10 as id };
        let name_10: string;
        export { name_10 as name };
        let category_10: string;
        export { category_10 as category };
        let protocol_10: string;
        export { protocol_10 as protocol };
        let scopes_10: string[];
        export { scopes_10 as scopes };
        export namespace endpoints_10 {
            let authorize_10: string;
            export { authorize_10 as authorize };
            let token_10: string;
            export { token_10 as token };
            let userinfo_10: string;
            export { userinfo_10 as userinfo };
        }
        export { endpoints_10 as endpoints };
        let color_10: string;
        export { color_10 as color };
        let icon_10: string;
        export { icon_10 as icon };
        export let requiresPKCE: boolean;
    }
    namespace snapchat {
        let id_11: string;
        export { id_11 as id };
        let name_11: string;
        export { name_11 as name };
        let category_11: string;
        export { category_11 as category };
        let protocol_11: string;
        export { protocol_11 as protocol };
        let scopes_11: string[];
        export { scopes_11 as scopes };
        export namespace endpoints_11 {
            let authorize_11: string;
            export { authorize_11 as authorize };
            let token_11: string;
            export { token_11 as token };
            let userinfo_11: string;
            export { userinfo_11 as userinfo };
        }
        export { endpoints_11 as endpoints };
        let color_11: string;
        export { color_11 as color };
        let icon_11: string;
        export { icon_11 as icon };
    }
    namespace linkedin {
        let id_12: string;
        export { id_12 as id };
        let name_12: string;
        export { name_12 as name };
        let category_12: string;
        export { category_12 as category };
        let protocol_12: string;
        export { protocol_12 as protocol };
        let scopes_12: string[];
        export { scopes_12 as scopes };
        export namespace endpoints_12 {
            let authorize_12: string;
            export { authorize_12 as authorize };
            let token_12: string;
            export { token_12 as token };
            let userinfo_12: string;
            export { userinfo_12 as userinfo };
        }
        export { endpoints_12 as endpoints };
        let color_12: string;
        export { color_12 as color };
        let icon_12: string;
        export { icon_12 as icon };
    }
    namespace reddit {
        let id_13: string;
        export { id_13 as id };
        let name_13: string;
        export { name_13 as name };
        let category_13: string;
        export { category_13 as category };
        let protocol_13: string;
        export { protocol_13 as protocol };
        let scopes_13: string[];
        export { scopes_13 as scopes };
        export namespace endpoints_13 {
            let authorize_13: string;
            export { authorize_13 as authorize };
            let token_13: string;
            export { token_13 as token };
            let userinfo_13: string;
            export { userinfo_13 as userinfo };
        }
        export { endpoints_13 as endpoints };
        let color_13: string;
        export { color_13 as color };
        let icon_13: string;
        export { icon_13 as icon };
    }
    namespace pinterest {
        let id_14: string;
        export { id_14 as id };
        let name_14: string;
        export { name_14 as name };
        let category_14: string;
        export { category_14 as category };
        let protocol_14: string;
        export { protocol_14 as protocol };
        let scopes_14: string[];
        export { scopes_14 as scopes };
        export namespace endpoints_14 {
            let authorize_14: string;
            export { authorize_14 as authorize };
            let token_14: string;
            export { token_14 as token };
            let userinfo_14: string;
            export { userinfo_14 as userinfo };
        }
        export { endpoints_14 as endpoints };
        let color_14: string;
        export { color_14 as color };
        let icon_14: string;
        export { icon_14 as icon };
    }
    namespace discord {
        let id_15: string;
        export { id_15 as id };
        let name_15: string;
        export { name_15 as name };
        let category_15: string;
        export { category_15 as category };
        let protocol_15: string;
        export { protocol_15 as protocol };
        let scopes_15: string[];
        export { scopes_15 as scopes };
        export namespace endpoints_15 {
            let authorize_15: string;
            export { authorize_15 as authorize };
            let token_15: string;
            export { token_15 as token };
            let userinfo_15: string;
            export { userinfo_15 as userinfo };
        }
        export { endpoints_15 as endpoints };
        let color_15: string;
        export { color_15 as color };
        let icon_15: string;
        export { icon_15 as icon };
    }
    namespace spotify {
        let id_16: string;
        export { id_16 as id };
        let name_16: string;
        export { name_16 as name };
        let category_16: string;
        export { category_16 as category };
        let protocol_16: string;
        export { protocol_16 as protocol };
        let scopes_16: string[];
        export { scopes_16 as scopes };
        export namespace endpoints_16 {
            let authorize_16: string;
            export { authorize_16 as authorize };
            let token_16: string;
            export { token_16 as token };
            let userinfo_16: string;
            export { userinfo_16 as userinfo };
        }
        export { endpoints_16 as endpoints };
        let color_16: string;
        export { color_16 as color };
        let icon_16: string;
        export { icon_16 as icon };
    }
    namespace twitch {
        let id_17: string;
        export { id_17 as id };
        let name_17: string;
        export { name_17 as name };
        let category_17: string;
        export { category_17 as category };
        let protocol_17: string;
        export { protocol_17 as protocol };
        let scopes_17: string[];
        export { scopes_17 as scopes };
        export namespace endpoints_17 {
            let authorize_17: string;
            export { authorize_17 as authorize };
            let token_17: string;
            export { token_17 as token };
            let userinfo_17: string;
            export { userinfo_17 as userinfo };
        }
        export { endpoints_17 as endpoints };
        let color_17: string;
        export { color_17 as color };
        let icon_17: string;
        export { icon_17 as icon };
    }
    namespace youtube {
        let id_18: string;
        export { id_18 as id };
        let name_18: string;
        export { name_18 as name };
        let category_18: string;
        export { category_18 as category };
        let protocol_18: string;
        export { protocol_18 as protocol };
        let scopes_18: string[];
        export { scopes_18 as scopes };
        export namespace endpoints_18 {
            let authorize_18: string;
            export { authorize_18 as authorize };
            let token_18: string;
            export { token_18 as token };
            let userinfo_18: string;
            export { userinfo_18 as userinfo };
        }
        export { endpoints_18 as endpoints };
        let color_18: string;
        export { color_18 as color };
        let icon_18: string;
        export { icon_18 as icon };
    }
    namespace huggingface {
        let id_19: string;
        export { id_19 as id };
        let name_19: string;
        export { name_19 as name };
        let category_19: string;
        export { category_19 as category };
        let protocol_19: string;
        export { protocol_19 as protocol };
        let scopes_19: string[];
        export { scopes_19 as scopes };
        export namespace endpoints_19 {
            let authorize_19: string;
            export { authorize_19 as authorize };
            let token_19: string;
            export { token_19 as token };
            let userinfo_19: string;
            export { userinfo_19 as userinfo };
        }
        export { endpoints_19 as endpoints };
        let color_19: string;
        export { color_19 as color };
        let icon_19: string;
        export { icon_19 as icon };
        let sshSupport_3: boolean;
        export { sshSupport_3 as sshSupport };
    }
    namespace openai {
        let id_20: string;
        export { id_20 as id };
        let name_20: string;
        export { name_20 as name };
        let category_20: string;
        export { category_20 as category };
        let protocol_20: string;
        export { protocol_20 as protocol };
        let scopes_20: never[];
        export { scopes_20 as scopes };
        export namespace endpoints_20 {
            let userinfo_20: string;
            export { userinfo_20 as userinfo };
        }
        export { endpoints_20 as endpoints };
        let color_20: string;
        export { color_20 as color };
        let icon_20: string;
        export { icon_20 as icon };
    }
    namespace firebase {
        let id_21: string;
        export { id_21 as id };
        let name_21: string;
        export { name_21 as name };
        let category_21: string;
        export { category_21 as category };
        let protocol_21: string;
        export { protocol_21 as protocol };
        let scopes_21: string[];
        export { scopes_21 as scopes };
        export namespace endpoints_21 {
            let authorize_20: string;
            export { authorize_20 as authorize };
            let token_20: string;
            export { token_20 as token };
            let userinfo_21: string;
            export { userinfo_21 as userinfo };
        }
        export { endpoints_21 as endpoints };
        let color_21: string;
        export { color_21 as color };
        let icon_21: string;
        export { icon_21 as icon };
    }
    namespace ssh_key {
        let id_22: string;
        export { id_22 as id };
        let name_22: string;
        export { name_22 as name };
        let category_22: string;
        export { category_22 as category };
        let protocol_22: string;
        export { protocol_22 as protocol };
        let scopes_22: never[];
        export { scopes_22 as scopes };
        let endpoints_22: {};
        export { endpoints_22 as endpoints };
        let color_22: string;
        export { color_22 as color };
        let icon_22: string;
        export { icon_22 as icon };
        let sshSupport_4: boolean;
        export { sshSupport_4 as sshSupport };
    }
    namespace gpg_signature {
        let id_23: string;
        export { id_23 as id };
        let name_23: string;
        export { name_23 as name };
        let category_23: string;
        export { category_23 as category };
        let protocol_23: string;
        export { protocol_23 as protocol };
        let scopes_23: never[];
        export { scopes_23 as scopes };
        let endpoints_23: {};
        export { endpoints_23 as endpoints };
        let color_23: string;
        export { color_23 as color };
        let icon_23: string;
        export { icon_23 as icon };
        let gpgSupport_2: boolean;
        export { gpgSupport_2 as gpgSupport };
    }
    namespace webauthn {
        let id_24: string;
        export { id_24 as id };
        let name_24: string;
        export { name_24 as name };
        let category_24: string;
        export { category_24 as category };
        let protocol_24: string;
        export { protocol_24 as protocol };
        let scopes_24: never[];
        export { scopes_24 as scopes };
        let endpoints_24: {};
        export { endpoints_24 as endpoints };
        let color_24: string;
        export { color_24 as color };
        let icon_24: string;
        export { icon_24 as icon };
    }
    namespace ethereum {
        let id_25: string;
        export { id_25 as id };
        let name_25: string;
        export { name_25 as name };
        let category_25: string;
        export { category_25 as category };
        let protocol_25: string;
        export { protocol_25 as protocol };
        let scopes_25: never[];
        export { scopes_25 as scopes };
        let endpoints_25: {};
        export { endpoints_25 as endpoints };
        let color_25: string;
        export { color_25 as color };
        let icon_25: string;
        export { icon_25 as icon };
    }
}
export namespace AUTH_SWARM_TEMPLATE {
    let name_26: string;
    export { name_26 as name };
    export let version: string;
    export let description: string;
    export let parallelism: string;
    export { PHI as phiBase };
    export { AUTH_PROVIDERS as providers };
    export let providerCount: number;
    export namespace categories {
        let code: string[];
        let cloud: string[];
        let social: string[];
        let entertainment: string[];
        let developer: string[];
        let crypto: string[];
    }
    export { SWARM_TASKS as swarmTasks };
    export function createBlastPlan(): {
        totalBees: number;
        tasksPerBee: number;
        totalTasks: number;
        parallelism: string;
        plan: {
            beeId: string;
            provider: any;
            icon: any;
            category: any;
            tasks: string[];
            phiPriority: number;
        }[];
    };
}
export const SWARM_TASKS: {
    'vector-context-inject': {
        name: string;
        description: string;
        priority: number;
        phiWeight: number;
        execute: (providerId: any, vectorMemory: any) => Promise<{
            provider: any;
            category: any;
            vectorContext: any;
            phiWeight: number;
            injectedAt: string;
        }>;
    };
    'oauth-init': {
        name: string;
        description: string;
        priority: number;
        phiWeight: number;
        execute: (providerId: any, config: any) => Promise<{
            provider: any;
            authUrl: any;
            params: {
                client_id: any;
                redirect_uri: any;
                response_type: string;
                scope: any;
                state: string;
            };
            protocol: any;
            state: string;
        }>;
    };
    'token-exchange': {
        name: string;
        description: string;
        priority: number;
        phiWeight: number;
    };
    'profile-vectorize': {
        name: string;
        description: string;
        priority: number;
        phiWeight: number;
        execute: (userProfile: any, vectorMemory: any) => Promise<{
            id: string;
            namespace: string;
            metadata: {
                provider: any;
                username: any;
                email: any;
                category: any;
                authedAt: string;
            };
        }>;
    };
    'session-create': {
        name: string;
        description: string;
        priority: number;
        phiWeight: number;
    };
};
import { PHI } from "../../packages/heady-sacred-geometry-sdk";
//# sourceMappingURL=auth-providers-swarm.d.ts.map