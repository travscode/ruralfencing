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

require_once __DIR__ . '/includes/block-patterns.php';

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
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('init', [$this, 'register_block_editor_assets']);
        add_action('init', [$this, 'register_shortcodes']);
        add_action('init', [$this, 'register_root_product_cat_rewrites'], 100);
        add_action('init', [$this, 'maybe_flush_root_product_cat_rewrites'], 110);
        add_action('after_switch_theme', [$this, 'flush_root_product_cat_rewrites'], 10, 0);
        add_action('created_product_cat', [$this, 'flush_root_product_cat_rewrites'], 10, 0);
        add_action('edited_product_cat', [$this, 'flush_root_product_cat_rewrites'], 10, 0);
        add_action('delete_product_cat', [$this, 'flush_root_product_cat_rewrites'], 10, 0);
        add_action('product_cat_add_form_fields', [$this, 'render_product_cat_seo_fields_add']);
        add_action('product_cat_edit_form_fields', [$this, 'render_product_cat_seo_fields_edit']);
        add_action('created_product_cat', [$this, 'save_product_cat_seo_fields']);
        add_action('edited_product_cat', [$this, 'save_product_cat_seo_fields']);
        add_action('admin_footer', [$this, 'render_product_cat_admin_media_script']);
        add_action('woocommerce_product_options_general_product_data', [$this, 'register_product_enquiry_field']);
        add_action('woocommerce_admin_process_product_object', [$this, 'save_product_enquiry_field']);
        add_action('admin_post_weerts_product_enquiry', [$this, 'handle_product_enquiry']);
        add_action('admin_post_nopriv_weerts_product_enquiry', [$this, 'handle_product_enquiry']);
        add_filter('timber/context', [$this, 'add_to_context']);
        add_filter('term_link', [$this, 'filter_product_cat_term_link'], 10, 3);
        add_filter('template_include', [$this, 'force_root_product_cat_template'], 20, 1);
        add_filter('woocommerce_is_purchasable', [$this, 'filter_enquire_only_purchasable'], 10, 2);

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
        $context['top_menu'] = Timber::get_menu('top');
        $context['products_menu'] = Timber::get_menu('products');
        $context['footer_menu'] = Timber::get_menu('footer');
        $context['product_categories_menu'] = Timber::get_menu('product_categories');
        $context['product_cat_tree'] = $this->get_product_cat_tree();
        $context['account_url'] = function_exists('wc_get_page_permalink')
            ? wc_get_page_permalink('myaccount')
            : wp_login_url();
        $context['cart_url'] = function_exists('wc_get_cart_url') ? wc_get_cart_url() : site_url('/cart');

        $cart_count = 0;
        if (function_exists('WC') && WC() && WC()->cart) {
            $cart_count = (int) WC()->cart->get_cart_contents_count();
        }
        $context['cart_count'] = $cart_count;

        return $context;
    }

    /**
     * @return array<int, array{id:int,name:string,slug:string,link:string,children:array}>
     */
    private function get_product_cat_tree(): array
    {
        if (!taxonomy_exists('product_cat')) {
            return [];
        }

        return $this->get_product_cat_children(0);
    }

    /**
     * @param int $parent_id
     * @return array<int, array{id:int,name:string,slug:string,link:string,children:array}>
     */
    private function get_product_cat_children(int $parent_id): array
    {
        $terms = get_terms(
            [
                'taxonomy' => 'product_cat',
                'hide_empty' => false,
                'parent' => $parent_id,
                'orderby' => 'name',
                'order' => 'ASC',
            ]
        );

        if (!is_array($terms)) {
            return [];
        }

        $result = [];
        foreach ($terms as $term) {
            if (!$term instanceof WP_Term) {
                continue;
            }
            $result[] = [
                'id' => (int) $term->term_id,
                'name' => (string) $term->name,
                'slug' => (string) $term->slug,
                'link' => $this->get_term_link_safe($term),
                'children' => $this->get_product_cat_children((int) $term->term_id),
            ];
        }

        return $result;
    }

    private function get_term_link_safe(WP_Term $term): string
    {
        $link = get_term_link($term, $term->taxonomy);
        if (is_wp_error($link)) {
            return '';
        }

        return (string) $link;
    }

    /**
     * Adds root-level URLs for product categories, e.g. /fencing/ instead of /product-category/fencing/.
     */
    public function register_root_product_cat_rewrites(): void
    {
        if (!taxonomy_exists('product_cat')) {
            return;
        }

        $terms = get_terms(
            [
                'taxonomy' => 'product_cat',
                'hide_empty' => false,
                'fields' => 'all',
            ]
        );

        if (!is_array($terms) || !$terms) {
            return;
        }

        $reserved_slugs = [
            'wp-admin',
            'wp-content',
            'wp-includes',
            'cart',
            'checkout',
            'my-account',
        ];

        foreach ($terms as $term) {
            if (!$term instanceof WP_Term) {
                continue;
            }

            $slug = (string) $term->slug;
            if ($slug === '' || in_array($slug, $reserved_slugs, true)) {
                continue;
            }

            if (get_page_by_path($slug) instanceof WP_Post) {
                continue;
            }

            $slug_regex = preg_quote($slug, '#');

            add_rewrite_rule(
                '^' . $slug_regex . '/page/([0-9]{1,})/?$',
                'index.php?product_cat=' . $slug . '&paged=$matches[1]',
                'top'
            );

            add_rewrite_rule(
                '^' . $slug_regex . '/?$',
                'index.php?product_cat=' . $slug,
                'top'
            );
        }
    }

    /**
     * Makes product category term links resolve to root-level URLs (e.g. /fencing/).
     *
     * @param string $termlink
     * @param WP_Term|int $term
     * @param string $taxonomy
     * @return string
     */
    public function filter_product_cat_term_link(string $termlink, $term, string $taxonomy): string
    {
        if ($taxonomy !== 'product_cat') {
            return $termlink;
        }

        if (!$term instanceof WP_Term) {
            $maybe_term = get_term((int) $term, $taxonomy);
            if (!$maybe_term instanceof WP_Term) {
                return $termlink;
            }
            $term = $maybe_term;
        }

        $slug = (string) $term->slug;
        if ($slug === '') {
            return $termlink;
        }

        return trailingslashit(home_url('/' . $slug));
    }

    /**
     * Forces WordPress to use the product category taxonomy template when a root-level product category URL is requested.
     *
     * @param string $template The template path WordPress selected.
     * @return string
     */
    public function force_root_product_cat_template(string $template): string
    {
        $candidate = get_stylesheet_directory() . '/taxonomy-product_cat.php';
        if (!file_exists($candidate)) {
            return $template;
        }

        $slug = get_query_var('product_cat');
        if (!is_string($slug) || $slug === '') {
            $slug = $this->get_root_request_slug();
        }

        $slug = is_string($slug) ? trim($slug) : '';
        if ($slug === '') {
            return $template;
        }

        if (get_page_by_path($slug) instanceof WP_Post) {
            return $template;
        }

        $term = get_term_by('slug', $slug, 'product_cat');
        if (!$term instanceof WP_Term) {
            return $template;
        }

        return $candidate;
    }

    /**
     * Extracts the root slug from the current request URL.
     *
     * @return string
     */
    private function get_root_request_slug(): string
    {
        $uri = isset($_SERVER['REQUEST_URI']) && is_string($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
        if ($uri === '') {
            return '';
        }

        $path = parse_url($uri, PHP_URL_PATH);
        $path = is_string($path) ? $path : '';
        $path = trim($path, '/');
        if ($path === '') {
            return '';
        }

        $parts = explode('/', $path);
        if (!$parts) {
            return '';
        }

        $slug = (string) ($parts[0] ?? '');
        if ($slug === '') {
            return '';
        }

        $reserved_slugs = [
            'wp-admin',
            'wp-content',
            'wp-includes',
            'cart',
            'checkout',
            'my-account',
        ];

        if (in_array($slug, $reserved_slugs, true)) {
            return '';
        }

        if (count($parts) === 1) {
            return $slug;
        }

        if (count($parts) === 3 && $parts[1] === 'page' && preg_match('/^[0-9]+$/', (string) $parts[2])) {
            return $slug;
        }

        return '';
    }

    /**
     * Loads media assets on the product category admin screens for the optional SEO image picker.
     */
    public function enqueue_admin_assets(string $hook_suffix): void
    {
        if (!$this->is_product_cat_admin_screen($hook_suffix)) {
            return;
        }

        wp_enqueue_media();
    }

    /**
     * Flushes rewrite rules once in wp-admin after the feature is deployed.
     */
    public function maybe_flush_root_product_cat_rewrites(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $version = '1';
        $option_key = 'weerts_root_product_cat_rewrites_version';
        $saved_version = get_option($option_key);
        if (is_string($saved_version) && $saved_version === $version) {
            return;
        }

        $permalink_structure = (string) get_option('permalink_structure');
        if ($permalink_structure === '') {
            update_option('permalink_structure', '/%postname%/');
        }

        $this->register_root_product_cat_rewrites();
        flush_rewrite_rules(false);
        update_option($option_key, $version, false);
    }

    /**
     * Flushes rewrite rules when the theme is switched or product categories are changed.
     */
    public function flush_root_product_cat_rewrites(): void
    {
        flush_rewrite_rules(false);
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
                'top' => __('Top Menu', 'rural-boilerplate'),
                'products' => __('Products Menu', 'rural-boilerplate'),
                'product_categories' => __('Product Categories', 'rural-boilerplate'),
                'footer' => __('Footer Menu', 'rural-boilerplate'),
            ]
        );

        add_theme_support('editor-styles');
        add_editor_style('static/editor.css');
    }

    /**
     * Renders the add-term UI for the optional SEO content fields.
     */
    public function render_product_cat_seo_fields_add(): void
    {
        $this->render_product_cat_seo_fields_markup();
    }

    /**
     * Renders the edit-term UI for the optional SEO content fields.
     */
    public function render_product_cat_seo_fields_edit(WP_Term $term): void
    {
        $this->render_product_cat_seo_fields_markup($this->get_product_cat_seo_fields((int) $term->term_id), true);
    }

    /**
     * Outputs the shared product category SEO field controls.
     *
     * @param array<string, mixed> $values
     */
    private function render_product_cat_seo_fields_markup(array $values = [], bool $is_edit = false): void
    {
        $defaults = [
            'enabled' => false,
            'eyebrow' => '',
            'title' => '',
            'body' => '',
            'body_html' => '',
            'paragraphs' => '',
            'list_items' => '',
            'image_id' => 0,
            'image_url' => '',
            'reverse' => false,
            'cta_url' => '',
            'cta_text' => '',
            'cta2_url' => '',
            'cta2_text' => '',
            'cta2_icon' => 'arrow-right',
        ];

        $values = array_merge($defaults, $values);
        wp_nonce_field('weerts_product_cat_seo_fields', 'weerts_product_cat_seo_fields_nonce');

        $enabled_checked = !empty($values['enabled']) ? 'checked' : '';
        $reverse_checked = !empty($values['reverse']) ? 'checked' : '';
        $image_id = (int) $values['image_id'];
        $image_url = (string) $values['image_url'];
        $body = (string) $values['body'];
        $body_html = (string) $values['body_html'];
        $paragraphs = (string) $values['paragraphs'];
        $list_items = (string) $values['list_items'];

        $field_renderer = static function (string $label, string $field_html, string $description = '') use ($is_edit): void {
            if ($is_edit) {
                echo '<tr class="form-field">';
                echo '<th scope="row"><label>' . esc_html($label) . '</label></th>';
                echo '<td>' . $field_html;
                if ($description !== '') {
                    echo '<p class="description">' . esc_html($description) . '</p>';
                }
                echo '</td></tr>';
                return;
            }

            echo '<div class="form-field">';
            echo '<label>' . esc_html($label) . '</label>';
            echo $field_html;
            if ($description !== '') {
                echo '<p>' . esc_html($description) . '</p>';
            }
            echo '</div>';
        };

        $field_renderer(
            'Optional SEO Content',
            '<label><input type="checkbox" name="weerts_optional_seo_enabled" value="1" ' . $enabled_checked . '> Enable this section</label>',
            'Turn the image-content section on for this product category.'
        );

        $field_renderer(
            'Eyebrow',
            '<input type="text" name="weerts_optional_seo_eyebrow" value="' . esc_attr((string) $values['eyebrow']) . '" class="regular-text">'
        );

        $field_renderer(
            'Title',
            '<input type="text" name="weerts_optional_seo_title" value="' . esc_attr((string) $values['title']) . '" class="regular-text">'
        );

        $field_renderer(
            'Body',
            '<textarea name="weerts_optional_seo_body" rows="5" class="large-text">' . esc_textarea($body) . '</textarea>'
        );

        $field_renderer(
            'Body HTML',
            '<textarea name="weerts_optional_seo_body_html" rows="5" class="large-text code">' . esc_textarea($body_html) . '</textarea>',
            'Optional rich text/HTML. When set, this will be used instead of Body.'
        );

        $field_renderer(
            'Paragraphs',
            '<textarea name="weerts_optional_seo_paragraphs" rows="5" class="large-text">' . esc_textarea($paragraphs) . '</textarea>',
            'One paragraph per line.'
        );

        $field_renderer(
            'List Items',
            '<textarea name="weerts_optional_seo_list_items" rows="5" class="large-text">' . esc_textarea($list_items) . '</textarea>',
            'One list item per line.'
        );

        $image_field_html = ''
            . '<input type="hidden" name="weerts_optional_seo_image_id" value="' . esc_attr((string) $image_id) . '" data-weerts-media-id>'
            . '<input type="text" name="weerts_optional_seo_image_url" value="' . esc_attr($image_url) . '" class="regular-text" data-weerts-media-url readonly>'
            . '<button type="button" class="button" data-weerts-media-open>Select image</button> '
            . '<button type="button" class="button-link-delete" data-weerts-media-clear>Clear</button>'
            . '<div data-weerts-media-preview style="margin-top:10px;">';

        if ($image_url !== '') {
            $image_field_html .= '<img src="' . esc_url($image_url) . '" alt="" style="max-width:180px;height:auto;">';
        }

        $image_field_html .= '</div>';

        $field_renderer('Image', $image_field_html);

        $field_renderer(
            'Reverse Layout',
            '<label><input type="checkbox" name="weerts_optional_seo_reverse" value="1" ' . $reverse_checked . '> Reverse the image-content layout</label>'
        );

        $field_renderer(
            'Primary CTA URL',
            '<input type="url" name="weerts_optional_seo_cta_url" value="' . esc_attr((string) $values['cta_url']) . '" class="regular-text">'
        );

        $field_renderer(
            'Primary CTA Text',
            '<input type="text" name="weerts_optional_seo_cta_text" value="' . esc_attr((string) $values['cta_text']) . '" class="regular-text">'
        );

        $field_renderer(
            'Secondary CTA URL',
            '<input type="url" name="weerts_optional_seo_cta2_url" value="' . esc_attr((string) $values['cta2_url']) . '" class="regular-text">'
        );

        $field_renderer(
            'Secondary CTA Text',
            '<input type="text" name="weerts_optional_seo_cta2_text" value="' . esc_attr((string) $values['cta2_text']) . '" class="regular-text">'
        );

        $field_renderer(
            'Secondary CTA Icon',
            '<input type="text" name="weerts_optional_seo_cta2_icon" value="' . esc_attr((string) $values['cta2_icon']) . '" class="regular-text">',
            'Use the Twig icon slug, e.g. arrow-right or pdf.'
        );
    }

    /**
     * Saves the optional SEO content fields for a product category term.
     */
    public function save_product_cat_seo_fields(int $term_id): void
    {
        if (!isset($_POST['weerts_product_cat_seo_fields_nonce']) || !wp_verify_nonce(sanitize_text_field((string) wp_unslash($_POST['weerts_product_cat_seo_fields_nonce'])), 'weerts_product_cat_seo_fields')) {
            return;
        }

        if (!current_user_can('manage_product_terms')) {
            return;
        }

        $text_keys = [
            'weerts_optional_seo_eyebrow',
            'weerts_optional_seo_title',
            'weerts_optional_seo_cta_text',
            'weerts_optional_seo_cta2_text',
            'weerts_optional_seo_cta2_icon',
        ];

        foreach ($text_keys as $key) {
            $value = isset($_POST[$key]) ? sanitize_text_field((string) wp_unslash($_POST[$key])) : '';
            update_term_meta($term_id, $key, $value);
        }

        $textarea_keys = [
            'weerts_optional_seo_body',
            'weerts_optional_seo_paragraphs',
            'weerts_optional_seo_list_items',
        ];

        foreach ($textarea_keys as $key) {
            $value = isset($_POST[$key]) ? sanitize_textarea_field((string) wp_unslash($_POST[$key])) : '';
            update_term_meta($term_id, $key, $value);
        }

        $body_html = isset($_POST['weerts_optional_seo_body_html']) ? wp_kses_post((string) wp_unslash($_POST['weerts_optional_seo_body_html'])) : '';
        update_term_meta($term_id, 'weerts_optional_seo_body_html', $body_html);

        $url_keys = [
            'weerts_optional_seo_cta_url',
            'weerts_optional_seo_cta2_url',
            'weerts_optional_seo_image_url',
        ];

        foreach ($url_keys as $key) {
            $value = isset($_POST[$key]) ? esc_url_raw((string) wp_unslash($_POST[$key])) : '';
            update_term_meta($term_id, $key, $value);
        }

        $image_id = isset($_POST['weerts_optional_seo_image_id']) ? (int) wp_unslash($_POST['weerts_optional_seo_image_id']) : 0;
        update_term_meta($term_id, 'weerts_optional_seo_image_id', $image_id);

        update_term_meta($term_id, 'weerts_optional_seo_enabled', isset($_POST['weerts_optional_seo_enabled']) ? '1' : '0');
        update_term_meta($term_id, 'weerts_optional_seo_reverse', isset($_POST['weerts_optional_seo_reverse']) ? '1' : '0');
    }

    /**
     * Returns the saved optional SEO content payload for a product category.
     *
     * @return array<string, mixed>
     */
    public function get_product_cat_seo_fields(int $term_id): array
    {
        $image_id = (int) get_term_meta($term_id, 'weerts_optional_seo_image_id', true);
        $stored_image_url = (string) get_term_meta($term_id, 'weerts_optional_seo_image_url', true);
        $attachment_url = $image_id > 0 ? wp_get_attachment_image_url($image_id, 'large') : '';

        return [
            'enabled' => get_term_meta($term_id, 'weerts_optional_seo_enabled', true) === '1',
            'eyebrow' => (string) get_term_meta($term_id, 'weerts_optional_seo_eyebrow', true),
            'title' => (string) get_term_meta($term_id, 'weerts_optional_seo_title', true),
            'body' => (string) get_term_meta($term_id, 'weerts_optional_seo_body', true),
            'body_html' => (string) get_term_meta($term_id, 'weerts_optional_seo_body_html', true),
            'paragraphs' => (string) get_term_meta($term_id, 'weerts_optional_seo_paragraphs', true),
            'list_items' => (string) get_term_meta($term_id, 'weerts_optional_seo_list_items', true),
            'image_id' => $image_id,
            'image_url' => is_string($attachment_url) && $attachment_url !== '' ? $attachment_url : $stored_image_url,
            'reverse' => get_term_meta($term_id, 'weerts_optional_seo_reverse', true) === '1',
            'cta_url' => (string) get_term_meta($term_id, 'weerts_optional_seo_cta_url', true),
            'cta_text' => (string) get_term_meta($term_id, 'weerts_optional_seo_cta_text', true),
            'cta2_url' => (string) get_term_meta($term_id, 'weerts_optional_seo_cta2_url', true),
            'cta2_text' => (string) get_term_meta($term_id, 'weerts_optional_seo_cta2_text', true),
            'cta2_icon' => (string) get_term_meta($term_id, 'weerts_optional_seo_cta2_icon', true),
        ];
    }

    /**
     * Prints the media picker script for the product category SEO image field.
     */
    public function render_product_cat_admin_media_script(): void
    {
        if (!$this->is_product_cat_admin_screen()) {
            return;
        }

        ?>
        <script>
            document.addEventListener('click', function (event) {
                const openButton = event.target.closest('[data-weerts-media-open]');
                const clearButton = event.target.closest('[data-weerts-media-clear]');

                if (!openButton && !clearButton) {
                    return;
                }

                const container = event.target.closest('.form-field, td');
                if (!container) {
                    return;
                }

                const idField = container.querySelector('[data-weerts-media-id]');
                const urlField = container.querySelector('[data-weerts-media-url]');
                const preview = container.querySelector('[data-weerts-media-preview]');

                if (clearButton) {
                    event.preventDefault();
                    if (idField) idField.value = '';
                    if (urlField) urlField.value = '';
                    if (preview) preview.innerHTML = '';
                    return;
                }

                event.preventDefault();

                const frame = wp.media({
                    title: 'Select image',
                    button: { text: 'Use image' },
                    multiple: false
                });

                frame.on('select', function () {
                    const attachment = frame.state().get('selection').first().toJSON();
                    if (idField) idField.value = attachment.id || '';
                    if (urlField) urlField.value = attachment.url || '';
                    if (preview) {
                        preview.innerHTML = attachment.url ? '<img src="' + attachment.url + '" alt="" style="max-width:180px;height:auto;">' : '';
                    }
                });

                frame.open();
            });
        </script>
        <?php
    }

    /**
     * Detects whether the current admin page is a product category taxonomy screen.
     */
    private function is_product_cat_admin_screen(string $hook_suffix = ''): bool
    {
        if (!is_admin()) {
            return false;
        }

        $taxonomy = isset($_GET['taxonomy']) ? sanitize_key((string) wp_unslash($_GET['taxonomy'])) : '';
        if ($taxonomy !== 'product_cat') {
            return false;
        }

        if ($hook_suffix === '') {
            return true;
        }

        return in_array($hook_suffix, ['edit-tags.php', 'term.php'], true);
    }

    public function register_block_editor_assets(): void
    {
        if (!function_exists('register_block_pattern') || !function_exists('register_block_style')) {
            return;
        }

        if (function_exists('register_block_pattern_category')) {
            register_block_pattern_category('weerts', ['label' => __('Weerts', 'rural-boilerplate')]);
        }

        register_block_style(
            'core/button',
            [
                'name' => 'rural-hero-fencing',
                'label' => __('Hero button (Fencing)', 'rural-boilerplate'),
            ]
        );

        register_block_style(
            'core/button',
            [
                'name' => 'rural-hero-gates',
                'label' => __('Hero button (Gates)', 'rural-boilerplate'),
            ]
        );

        register_block_style(
            'core/button',
            [
                'name' => 'rural-hero-irrigation',
                'label' => __('Hero button (Irrigation)', 'rural-boilerplate'),
            ]
        );

        $theme_uri = get_stylesheet_directory_uri();
        if (function_exists('weerts_register_block_patterns')) {
            weerts_register_block_patterns($theme_uri);
        }
    }

    public function register_shortcodes(): void
    {
        add_shortcode('weerts_product_category_pills', [$this, 'shortcode_product_category_pills']);
        add_shortcode('weerts_products', [$this, 'shortcode_products']);
    }

    /**
     * Adds an enquiry-only toggle to WooCommerce product settings.
     */
    public function register_product_enquiry_field(): void
    {
        if (!function_exists('woocommerce_wp_checkbox')) {
            return;
        }

        woocommerce_wp_checkbox(
            [
                'id' => '_weerts_enquire_only',
                'label' => __('Enquire only', 'rural-boilerplate'),
                'description' => __(
                    'Disable add to cart for this product and show the product enquiry modal instead.',
                    'rural-boilerplate'
                ),
                'desc_tip' => true,
            ]
        );
    }

    /**
     * Persists the enquiry-only toggle on the product.
     */
    public function save_product_enquiry_field(WC_Product $product): void
    {
        $enquire_only = isset($_POST['_weerts_enquire_only']) ? 'yes' : 'no';
        $product->update_meta_data('_weerts_enquire_only', $enquire_only);
    }

    /**
     * Prevents enquire-only products from being purchasable through WooCommerce.
     */
    public function filter_enquire_only_purchasable(bool $purchasable, WC_Product $product): bool
    {
        $enquire_only = $product->get_meta('_weerts_enquire_only', true);
        if ($enquire_only === 'yes') {
            return false;
        }

        return $purchasable;
    }

    /**
     * Sends product enquiry submissions to the site admin email.
     */
    public function handle_product_enquiry(): void
    {
        $product_id = isset($_POST['product_id']) ? (int) wp_unslash($_POST['product_id']) : 0;
        $redirect_url = isset($_POST['redirect_to'])
            ? esc_url_raw((string) wp_unslash($_POST['redirect_to']))
            : home_url('/');

        if ($product_id <= 0) {
            wp_safe_redirect(add_query_arg('enquiry', 'error', $redirect_url));
            exit;
        }

        if (
            !isset($_POST['weerts_product_enquiry_nonce'])
            || !wp_verify_nonce(
                sanitize_text_field((string) wp_unslash($_POST['weerts_product_enquiry_nonce'])),
                'weerts_product_enquiry'
            )
        ) {
            wp_safe_redirect(add_query_arg('enquiry', 'error', $redirect_url));
            exit;
        }

        $product = wc_get_product($product_id);
        if (!$product instanceof WC_Product) {
            wp_safe_redirect(add_query_arg('enquiry', 'error', $redirect_url));
            exit;
        }

        $first_name = isset($_POST['first_name']) ? sanitize_text_field((string) wp_unslash($_POST['first_name'])) : '';
        $last_name = isset($_POST['last_name']) ? sanitize_text_field((string) wp_unslash($_POST['last_name'])) : '';
        $email = isset($_POST['email']) ? sanitize_email((string) wp_unslash($_POST['email'])) : '';
        $phone = isset($_POST['phone']) ? sanitize_text_field((string) wp_unslash($_POST['phone'])) : '';
        $location = isset($_POST['location']) ? sanitize_text_field((string) wp_unslash($_POST['location'])) : '';
        $message = isset($_POST['message']) ? sanitize_textarea_field((string) wp_unslash($_POST['message'])) : '';
        $product_label = isset($_POST['product_interest'])
            ? sanitize_text_field((string) wp_unslash($_POST['product_interest']))
            : (string) $product->get_name();

        if ($first_name === '' || $last_name === '' || $email === '' || !is_email($email) || $message === '') {
            wp_safe_redirect(add_query_arg('enquiry', 'invalid', $redirect_url));
            exit;
        }

        $subject = sprintf(__('Product enquiry: %s', 'rural-boilerplate'), $product->get_name());
        $body_lines = [
            'Product: ' . $product_label,
            'Product URL: ' . $product->get_permalink(),
            'Name: ' . trim($first_name . ' ' . $last_name),
            'Email: ' . $email,
            'Phone: ' . $phone,
            'Location: ' . $location,
            '',
            'Enquiry:',
            $message,
        ];

        $headers = ['Content-Type: text/plain; charset=UTF-8', 'Reply-To: ' . $email];
        $sent = wp_mail(get_option('admin_email'), $subject, implode("\n", $body_lines), $headers);

        wp_safe_redirect(add_query_arg('enquiry', $sent ? 'sent' : 'error', $redirect_url));
        exit;
    }

    public function shortcode_product_category_pills(array $atts = []): string
    {
        $atts = shortcode_atts(
            [
                'parent_slug' => '',
                'limit' => 12,
                'hide_empty' => 0,
            ],
            $atts,
            'weerts_product_category_pills'
        );

        if (!taxonomy_exists('product_cat')) {
            return '';
        }

        $limit = (int) $atts['limit'];
        if ($limit <= 0) {
            $limit = 12;
        }

        $hide_empty = (bool) (int) $atts['hide_empty'];

        $parent_id = 0;
        $parent_slug = is_string($atts['parent_slug']) ? trim($atts['parent_slug']) : '';
        if ($parent_slug !== '') {
            $parent_term = get_term_by('slug', $parent_slug, 'product_cat');
            if ($parent_term instanceof WP_Term) {
                $parent_id = (int) $parent_term->term_id;
            }
        }

        $terms = get_terms(
            [
                'taxonomy' => 'product_cat',
                'hide_empty' => $hide_empty,
                'parent' => $parent_id,
                'orderby' => 'name',
                'order' => 'ASC',
                'number' => $limit,
            ]
        );

        if (!is_array($terms) || !$terms) {
            return '';
        }

        $pill_terms = [];
        foreach ($terms as $term) {
            if (!$term instanceof WP_Term) {
                continue;
            }
            $link = get_term_link($term, 'product_cat');
            if (is_wp_error($link)) {
                continue;
            }

            $pill_terms[] = [
                'name' => (string) $term->name,
                'link' => (string) $link,
            ];
        }

        if (!$pill_terms) {
            return '';
        }

        $template = 'partials/product-category-pills.twig';
        $template_path = get_stylesheet_directory() . '/templates/' . $template;
        if (file_exists($template_path) && method_exists(Timber::class, 'compile')) {
            return (string) Timber::compile($template, ['terms' => $pill_terms]);
        }

        $out = '<div class="rural-category-spotlight__buttons" aria-label="Product categories">'
            . '<div class="rural-category-spotlight__buttons-inner">';

        foreach ($pill_terms as $pill_term) {
            $out .= sprintf(
                '<a class="rural-category-spotlight__pill" href="%s">%s</a>',
                esc_url((string) $pill_term['link']),
                esc_html((string) $pill_term['name'])
            );
        }

        $out .= '</div></div>';

        return $out;
    }

    /**
     * Renders a product loop shortcode with reliable featured and on-sale filtering.
     */
    public function shortcode_products(array $atts = []): string
    {
        if (!class_exists('WooCommerce')) {
            return '';
        }

        $atts = shortcode_atts(
            [
                'limit' => 12,
                'columns' => 4,
                'ids' => '',
                'featured' => '',
                'on_sale' => '',
                'show_sale_flash' => 'true',
                'show_badges' => 'false',
                'new_days' => 30,
                'class' => '',
                'orderby' => 'date',
                'order' => 'DESC',
            ],
            $atts,
            'weerts_products'
        );

        $limit = max(1, (int) $atts['limit']);
        $columns = max(1, (int) $atts['columns']);
        $orderby = is_string($atts['orderby']) ? strtolower(trim($atts['orderby'])) : 'date';
        $order = is_string($atts['order']) ? strtoupper(trim($atts['order'])) : 'DESC';
        $featured = filter_var($atts['featured'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $on_sale = filter_var($atts['on_sale'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $show_sale_flash = filter_var($atts['show_sale_flash'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $show_badges = filter_var($atts['show_badges'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $new_days = max(1, (int) $atts['new_days']);
        $wrapper_class_raw = is_string($atts['class']) ? trim($atts['class']) : '';
        $ids_raw = is_string($atts['ids']) ? trim($atts['ids']) : '';
        $ids = $ids_raw !== ''
            ? array_values(array_filter(array_map('intval', preg_split('/\s*,\s*/', $ids_raw) ?: [])))
            : [];

        $query_args = [
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => $limit,
            'ignore_sticky_posts' => true,
            'orderby' => in_array($orderby, ['date', 'title', 'menu_order', 'rand', 'id'], true) ? $orderby : 'date',
            'order' => in_array($order, ['ASC', 'DESC'], true) ? $order : 'DESC',
        ];

        if ($ids !== []) {
            $query_args['post__in'] = $ids;
            $query_args['orderby'] = 'post__in';
            $query_args['posts_per_page'] = min($limit, count($ids));
        }

        $tax_query = [];
        if ($featured === true && function_exists('wc_get_product_visibility_term_ids')) {
            $visibility_term_ids = wc_get_product_visibility_term_ids();
            if (!empty($visibility_term_ids['featured'])) {
                $tax_query[] = [
                    'taxonomy' => 'product_visibility',
                    'field' => 'term_taxonomy_id',
                    'terms' => [(int) $visibility_term_ids['featured']],
                ];
            }
        }

        if ($tax_query) {
            $query_args['tax_query'] = $tax_query;
        }

        if (function_exists('wc_get_product_ids_on_sale') && $on_sale !== null) {
            $sale_ids = array_map('intval', wc_get_product_ids_on_sale());
            if ($sale_ids === []) {
                $sale_ids = [0];
            }

            if ($on_sale === true) {
                $query_args['post__in'] = $sale_ids;
            } elseif ($on_sale === false) {
                $query_args['post__not_in'] = $sale_ids;
            }
        }

        $products = new WP_Query($query_args);
        if (!$products->have_posts()) {
            return '';
        }

        $classes = ['woocommerce'];
        if ($wrapper_class_raw !== '') {
            $parts = preg_split('/\s+/', $wrapper_class_raw) ?: [];
            foreach ($parts as $part) {
                $part = sanitize_html_class($part);
                if ($part !== '') {
                    $classes[] = $part;
                }
            }
        }

        $sale_flash_filter = static function (string $html, $post, $product) use ($show_sale_flash): string {
            if ($show_sale_flash === false) {
                return '';
            }

            return $html;
        };

        if ($show_sale_flash === false) {
            add_filter('woocommerce_sale_flash', $sale_flash_filter, 10, 3);
        }

        $product_badges_action = static function () use ($new_days): void {
            global $product;

            if (!$product instanceof WC_Product) {
                return;
            }

            $product_id = $product->get_id();
            $badges = [];

            if ($product->is_featured()) {
                $badges[] = ['key' => 'featured', 'label' => 'Featured'];
            }

            if ($product->is_on_sale()) {
                $badges[] = ['key' => 'specials', 'label' => 'Specials'];
            }

            if (
                ($product_id && has_term('clearance', 'product_cat', $product_id))
                || ($product_id && has_term('clearance', 'product_tag', $product_id))
            ) {
                $badges[] = ['key' => 'clearance', 'label' => 'Clearance'];
            }

            $published_gmt = $product_id ? (int) get_post_time('U', true, $product_id) : 0;
            if ($published_gmt > 0) {
                $age_seconds = max(0, (int) current_time('timestamp', true) - $published_gmt);
                if ($age_seconds <= ($new_days * DAY_IN_SECONDS)) {
                    $badges[] = ['key' => 'new', 'label' => 'New'];
                }
            }

            if ($badges === []) {
                return;
            }

            echo '<div class="weerts-product-badges" aria-hidden="true">';
            foreach ($badges as $badge) {
                echo '<span class="weerts-product-badge weerts-product-badge--' . esc_attr((string) $badge['key']) . '">'
                    . esc_html((string) $badge['label'])
                    . '</span>';
            }
            echo '</div>';
        };

        if ($show_badges === true) {
            add_action('woocommerce_before_shop_loop_item_title', $product_badges_action, 9);
        }

        ob_start();

        try {
            echo '<div class="' . esc_attr(implode(' ', $classes)) . '">';

            if (function_exists('wc_setup_loop')) {
                wc_setup_loop(
                    [
                        'columns' => $columns,
                        'is_shortcode' => true,
                        'is_paginated' => false,
                        'total' => $products->found_posts,
                        'total_pages' => $products->max_num_pages,
                        'per_page' => $limit,
                        'current_page' => 1,
                    ]
                );
            } else {
                wc_set_loop_prop('columns', $columns);
            }

            woocommerce_product_loop_start();

            while ($products->have_posts()) {
                $products->the_post();
                wc_get_template_part('content', 'product');
            }

            woocommerce_product_loop_end();

            if (function_exists('wc_reset_loop')) {
                wc_reset_loop();
            }

            echo '</div>';

            wp_reset_postdata();

            return (string) ob_get_clean();
        } finally {
            if ($show_sale_flash === false) {
                remove_filter('woocommerce_sale_flash', $sale_flash_filter, 10);
            }
            if ($show_badges === true) {
                remove_action('woocommerce_before_shop_loop_item_title', $product_badges_action, 9);
            }
        }
    }
}

new RuralBoilerplateSite();

if (defined('WP_CLI') && WP_CLI && class_exists('WP_CLI')) {
    $wp_cli = 'WP_CLI';
    call_user_func(
        [$wp_cli, 'add_command'],
        'weerts seed-product-cats',
        function () use ($wp_cli): void {
            if (!taxonomy_exists('product_cat')) {
                call_user_func([$wp_cli, 'error'], 'WooCommerce product categories (product_cat) are not available.');
            }

            $seed_tree = [
                ['name' => 'Automatic Gates'],
                ['name' => 'Cattle Rail'],
                ['name' => 'Electric Fencing'],
                [
                    'name' => 'Fencing – Panels & Gates',
                ],
                [
                    'name' => 'Fencing – Rural',
                ],
                [
                    'name' => 'Fencing – Security',
                    'children' => [
                        [
                            'name' => 'Aluminium Boundary Fencing',
                            'children' => [
                                ['name' => 'Boundary Panels'],
                                ['name' => 'Boundary Gates'],
                                ['name' => 'Boundary Posts'],
                                ['name' => 'Boundary Accessories'],
                            ],
                        ],
                        ['name' => 'Aluminium Picket Fencing'],
                        ['name' => 'Aluminium Pool Fencing'],
                        ['name' => 'Garrison Fencing'],
                        ['name' => 'Safety Gate Latches & Hinges'],
                    ],
                ],
                ['name' => 'Gabion Cages'],
                ['name' => 'Gates'],
                ['name' => 'Hardware & Garden'],
                ['name' => 'Irrigation'],
                ['name' => 'Pet Enclosures'],
                ['name' => 'Pumps'],
                ['name' => 'Shade Cloth & Fruit Tree Netting'],
                ['name' => 'Steel ‘Y’ Posts'],
                ['name' => 'Treated Pine Poles'],
                ['name' => 'Water Tanks'],
                ['name' => 'Welded Mesh'],
                ['name' => 'Wire Netting'],
                ['name' => 'Clearance'],
                ['name' => 'Specials'],
                ['name' => 'New Products'],
                ['name' => 'Featured'],
            ];

            $existing_gates = get_term_by('slug', 'gates', 'product_cat');
            if ($existing_gates instanceof WP_Term && (int) $existing_gates->parent !== 0) {
                $boundary = get_term_by('slug', 'aluminium-boundary-fencing', 'product_cat');
                if ($boundary instanceof WP_Term && (int) $existing_gates->parent === (int) $boundary->term_id) {
                    wp_update_term(
                        (int) $existing_gates->term_id,
                        'product_cat',
                        [
                            'name' => 'Boundary Gates',
                            'slug' => 'boundary-gates',
                        ]
                    );
                }
            }

            $created = [];
            $walker = function (array $nodes, int $parent_id = 0) use (&$walker, &$created, $wp_cli): void {
                foreach ($nodes as $node) {
                    $name = isset($node['name']) ? (string) $node['name'] : '';
                    if ($name === '') {
                        continue;
                    }

                    $slug = sanitize_title($name);
                    $existing = get_term_by('slug', $slug, 'product_cat');
                    if ($existing instanceof WP_Term) {
                        $term_id = (int) $existing->term_id;
                    } else {
                        $inserted = wp_insert_term(
                            $name,
                            'product_cat',
                            [
                                'parent' => $parent_id,
                                'slug' => $slug,
                            ]
                        );

                        if (is_wp_error($inserted)) {
                            call_user_func(
                                [$wp_cli, 'warning'],
                                sprintf('Failed creating "%s": %s', $name, $inserted->get_error_message())
                            );
                            continue;
                        }
                        $term_id = (int) $inserted['term_id'];
                    }

                    $created[$name] = $term_id;

                    $children = isset($node['children']) && is_array($node['children']) ? $node['children'] : [];
                    if ($children) {
                        $walker($children, $term_id);
                    }
                }
            };

            $walker($seed_tree, 0);

            update_option('weerts_seeded_product_cat_ids', $created, false);

            call_user_func(
                [$wp_cli, 'success'],
                sprintf(
                    'Seeded %d product categories. Stored IDs in option weerts_seeded_product_cat_ids.',
                    count($created)
                )
            );
        }
    );
}
