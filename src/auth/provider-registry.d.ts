export namespace google {
    let type: string;
    let name: string;
    let icon: string;
    let color: string;
    let bg: string;
    let envKey: string;
    let envSecret: string;
    let authorizeUrl: string;
    let tokenUrl: string;
    let profileUrl: null;
    let scope: string;
    namespace extraParams {
        let access_type: string;
    }
    let tokenPrefix: string;
    function extractUser(tokens: any, _profile: any): {
        email: any;
        name: any;
        photo: any;
    };
}
export namespace github {
    let type_1: string;
    export { type_1 as type };
    let name_1: string;
    export { name_1 as name };
    let icon_1: string;
    export { icon_1 as icon };
    let color_1: string;
    export { color_1 as color };
    let bg_1: string;
    export { bg_1 as bg };
    let envKey_1: string;
    export { envKey_1 as envKey };
    let envSecret_1: string;
    export { envSecret_1 as envSecret };
    let authorizeUrl_1: string;
    export { authorizeUrl_1 as authorizeUrl };
    let tokenUrl_1: string;
    export { tokenUrl_1 as tokenUrl };
    let profileUrl_1: string;
    export { profileUrl_1 as profileUrl };
    let scope_1: string;
    export { scope_1 as scope };
    let tokenPrefix_1: string;
    export { tokenPrefix_1 as tokenPrefix };
    export function profileHeaders(token: any): {
        Authorization: string;
        'User-Agent': string;
        Accept: string;
    };
    export function extractUser_1(_tokens: any, profile: any, accessToken: any): Promise<{
        email: any;
        name: any;
        photo: any;
    }>;
    export { extractUser_1 as extractUser };
}
export namespace microsoft {
    let type_2: string;
    export { type_2 as type };
    let name_2: string;
    export { name_2 as name };
    let icon_2: string;
    export { icon_2 as icon };
    let color_2: string;
    export { color_2 as color };
    let bg_2: string;
    export { bg_2 as bg };
    let envKey_2: string;
    export { envKey_2 as envKey };
    let envSecret_2: string;
    export { envSecret_2 as envSecret };
    export function authorizeUrl_2(): string;
    export { authorizeUrl_2 as authorizeUrl };
    export function tokenUrl_2(): string;
    export { tokenUrl_2 as tokenUrl };
    let profileUrl_2: string;
    export { profileUrl_2 as profileUrl };
    let scope_2: string;
    export { scope_2 as scope };
    export namespace extraParams_1 {
        let response_mode: string;
    }
    export { extraParams_1 as extraParams };
    let tokenPrefix_2: string;
    export { tokenPrefix_2 as tokenPrefix };
    export function extractUser_2(_tokens: any, profile: any): {
        email: any;
        name: any;
        photo: null;
    };
    export { extractUser_2 as extractUser };
}
export namespace facebook {
    let type_3: string;
    export { type_3 as type };
    let name_3: string;
    export { name_3 as name };
    let icon_3: string;
    export { icon_3 as icon };
    let color_3: string;
    export { color_3 as color };
    let bg_3: string;
    export { bg_3 as bg };
    let envKey_3: string;
    export { envKey_3 as envKey };
    let envSecret_3: string;
    export { envSecret_3 as envSecret };
    let authorizeUrl_3: string;
    export { authorizeUrl_3 as authorizeUrl };
    let tokenUrl_3: string;
    export { tokenUrl_3 as tokenUrl };
    let profileUrl_3: string;
    export { profileUrl_3 as profileUrl };
    let scope_3: string;
    export { scope_3 as scope };
    let tokenPrefix_3: string;
    export { tokenPrefix_3 as tokenPrefix };
    export function extractUser_3(_tokens: any, profile: any): {
        email: any;
        name: any;
        photo: any;
    };
    export { extractUser_3 as extractUser };
}
export namespace amazon {
    let type_4: string;
    export { type_4 as type };
    let name_4: string;
    export { name_4 as name };
    let icon_4: string;
    export { icon_4 as icon };
    let color_4: string;
    export { color_4 as color };
    let bg_4: string;
    export { bg_4 as bg };
    let envKey_4: string;
    export { envKey_4 as envKey };
    let envSecret_4: string;
    export { envSecret_4 as envSecret };
    let authorizeUrl_4: string;
    export { authorizeUrl_4 as authorizeUrl };
    let tokenUrl_4: string;
    export { tokenUrl_4 as tokenUrl };
    let profileUrl_4: string;
    export { profileUrl_4 as profileUrl };
    let scope_4: string;
    export { scope_4 as scope };
    let tokenPrefix_4: string;
    export { tokenPrefix_4 as tokenPrefix };
    export function extractUser_4(_tokens: any, profile: any): {
        email: any;
        name: any;
        photo: null;
    };
    export { extractUser_4 as extractUser };
}
export namespace apple {
    let type_5: string;
    export { type_5 as type };
    let name_5: string;
    export { name_5 as name };
    let icon_5: string;
    export { icon_5 as icon };
    let color_5: string;
    export { color_5 as color };
    let bg_5: string;
    export { bg_5 as bg };
    let envKey_5: string;
    export { envKey_5 as envKey };
    let envSecret_5: string;
    export { envSecret_5 as envSecret };
    let authorizeUrl_5: string;
    export { authorizeUrl_5 as authorizeUrl };
    let tokenUrl_5: string;
    export { tokenUrl_5 as tokenUrl };
    let profileUrl_5: null;
    export { profileUrl_5 as profileUrl };
    let scope_5: string;
    export { scope_5 as scope };
    export namespace extraParams_2 {
        let response_mode_1: string;
        export { response_mode_1 as response_mode };
    }
    export { extraParams_2 as extraParams };
    let tokenPrefix_5: string;
    export { tokenPrefix_5 as tokenPrefix };
    export function extractUser_5(tokens: any): {
        email: any;
        name: any;
        photo: null;
    };
    export { extractUser_5 as extractUser };
}
export namespace discord {
    let type_6: string;
    export { type_6 as type };
    let name_6: string;
    export { name_6 as name };
    let icon_6: string;
    export { icon_6 as icon };
    let color_6: string;
    export { color_6 as color };
    let bg_6: string;
    export { bg_6 as bg };
    let envKey_6: string;
    export { envKey_6 as envKey };
    let envSecret_6: string;
    export { envSecret_6 as envSecret };
    let authorizeUrl_6: string;
    export { authorizeUrl_6 as authorizeUrl };
    let tokenUrl_6: string;
    export { tokenUrl_6 as tokenUrl };
    let profileUrl_6: string;
    export { profileUrl_6 as profileUrl };
    let scope_6: string;
    export { scope_6 as scope };
    let tokenPrefix_6: string;
    export { tokenPrefix_6 as tokenPrefix };
    export let tokenContentType: string;
    export function extractUser_6(_tokens: any, profile: any): {
        email: any;
        name: any;
        photo: string | null;
    };
    export { extractUser_6 as extractUser };
}
export namespace slack {
    let type_7: string;
    export { type_7 as type };
    let name_7: string;
    export { name_7 as name };
    let icon_7: string;
    export { icon_7 as icon };
    let color_7: string;
    export { color_7 as color };
    let bg_7: string;
    export { bg_7 as bg };
    let envKey_7: string;
    export { envKey_7 as envKey };
    let envSecret_7: string;
    export { envSecret_7 as envSecret };
    let authorizeUrl_7: string;
    export { authorizeUrl_7 as authorizeUrl };
    let tokenUrl_7: string;
    export { tokenUrl_7 as tokenUrl };
    let profileUrl_7: string;
    export { profileUrl_7 as profileUrl };
    let scope_7: string;
    export { scope_7 as scope };
    let tokenPrefix_7: string;
    export { tokenPrefix_7 as tokenPrefix };
    let tokenContentType_1: string;
    export { tokenContentType_1 as tokenContentType };
    export function extractUser_7(_tokens: any, profile: any): {
        email: any;
        name: any;
        photo: any;
    };
    export { extractUser_7 as extractUser };
}
export namespace linkedin {
    let type_8: string;
    export { type_8 as type };
    let name_8: string;
    export { name_8 as name };
    let icon_8: string;
    export { icon_8 as icon };
    let color_8: string;
    export { color_8 as color };
    let bg_8: string;
    export { bg_8 as bg };
    let envKey_8: string;
    export { envKey_8 as envKey };
    let envSecret_8: string;
    export { envSecret_8 as envSecret };
    let authorizeUrl_8: string;
    export { authorizeUrl_8 as authorizeUrl };
    let tokenUrl_8: string;
    export { tokenUrl_8 as tokenUrl };
    let profileUrl_8: string;
    export { profileUrl_8 as profileUrl };
    let scope_8: string;
    export { scope_8 as scope };
    let tokenPrefix_8: string;
    export { tokenPrefix_8 as tokenPrefix };
    let tokenContentType_2: string;
    export { tokenContentType_2 as tokenContentType };
    export function extractUser_8(_tokens: any, profile: any): {
        email: any;
        name: any;
        photo: any;
    };
    export { extractUser_8 as extractUser };
}
export namespace twitter {
    let type_9: string;
    export { type_9 as type };
    let name_9: string;
    export { name_9 as name };
    let icon_9: string;
    export { icon_9 as icon };
    let color_9: string;
    export { color_9 as color };
    let bg_9: string;
    export { bg_9 as bg };
    let envKey_9: string;
    export { envKey_9 as envKey };
    let envSecret_9: string;
    export { envSecret_9 as envSecret };
    let authorizeUrl_9: string;
    export { authorizeUrl_9 as authorizeUrl };
    let tokenUrl_9: string;
    export { tokenUrl_9 as tokenUrl };
    let profileUrl_9: string;
    export { profileUrl_9 as profileUrl };
    let scope_9: string;
    export { scope_9 as scope };
    export namespace extraParams_3 {
        let code_challenge: string;
        let code_challenge_method: string;
    }
    export { extraParams_3 as extraParams };
    let tokenPrefix_9: string;
    export { tokenPrefix_9 as tokenPrefix };
    let tokenContentType_3: string;
    export { tokenContentType_3 as tokenContentType };
    export let tokenAuth: string;
    export function extractUser_9(_tokens: any, profile: any): {
        email: null;
        name: any;
        photo: any;
    };
    export { extractUser_9 as extractUser };
}
export namespace spotify {
    let type_10: string;
    export { type_10 as type };
    let name_10: string;
    export { name_10 as name };
    let icon_10: string;
    export { icon_10 as icon };
    let color_10: string;
    export { color_10 as color };
    let bg_10: string;
    export { bg_10 as bg };
    let envKey_10: string;
    export { envKey_10 as envKey };
    let envSecret_10: string;
    export { envSecret_10 as envSecret };
    let authorizeUrl_10: string;
    export { authorizeUrl_10 as authorizeUrl };
    let tokenUrl_10: string;
    export { tokenUrl_10 as tokenUrl };
    let profileUrl_10: string;
    export { profileUrl_10 as profileUrl };
    let scope_10: string;
    export { scope_10 as scope };
    let tokenPrefix_10: string;
    export { tokenPrefix_10 as tokenPrefix };
    let tokenContentType_4: string;
    export { tokenContentType_4 as tokenContentType };
    let tokenAuth_1: string;
    export { tokenAuth_1 as tokenAuth };
    export function extractUser_10(_tokens: any, profile: any): {
        email: any;
        name: any;
        photo: any;
    };
    export { extractUser_10 as extractUser };
}
export namespace openai {
    let type_11: string;
    export { type_11 as type };
    let name_11: string;
    export { name_11 as name };
    let icon_11: string;
    export { icon_11 as icon };
    let color_11: string;
    export { color_11 as color };
    let bg_11: string;
    export { bg_11 as bg };
    export let validateUrl: string;
    export let validateMethod: string;
    export function validateHeaders(key: any): {
        Authorization: string;
    };
    let tokenPrefix_11: string;
    export { tokenPrefix_11 as tokenPrefix };
    export let keyPlaceholder: string;
}
export namespace claude {
    let type_12: string;
    export { type_12 as type };
    let name_12: string;
    export { name_12 as name };
    let icon_12: string;
    export { icon_12 as icon };
    let color_12: string;
    export { color_12 as color };
    let bg_12: string;
    export { bg_12 as bg };
    let validateUrl_1: string;
    export { validateUrl_1 as validateUrl };
    let validateMethod_1: string;
    export { validateMethod_1 as validateMethod };
    export function validateHeaders_1(key: any): {
        'x-api-key': any;
        'anthropic-version': string;
        'Content-Type': string;
    };
    export { validateHeaders_1 as validateHeaders };
    export namespace validateBody {
        let model: string;
        let max_tokens: number;
        let messages: {
            role: string;
            content: string;
        }[];
    }
    let tokenPrefix_12: string;
    export { tokenPrefix_12 as tokenPrefix };
    let keyPlaceholder_1: string;
    export { keyPlaceholder_1 as keyPlaceholder };
}
export namespace perplexity {
    let type_13: string;
    export { type_13 as type };
    let name_13: string;
    export { name_13 as name };
    let icon_13: string;
    export { icon_13 as icon };
    let color_13: string;
    export { color_13 as color };
    let bg_13: string;
    export { bg_13 as bg };
    let validateUrl_2: string;
    export { validateUrl_2 as validateUrl };
    let validateMethod_2: string;
    export { validateMethod_2 as validateMethod };
    export function validateHeaders_2(key: any): {
        Authorization: string;
        'Content-Type': string;
    };
    export { validateHeaders_2 as validateHeaders };
    export namespace validateBody_1 {
        let model_1: string;
        export { model_1 as model };
        let messages_1: {
            role: string;
            content: string;
        }[];
        export { messages_1 as messages };
        let max_tokens_1: number;
        export { max_tokens_1 as max_tokens };
    }
    export { validateBody_1 as validateBody };
    let tokenPrefix_13: string;
    export { tokenPrefix_13 as tokenPrefix };
    let keyPlaceholder_2: string;
    export { keyPlaceholder_2 as keyPlaceholder };
}
export namespace gemini {
    let type_14: string;
    export { type_14 as type };
    let name_14: string;
    export { name_14 as name };
    let icon_14: string;
    export { icon_14 as icon };
    let color_14: string;
    export { color_14 as color };
    let bg_14: string;
    export { bg_14 as bg };
    export function validateUrl_3(key: any): string;
    export { validateUrl_3 as validateUrl };
    let validateMethod_3: string;
    export { validateMethod_3 as validateMethod };
    export function validateHeaders_3(): {};
    export { validateHeaders_3 as validateHeaders };
    let tokenPrefix_14: string;
    export { tokenPrefix_14 as tokenPrefix };
    let keyPlaceholder_3: string;
    export { keyPlaceholder_3 as keyPlaceholder };
}
export namespace huggingface {
    let type_15: string;
    export { type_15 as type };
    let name_15: string;
    export { name_15 as name };
    let icon_15: string;
    export { icon_15 as icon };
    let color_15: string;
    export { color_15 as color };
    let bg_15: string;
    export { bg_15 as bg };
    let validateUrl_4: string;
    export { validateUrl_4 as validateUrl };
    let validateMethod_4: string;
    export { validateMethod_4 as validateMethod };
    export function validateHeaders_4(key: any): {
        Authorization: string;
    };
    export { validateHeaders_4 as validateHeaders };
    let tokenPrefix_15: string;
    export { tokenPrefix_15 as tokenPrefix };
    let keyPlaceholder_4: string;
    export { keyPlaceholder_4 as keyPlaceholder };
}
export namespace replicate {
    let type_16: string;
    export { type_16 as type };
    let name_16: string;
    export { name_16 as name };
    let icon_16: string;
    export { icon_16 as icon };
    let color_16: string;
    export { color_16 as color };
    let bg_16: string;
    export { bg_16 as bg };
    let validateUrl_5: string;
    export { validateUrl_5 as validateUrl };
    let validateMethod_5: string;
    export { validateMethod_5 as validateMethod };
    export function validateHeaders_5(key: any): {
        Authorization: string;
    };
    export { validateHeaders_5 as validateHeaders };
    let tokenPrefix_16: string;
    export { tokenPrefix_16 as tokenPrefix };
    let keyPlaceholder_5: string;
    export { keyPlaceholder_5 as keyPlaceholder };
}
export namespace mistral {
    let type_17: string;
    export { type_17 as type };
    let name_17: string;
    export { name_17 as name };
    let icon_17: string;
    export { icon_17 as icon };
    let color_17: string;
    export { color_17 as color };
    let bg_17: string;
    export { bg_17 as bg };
    let validateUrl_6: string;
    export { validateUrl_6 as validateUrl };
    let validateMethod_6: string;
    export { validateMethod_6 as validateMethod };
    export function validateHeaders_6(key: any): {
        Authorization: string;
    };
    export { validateHeaders_6 as validateHeaders };
    let tokenPrefix_17: string;
    export { tokenPrefix_17 as tokenPrefix };
    let keyPlaceholder_6: string;
    export { keyPlaceholder_6 as keyPlaceholder };
}
export namespace cohere {
    let type_18: string;
    export { type_18 as type };
    let name_18: string;
    export { name_18 as name };
    let icon_18: string;
    export { icon_18 as icon };
    let color_18: string;
    export { color_18 as color };
    let bg_18: string;
    export { bg_18 as bg };
    let validateUrl_7: string;
    export { validateUrl_7 as validateUrl };
    let validateMethod_7: string;
    export { validateMethod_7 as validateMethod };
    export function validateHeaders_7(key: any): {
        Authorization: string;
    };
    export { validateHeaders_7 as validateHeaders };
    let tokenPrefix_18: string;
    export { tokenPrefix_18 as tokenPrefix };
    let keyPlaceholder_7: string;
    export { keyPlaceholder_7 as keyPlaceholder };
}
export namespace groq {
    let type_19: string;
    export { type_19 as type };
    let name_19: string;
    export { name_19 as name };
    let icon_19: string;
    export { icon_19 as icon };
    let color_19: string;
    export { color_19 as color };
    let bg_19: string;
    export { bg_19 as bg };
    let validateUrl_8: string;
    export { validateUrl_8 as validateUrl };
    let validateMethod_8: string;
    export { validateMethod_8 as validateMethod };
    export function validateHeaders_8(key: any): {
        Authorization: string;
    };
    export { validateHeaders_8 as validateHeaders };
    let tokenPrefix_19: string;
    export { tokenPrefix_19 as tokenPrefix };
    let keyPlaceholder_8: string;
    export { keyPlaceholder_8 as keyPlaceholder };
}
//# sourceMappingURL=provider-registry.d.ts.map