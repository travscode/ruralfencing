<?php

use Timber\Site;
use Timber\Timber;

/**
 * Timber BlankSlate-theme
 * https://github.com/timber/BlankSlate-theme
 *
 * @package  WordPress
 * @subpackage  Timber
 * @since   Timber 0.1
 */

/**
 * If you are installing Timber as a Composer dependency in your theme, you'll need this block
 * to load your dependencies and initialize Timber. If you are using Timber via the WordPress.org
 * plug-in, you can safely delete this block.
 */
$composer_autoload = __DIR__ . '/vendor/autoload.php';
if (file_exists($composer_autoload)) {
	require_once $composer_autoload;
	Timber::init();
}

include 'php/tiny-mce-extend.php';
include 'php/admin-columns.php';
include 'php/get-posts.php';
include 'php/post-api.php';
include 'php/media-library-extend.php';
include 'php/gravity-forms.php';
include 'php/contact-form.php';
include 'php/post-rewrite.php';


/**
 * Include helpers
 */
$helpers = glob(__DIR__ . '/helpers/*/*.php');
foreach ($helpers as $helper) {
	if (file_exists($helper)) {
		include_once $helper;
	}
}

/**
 * Setup our custom options page
 */
if (function_exists('acf_add_options_page')) {
	acf_add_options_page(array(
		'page_title' 	=> 'Site Settings',
		'menu_title'	=> 'Site Settings',
		'menu_slug' 	=> 'site-settings',
		'capability'	=> 'edit_posts',
		'redirect'		=> false
	));
}

/**
 * This ensures that Timber is loaded and available as a PHP class.
 * If not, it gives an error message to help direct developers on where to activate
 */
if (!class_exists('Timber')) {

	add_action(
		'admin_notices',
		function () {
			echo '<div class="error"><p>Timber not activated. Make sure you activate the plugin in <a href="' . esc_url(admin_url('plugins.php#timber')) . '">' . esc_url(admin_url('plugins.php')) . '</a></p></div>';
		}
	);

	add_filter(
		'template_include',
		function ($template) {
			return get_stylesheet_directory() . '/static/no-timber.html';
		}
	);
	return;
}

/**
 * Sets the directories (inside your theme) to find .twig files
 */
Timber::$dirname = array('templates', 'views');

/**
 * We're going to configure our theme inside of a subclass of Timber\Site
 * You can move this to its own file and include here via php's include("MySite.php")
 */
class weerts extends Site
{
	public function __construct()
	{
		add_action('after_setup_theme', array($this, 'theme_supports'));
		add_filter('timber/context', array($this, 'add_to_context'));
		add_action('wp_enqueue_scripts', array($this, 'register_assets'));
		parent::__construct();
	}

	public function register_assets()
	{
		$style_version = filemtime(get_stylesheet_directory() . '/static/style.css') ?: '';
		$script_version = filemtime(get_stylesheet_directory() . '/static/site.js') ?: '';

		wp_enqueue_style('weerts', get_stylesheet_directory_uri() . '/static/style.css', false, $style_version);
		wp_enqueue_script('weerts', get_stylesheet_directory_uri() . '/static/site.js', false, $script_version);
	}

	/** This is where you add some context
	 *
	 * @param string $context context['this'] Being the Twig's {{ this }}.
	 */
	public function add_to_context($context)
	{
		if (function_exists('get_fields')) {
			$context['options'] = get_fields('options');
		}
		$context['main_menu']  = Timber::get_menu('main');
		$context['footer_menu']  = Timber::get_menu('footer');
		$context['socials_menu'] = Timber::get_menu('socials');
		$context['design_menu'] = Timber::get_menu('design');
		$context['development_menu'] = Timber::get_menu('development');
		$context['marketing_menu'] = Timber::get_menu('marketing');

		$context['site']  = $this;

		return $context;
	}

	public function theme_supports()
	{
		add_theme_support('title-tag');
		add_theme_support('post-thumbnails');

		add_theme_support('menus');
		register_nav_menus(
			array(
				'main' => __('Main Menu', 'weerts'),
				'design' => __('Design Menu', 'weerts'),
				'development' => __('Development Menu', 'weerts'),
				'marketing' => __('Marketing Menu', 'weerts'),
				'socials' => __('Socials Menu', 'weerts'),
			)
		);

		add_theme_support('editor-styles');
		add_editor_style('static/editor.css');
	}
}

new weerts();

add_filter('timber/meta/transform_value', '__return_true');
