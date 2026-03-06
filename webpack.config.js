/**
 * ═══════════════════════════════════════════════════════════════
 * Webpack Module Federation Configuration
 * ═══════════════════════════════════════════════════════════════
 *
 * Enables the HeadyWeb Universal Shell to dynamically load
 * micro-frontend UIs at runtime. Each registered app in the
 * UI Registry can be independently built and deployed, then
 * loaded by the shell via Module Federation.
 *
 * Host: HeadyWeb Shell (loads remotes dynamically)
 * Remotes: Antigravity, HeadyIDE, SwarmDashboard, etc.
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = (env = {}) => {
    const isRemote = env.remote || false;
    const appName = env.appName || 'headyShell';
    const port = env.port || 3000;

    return {
        mode: env.production ? 'production' : 'development',
        devtool: env.production ? 'source-map' : 'eval-cheap-module-source-map',

        entry: isRemote ? './src/bootstrap.js' : './src/shell/index.js',

        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: '[name].[contenthash:8].js',
            publicPath: 'auto',
            clean: true,
        },

        resolve: {
            extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
            alias: {
                '@heady': path.resolve(__dirname, 'src'),
                '@services': path.resolve(__dirname, 'src/services'),
                '@bees': path.resolve(__dirname, 'src/bees'),
                '@ui': path.resolve(__dirname, 'src/ui'),
            },
        },

        module: {
            rules: [
                {
                    test: /\.(js|jsx|ts|tsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ['@babel/preset-env', { targets: { esmodules: true } }],
                            ],
                        },
                    },
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'],
                },
                {
                    test: /\.(png|svg|jpg|jpeg|gif|webp)$/i,
                    type: 'asset/resource',
                },
            ],
        },

        plugins: [
            new ModuleFederationPlugin(
                isRemote
                    ? {
                        // ─── Remote App Config ───────────────────────
                        name: appName,
                        filename: 'remoteEntry.js',
                        exposes: {
                            './App': './src/App',
                            './mount': './src/mount',
                        },
                        shared: {
                            'three': { singleton: true, requiredVersion: '>=0.160.0' },
                        },
                    }
                    : {
                        // ─── Host Shell Config ───────────────────────
                        name: 'headyShell',
                        remotes: {
                            // Dynamic remotes loaded at runtime via loadDynamicRemote()
                            // Static fallbacks can be declared here:
                            // antigravity: 'antigravity@/remotes/antigravity/remoteEntry.js',
                        },
                        shared: {
                            'three': { singleton: true, requiredVersion: '>=0.160.0' },
                        },
                    }
            ),

            new HtmlWebpackPlugin({
                template: './src/shell/index.html',
                title: 'HeadyWeb — Universal Shell',
                meta: {
                    viewport: 'width=device-width, initial-scale=1',
                    description: 'Heady™ Autonomous Multi-Agent Platform',
                },
            }),
        ],

        devServer: {
            port,
            hot: true,
            historyApiFallback: true,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        },

        optimization: {
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendors',
                        chunks: 'all',
                    },
                },
            },
        },
    };
};
