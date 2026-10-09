<?php
/** Deployment commands. All metadata imports are preview-only unless --apply is supplied. */

defined('ABSPATH') || exit;

final class Rural_SEO_CLI
{
    /**
     * Configure Yoast without changing search visibility.
     *
     * ## OPTIONS
     * [--apply]
     * : Save the configuration. Otherwise show the planned values.
     * [--logo-file=<path>]
     * : Local business logo image. Defaults to the theme's 500px brand icon.
     */
    public function setup(array $args, array $assoc): void
    {
        $this->require_yoast();
        $logo_id = (int) WPSEO_Options::get('company_logo_id');
        $logo_id = $logo_id ?: (int) get_theme_mod('custom_logo');
        $logo_id = $logo_id ?: (int) get_option('site_icon');
        $logo_file = $assoc['logo-file'] ?? get_theme_file_path('/images/favicon-rural-fencing.png');
        if (!$logo_id && !is_readable($logo_file)) {
            WP_CLI::error('Yoast requires a business logo for Organization schema. Supply --logo-file or set a site logo first.');
        }
        $options = [
            'enable_xml_sitemap' => true,
            // Rural SEO serves a dynamic directory instead of a second static file.
            'enable_llms_txt' => false,
            'company_or_person' => 'company',
            'company_name' => 'Rural Fencing & Irrigation Supplies',
            'title-tax-product_cat' => '%%term_title%% %%page%% %%sep%% %%sitename%%',
        ];
        foreach ($options as $key => $value) {
            WP_CLI::log($key . ': ' . wp_json_encode($value));
            if (isset($assoc['apply'])) {
                WPSEO_Options::set($key, $value);
            }
        }
        if (isset($assoc['apply'])) {
            if (!$logo_id) {
                require_once ABSPATH . 'wp-admin/includes/file.php';
                require_once ABSPATH . 'wp-admin/includes/media.php';
                require_once ABSPATH . 'wp-admin/includes/image.php';
                $temporary = wp_tempnam(basename($logo_file));
                if (!$temporary || !copy($logo_file, $temporary)) {
                    WP_CLI::error('Could not prepare the business logo.');
                }
                $logo_id = media_handle_sideload(['name' => basename($logo_file), 'tmp_name' => $temporary], 0, 'Rural Fencing & Irrigation Supplies logo');
                if (is_wp_error($logo_id)) {
                    if (file_exists($temporary)) {
                        unlink($temporary);
                    }
                    WP_CLI::error($logo_id->get_error_message());
                }
            }
            WPSEO_Options::set('company_logo_id', $logo_id);
            WPSEO_Options::set('company_logo', wp_get_attachment_url($logo_id));
            // Prevent account and checkout pages appearing in Yoast's sitemap.
            foreach (['woocommerce_cart_page_id', 'woocommerce_checkout_page_id', 'woocommerce_myaccount_page_id'] as $key) {
                $id = (int) get_option($key);
                if ($id) {
                    update_post_meta($id, '_yoast_wpseo_meta-robots-noindex', '1');
                }
            }
            flush_rewrite_rules(false);
        } else {
            WP_CLI::log($logo_id ? 'Reuse logo attachment ' . $logo_id : 'Import business logo from ' . $logo_file);
        }
        WP_CLI::success(isset($assoc['apply']) ? 'Configured. Run wp yoast index --reindex next.' : 'Preview only; use --apply to save.');
    }

    /**
     * Import a reviewed legacy metadata snapshot into Yoast. Existing values are preserved.
     *
     * ## OPTIONS
     * --file=<path>
     * : Snapshot JSON from collect_metadata.py or collect-products.
     * [--apply]
     * : Save missing metadata. The default is a dry run.
     */
    public function import(array $args, array $assoc): void
    {
        $this->require_yoast();
        $file = $assoc['file'] ?? '';
        if (!is_readable($file)) {
            WP_CLI::error('Provide a readable --file snapshot.');
        }
        $data = json_decode(file_get_contents($file), true);
        if (!is_array($data) || !isset($data['rows']) || !is_array($data['rows'])) {
            WP_CLI::error('Invalid snapshot: expected a rows array.');
        }
        // Validate the whole file before writing any metadata.
        foreach ($data['rows'] as $row) {
            if (!is_array($row) || !in_array($row['type'] ?? '', ['product_cat', 'page', 'front_page', 'product'], true)
                || !is_string($row['slug'] ?? null)
                || !in_array($row['status'] ?? '', ['ready', 'review'], true)
                || ($row['status'] === 'ready' && (!is_string($row['title'] ?? null) || !is_string($row['description'] ?? null)))) {
                WP_CLI::error('Invalid snapshot row; nothing imported.');
            }
        }
        $counts = ['changed' => 0, 'preserved' => 0, 'review' => 0];
        foreach ($data['rows'] as $row) {
            $target = $this->resolve($row);
            if ($row['status'] !== 'ready' || !$target) {
                ++$counts['review'];
                WP_CLI::warning($row['slug'] . ': ' . ($row['reason'] ?? 'Target not found or ambiguous'));
                continue;
            }
            foreach (['title', 'description'] as $field) {
                $key = $field === 'title' ? 'title' : ($row['type'] === 'product_cat' ? 'desc' : 'metadesc');
                $value = trim($row[$field]);
                $current = $row['type'] === 'product_cat'
                    ? WPSEO_Taxonomy_Meta::get_term_meta($target, 'product_cat', $key)
                    : get_post_meta($target, '_yoast_wpseo_' . $key, true);
                if ($value === '' || (string) $current !== '') {
                    ++$counts['preserved'];
                    continue;
                }
                ++$counts['changed'];
                WP_CLI::log($row['slug'] . ' ' . $field . ': ' . $value);
                if (isset($assoc['apply'])) {
                    if ($row['type'] === 'product_cat') {
                        // Yoast validates a full term record; a single-field write
                        // would reset other fields (including a saved canonical).
                        $meta = WPSEO_Taxonomy_Meta::get_term_meta($target, 'product_cat');
                        $meta['wpseo_' . $key] = $value;
                        WPSEO_Taxonomy_Meta::set_values($target, 'product_cat', $meta);
                    } else {
                        update_post_meta($target, '_yoast_wpseo_' . $key, wp_slash($value));
                    }
                }
            }
        }
        WP_CLI::log(wp_json_encode($counts));
        WP_CLI::success(isset($assoc['apply']) ? 'Missing metadata imported; existing edits preserved. Run wp yoast index --reindex.' : 'Dry run only; use --apply to save.');
        if ($counts['review']) {
            WP_CLI::warning('Unresolved rows remain; do not sign off the migration yet.');
        }
    }

    private function resolve(array $row): int
    {
        if ($row['type'] === 'product_cat') {
            $term = get_term_by('slug', $row['slug'], 'product_cat');
            return $term ? (int) $term->term_id : 0;
        }
        if ($row['type'] === 'front_page') {
            return get_option('show_on_front') === 'page' ? (int) get_option('page_on_front') : 0;
        }
        $post = get_page_by_path($row['slug'], OBJECT, $row['type']);
        if (!$post || $post->post_status !== 'publish') {
            return 0;
        }
        if ($row['type'] === 'product' && (int) get_post_meta($post->ID, '_rural_zen_product_id', true) !== (int) ($row['zen_id'] ?? 0)) {
            return 0;
        }
        return (int) $post->ID;
    }

    /**
     * Capture product metadata using the catalogue's legacy Zen product IDs. Does not edit WordPress.
     *
     * ## OPTIONS
     * --file=<path>
     * : New JSON output path, preferably outside the public web root.
     * [--limit=<number>]
     * : Number of products to inspect. Default 100.
     * [--offset=<number>]
     * : Product offset. Default 0.
     *
     * @subcommand collect-products
     */
    public function collect_products(array $args, array $assoc): void
    {
        $file = $assoc['file'] ?? '';
        if (!$file || file_exists($file) || !is_writable(dirname($file))) {
            WP_CLI::error('Provide a new --file path in a writable directory.');
        }
        $posts = get_posts([
            'post_type' => 'product', 'post_status' => 'publish', 'orderby' => 'ID', 'order' => 'ASC',
            'numberposts' => max(1, min(500, (int) ($assoc['limit'] ?? 100))),
            'offset' => max(0, (int) ($assoc['offset'] ?? 0)),
        ]);
        $rows = [];
        $cache = [];
        foreach ($posts as $post) {
            $id = (int) get_post_meta($post->ID, '_rural_zen_product_id', true);
            $row = ['type' => 'product', 'slug' => $post->post_name, 'zen_id' => $id, 'status' => 'review'];
            if (!$id) {
                $row['reason'] = 'No legacy product ID; needs new metadata or a reviewed mapping.';
            } else {
                $source = 'https://www.ruralfencingsupplies.com.au/index.php?main_page=product_info&products_id=' . $id;
                if (!isset($cache[$id])) {
                    $cache[$id] = $this->fetch_product($source, $id);
                    usleep(250000);
                }
                $row = array_merge($row, ['source' => $source], $cache[$id]);
            }
            $rows[] = $row;
            WP_CLI::log($post->post_name . ': ' . $row['status']);
        }
        $json = wp_json_encode(['captured_at' => gmdate('c'), 'rows' => $rows], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if (file_put_contents($file, $json . "\n", LOCK_EX) === false) {
            WP_CLI::error('Could not write snapshot.');
        }
        WP_CLI::success('Captured ' . count($rows) . ' products. Review before running import.');
    }

    private function fetch_product(string $url, int $id): array
    {
        $response = wp_safe_remote_get($url, ['timeout' => 30, 'redirection' => 3]);
        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
            return ['status' => 'review', 'reason' => 'Source request failed.'];
        }
        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="UTF-8">' . wp_remote_retrieve_body($response), LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        $xpath = new DOMXPath($document);
        // Refuse homepage/soft-404 metadata when the source no longer has this product.
        $ids = $xpath->query('//input[@name="products_id"]/@value');
        $matched = false;
        foreach ($ids as $node) {
            $matched = $matched || (int) $node->nodeValue === $id;
        }
        $title = trim($xpath->evaluate('string(//title)'));
        $description = trim($xpath->evaluate('string(//meta[translate(@name,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz")="description"]/@content)'));
        if (!$matched || !$title || !$description) {
            return ['status' => 'review', 'reason' => 'Product identity or metadata could not be verified.'];
        }
        return ['status' => 'ready', 'title' => $title, 'description' => $description];
    }

    private function require_yoast(): void
    {
        if (!class_exists('WPSEO_Options') || !class_exists('WPSEO_Taxonomy_Meta')) {
            WP_CLI::error('Install and activate Yoast SEO first.');
        }
    }
}

WP_CLI::add_command('rural seo', Rural_SEO_CLI::class);
