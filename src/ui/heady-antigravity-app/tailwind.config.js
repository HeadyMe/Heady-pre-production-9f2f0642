/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 8px rgba(16,185,129,0.6)' },
                    '50%': { boxShadow: '0 0 20px rgba(16,185,129,0.8)' },
                },
                'float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-8px)' },
                },
                'grid-fade': {
                    '0%': { opacity: '0.1' },
                    '50%': { opacity: '0.3' },
                    '100%': { opacity: '0.1' },
                },
                'orbit': {
                    '0%': { transform: 'rotate(0deg) translateX(60px) rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg) translateX(60px) rotate(-360deg)' },
                },
            },
            animation: {
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'float': 'float 3s ease-in-out infinite',
                'grid-fade': 'grid-fade 4s ease-in-out infinite',
                'orbit': 'orbit 8s linear infinite',
            },
        },
    },
    plugins: [],
}
