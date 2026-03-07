/**
 * HeadyWeb Universal Shell — Webpack 5 Configuration
 * Supports both host (shell) and remote (micro-frontend) builds via env flags.
 *
 * Usage:
 *   Host build:   webpack --env host
 *   Remote build: webpack --env remote --env appName=<scopeName>
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

/**
 * Registry of all micro-frontend remotes exposed by the shell.
 * Each entry maps a logical name to its Module Federation scope and exposed module.
 * @type {Record<string, {scope: string, module: string, exposes: string}>}
 */
const REMOTE_CONFIG = {
  antigravity: {
    scope: 'antigravity',
    module: './App',
    exposes: './remotes/antigravity/src',
  },
  landing: {
    scope: 'headyLanding',
    module: './App',
    exposes: './remotes/landing/src',
  },
  'heady-ide': {
    scope: 'headyIDE',
    module: './App',
    exposes: './remotes/heady-ide/src',
  },
  'swarm-dashboard': {
    scope: 'swarmDashboard',
    module: './App',
    exposes: './remotes/swarm-dashboard/src',
  },
  'governance-panel': {
    scope: 'governancePanel',
    module: './App',
    exposes: './remotes/governance-panel/src',
  },
  'projection-monitor': {
    scope: 'projectionMonitor',
    module: './App',
    exposes: './remotes/projection-monitor/src',
  },
  'vector-explorer': {
    scope: 'vectorExplorer',
    module: './App',
    exposes: './remotes/vector-explorer/src',
  },
};

/**
 * Build the Module Federation remotes map for the host shell.
 * Each remote is configured for dynamic loading at runtime, so we use
 * a promise-based remote entry pattern.
 * @returns {Record<string, string>}
 */
function buildHostRemotes() {
  const remotes = {};
  for (const [name, cfg] of Object.entries(REMOTE_CONFIG)) {
    const urlVar = `HEADY_REMOTE_${name.toUpperCase().replace(/-/g, '_')}_URL`;
    remotes[cfg.scope] = `promise new Promise((resolve, reject) => {
      const url = window.__HEADY_REMOTES__?.['${name}'] || '/remotes/${name}/remoteEntry.js';
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => resolve(window['${cfg.scope}']);
      script.onerror = (err) => reject(new Error('Failed to load remote: ${name} from ' + url));
      document.head.appendChild(script);
    })`;
  }
  return remotes;
}

/**
 * Build the exposes map for a single remote/micro-frontend build.
 * @param {string} appName - The logical remote name (e.g. 'antigravity')
 * @returns {Record<string, string>}
 */
function buildRemoteExposes(appName) {
  return {
    './App': `./remotes/${appName}/src/App.js`,
    './mount': `./remotes/${appName}/src/mount.js`,
  };
}

/**
 * Main Webpack configuration factory.
 * @param {object} env - Webpack env flags
 * @param {boolean} env.host - Build the shell host
 * @param {boolean} env.remote - Build a micro-frontend remote
 * @param {string} [env.appName] - Remote app name (required when env.remote is true)
 * @param {object} argv - Webpack argv
 * @returns {import('webpack').Configuration}
 */
module.exports = (env = {}, argv = {}) => {
  const isHost = Boolean(env.host);
  const isRemote = Boolean(env.remote);
  const appName = env.appName || null;
  const isDev = argv.mode === 'development' || process.env.NODE_ENV === 'development';

  if (isRemote && !appName) {
    throw new Error('--env appName=<name> is required when building a remote');
  }

  const remoteCfg = appName ? REMOTE_CONFIG[appName] : null;
  if (isRemote && !remoteCfg) {
    throw new Error(`Unknown remote app name: "${appName}". Valid names: ${Object.keys(REMOTE_CONFIG).join(', ')}`);
  }

  /** @type {import('webpack').Configuration} */
  const config = {
    mode: isDev ? 'development' : 'production',

    entry: isHost
      ? './src/shell/index.js'
      : `./remotes/${appName}/src/bootstrap.js`,

    output: {
      path: isHost
        ? path.resolve(__dirname, 'dist')
        : path.resolve(__dirname, `dist/remotes/${appName}`),
      filename: isHost ? 'shell.[contenthash].js' : '[name].[contenthash].js',
      publicPath: isHost ? '/' : `/remotes/${appName}/`,
      clean: true,
      uniqueName: isHost ? 'headyShell' : remoteCfg?.scope,
    },

    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      alias: {
        '@heady/shell': path.resolve(__dirname, 'src/shell'),
        '@heady/services': path.resolve(__dirname, 'src/services'),
      },
    },

    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: '> 0.5%, last 2 versions, not dead',
                  useBuiltIns: 'usage',
                  corejs: 3,
                }],
              ],
              cacheDirectory: true,
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
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
        },
      ],
    },

    plugins: [
      new ModuleFederationPlugin(
        isHost
          ? {
              name: 'headyShell',
              remotes: buildHostRemotes(),
              shared: {
                three: { singleton: true, requiredVersion: '^0.163.0' },
              },
            }
          : {
              name: remoteCfg.scope,
              filename: 'remoteEntry.js',
              exposes: buildRemoteExposes(appName),
              shared: {
                three: { singleton: true, requiredVersion: '^0.163.0' },
              },
            }
      ),
      ...(isHost
        ? [
            new HtmlWebpackPlugin({
              template: './src/shell/index.html',
              filename: 'index.html',
              title: 'HeadyWeb — Universal Shell v3.1.0',
              inject: 'body',
              minify: !isDev,
            }),
          ]
        : []),
    ],

    devServer: isHost
      ? {
          port: 3000,
          historyApiFallback: true,
          hot: true,
          open: true,
          static: [
            { directory: path.resolve(__dirname, 'dist'), publicPath: '/' },
          ],
          proxy: [
            {
              context: ['/api'],
              target: 'http://localhost:8080',
              changeOrigin: true,
            },
          ],
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      : undefined,

    devtool: isDev ? 'eval-source-map' : 'source-map',

    optimization: {
      splitChunks: isHost
        ? {
            chunks: 'all',
            cacheGroups: {
              vendors: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
              },
            },
          }
        : false,
    },

    performance: {
      hints: isDev ? false : 'warning',
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
  };

  return config;
};
