<?php
/**
 * Plugin Name: Rural SEO
 * Description: Site-specific crawl rules, business schema and AI directory, integrated with Yoast SEO.
 */

defined('ABSPATH') || exit;

final class Rural_SEO
{
    public static function init(): void
    {
        add_filter('robots_txt', [self::class, 'robots'], PHP_INT_MAX, 2);
        add_filter('wp_robots', [self::class, 'robots_meta']);
        add_filter('wpseo_robots_array', [self::class, 'yoast_robots']);
        add_filter('wpseo_schema_organization', [self::class, 'organization']);
        add_filter('wpseo_metadesc', [self::class, 'description']);
        add_filter('woocommerce_structured_data_product', [self::class, 'product_schema'], 10, 2);
        add_action('template_redirect', [self::class, 'endpoints'], 0);
        add_action('admin_notices', [self::class, 'notice']);
    }

    public static function is_private(): bool
    {
        $host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
        // The known demo must remain protected even if copied with blog_public=1.
        return $host === 'rural.travis.work'
            || wp_get_environment_type() !== 'production'
            || (string) get_option('blog_public') !== '1';
    }

    public static function robots(string $output, $public): string
    {
        if (self::is_private() || !$public) {
            return "User-agent: *\nDisallow: /\n";
        }
        // Preserve plugin/server additions on public sites; do not block CSS, JS or images.
        foreach (['/*?s=', '/*&s=', '/*?add-to-cart=', '/*&add-to-cart='] as $path) {
            $output .= "\nDisallow: {$path}";
        }
        $sitemap = home_url(defined('WPSEO_VERSION') ? '/sitemap_index.xml' : '/wp-sitemap.xml');
        if (strpos($output, 'Sitemap:') === false) {
            $output .= "\nSitemap: {$sitemap}";
        }
        return rtrim($output) . "\n";
    }

    public static function robots_meta(array $robots): array
    {
        if (self::is_private()) {
            unset($robots['index']);
            $robots['noindex'] = true;
            $robots['nofollow'] = true;
        }
        return $robots;
    }

    public static function yoast_robots(array $robots): array
    {
        if (self::is_private()) {
            $robots['index'] = 'noindex';
            $robots['follow'] = 'nofollow';
        }
        return $robots;
    }

    public static function organization(array $data): array
    {
        // Match the business information displayed in the contact page template.
        $data['@type'] = 'Store';
        $data['name'] = 'Rural Fencing & Irrigation Supplies';
        $data['telephone'] = '+61-8-9492-0500';
        $data['email'] = 'sales@ruralfencingsupplies.com.au';
        $data['address'] = [
            '@type' => 'PostalAddress', 'streetAddress' => '2 Davison Street',
            'addressLocality' => 'Maddington', 'addressRegion' => 'WA',
            'postalCode' => '6109', 'addressCountry' => 'AU',
        ];
        $data['openingHoursSpecification'] = [
            ['@type' => 'OpeningHoursSpecification', 'dayOfWeek' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'opens' => '07:30', 'closes' => '16:30'],
            ['@type' => 'OpeningHoursSpecification', 'dayOfWeek' => ['Saturday'], 'opens' => '08:00', 'closes' => '13:00'],
        ];
        return $data;
    }

    public static function description(string $description): string
    {
        if (trim($description) !== '' || is_404() || is_search()) {
            return $description;
        }
        $text = '';
        if (is_tax('product_cat')) {
            $term = get_queried_object();
            $text = $term->description ?: sprintf('Browse %s at Rural Fencing & Irrigation Supplies in Maddington, Perth. Contact our team for product advice and availability.', $term->name);
        } elseif (is_singular()) {
            $post = get_queried_object();
            // Excerpts are safe plain summaries; raw block/shortcode content is not.
            $text = $post->post_excerpt ?: sprintf('%s — Rural Fencing & Irrigation Supplies, Maddington, Perth. Contact our team for more information.', get_the_title($post));
        }
        return wp_trim_words(wp_strip_all_tags(strip_shortcodes($text)), 30, '…');
    }

    public static function product_schema(array $data, $product): array
    {
        if ($product->get_meta('_weerts_enquire_only', true) === 'yes') {
            // An enquiry price is not an offer to buy the item for $0.
            unset($data['offers']);
        }
        return $data;
    }

    public static function llms(): string
    {
        $text = "# Rural Fencing & Irrigation Supplies\n\n> Fencing, gates, irrigation and rural supplies in Maddington, Perth, Western Australia.\n\n";
        $text .= "Visit: 2 Davison Street, Maddington WA 6109.\nPhone: (08) 9492 0500. Email: sales@ruralfencingsupplies.com.au.\n\n";
        $text .= "Product pages are the source for current specifications and availability. Contact the store to confirm pricing and delivery.\n\n## Website\n\n";
        $text .= '- [Home](' . home_url('/') . ")\n";
        foreach (['about', 'about-us', 'contact', 'contact-us', 'services'] as $slug) {
            $page = get_page_by_path($slug);
            if ($page && $page->post_status === 'publish') {
                $text .= '- [' . self::label(get_the_title($page)) . '](' . get_permalink($page) . ")\n";
            }
        }
        $terms = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => true, 'parent' => 0]);
        if (!is_wp_error($terms) && $terms) {
            $text .= "\n## Product categories\n\n";
            foreach ($terms as $term) {
                if ($term->slug === 'uncategorized') {
                    continue;
                }
                $url = get_term_link($term);
                if (!is_wp_error($url)) {
                    $text .= '- [' . self::label($term->name) . '](' . $url . ")\n";
                }
            }
        }
        return $text;
    }

    private static function label(string $text): string
    {
        return str_replace(['[', ']', "\r", "\n"], '', wp_strip_all_tags(html_entity_decode($text, ENT_QUOTES, 'UTF-8')));
    }

    public static function endpoints(): void
    {
        if (self::is_private()) {
            header('X-Robots-Tag: noindex, nofollow', true);
        }
        $path = wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
        if ($path === wp_parse_url(home_url('/sitemap.xml'), PHP_URL_PATH)) {
            wp_safe_redirect(home_url(defined('WPSEO_VERSION') ? '/sitemap_index.xml' : '/wp-sitemap.xml'), 301, 'Rural SEO');
            exit;
        }
        if ($path === wp_parse_url(home_url('/llms.txt'), PHP_URL_PATH)) {
            status_header(200);
            header('Content-Type: text/plain; charset=UTF-8');
            echo self::llms(); // Plain text response, not HTML.
            exit;
        }
    }

    public static function notice(): void
    {
        if (current_user_can('manage_options') && !defined('WPSEO_VERSION')) {
            echo '<div class="notice notice-warning"><p>Rural SEO requires Yoast SEO. Complete the setup in scripts/seo/README.md before signing off the SEO checklist.</p></div>';
        }
    }
}

Rural_SEO::init();

if (defined('WP_CLI') && WP_CLI) {
    require_once __DIR__ . '/rural-seo/cli.php';
}
