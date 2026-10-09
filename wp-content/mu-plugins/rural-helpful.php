<?php
/**
 * Plugin Name: Rural Helpful Information
 * Description: Reviewed legacy guides, an explicit WP-CLI import, and legacy information-page redirects.
 */

if (!defined('ABSPATH')) { exit; }

final class Rural_Helpful_Content
{
    public static function guides(): array
    {
        static $guides;
        if ($guides === null) {
            $guides = json_decode((string) file_get_contents(__DIR__ . '/rural-helpful/guides.json'), true);
            if (!is_array($guides)) { throw new RuntimeException('Invalid helpful-guide content file.'); }
        }
        return $guides;
    }

    public static function content(array $guide): string
    {
        $html = '<p>' . esc_html($guide['excerpt']) . '</p>';
        foreach ($guide['sections'] as $section) {
            $html .= '\n<h2>' . esc_html($section['title']) . '</h2>';
            if (!empty($section['text'])) { $html .= '<p>' . esc_html($section['text']) . '</p>'; }
            if (!empty($section['items'])) {
                $html .= '<ul>';
                foreach ($section['items'] as $item) { $html .= '<li>' . esc_html($item) . '</li>'; }
                $html .= '</ul>';
            }
        }
        if ($guide['slug'] === 'automatic-gates') {
            $html .= '<p><a href="https://www.gatemaster.com.au/">Explore Gatemaster Australia</a></p>';
        }
        return str_replace('\\n', "\n", $html);
    }

    private static function existing_guide(array $guide): ?WP_Post
    {
        $posts = get_posts([
            'post_type' => 'page', 'post_status' => array_keys(get_post_stati()), 'numberposts' => 1,
            'meta_key' => '_rural_guide_source', 'meta_value' => $guide['source'],
        ]);
        return $posts ? $posts[0] : null;
    }

    /** Create only; repeat imports preserve all editor changes and publication decisions. */
    public static function import(bool $apply = false): array
    {
        $parent = get_page_by_path('help');
        $guides = self::guides();
        // Preflight all conflicts before making any changes.
        foreach ($guides as $guide) {
            $existing = get_page_by_path('help/' . $guide['slug']);
            if ($existing && get_post_meta($existing->ID, '_rural_guide_source', true) !== $guide['source']) {
                throw new RuntimeException('Existing unowned page at help/' . $guide['slug'] . '; resolve before importing.');
            }
        }
        $result = [];
        if (!$apply) {
            $result[] = ['path' => 'help', 'action' => $parent ? 'keep existing index page' : 'create index page'];
            foreach ($guides as $guide) {
                $existing = self::existing_guide($guide);
                $result[] = ['path' => 'help/' . $guide['slug'], 'action' => $existing ? 'preserve existing guide' : 'create guide'];
            }
            return $result;
        }
        if (!$parent) {
            $id = wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Helpful Info', 'post_name' => 'help'], true);
            if (is_wp_error($id)) { throw new RuntimeException($id->get_error_message()); }
            $parent = get_post($id);
        }
        foreach ($guides as $index => $guide) {
            $existing = self::existing_guide($guide);
            if ($existing) {
                $result[] = ['path' => 'help/' . $guide['slug'], 'action' => 'preserved'];
                continue;
            }
            $id = wp_insert_post([
                'post_type' => 'page', 'post_status' => 'publish', 'post_parent' => $parent->ID,
                'post_title' => $guide['title'], 'post_name' => $guide['slug'],
                'post_excerpt' => $guide['excerpt'], 'post_content' => self::content($guide),
                'menu_order' => $index + 1,
                'meta_input' => ['_rural_guide_source' => $guide['source'], '_rural_guide_image' => $guide['image']],
            ], true);
            if (is_wp_error($id)) { throw new RuntimeException($id->get_error_message()); }
            $result[] = ['path' => 'help/' . $guide['slug'], 'action' => 'created'];
        }
        return $result;
    }

    public static function legacy_target(string $path): string
    {
        foreach (self::guides() as $guide) {
            if (strtolower(rtrim($path, '/')) !== strtolower(wp_parse_url($guide['source'], PHP_URL_PATH))) { continue; }
            $page = self::existing_guide($guide);
            if ($page && $page->post_status === 'publish' && !post_password_required($page)
                && get_post_meta($page->ID, '_rural_guide_source', true) === $guide['source']) {
                return (string) get_permalink($page);
            }
        }
        return '';
    }
}

add_action('template_redirect', static function (): void {
    // Do not take over valid pages/products, POST requests, previews or admin routes.
    if (!is_404() || !in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) { return; }
    $path = (string) wp_parse_url(wp_unslash($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
    $target = Rural_Helpful_Content::legacy_target($path);
    if ($target) { wp_safe_redirect($target, 301, 'Rural Helpful Information'); exit; }
}, 5);

if (defined('WP_CLI') && WP_CLI) {
    WP_CLI::add_command('rural helpful import', static function (array $args, array $options): void {
        try {
            $apply = isset($options['apply']);
            $rows = Rural_Helpful_Content::import($apply);
            \WP_CLI\Utils\format_items('table', $rows, ['path', 'action']);
            WP_CLI::success($apply ? 'Helpful guides imported. Existing guides were preserved.' : 'Preview only. Add --apply to create these pages.');
        } catch (Throwable $error) { WP_CLI::error($error->getMessage()); }
    });
}
