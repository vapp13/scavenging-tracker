const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
    const isDev = argv.mode === 'development';

    return {
        entry: './src/app.js',

        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: isDev ? 'bundle.js' : 'bundle.[contenthash:8].js',
            clean: true,
        },

        mode: isDev ? 'development' : 'production',
        devtool: isDev ? 'inline-source-map' : false,

        devServer: {
            static: path.resolve(__dirname, 'dist'),
            port: 8080,
            hot: true,
            open: true,
        },

        module: {
            rules: [
                { test: /\.tsx?$/, loader: "ts-loader" },
                { test: /\.css$/, use: ["style-loader", "css-loader"] },
                { test: /\.scss$/, use: ["style-loader", "css-loader", "sass-loader"] },
                { test: /\.(png|jpg|jpeg|gif|webp)$/, type: "asset/resource", generator: { filename: "[base]" } },
                { test: /\.(html|json)$/, type: "asset/resource", generator: { filename: "[base]" } },
                { test: /\.data\.png$/, loader: "alt1/imagedata-loader", type: "javascript/auto" },
                { test: /\.fontmeta.json/, loader: "alt1/font-loader" }
            ],
        },

        resolve: {
            extensions: ['.js', '.ts'],
            fallback: {
                // Browser polyfill for Buffer (used by alt1/base)
                buffer: require.resolve('buffer/'),
                // Node built-ins — not needed in browser
                process: false,
                util: false,
                path: false,
                fs: false,
                // Native image libs — alt1/base tries to require these in
                // Node environments but doesn't need them in the browser
                canvas: false,
                sharp: false,
            },
        },

        plugins: [
            // Silence the "can't resolve" warnings for Node-only optional deps
            // that alt1/base conditionally imports (canvas, sharp, electron)
            new webpack.IgnorePlugin({
                resourceRegExp: /^(canvas|sharp|electron(\/.*)?|node-fetch)$/,
            }),

            // Make Buffer available globally (required by alt1/base)
            new webpack.ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
            }),

            // Replace process.env.NODE_ENV so ScavDev helpers are
            // tree-shaken out of the production build
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': JSON.stringify(
                    isDev ? 'development' : 'production'
                ),
            }),

            new HtmlWebpackPlugin({
                template: './index.html',
                filename: 'index.html',
                inject: 'body',
            }),

            new CopyWebpackPlugin({
                patterns: [
                    { from: 'style.css', to: 'style.css' },
                    { from: 'appconfig.json', to: 'appconfig.json' },
                    { from: 'icon.png', to: 'icon.png', noErrorOnMissing: true },
                ],
            }),
        ],

        performance: {
            hints: isDev ? false : 'warning',
            maxAssetSize: 1_200_000,
            maxEntrypointSize: 1_200_000,
        },
    };
};