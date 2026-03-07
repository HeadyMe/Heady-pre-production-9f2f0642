export namespace PROVIDERS {
    namespace google {
        let id: string;
        let name: string;
        let icon: string;
        let color: string;
        let category: string;
        namespace services {
            namespace gmail {
                export let label: string;
                let icon_1: string;
                export { icon_1 as icon };
                export let description: string;
                export let scopes: string[];
            }
            namespace calendar {
                let label_1: string;
                export { label_1 as label };
                let icon_2: string;
                export { icon_2 as icon };
                let description_1: string;
                export { description_1 as description };
                let scopes_1: string[];
                export { scopes_1 as scopes };
            }
            namespace drive {
                let label_2: string;
                export { label_2 as label };
                let icon_3: string;
                export { icon_3 as icon };
                let description_2: string;
                export { description_2 as description };
                let scopes_2: string[];
                export { scopes_2 as scopes };
            }
            namespace sheets {
                let label_3: string;
                export { label_3 as label };
                let icon_4: string;
                export { icon_4 as icon };
                let description_3: string;
                export { description_3 as description };
                let scopes_3: string[];
                export { scopes_3 as scopes };
            }
            namespace docs {
                let label_4: string;
                export { label_4 as label };
                let icon_5: string;
                export { icon_5 as icon };
                let description_4: string;
                export { description_4 as description };
                let scopes_4: string[];
                export { scopes_4 as scopes };
            }
            namespace contacts {
                let label_5: string;
                export { label_5 as label };
                let icon_6: string;
                export { icon_6 as icon };
                let description_5: string;
                export { description_5 as description };
                let scopes_5: string[];
                export { scopes_5 as scopes };
            }
            namespace tasks {
                let label_6: string;
                export { label_6 as label };
                let icon_7: string;
                export { icon_7 as icon };
                let description_6: string;
                export { description_6 as description };
                let scopes_6: string[];
                export { scopes_6 as scopes };
            }
            namespace photos {
                let label_7: string;
                export { label_7 as label };
                let icon_8: string;
                export { icon_8 as icon };
                let description_7: string;
                export { description_7 as description };
                let scopes_7: string[];
                export { scopes_7 as scopes };
            }
            namespace youtube {
                let label_8: string;
                export { label_8 as label };
                let icon_9: string;
                export { icon_9 as icon };
                let description_8: string;
                export { description_8 as description };
                let scopes_8: string[];
                export { scopes_8 as scopes };
            }
            namespace meet {
                let label_9: string;
                export { label_9 as label };
                let icon_10: string;
                export { icon_10 as icon };
                let description_9: string;
                export { description_9 as description };
                let scopes_9: string[];
                export { scopes_9 as scopes };
            }
            namespace cloud {
                let label_10: string;
                export { label_10 as label };
                let icon_11: string;
                export { icon_11 as icon };
                let description_10: string;
                export { description_10 as description };
                let scopes_10: string[];
                export { scopes_10 as scopes };
                export let businessOnly: boolean;
            }
            namespace analytics {
                let label_11: string;
                export { label_11 as label };
                let icon_12: string;
                export { icon_12 as icon };
                let description_11: string;
                export { description_11 as description };
                let scopes_11: string[];
                export { scopes_11 as scopes };
                let businessOnly_1: boolean;
                export { businessOnly_1 as businessOnly };
            }
            namespace ads {
                let label_12: string;
                export { label_12 as label };
                let icon_13: string;
                export { icon_13 as icon };
                let description_12: string;
                export { description_12 as description };
                let scopes_12: string[];
                export { scopes_12 as scopes };
                let businessOnly_2: boolean;
                export { businessOnly_2 as businessOnly };
            }
        }
    }
    namespace github {
        let id_1: string;
        export { id_1 as id };
        let name_1: string;
        export { name_1 as name };
        let icon_14: string;
        export { icon_14 as icon };
        let color_1: string;
        export { color_1 as color };
        let category_1: string;
        export { category_1 as category };
        export namespace services_1 {
            namespace repos {
                let label_13: string;
                export { label_13 as label };
                let icon_15: string;
                export { icon_15 as icon };
                let description_13: string;
                export { description_13 as description };
                let scopes_13: string[];
                export { scopes_13 as scopes };
            }
            namespace actions {
                let label_14: string;
                export { label_14 as label };
                let icon_16: string;
                export { icon_16 as icon };
                let description_14: string;
                export { description_14 as description };
                let scopes_14: string[];
                export { scopes_14 as scopes };
            }
            namespace issues {
                let label_15: string;
                export { label_15 as label };
                let icon_17: string;
                export { icon_17 as icon };
                let description_15: string;
                export { description_15 as description };
                let scopes_15: string[];
                export { scopes_15 as scopes };
            }
            namespace packages {
                let label_16: string;
                export { label_16 as label };
                let icon_18: string;
                export { icon_18 as icon };
                let description_16: string;
                export { description_16 as description };
                let scopes_16: string[];
                export { scopes_16 as scopes };
            }
            namespace gists {
                let label_17: string;
                export { label_17 as label };
                let icon_19: string;
                export { icon_19 as icon };
                let description_17: string;
                export { description_17 as description };
                let scopes_17: string[];
                export { scopes_17 as scopes };
            }
            namespace orgs {
                let label_18: string;
                export { label_18 as label };
                let icon_20: string;
                export { icon_20 as icon };
                let description_18: string;
                export { description_18 as description };
                let scopes_18: string[];
                export { scopes_18 as scopes };
                let businessOnly_3: boolean;
                export { businessOnly_3 as businessOnly };
            }
            namespace webhooks {
                let label_19: string;
                export { label_19 as label };
                let icon_21: string;
                export { icon_21 as icon };
                let description_19: string;
                export { description_19 as description };
                let scopes_19: string[];
                export { scopes_19 as scopes };
            }
            namespace pages {
                let label_20: string;
                export { label_20 as label };
                let icon_22: string;
                export { icon_22 as icon };
                let description_20: string;
                export { description_20 as description };
                let scopes_20: string[];
                export { scopes_20 as scopes };
            }
        }
        export { services_1 as services };
    }
    namespace microsoft {
        let id_2: string;
        export { id_2 as id };
        let name_2: string;
        export { name_2 as name };
        let icon_23: string;
        export { icon_23 as icon };
        let color_2: string;
        export { color_2 as color };
        let category_2: string;
        export { category_2 as category };
        export namespace services_2 {
            export namespace outlook {
                let label_21: string;
                export { label_21 as label };
                let icon_24: string;
                export { icon_24 as icon };
                let description_21: string;
                export { description_21 as description };
                let scopes_21: string[];
                export { scopes_21 as scopes };
            }
            export namespace calendar_1 {
                let label_22: string;
                export { label_22 as label };
                let icon_25: string;
                export { icon_25 as icon };
                let description_22: string;
                export { description_22 as description };
                let scopes_22: string[];
                export { scopes_22 as scopes };
            }
            export { calendar_1 as calendar };
            export namespace onedrive {
                let label_23: string;
                export { label_23 as label };
                let icon_26: string;
                export { icon_26 as icon };
                let description_23: string;
                export { description_23 as description };
                let scopes_23: string[];
                export { scopes_23 as scopes };
            }
            export namespace teams {
                let label_24: string;
                export { label_24 as label };
                let icon_27: string;
                export { icon_27 as icon };
                let description_24: string;
                export { description_24 as description };
                let scopes_24: string[];
                export { scopes_24 as scopes };
                let businessOnly_4: boolean;
                export { businessOnly_4 as businessOnly };
            }
            export namespace todo {
                let label_25: string;
                export { label_25 as label };
                let icon_28: string;
                export { icon_28 as icon };
                let description_25: string;
                export { description_25 as description };
                let scopes_25: string[];
                export { scopes_25 as scopes };
            }
            export namespace onenote {
                let label_26: string;
                export { label_26 as label };
                let icon_29: string;
                export { icon_29 as icon };
                let description_26: string;
                export { description_26 as description };
                let scopes_26: string[];
                export { scopes_26 as scopes };
            }
            export namespace sharepoint {
                let label_27: string;
                export { label_27 as label };
                let icon_30: string;
                export { icon_30 as icon };
                let description_27: string;
                export { description_27 as description };
                let scopes_27: string[];
                export { scopes_27 as scopes };
                let businessOnly_5: boolean;
                export { businessOnly_5 as businessOnly };
            }
            export namespace azure {
                let label_28: string;
                export { label_28 as label };
                let icon_31: string;
                export { icon_31 as icon };
                let description_28: string;
                export { description_28 as description };
                let scopes_28: string[];
                export { scopes_28 as scopes };
                let businessOnly_6: boolean;
                export { businessOnly_6 as businessOnly };
            }
            export namespace powerbi {
                let label_29: string;
                export { label_29 as label };
                let icon_32: string;
                export { icon_32 as icon };
                let description_29: string;
                export { description_29 as description };
                let scopes_29: string[];
                export { scopes_29 as scopes };
                let businessOnly_7: boolean;
                export { businessOnly_7 as businessOnly };
            }
        }
        export { services_2 as services };
    }
    namespace facebook {
        let id_3: string;
        export { id_3 as id };
        let name_3: string;
        export { name_3 as name };
        let icon_33: string;
        export { icon_33 as icon };
        let color_3: string;
        export { color_3 as color };
        let category_3: string;
        export { category_3 as category };
        export namespace services_3 {
            export namespace profile {
                let label_30: string;
                export { label_30 as label };
                let icon_34: string;
                export { icon_34 as icon };
                let description_30: string;
                export { description_30 as description };
                let scopes_30: string[];
                export { scopes_30 as scopes };
            }
            export namespace pages_1 {
                let label_31: string;
                export { label_31 as label };
                let icon_35: string;
                export { icon_35 as icon };
                let description_31: string;
                export { description_31 as description };
                let scopes_31: string[];
                export { scopes_31 as scopes };
                let businessOnly_8: boolean;
                export { businessOnly_8 as businessOnly };
            }
            export { pages_1 as pages };
            export namespace ads_1 {
                let label_32: string;
                export { label_32 as label };
                let icon_36: string;
                export { icon_36 as icon };
                let description_32: string;
                export { description_32 as description };
                let scopes_32: string[];
                export { scopes_32 as scopes };
                let businessOnly_9: boolean;
                export { businessOnly_9 as businessOnly };
            }
            export { ads_1 as ads };
            export namespace groups {
                let label_33: string;
                export { label_33 as label };
                let icon_37: string;
                export { icon_37 as icon };
                let description_33: string;
                export { description_33 as description };
                let scopes_33: string[];
                export { scopes_33 as scopes };
                let businessOnly_10: boolean;
                export { businessOnly_10 as businessOnly };
            }
        }
        export { services_3 as services };
    }
    namespace instagram {
        let id_4: string;
        export { id_4 as id };
        let name_4: string;
        export { name_4 as name };
        let icon_38: string;
        export { icon_38 as icon };
        let color_4: string;
        export { color_4 as color };
        let category_4: string;
        export { category_4 as category };
        export namespace services_4 {
            namespace feed {
                let label_34: string;
                export { label_34 as label };
                let icon_39: string;
                export { icon_39 as icon };
                let description_34: string;
                export { description_34 as description };
                let scopes_34: string[];
                export { scopes_34 as scopes };
            }
            namespace insights {
                let label_35: string;
                export { label_35 as label };
                let icon_40: string;
                export { icon_40 as icon };
                let description_35: string;
                export { description_35 as description };
                let scopes_35: string[];
                export { scopes_35 as scopes };
                let businessOnly_11: boolean;
                export { businessOnly_11 as businessOnly };
            }
            namespace comments {
                let label_36: string;
                export { label_36 as label };
                let icon_41: string;
                export { icon_41 as icon };
                let description_36: string;
                export { description_36 as description };
                let scopes_36: string[];
                export { scopes_36 as scopes };
            }
        }
        export { services_4 as services };
    }
    namespace twitter {
        let id_5: string;
        export { id_5 as id };
        let name_5: string;
        export { name_5 as name };
        let icon_42: string;
        export { icon_42 as icon };
        let color_5: string;
        export { color_5 as color };
        let category_5: string;
        export { category_5 as category };
        export namespace services_5 {
            export namespace posts {
                let label_37: string;
                export { label_37 as label };
                let icon_43: string;
                export { icon_43 as icon };
                let description_37: string;
                export { description_37 as description };
                let scopes_37: string[];
                export { scopes_37 as scopes };
            }
            export namespace dm {
                let label_38: string;
                export { label_38 as label };
                let icon_44: string;
                export { icon_44 as icon };
                let description_38: string;
                export { description_38 as description };
                let scopes_38: string[];
                export { scopes_38 as scopes };
            }
            export namespace lists {
                let label_39: string;
                export { label_39 as label };
                let icon_45: string;
                export { icon_45 as icon };
                let description_39: string;
                export { description_39 as description };
                let scopes_39: string[];
                export { scopes_39 as scopes };
            }
            export namespace spaces {
                let label_40: string;
                export { label_40 as label };
                let icon_46: string;
                export { icon_46 as icon };
                let description_40: string;
                export { description_40 as description };
                let scopes_40: string[];
                export { scopes_40 as scopes };
            }
            export namespace analytics_1 {
                let label_41: string;
                export { label_41 as label };
                let icon_47: string;
                export { icon_47 as icon };
                let description_41: string;
                export { description_41 as description };
                let scopes_41: string[];
                export { scopes_41 as scopes };
            }
            export { analytics_1 as analytics };
        }
        export { services_5 as services };
    }
    namespace linkedin {
        let id_6: string;
        export { id_6 as id };
        let name_6: string;
        export { name_6 as name };
        let icon_48: string;
        export { icon_48 as icon };
        let color_6: string;
        export { color_6 as color };
        let category_6: string;
        export { category_6 as category };
        export namespace services_6 {
            export namespace profile_1 {
                let label_42: string;
                export { label_42 as label };
                let icon_49: string;
                export { icon_49 as icon };
                let description_42: string;
                export { description_42 as description };
                let scopes_42: string[];
                export { scopes_42 as scopes };
            }
            export { profile_1 as profile };
            export namespace posts_1 {
                let label_43: string;
                export { label_43 as label };
                let icon_50: string;
                export { icon_50 as icon };
                let description_43: string;
                export { description_43 as description };
                let scopes_43: string[];
                export { scopes_43 as scopes };
            }
            export { posts_1 as posts };
            export namespace company {
                let label_44: string;
                export { label_44 as label };
                let icon_51: string;
                export { icon_51 as icon };
                let description_44: string;
                export { description_44 as description };
                let scopes_44: string[];
                export { scopes_44 as scopes };
                let businessOnly_12: boolean;
                export { businessOnly_12 as businessOnly };
            }
            export namespace ads_2 {
                let label_45: string;
                export { label_45 as label };
                let icon_52: string;
                export { icon_52 as icon };
                let description_45: string;
                export { description_45 as description };
                let scopes_45: string[];
                export { scopes_45 as scopes };
                let businessOnly_13: boolean;
                export { businessOnly_13 as businessOnly };
            }
            export { ads_2 as ads };
        }
        export { services_6 as services };
    }
    namespace tiktok {
        let id_7: string;
        export { id_7 as id };
        let name_7: string;
        export { name_7 as name };
        let icon_53: string;
        export { icon_53 as icon };
        let color_7: string;
        export { color_7 as color };
        let category_7: string;
        export { category_7 as category };
        export namespace services_7 {
            export namespace videos {
                let label_46: string;
                export { label_46 as label };
                let icon_54: string;
                export { icon_54 as icon };
                let description_46: string;
                export { description_46 as description };
                let scopes_46: string[];
                export { scopes_46 as scopes };
            }
            export namespace profile_2 {
                let label_47: string;
                export { label_47 as label };
                let icon_55: string;
                export { icon_55 as icon };
                let description_47: string;
                export { description_47 as description };
                let scopes_47: string[];
                export { scopes_47 as scopes };
            }
            export { profile_2 as profile };
            export namespace insights_1 {
                let label_48: string;
                export { label_48 as label };
                let icon_56: string;
                export { icon_56 as icon };
                let description_48: string;
                export { description_48 as description };
                let scopes_48: string[];
                export { scopes_48 as scopes };
                let businessOnly_14: boolean;
                export { businessOnly_14 as businessOnly };
            }
            export { insights_1 as insights };
        }
        export { services_7 as services };
    }
    namespace pinterest {
        let id_8: string;
        export { id_8 as id };
        let name_8: string;
        export { name_8 as name };
        let icon_57: string;
        export { icon_57 as icon };
        let color_8: string;
        export { color_8 as color };
        let category_8: string;
        export { category_8 as category };
        export namespace services_8 {
            export namespace pins {
                let label_49: string;
                export { label_49 as label };
                let icon_58: string;
                export { icon_58 as icon };
                let description_49: string;
                export { description_49 as description };
                let scopes_49: string[];
                export { scopes_49 as scopes };
            }
            export namespace analytics_2 {
                let label_50: string;
                export { label_50 as label };
                let icon_59: string;
                export { icon_59 as icon };
                let description_50: string;
                export { description_50 as description };
                let scopes_50: string[];
                export { scopes_50 as scopes };
                let businessOnly_15: boolean;
                export { businessOnly_15 as businessOnly };
            }
            export { analytics_2 as analytics };
        }
        export { services_8 as services };
    }
    namespace slack {
        let id_9: string;
        export { id_9 as id };
        let name_9: string;
        export { name_9 as name };
        let icon_60: string;
        export { icon_60 as icon };
        let color_9: string;
        export { color_9 as color };
        let category_9: string;
        export { category_9 as category };
        export namespace services_9 {
            namespace messages {
                let label_51: string;
                export { label_51 as label };
                let icon_61: string;
                export { icon_61 as icon };
                let description_51: string;
                export { description_51 as description };
                let scopes_51: string[];
                export { scopes_51 as scopes };
            }
            namespace channels {
                let label_52: string;
                export { label_52 as label };
                let icon_62: string;
                export { icon_62 as icon };
                let description_52: string;
                export { description_52 as description };
                let scopes_52: string[];
                export { scopes_52 as scopes };
            }
            namespace files {
                let label_53: string;
                export { label_53 as label };
                let icon_63: string;
                export { icon_63 as icon };
                let description_53: string;
                export { description_53 as description };
                let scopes_53: string[];
                export { scopes_53 as scopes };
            }
            namespace users {
                let label_54: string;
                export { label_54 as label };
                let icon_64: string;
                export { icon_64 as icon };
                let description_54: string;
                export { description_54 as description };
                let scopes_54: string[];
                export { scopes_54 as scopes };
            }
            namespace reactions {
                let label_55: string;
                export { label_55 as label };
                let icon_65: string;
                export { icon_65 as icon };
                let description_55: string;
                export { description_55 as description };
                let scopes_55: string[];
                export { scopes_55 as scopes };
            }
            namespace workflows {
                let label_56: string;
                export { label_56 as label };
                let icon_66: string;
                export { icon_66 as icon };
                let description_56: string;
                export { description_56 as description };
                let scopes_56: string[];
                export { scopes_56 as scopes };
                let businessOnly_16: boolean;
                export { businessOnly_16 as businessOnly };
            }
        }
        export { services_9 as services };
    }
    namespace discord {
        let id_10: string;
        export { id_10 as id };
        let name_10: string;
        export { name_10 as name };
        let icon_67: string;
        export { icon_67 as icon };
        let color_10: string;
        export { color_10 as color };
        let category_10: string;
        export { category_10 as category };
        export namespace services_10 {
            export namespace messages_1 {
                let label_57: string;
                export { label_57 as label };
                let icon_68: string;
                export { icon_68 as icon };
                let description_57: string;
                export { description_57 as description };
                let scopes_57: string[];
                export { scopes_57 as scopes };
            }
            export { messages_1 as messages };
            export namespace guilds {
                let label_58: string;
                export { label_58 as label };
                let icon_69: string;
                export { icon_69 as icon };
                let description_58: string;
                export { description_58 as description };
                let scopes_58: string[];
                export { scopes_58 as scopes };
            }
            export namespace voice {
                let label_59: string;
                export { label_59 as label };
                let icon_70: string;
                export { icon_70 as icon };
                let description_59: string;
                export { description_59 as description };
                let scopes_59: string[];
                export { scopes_59 as scopes };
            }
            export namespace webhooks_1 {
                let label_60: string;
                export { label_60 as label };
                let icon_71: string;
                export { icon_71 as icon };
                let description_60: string;
                export { description_60 as description };
                let scopes_60: string[];
                export { scopes_60 as scopes };
            }
            export { webhooks_1 as webhooks };
        }
        export { services_10 as services };
    }
    namespace notion {
        let id_11: string;
        export { id_11 as id };
        let name_11: string;
        export { name_11 as name };
        let icon_72: string;
        export { icon_72 as icon };
        let color_11: string;
        export { color_11 as color };
        let category_11: string;
        export { category_11 as category };
        export namespace services_11 {
            export namespace pages_2 {
                let label_61: string;
                export { label_61 as label };
                let icon_73: string;
                export { icon_73 as icon };
                let description_61: string;
                export { description_61 as description };
                let scopes_61: string[];
                export { scopes_61 as scopes };
            }
            export { pages_2 as pages };
            export namespace databases {
                let label_62: string;
                export { label_62 as label };
                let icon_74: string;
                export { icon_74 as icon };
                let description_62: string;
                export { description_62 as description };
                let scopes_62: string[];
                export { scopes_62 as scopes };
            }
            export namespace search {
                let label_63: string;
                export { label_63 as label };
                let icon_75: string;
                export { icon_75 as icon };
                let description_63: string;
                export { description_63 as description };
                let scopes_63: string[];
                export { scopes_63 as scopes };
            }
            export namespace comments_1 {
                let label_64: string;
                export { label_64 as label };
                let icon_76: string;
                export { icon_76 as icon };
                let description_64: string;
                export { description_64 as description };
                let scopes_64: string[];
                export { scopes_64 as scopes };
            }
            export { comments_1 as comments };
        }
        export { services_11 as services };
    }
    namespace asana {
        let id_12: string;
        export { id_12 as id };
        let name_12: string;
        export { name_12 as name };
        let icon_77: string;
        export { icon_77 as icon };
        let color_12: string;
        export { color_12 as color };
        let category_12: string;
        export { category_12 as category };
        export namespace services_12 {
            export namespace tasks_1 {
                let label_65: string;
                export { label_65 as label };
                let icon_78: string;
                export { icon_78 as icon };
                let description_65: string;
                export { description_65 as description };
                let scopes_65: string[];
                export { scopes_65 as scopes };
            }
            export { tasks_1 as tasks };
            export namespace projects {
                let label_66: string;
                export { label_66 as label };
                let icon_79: string;
                export { icon_79 as icon };
                let description_66: string;
                export { description_66 as description };
                let scopes_66: string[];
                export { scopes_66 as scopes };
            }
            export namespace teams_1 {
                let label_67: string;
                export { label_67 as label };
                let icon_80: string;
                export { icon_80 as icon };
                let description_67: string;
                export { description_67 as description };
                let scopes_67: string[];
                export { scopes_67 as scopes };
                let businessOnly_17: boolean;
                export { businessOnly_17 as businessOnly };
            }
            export { teams_1 as teams };
        }
        export { services_12 as services };
    }
    namespace trello {
        let id_13: string;
        export { id_13 as id };
        let name_13: string;
        export { name_13 as name };
        let icon_81: string;
        export { icon_81 as icon };
        let color_13: string;
        export { color_13 as color };
        let category_13: string;
        export { category_13 as category };
        export namespace services_13 {
            namespace boards {
                let label_68: string;
                export { label_68 as label };
                let icon_82: string;
                export { icon_82 as icon };
                let description_68: string;
                export { description_68 as description };
                let scopes_68: string[];
                export { scopes_68 as scopes };
            }
            namespace cards {
                let label_69: string;
                export { label_69 as label };
                let icon_83: string;
                export { icon_83 as icon };
                let description_69: string;
                export { description_69 as description };
                let scopes_69: string[];
                export { scopes_69 as scopes };
            }
        }
        export { services_13 as services };
    }
    namespace zoom {
        let id_14: string;
        export { id_14 as id };
        let name_14: string;
        export { name_14 as name };
        let icon_84: string;
        export { icon_84 as icon };
        let color_14: string;
        export { color_14 as color };
        let category_14: string;
        export { category_14 as category };
        export namespace services_14 {
            export namespace meetings {
                let label_70: string;
                export { label_70 as label };
                let icon_85: string;
                export { icon_85 as icon };
                let description_70: string;
                export { description_70 as description };
                let scopes_70: string[];
                export { scopes_70 as scopes };
            }
            export namespace recordings {
                let label_71: string;
                export { label_71 as label };
                let icon_86: string;
                export { icon_86 as icon };
                let description_71: string;
                export { description_71 as description };
                let scopes_71: string[];
                export { scopes_71 as scopes };
            }
            export namespace webinars {
                let label_72: string;
                export { label_72 as label };
                let icon_87: string;
                export { icon_87 as icon };
                let description_72: string;
                export { description_72 as description };
                let scopes_72: string[];
                export { scopes_72 as scopes };
                let businessOnly_18: boolean;
                export { businessOnly_18 as businessOnly };
            }
            export namespace contacts_1 {
                let label_73: string;
                export { label_73 as label };
                let icon_88: string;
                export { icon_88 as icon };
                let description_73: string;
                export { description_73 as description };
                let scopes_73: string[];
                export { scopes_73 as scopes };
            }
            export { contacts_1 as contacts };
        }
        export { services_14 as services };
    }
    namespace gitlab {
        let id_15: string;
        export { id_15 as id };
        let name_15: string;
        export { name_15 as name };
        let icon_89: string;
        export { icon_89 as icon };
        let color_15: string;
        export { color_15 as color };
        let category_15: string;
        export { category_15 as category };
        export namespace services_15 {
            export namespace repos_1 {
                let label_74: string;
                export { label_74 as label };
                let icon_90: string;
                export { icon_90 as icon };
                let description_74: string;
                export { description_74 as description };
                let scopes_74: string[];
                export { scopes_74 as scopes };
            }
            export { repos_1 as repos };
            export namespace ci {
                let label_75: string;
                export { label_75 as label };
                let icon_91: string;
                export { icon_91 as icon };
                let description_75: string;
                export { description_75 as description };
                let scopes_75: string[];
                export { scopes_75 as scopes };
            }
            export namespace issues_1 {
                let label_76: string;
                export { label_76 as label };
                let icon_92: string;
                export { icon_92 as icon };
                let description_76: string;
                export { description_76 as description };
                let scopes_76: string[];
                export { scopes_76 as scopes };
            }
            export { issues_1 as issues };
            export namespace registry {
                let label_77: string;
                export { label_77 as label };
                let icon_93: string;
                export { icon_93 as icon };
                let description_77: string;
                export { description_77 as description };
                let scopes_77: string[];
                export { scopes_77 as scopes };
            }
        }
        export { services_15 as services };
    }
    namespace bitbucket {
        let id_16: string;
        export { id_16 as id };
        let name_16: string;
        export { name_16 as name };
        let icon_94: string;
        export { icon_94 as icon };
        let color_16: string;
        export { color_16 as color };
        let category_16: string;
        export { category_16 as category };
        export namespace services_16 {
            export namespace repos_2 {
                let label_78: string;
                export { label_78 as label };
                let icon_95: string;
                export { icon_95 as icon };
                let description_78: string;
                export { description_78 as description };
                let scopes_78: string[];
                export { scopes_78 as scopes };
            }
            export { repos_2 as repos };
            export namespace pipelines {
                let label_79: string;
                export { label_79 as label };
                let icon_96: string;
                export { icon_96 as icon };
                let description_79: string;
                export { description_79 as description };
                let scopes_79: string[];
                export { scopes_79 as scopes };
            }
            export namespace pullreqs {
                let label_80: string;
                export { label_80 as label };
                let icon_97: string;
                export { icon_97 as icon };
                let description_80: string;
                export { description_80 as description };
                let scopes_80: string[];
                export { scopes_80 as scopes };
            }
        }
        export { services_16 as services };
    }
    namespace jira {
        let id_17: string;
        export { id_17 as id };
        let name_17: string;
        export { name_17 as name };
        let icon_98: string;
        export { icon_98 as icon };
        let color_17: string;
        export { color_17 as color };
        let category_17: string;
        export { category_17 as category };
        export namespace services_17 {
            export namespace issues_2 {
                let label_81: string;
                export { label_81 as label };
                let icon_99: string;
                export { icon_99 as icon };
                let description_81: string;
                export { description_81 as description };
                let scopes_81: string[];
                export { scopes_81 as scopes };
            }
            export { issues_2 as issues };
            export namespace boards_1 {
                let label_82: string;
                export { label_82 as label };
                let icon_100: string;
                export { icon_100 as icon };
                let description_82: string;
                export { description_82 as description };
                let scopes_82: string[];
                export { scopes_82 as scopes };
            }
            export { boards_1 as boards };
            export namespace sprints {
                let label_83: string;
                export { label_83 as label };
                let icon_101: string;
                export { icon_101 as icon };
                let description_83: string;
                export { description_83 as description };
                let scopes_83: string[];
                export { scopes_83 as scopes };
            }
            export namespace reports {
                let label_84: string;
                export { label_84 as label };
                let icon_102: string;
                export { icon_102 as icon };
                let description_84: string;
                export { description_84 as description };
                let scopes_84: string[];
                export { scopes_84 as scopes };
                let businessOnly_19: boolean;
                export { businessOnly_19 as businessOnly };
            }
        }
        export { services_17 as services };
    }
    namespace vercel {
        let id_18: string;
        export { id_18 as id };
        let name_18: string;
        export { name_18 as name };
        let icon_103: string;
        export { icon_103 as icon };
        let color_18: string;
        export { color_18 as color };
        let category_18: string;
        export { category_18 as category };
        export namespace services_18 {
            namespace deployments {
                let label_85: string;
                export { label_85 as label };
                let icon_104: string;
                export { icon_104 as icon };
                let description_85: string;
                export { description_85 as description };
                let scopes_85: string[];
                export { scopes_85 as scopes };
            }
            namespace domains {
                let label_86: string;
                export { label_86 as label };
                let icon_105: string;
                export { icon_105 as icon };
                let description_86: string;
                export { description_86 as description };
                let scopes_86: string[];
                export { scopes_86 as scopes };
            }
            namespace env {
                let label_87: string;
                export { label_87 as label };
                let icon_106: string;
                export { icon_106 as icon };
                let description_87: string;
                export { description_87 as description };
                let scopes_87: string[];
                export { scopes_87 as scopes };
            }
        }
        export { services_18 as services };
    }
    namespace netlify {
        let id_19: string;
        export { id_19 as id };
        let name_19: string;
        export { name_19 as name };
        let icon_107: string;
        export { icon_107 as icon };
        let color_19: string;
        export { color_19 as color };
        let category_19: string;
        export { category_19 as category };
        export namespace services_19 {
            namespace sites {
                let label_88: string;
                export { label_88 as label };
                let icon_108: string;
                export { icon_108 as icon };
                let description_88: string;
                export { description_88 as description };
                let scopes_88: string[];
                export { scopes_88 as scopes };
            }
            namespace forms {
                let label_89: string;
                export { label_89 as label };
                let icon_109: string;
                export { icon_109 as icon };
                let description_89: string;
                export { description_89 as description };
                let scopes_89: string[];
                export { scopes_89 as scopes };
            }
            namespace functions {
                let label_90: string;
                export { label_90 as label };
                let icon_110: string;
                export { icon_110 as icon };
                let description_90: string;
                export { description_90 as description };
                let scopes_90: string[];
                export { scopes_90 as scopes };
            }
        }
        export { services_19 as services };
    }
    namespace digitalocean {
        let id_20: string;
        export { id_20 as id };
        let name_20: string;
        export { name_20 as name };
        let icon_111: string;
        export { icon_111 as icon };
        let color_20: string;
        export { color_20 as color };
        let category_20: string;
        export { category_20 as category };
        export namespace services_20 {
            export namespace droplets {
                let label_91: string;
                export { label_91 as label };
                let icon_112: string;
                export { icon_112 as icon };
                let description_91: string;
                export { description_91 as description };
                let scopes_91: string[];
                export { scopes_91 as scopes };
            }
            export namespace kubernetes {
                let label_92: string;
                export { label_92 as label };
                let icon_113: string;
                export { icon_113 as icon };
                let description_92: string;
                export { description_92 as description };
                let scopes_92: string[];
                export { scopes_92 as scopes };
            }
            export namespace databases_1 {
                let label_93: string;
                export { label_93 as label };
                let icon_114: string;
                export { icon_114 as icon };
                let description_93: string;
                export { description_93 as description };
                let scopes_93: string[];
                export { scopes_93 as scopes };
            }
            export { databases_1 as databases };
            export namespace spaces_1 {
                let label_94: string;
                export { label_94 as label };
                let icon_115: string;
                export { icon_115 as icon };
                let description_94: string;
                export { description_94 as description };
                let scopes_94: string[];
                export { scopes_94 as scopes };
            }
            export { spaces_1 as spaces };
        }
        export { services_20 as services };
    }
    namespace salesforce {
        let id_21: string;
        export { id_21 as id };
        let name_21: string;
        export { name_21 as name };
        let icon_116: string;
        export { icon_116 as icon };
        let color_21: string;
        export { color_21 as color };
        let category_21: string;
        export { category_21 as category };
        export namespace services_21 {
            export namespace crm {
                let label_95: string;
                export { label_95 as label };
                let icon_117: string;
                export { icon_117 as icon };
                let description_95: string;
                export { description_95 as description };
                let scopes_95: string[];
                export { scopes_95 as scopes };
            }
            export namespace reports_1 {
                let label_96: string;
                export { label_96 as label };
                let icon_118: string;
                export { icon_118 as icon };
                let description_96: string;
                export { description_96 as description };
                let scopes_96: string[];
                export { scopes_96 as scopes };
            }
            export { reports_1 as reports };
            export namespace marketing {
                let label_97: string;
                export { label_97 as label };
                let icon_119: string;
                export { icon_119 as icon };
                let description_97: string;
                export { description_97 as description };
                let scopes_97: string[];
                export { scopes_97 as scopes };
                let businessOnly_20: boolean;
                export { businessOnly_20 as businessOnly };
            }
        }
        export { services_21 as services };
    }
    namespace hubspot {
        let id_22: string;
        export { id_22 as id };
        let name_22: string;
        export { name_22 as name };
        let icon_120: string;
        export { icon_120 as icon };
        let color_22: string;
        export { color_22 as color };
        let category_22: string;
        export { category_22 as category };
        export namespace services_22 {
            export namespace contacts_2 {
                let label_98: string;
                export { label_98 as label };
                let icon_121: string;
                export { icon_121 as icon };
                let description_98: string;
                export { description_98 as description };
                let scopes_98: string[];
                export { scopes_98 as scopes };
            }
            export { contacts_2 as contacts };
            export namespace deals {
                let label_99: string;
                export { label_99 as label };
                let icon_122: string;
                export { icon_122 as icon };
                let description_99: string;
                export { description_99 as description };
                let scopes_99: string[];
                export { scopes_99 as scopes };
            }
            export namespace email {
                let label_100: string;
                export { label_100 as label };
                let icon_123: string;
                export { icon_123 as icon };
                let description_100: string;
                export { description_100 as description };
                let scopes_100: string[];
                export { scopes_100 as scopes };
                let businessOnly_21: boolean;
                export { businessOnly_21 as businessOnly };
            }
            export namespace tickets {
                let label_101: string;
                export { label_101 as label };
                let icon_124: string;
                export { icon_124 as icon };
                let description_101: string;
                export { description_101 as description };
                let scopes_101: string[];
                export { scopes_101 as scopes };
            }
        }
        export { services_22 as services };
    }
    namespace shopify {
        let id_23: string;
        export { id_23 as id };
        let name_23: string;
        export { name_23 as name };
        let icon_125: string;
        export { icon_125 as icon };
        let color_23: string;
        export { color_23 as color };
        let category_23: string;
        export { category_23 as category };
        export namespace services_23 {
            export namespace products {
                let label_102: string;
                export { label_102 as label };
                let icon_126: string;
                export { icon_126 as icon };
                let description_102: string;
                export { description_102 as description };
                let scopes_102: string[];
                export { scopes_102 as scopes };
            }
            export namespace orders {
                let label_103: string;
                export { label_103 as label };
                let icon_127: string;
                export { icon_127 as icon };
                let description_103: string;
                export { description_103 as description };
                let scopes_103: string[];
                export { scopes_103 as scopes };
            }
            export namespace customers {
                let label_104: string;
                export { label_104 as label };
                let icon_128: string;
                export { icon_128 as icon };
                let description_104: string;
                export { description_104 as description };
                let scopes_104: string[];
                export { scopes_104 as scopes };
            }
            export namespace analytics_3 {
                let label_105: string;
                export { label_105 as label };
                let icon_129: string;
                export { icon_129 as icon };
                let description_105: string;
                export { description_105 as description };
                let scopes_105: string[];
                export { scopes_105 as scopes };
            }
            export { analytics_3 as analytics };
            export namespace themes {
                let label_106: string;
                export { label_106 as label };
                let icon_130: string;
                export { icon_130 as icon };
                let description_106: string;
                export { description_106 as description };
                let scopes_106: string[];
                export { scopes_106 as scopes };
            }
        }
        export { services_23 as services };
    }
    namespace stripe {
        let id_24: string;
        export { id_24 as id };
        let name_24: string;
        export { name_24 as name };
        let icon_131: string;
        export { icon_131 as icon };
        let color_24: string;
        export { color_24 as color };
        let category_24: string;
        export { category_24 as category };
        export namespace services_24 {
            export namespace payments {
                let label_107: string;
                export { label_107 as label };
                let icon_132: string;
                export { icon_132 as icon };
                let description_107: string;
                export { description_107 as description };
                let scopes_107: string[];
                export { scopes_107 as scopes };
            }
            export namespace customers_1 {
                let label_108: string;
                export { label_108 as label };
                let icon_133: string;
                export { icon_133 as icon };
                let description_108: string;
                export { description_108 as description };
                let scopes_108: string[];
                export { scopes_108 as scopes };
            }
            export { customers_1 as customers };
            export namespace invoices {
                let label_109: string;
                export { label_109 as label };
                let icon_134: string;
                export { icon_134 as icon };
                let description_109: string;
                export { description_109 as description };
                let scopes_109: string[];
                export { scopes_109 as scopes };
            }
            export namespace subs {
                let label_110: string;
                export { label_110 as label };
                let icon_135: string;
                export { icon_135 as icon };
                let description_110: string;
                export { description_110 as description };
                let scopes_110: string[];
                export { scopes_110 as scopes };
            }
            export namespace reports_2 {
                let label_111: string;
                export { label_111 as label };
                let icon_136: string;
                export { icon_136 as icon };
                let description_111: string;
                export { description_111 as description };
                let scopes_111: string[];
                export { scopes_111 as scopes };
            }
            export { reports_2 as reports };
        }
        export { services_24 as services };
    }
    namespace quickbooks {
        let id_25: string;
        export { id_25 as id };
        let name_25: string;
        export { name_25 as name };
        let icon_137: string;
        export { icon_137 as icon };
        let color_25: string;
        export { color_25 as color };
        let category_25: string;
        export { category_25 as category };
        export namespace services_25 {
            export namespace accounting {
                let label_112: string;
                export { label_112 as label };
                let icon_138: string;
                export { icon_138 as icon };
                let description_112: string;
                export { description_112 as description };
                let scopes_112: string[];
                export { scopes_112 as scopes };
            }
            export namespace payments_1 {
                let label_113: string;
                export { label_113 as label };
                let icon_139: string;
                export { icon_139 as icon };
                let description_113: string;
                export { description_113 as description };
                let scopes_113: string[];
                export { scopes_113 as scopes };
            }
            export { payments_1 as payments };
            export namespace reports_3 {
                let label_114: string;
                export { label_114 as label };
                let icon_140: string;
                export { icon_140 as icon };
                let description_114: string;
                export { description_114 as description };
                let scopes_114: string[];
                export { scopes_114 as scopes };
            }
            export { reports_3 as reports };
        }
        export { services_25 as services };
    }
    namespace mailchimp {
        let id_26: string;
        export { id_26 as id };
        let name_26: string;
        export { name_26 as name };
        let icon_141: string;
        export { icon_141 as icon };
        let color_26: string;
        export { color_26 as color };
        let category_26: string;
        export { category_26 as category };
        export namespace services_26 {
            export namespace lists_1 {
                let label_115: string;
                export { label_115 as label };
                let icon_142: string;
                export { icon_142 as icon };
                let description_115: string;
                export { description_115 as description };
                let scopes_115: string[];
                export { scopes_115 as scopes };
            }
            export { lists_1 as lists };
            export namespace campaigns {
                let label_116: string;
                export { label_116 as label };
                let icon_143: string;
                export { icon_143 as icon };
                let description_116: string;
                export { description_116 as description };
                let scopes_116: string[];
                export { scopes_116 as scopes };
            }
            export namespace analytics_4 {
                let label_117: string;
                export { label_117 as label };
                let icon_144: string;
                export { icon_144 as icon };
                let description_117: string;
                export { description_117 as description };
                let scopes_117: string[];
                export { scopes_117 as scopes };
            }
            export { analytics_4 as analytics };
            export namespace automations {
                let label_118: string;
                export { label_118 as label };
                let icon_145: string;
                export { icon_145 as icon };
                let description_118: string;
                export { description_118 as description };
                let scopes_118: string[];
                export { scopes_118 as scopes };
            }
        }
        export { services_26 as services };
    }
    namespace dropbox {
        let id_27: string;
        export { id_27 as id };
        let name_27: string;
        export { name_27 as name };
        let icon_146: string;
        export { icon_146 as icon };
        let color_27: string;
        export { color_27 as color };
        let category_27: string;
        export { category_27 as category };
        export namespace services_27 {
            export namespace files_1 {
                let label_119: string;
                export { label_119 as label };
                let icon_147: string;
                export { icon_147 as icon };
                let description_119: string;
                export { description_119 as description };
                let scopes_119: string[];
                export { scopes_119 as scopes };
            }
            export { files_1 as files };
            export namespace sharing {
                let label_120: string;
                export { label_120 as label };
                let icon_148: string;
                export { icon_148 as icon };
                let description_120: string;
                export { description_120 as description };
                let scopes_120: string[];
                export { scopes_120 as scopes };
            }
            export namespace paper {
                let label_121: string;
                export { label_121 as label };
                let icon_149: string;
                export { icon_149 as icon };
                let description_121: string;
                export { description_121 as description };
                let scopes_121: string[];
                export { scopes_121 as scopes };
            }
        }
        export { services_27 as services };
    }
    namespace box {
        let id_28: string;
        export { id_28 as id };
        let name_28: string;
        export { name_28 as name };
        let icon_150: string;
        export { icon_150 as icon };
        let color_28: string;
        export { color_28 as color };
        let category_28: string;
        export { category_28 as category };
        export namespace services_28 {
            export namespace files_2 {
                let label_122: string;
                export { label_122 as label };
                let icon_151: string;
                export { icon_151 as icon };
                let description_122: string;
                export { description_122 as description };
                let scopes_122: string[];
                export { scopes_122 as scopes };
            }
            export { files_2 as files };
            export namespace collab {
                let label_123: string;
                export { label_123 as label };
                let icon_152: string;
                export { icon_152 as icon };
                let description_123: string;
                export { description_123 as description };
                let scopes_123: string[];
                export { scopes_123 as scopes };
                let businessOnly_22: boolean;
                export { businessOnly_22 as businessOnly };
            }
        }
        export { services_28 as services };
    }
    namespace spotify {
        let id_29: string;
        export { id_29 as id };
        let name_29: string;
        export { name_29 as name };
        let icon_153: string;
        export { icon_153 as icon };
        let color_29: string;
        export { color_29 as color };
        let category_29: string;
        export { category_29 as category };
        export namespace services_29 {
            namespace playback {
                let label_124: string;
                export { label_124 as label };
                let icon_154: string;
                export { icon_154 as icon };
                let description_124: string;
                export { description_124 as description };
                let scopes_124: string[];
                export { scopes_124 as scopes };
            }
            namespace library {
                let label_125: string;
                export { label_125 as label };
                let icon_155: string;
                export { icon_155 as icon };
                let description_125: string;
                export { description_125 as description };
                let scopes_125: string[];
                export { scopes_125 as scopes };
            }
            namespace playlists {
                let label_126: string;
                export { label_126 as label };
                let icon_156: string;
                export { icon_156 as icon };
                let description_126: string;
                export { description_126 as description };
                let scopes_126: string[];
                export { scopes_126 as scopes };
            }
            namespace stats {
                let label_127: string;
                export { label_127 as label };
                let icon_157: string;
                export { icon_157 as icon };
                let description_127: string;
                export { description_127 as description };
                let scopes_127: string[];
                export { scopes_127 as scopes };
            }
        }
        export { services_29 as services };
    }
    namespace twilio {
        let id_30: string;
        export { id_30 as id };
        let name_30: string;
        export { name_30 as name };
        let icon_158: string;
        export { icon_158 as icon };
        let color_30: string;
        export { color_30 as color };
        let category_30: string;
        export { category_30 as category };
        export namespace services_30 {
            export namespace sms {
                let label_128: string;
                export { label_128 as label };
                let icon_159: string;
                export { icon_159 as icon };
                let description_128: string;
                export { description_128 as description };
                let scopes_128: string[];
                export { scopes_128 as scopes };
            }
            export namespace voice_1 {
                let label_129: string;
                export { label_129 as label };
                let icon_160: string;
                export { icon_160 as icon };
                let description_129: string;
                export { description_129 as description };
                let scopes_129: string[];
                export { scopes_129 as scopes };
            }
            export { voice_1 as voice };
            export namespace whatsapp {
                let label_130: string;
                export { label_130 as label };
                let icon_161: string;
                export { icon_161 as icon };
                let description_130: string;
                export { description_130 as description };
                let scopes_130: string[];
                export { scopes_130 as scopes };
            }
            export namespace verify {
                let label_131: string;
                export { label_131 as label };
                let icon_162: string;
                export { icon_162 as icon };
                let description_131: string;
                export { description_131 as description };
                let scopes_131: string[];
                export { scopes_131 as scopes };
            }
        }
        export { services_30 as services };
    }
    namespace sendgrid {
        let id_31: string;
        export { id_31 as id };
        let name_31: string;
        export { name_31 as name };
        let icon_163: string;
        export { icon_163 as icon };
        let color_31: string;
        export { color_31 as color };
        let category_31: string;
        export { category_31 as category };
        export namespace services_31 {
            export namespace email_1 {
                let label_132: string;
                export { label_132 as label };
                let icon_164: string;
                export { icon_164 as icon };
                let description_132: string;
                export { description_132 as description };
                let scopes_132: string[];
                export { scopes_132 as scopes };
            }
            export { email_1 as email };
            export namespace templates {
                let label_133: string;
                export { label_133 as label };
                let icon_165: string;
                export { icon_165 as icon };
                let description_133: string;
                export { description_133 as description };
                let scopes_133: string[];
                export { scopes_133 as scopes };
            }
            export namespace contacts_3 {
                let label_134: string;
                export { label_134 as label };
                let icon_166: string;
                export { icon_166 as icon };
                let description_134: string;
                export { description_134 as description };
                let scopes_134: string[];
                export { scopes_134 as scopes };
            }
            export { contacts_3 as contacts };
        }
        export { services_31 as services };
    }
    namespace amazon {
        let id_32: string;
        export { id_32 as id };
        let name_32: string;
        export { name_32 as name };
        let icon_167: string;
        export { icon_167 as icon };
        let color_32: string;
        export { color_32 as color };
        let category_32: string;
        export { category_32 as category };
        export namespace services_32 {
            export namespace aws {
                let label_135: string;
                export { label_135 as label };
                let icon_168: string;
                export { icon_168 as icon };
                let description_135: string;
                export { description_135 as description };
                let scopes_135: string[];
                export { scopes_135 as scopes };
                let businessOnly_23: boolean;
                export { businessOnly_23 as businessOnly };
            }
            export namespace ses {
                let label_136: string;
                export { label_136 as label };
                let icon_169: string;
                export { icon_169 as icon };
                let description_136: string;
                export { description_136 as description };
                let scopes_136: string[];
                export { scopes_136 as scopes };
                let businessOnly_24: boolean;
                export { businessOnly_24 as businessOnly };
            }
            export namespace s3 {
                let label_137: string;
                export { label_137 as label };
                let icon_170: string;
                export { icon_170 as icon };
                let description_137: string;
                export { description_137 as description };
                let scopes_137: string[];
                export { scopes_137 as scopes };
                let businessOnly_25: boolean;
                export { businessOnly_25 as businessOnly };
            }
            export namespace profile_3 {
                let label_138: string;
                export { label_138 as label };
                let icon_171: string;
                export { icon_171 as icon };
                let description_138: string;
                export { description_138 as description };
                let scopes_138: string[];
                export { scopes_138 as scopes };
            }
            export { profile_3 as profile };
        }
        export { services_32 as services };
    }
    namespace apple {
        let id_33: string;
        export { id_33 as id };
        let name_33: string;
        export { name_33 as name };
        let icon_172: string;
        export { icon_172 as icon };
        let color_33: string;
        export { color_33 as color };
        let category_33: string;
        export { category_33 as category };
        export namespace services_33 {
            namespace signin {
                let label_139: string;
                export { label_139 as label };
                let icon_173: string;
                export { icon_173 as icon };
                let description_139: string;
                export { description_139 as description };
                let scopes_139: string[];
                export { scopes_139 as scopes };
            }
            namespace musickit {
                let label_140: string;
                export { label_140 as label };
                let icon_174: string;
                export { icon_174 as icon };
                let description_140: string;
                export { description_140 as description };
                let scopes_140: string[];
                export { scopes_140 as scopes };
            }
        }
        export { services_33 as services };
    }
    namespace cloudflare {
        let id_34: string;
        export { id_34 as id };
        let name_34: string;
        export { name_34 as name };
        let icon_175: string;
        export { icon_175 as icon };
        let color_34: string;
        export { color_34 as color };
        let category_34: string;
        export { category_34 as category };
        export namespace services_34 {
            export namespace dns {
                let label_141: string;
                export { label_141 as label };
                let icon_176: string;
                export { icon_176 as icon };
                let description_141: string;
                export { description_141 as description };
                let scopes_141: string[];
                export { scopes_141 as scopes };
            }
            export namespace workers {
                let label_142: string;
                export { label_142 as label };
                let icon_177: string;
                export { icon_177 as icon };
                let description_142: string;
                export { description_142 as description };
                let scopes_142: string[];
                export { scopes_142 as scopes };
            }
            export namespace pages_3 {
                let label_143: string;
                export { label_143 as label };
                let icon_178: string;
                export { icon_178 as icon };
                let description_143: string;
                export { description_143 as description };
                let scopes_143: string[];
                export { scopes_143 as scopes };
            }
            export { pages_3 as pages };
            export namespace analytics_5 {
                let label_144: string;
                export { label_144 as label };
                let icon_179: string;
                export { icon_179 as icon };
                let description_144: string;
                export { description_144 as description };
                let scopes_144: string[];
                export { scopes_144 as scopes };
            }
            export { analytics_5 as analytics };
        }
        export { services_34 as services };
    }
    namespace openai {
        let id_35: string;
        export { id_35 as id };
        let name_35: string;
        export { name_35 as name };
        let icon_180: string;
        export { icon_180 as icon };
        let color_35: string;
        export { color_35 as color };
        let category_35: string;
        export { category_35 as category };
        export namespace services_35 {
            export namespace api {
                let label_145: string;
                export { label_145 as label };
                let icon_181: string;
                export { icon_181 as icon };
                let description_145: string;
                export { description_145 as description };
                let scopes_145: string[];
                export { scopes_145 as scopes };
            }
            export namespace assistants {
                let label_146: string;
                export { label_146 as label };
                let icon_182: string;
                export { icon_182 as icon };
                let description_146: string;
                export { description_146 as description };
                let scopes_146: string[];
                export { scopes_146 as scopes };
            }
            export namespace files_3 {
                let label_147: string;
                export { label_147 as label };
                let icon_183: string;
                export { icon_183 as icon };
                let description_147: string;
                export { description_147 as description };
                let scopes_147: string[];
                export { scopes_147 as scopes };
            }
            export { files_3 as files };
        }
        export { services_35 as services };
    }
    namespace huggingface {
        let id_36: string;
        export { id_36 as id };
        let name_36: string;
        export { name_36 as name };
        let icon_184: string;
        export { icon_184 as icon };
        let color_36: string;
        export { color_36 as color };
        let category_36: string;
        export { category_36 as category };
        export namespace services_36 {
            export namespace models {
                let label_148: string;
                export { label_148 as label };
                let icon_185: string;
                export { icon_185 as icon };
                let description_148: string;
                export { description_148 as description };
                let scopes_148: string[];
                export { scopes_148 as scopes };
            }
            export namespace spaces_2 {
                let label_149: string;
                export { label_149 as label };
                let icon_186: string;
                export { icon_186 as icon };
                let description_149: string;
                export { description_149 as description };
                let scopes_149: string[];
                export { scopes_149 as scopes };
            }
            export { spaces_2 as spaces };
            export namespace datasets {
                let label_150: string;
                export { label_150 as label };
                let icon_187: string;
                export { icon_187 as icon };
                let description_150: string;
                export { description_150 as description };
                let scopes_150: string[];
                export { scopes_150 as scopes };
            }
            export namespace inference {
                let label_151: string;
                export { label_151 as label };
                let icon_188: string;
                export { icon_188 as icon };
                let description_151: string;
                export { description_151 as description };
                let scopes_151: string[];
                export { scopes_151 as scopes };
            }
        }
        export { services_36 as services };
    }
    namespace airtable {
        let id_37: string;
        export { id_37 as id };
        let name_37: string;
        export { name_37 as name };
        let icon_189: string;
        export { icon_189 as icon };
        let color_37: string;
        export { color_37 as color };
        let category_37: string;
        export { category_37 as category };
        export namespace services_37 {
            export namespace bases {
                let label_152: string;
                export { label_152 as label };
                let icon_190: string;
                export { icon_190 as icon };
                let description_152: string;
                export { description_152 as description };
                let scopes_152: string[];
                export { scopes_152 as scopes };
            }
            export namespace automations_1 {
                let label_153: string;
                export { label_153 as label };
                let icon_191: string;
                export { icon_191 as icon };
                let description_153: string;
                export { description_153 as description };
                let scopes_153: string[];
                export { scopes_153 as scopes };
            }
            export { automations_1 as automations };
        }
        export { services_37 as services };
    }
    namespace zendesk {
        let id_38: string;
        export { id_38 as id };
        let name_38: string;
        export { name_38 as name };
        let icon_192: string;
        export { icon_192 as icon };
        let color_38: string;
        export { color_38 as color };
        let category_38: string;
        export { category_38 as category };
        export namespace services_38 {
            export namespace tickets_1 {
                let label_154: string;
                export { label_154 as label };
                let icon_193: string;
                export { icon_193 as icon };
                let description_154: string;
                export { description_154 as description };
                let scopes_154: string[];
                export { scopes_154 as scopes };
            }
            export { tickets_1 as tickets };
            export namespace users_1 {
                let label_155: string;
                export { label_155 as label };
                let icon_194: string;
                export { icon_194 as icon };
                let description_155: string;
                export { description_155 as description };
                let scopes_155: string[];
                export { scopes_155 as scopes };
            }
            export { users_1 as users };
            export namespace knowledge {
                let label_156: string;
                export { label_156 as label };
                let icon_195: string;
                export { icon_195 as icon };
                let description_156: string;
                export { description_156 as description };
                let scopes_156: string[];
                export { scopes_156 as scopes };
            }
        }
        export { services_38 as services };
    }
    namespace intercom {
        let id_39: string;
        export { id_39 as id };
        let name_39: string;
        export { name_39 as name };
        let icon_196: string;
        export { icon_196 as icon };
        let color_39: string;
        export { color_39 as color };
        let category_39: string;
        export { category_39 as category };
        export namespace services_39 {
            export namespace conversations {
                let label_157: string;
                export { label_157 as label };
                let icon_197: string;
                export { icon_197 as icon };
                let description_157: string;
                export { description_157 as description };
                let scopes_157: string[];
                export { scopes_157 as scopes };
            }
            export namespace contacts_4 {
                let label_158: string;
                export { label_158 as label };
                let icon_198: string;
                export { icon_198 as icon };
                let description_158: string;
                export { description_158 as description };
                let scopes_158: string[];
                export { scopes_158 as scopes };
            }
            export { contacts_4 as contacts };
            export namespace articles {
                let label_159: string;
                export { label_159 as label };
                let icon_199: string;
                export { icon_199 as icon };
                let description_159: string;
                export { description_159 as description };
                let scopes_159: string[];
                export { scopes_159 as scopes };
            }
        }
        export { services_39 as services };
    }
    namespace plaid {
        let id_40: string;
        export { id_40 as id };
        let name_40: string;
        export { name_40 as name };
        let icon_200: string;
        export { icon_200 as icon };
        let color_40: string;
        export { color_40 as color };
        let category_40: string;
        export { category_40 as category };
        export namespace services_40 {
            namespace accounts {
                let label_160: string;
                export { label_160 as label };
                let icon_201: string;
                export { icon_201 as icon };
                let description_160: string;
                export { description_160 as description };
                let scopes_160: string[];
                export { scopes_160 as scopes };
            }
            namespace transactions {
                let label_161: string;
                export { label_161 as label };
                let icon_202: string;
                export { icon_202 as icon };
                let description_161: string;
                export { description_161 as description };
                let scopes_161: string[];
                export { scopes_161 as scopes };
            }
            namespace identity {
                let label_162: string;
                export { label_162 as label };
                let icon_203: string;
                export { icon_203 as icon };
                let description_162: string;
                export { description_162 as description };
                let scopes_162: string[];
                export { scopes_162 as scopes };
            }
        }
        export { services_40 as services };
    }
}
export function getScopesForServices(providerId: any, serviceIds: any): any[];
export function listServices(providerId: any, opts?: {}): {
    id: string;
    label: any;
    description: any;
    icon: any;
    businessOnly: boolean;
    scopeCount: any;
}[];
export function listProviders(opts?: {}): {
    id: string;
    name: string;
    icon: string;
    color: string;
    category: string;
    serviceCount: number;
}[];
export function listCategories(): {
    id: string;
    label: string;
    providerCount: number;
}[];
//# sourceMappingURL=oauth-scopes.d.ts.map