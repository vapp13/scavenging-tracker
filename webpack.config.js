const path              = require('path');
const webpack           = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    const isDev = argv.mode === 'development';

    return {
        entry: './src/app.js',

        output: {
            path:     path.resolve(__dirname, 'dist'),
            filename: isDev ? 'bundle.js' : 'bundle.[contenthash:8].js',
            clean:    true,
            library:  { type: 'umd', name: 'ScavTracker' },
        },

        mode:    isDev ? 'development' : 'production',
        devtool: false,

        devServer: {
            static:  path.resolve(__dirname, 'dist'),
            port:    8080,
            hot:     true,
            open:    true,
        },

        // ── Externals ─────────────────────────────────────────────────────────
        // canvas, sharp, electron are optional peer dependencies inside alt1
        // that only apply in Node/Electron environments, not the browser.
        externals: ['sharp', 'canvas', 'electron/common'],

        // ── Resolve ───────────────────────────────────────────────────────────
        resolve: {
            extensions: ['.wasm', '.mjs', '.js', '.jsx'],

            // CRITICAL: The alt1 package uses package.json "exports" with a
            // custom "alt1-source" condition. We must tell webpack to resolve
            // the "default" condition (the compiled JS dist files).
            // Without this, webpack can't locate alt1/chatbox, alt1/base etc.
            conditionNames: ['default', 'require', 'node'],

            fallback: {
                buffer: require.resolve('buffer/'),
            },
        },

        // ── Module Rules ──────────────────────────────────────────────────────
        module: {
            rules: [
                // CSS: style-loader injects a <style> tag at runtime.
                // Triggered by: import '../style.css' in app.js
                {
                    test: /\.css$/,
                    use:  ['style-loader', 'css-loader'],
                },

                // PNG: webpack copies to dist/ and returns the output URL.
                // Triggered by: import '../icon.png' in app.js
                {
                    test: /\.(png|jpg|jpeg|gif|webp)$/,
                    type: 'asset/resource',
                    generator: { filename: '[base]' },
                },

                // appconfig.json: copied to dist/ as a static asset.
                // Triggered by: import '../appconfig.json' in app.js
                {
                    test:    /appconfig\.json$/,
                    type:    'asset/resource',
                    generator: { filename: '[base]' },
                },

                // alt1 packages ship as CJS but have ESM-style imports internally.
                // This rule prevents "fullySpecified" resolution errors.
                {
                    test:    /\.js$/,
                    include: /node_modules[\\/]alt1/,
                    resolve: { fullySpecified: false },
                },
            ],
        },

        // ── Plugins ───────────────────────────────────────────────────────────
        plugins: [
            // Buffer polyfill — alt1/base uses Buffer in the browser bundle
            new webpack.ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
            }),

            // NODE_ENV — allows tree-shaking of ScavDev dev helpers in prod
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': JSON.stringify(
                    isDev ? 'development' : 'production'
                ),
            }),

            // Inject hashed bundle filename into index.html automatically
            new HtmlWebpackPlugin({
                template: './index.html',
                filename: 'index.html',
                inject:   'body',
            }),
        ],

        performance: {
            hints:            isDev ? false : 'warning',
            maxAssetSize:      1_200_000,
            maxEntrypointSize: 1_200_000,
        },
    };
};