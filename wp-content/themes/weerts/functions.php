<?php

use Timber\Site;
use Timber\Timber;

/**
 * Bootstrap Timber when it is installed through Composer in the theme.
 */
$composer_autoload = __DIR__ . '/vendor/autoload.php';
if (file_exists($composer_autoload)) {
    require_once $composer_autoload;
    Timber::init();
}

if (!class_exists(Timber::class)) {
    add_action(
        'admin_notices',
        function (): void {
            printf(
                '<div class="error"><p>%s</p></div>',
                wp_kses_post(
                    __('Timber is not available. Run composer install in the theme or activate the Timber plugin.', 'rural-boilerplate')
                )
            );
        }
    );

    add_filter(
        'template_include',
        function (): string {
            return get_stylesheet_directory() . '/static/no-timber.html';
        }
    );

    return;
}

Timber::$dirname = ['templates'];

/**
 * Sets up the shared Timber site configuration.
 */
class RuralBoilerplateSite extends Site
{
    /**
     * Registers theme hooks.
     */
    public function __construct()
    {
        add_action('after_setup_theme', [$this, 'theme_supports']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_filter('timber/context', [$this, 'add_to_context']);

        parent::__construct();
    }

    /**
     * Adds shared data to every Twig template.
     *
     * @param array<string, mixed> $context Timber context values.
     * @return array<string, mixed>
     */
    public function add_to_context(array $context): array
    {
        $context['site'] = $this;
        $context['menu'] = Timber::get_menu('primary');
        $context['footer_menu'] = Timber::get_menu('footer');

        return $context;
    }

    /**
     * Enqueues the compiled front-end assets when they exist.
     */
    public function enqueue_assets(): void
    {
        $theme_path = get_stylesheet_directory();
        $theme_uri = get_stylesheet_directory_uri();
        $style_path = $theme_path . '/static/style.css';
        $script_path = $theme_path . '/static/site.js';

        if (file_exists($style_path)) {
            wp_enqueue_style(
                'rural-boilerplate-theme',
                $theme_uri . '/static/style.css',
                [],
                (string) filemtime($style_path)
            );
        }

        if (file_exists($script_path)) {
            wp_enqueue_script(
                'rural-boilerplate-theme',
                $theme_uri . '/static/site.js',
                [],
                (string) filemtime($script_path),
                true
            );
        }
    }

    /**
     * Registers theme features and navigation menus.
     */
    public function theme_supports(): void
    {
        add_theme_support('title-tag');
        add_theme_support('post-thumbnails');
        add_theme_support('menus');
        add_theme_support('align-wide');
        add_theme_support(
            'html5',
            ['comment-list', 'comment-form', 'search-form', 'gallery', 'caption', 'style', 'script']
        );

        register_nav_menus(
            [
                'primary' => __('Primary Menu', 'rural-boilerplate'),
                'footer' => __('Footer Menu', 'rural-boilerplate'),
            ]
        );

        add_theme_support('editor-styles');
        add_editor_style('static/editor.css');
    }
}

new RuralBoilerplateSite();
