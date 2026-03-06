const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = (env, argv) => ({
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].[contenthash:8].js',
        publicPath: 'auto',
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: { presets: ['@babel/preset-env', '@babel/preset-react'] },
                },
            },
            { test: /\.css$/, use: ['style-loader', 'css-loader'] },
        ],
    },
    resolve: { extensions: ['.js', '.jsx'] },
    plugins: [
        new HtmlWebpackPlugin({
            template: './public/index.html',
            title: 'Heady™ UI',
            meta: {
                description: 'Heady™ Micro-Frontend — Liquid Projected UI',
                viewport: 'width=device-width, initial-scale=1',
            },
        }),
        // ── Module Federation: Expose components for dynamic remote loading ──
        new ModuleFederationPlugin({
            name: 'heady_ui_vertical',
            filename: 'remoteEntry.js',
            exposes: {
                './App': './src/App',
            },
            shared: {
                react: { singleton: true, requiredVersion: '^18.0.0' },
                'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
            },
        }),
    ],
    devServer: {
        port: 3000,
        hot: true,
        historyApiFallback: true,
        headers: { 'Access-Control-Allow-Origin': '*' },
    },
    optimization: {
        splitChunks: { chunks: 'all' },
        minimize: argv.mode === 'production',
    },
});
