/**
 * Template Webpack Configuration
 *
 * Extends @wordpress/scripts default webpack config, which provides:
 * - TypeScript/JSX compilation
 * - CSS/Sass processing with MiniCssExtractPlugin
 * - WordPress dependency extraction (.asset.php files)
 * - Source map generation in development mode
 *
 * Additional plugins:
 * - RemoveEmptyScriptsPlugin: CSS-only entries (like style.scss) generate
 *   empty .js files by default. This plugin removes those empty files.
 * - WebpackRTLPlugin: Generates mirrored RTL stylesheets (e.g., style-rtl.css)
 *   for right-to-left language support (Arabic, Hebrew, etc.)
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const RemoveEmptyScriptsPlugin = require( 'webpack-remove-empty-scripts' );
const WebpackRTLPlugin = require( 'webpack-rtl-plugin' );

module.exports = {
    ...defaultConfig,
    ...{
        plugins: [
            ...defaultConfig.plugins,
            new RemoveEmptyScriptsPlugin(),
            new WebpackRTLPlugin( {
                filename: '[name]-rtl.css',
            } ),
        ],
    },
};
