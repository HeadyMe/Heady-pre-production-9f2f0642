declare const _default: {
    content: string[];
    theme: {
        extend: {
            fontFamily: {
                sans: string[];
                mono: string[];
            };
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': {
                        boxShadow: string;
                    };
                    '50%': {
                        boxShadow: string;
                    };
                };
                float: {
                    '0%, 100%': {
                        transform: string;
                    };
                    '50%': {
                        transform: string;
                    };
                };
                'grid-fade': {
                    '0%': {
                        opacity: string;
                    };
                    '50%': {
                        opacity: string;
                    };
                    '100%': {
                        opacity: string;
                    };
                };
                orbit: {
                    '0%': {
                        transform: string;
                    };
                    '100%': {
                        transform: string;
                    };
                };
            };
            animation: {
                'pulse-glow': string;
                float: string;
                'grid-fade': string;
                orbit: string;
            };
        };
    };
    plugins: never[];
};
export default _default;
//# sourceMappingURL=tailwind.config.d.ts.map