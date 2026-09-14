<?php
/**
 * Plugin Name: Rural Catalogue Tools
 * Description: WP-CLI commands that load the Xero/Zen Cart catalogue (built by scripts/catalogue/build_catalogue.py) into WooCommerce. Run `wp rural catalogue --help`.
 * Version: 1.0.0
 * Author: Weerts
 * Requires Plugins: woocommerce
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('WP_CLI') || !WP_CLI) {
    return;
}

/**
 * Import, purge and inspect the product catalogue.
 */
class Rural_Catalogue_Command
{
    private const META_XERO_CODE = '_xero_item_code';
    private const META_ZEN_ID = '_rural_zen_product_id';
    private const META_TIER = '_rural_match_tier';
    private const META_HASH = '_rural_catalogue_hash';
    private const META_SOURCE_IMAGE = '_rural_source_image';
    private const META_ENQUIRE = '_weerts_enquire_only';
    private const ATTRIBUTE_NAME = 'Option';

    private string $imagesDir = '';
    private bool $dryRun = false;
    private bool $skipImages = false;
    private bool $noSiblingImages = false;
    private bool $force = false;
    private array $attachmentCache = [];
    private array $stats = ['created' => 0, 'updated' => 0, 'skipped' => 0, 'variations' => 0, 'images' => 0, 'errors' => 0];

    /**
     * Import products from the catalogue CSV. Idempotent: rerunning updates existing products by SKU.
     *
     * ## OPTIONS
     *
     * --file=<path>
     * : Path to products.csv
     *
     * [--images=<dir>]
     * : Directory that holds the Zen Cart images (image_file column is relative to it)
     *
     * [--offset=<n>]
     * : Skip the first n top-level products
     *
     * [--limit=<n>]
     * : Process at most n top-level products (variations travel with their parent)
     *
     * [--sku=<sku>]
     * : Only import this SKU (a product or a parent ZEN-x SKU)
     *
     * [--dry-run]
     * : Report what would happen without writing
     *
     * [--skip-images]
     * : Do not touch images
     *
     * [--no-sibling-images]
     * : Ignore images the builder borrowed from a sibling item (flag image_from_sibling)
     *
     * [--force]
     * : Rewrite products even when their catalogue hash is unchanged
     *
     * ## EXAMPLES
     *
     *     wp rural catalogue import --file=/tmp/catalogue/products.csv --images=/tmp/catalogue/images
     *     wp rural catalogue import --file=products.csv --images=images --offset=0 --limit=200
     *
     * @when after_wp_load
     */
    public function import(array $args, array $assoc): void
    {
        if (!class_exists('WooCommerce')) {
            WP_CLI::error('WooCommerce is not active.');
        }
        $file = $assoc['file'] ?? '';
        if (!$file || !is_readable($file)) {
            WP_CLI::error('Pass --file=<path to products.csv>');
        }
        $this->imagesDir = rtrim((string) ($assoc['images'] ?? ''), '/');
        $this->dryRun = isset($assoc['dry-run']);
        $this->skipImages = isset($assoc['skip-images']);
        $this->noSiblingImages = isset($assoc['no-sibling-images']);
        $this->force = isset($assoc['force']);
        $offset = (int) ($assoc['offset'] ?? 0);
        $limit = isset($assoc['limit']) ? (int) $assoc['limit'] : PHP_INT_MAX;
        $onlySku = isset($assoc['sku']) ? (string) $assoc['sku'] : '';

        [$products, $variations] = $this->readCatalogue($file);
        WP_CLI::log(sprintf('Catalogue: %d top-level products, %d variations', count($products), array_sum(array_map('count', $variations))));

        if ($onlySku !== '') {
            $products = array_values(array_filter($products, fn($p) => $p['sku'] === $onlySku));
            if (!$products) {
                WP_CLI::error("SKU {$onlySku} not found in catalogue.");
            }
        } else {
            $products = array_slice($products, $offset, $limit);
        }

        $this->disableExpensiveHooks();
        $progress = \WP_CLI\Utils\make_progress_bar('Importing', count($products));
        $i = 0;
        foreach ($products as $row) {
            try {
                $this->importProduct($row, $variations[$row['sku']] ?? []);
            } catch (\Throwable $e) {
                $this->stats['errors']++;
                WP_CLI::warning(sprintf('%s: %s', $row['sku'], $e->getMessage()));
            }
            $progress->tick();
            if (++$i % 25 === 0) {
                $this->releaseMemory();
            }
        }
        $progress->finish();
        if (!$this->dryRun) {
            wc_update_product_lookup_tables();
            $this->recountTerms();
        }
        WP_CLI::success(sprintf(
            'created=%d updated=%d skipped(unchanged)=%d variations=%d images=%d errors=%d%s',
            $this->stats['created'], $this->stats['updated'], $this->stats['skipped'], $this->stats['variations'],
            $this->stats['images'], $this->stats['errors'], $this->dryRun ? ' (dry run)' : ''
        ));
    }

    /**
     * Delete every WooCommerce product and variation. Attachments created by the importer can go too.
     *
     * ## OPTIONS
     *
     * [--attachments]
     * : Also delete media the importer uploaded
     *
     * [--yes]
     * : Skip the confirmation
     *
     * @when after_wp_load
     */
    public function purge(array $args, array $assoc): void
    {
        WP_CLI::confirm('Delete ALL products and variations on this site?', $assoc);
        global $wpdb;
        $ids = $wpdb->get_col("SELECT ID FROM {$wpdb->posts} WHERE post_type IN ('product','product_variation') ORDER BY post_type = 'product'");
        $progress = \WP_CLI\Utils\make_progress_bar('Deleting products', count($ids));
        $this->disableExpensiveHooks();
        foreach ($ids as $n => $id) {
            $product = wc_get_product((int) $id);
            if ($product) {
                $product->delete(true);
            } else {
                wp_delete_post((int) $id, true);
            }
            $progress->tick();
            if ($n % 100 === 0) {
                $this->releaseMemory();
            }
        }
        $progress->finish();
        if (isset($assoc['attachments'])) {
            $atts = $wpdb->get_col($wpdb->prepare("SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s", self::META_SOURCE_IMAGE));
            $progress = \WP_CLI\Utils\make_progress_bar('Deleting attachments', count($atts));
            foreach ($atts as $id) {
                wp_delete_attachment((int) $id, true);
                $progress->tick();
            }
            $progress->finish();
        }
        $this->recountTerms();
        WP_CLI::success(sprintf('Deleted %d products/variations.', count($ids)));
    }

    /**
     * Show catalogue counts on this site.
     *
     * @when after_wp_load
     */
    public function status(): void
    {
        global $wpdb;
        $rows = $wpdb->get_results("SELECT post_type, post_status, COUNT(*) AS n FROM {$wpdb->posts} WHERE post_type IN ('product','product_variation') GROUP BY post_type, post_status");
        foreach ($rows as $r) {
            WP_CLI::log(sprintf('%-18s %-10s %d', $r->post_type, $r->post_status, $r->n));
        }
        $withImage = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} pm JOIN {$wpdb->posts} p ON p.ID = pm.post_id WHERE p.post_type = 'product' AND pm.meta_key = '_thumbnail_id' AND pm.meta_value <> ''");
        $withXero = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT post_id) FROM {$wpdb->postmeta} WHERE meta_key = %s", self::META_XERO_CODE));
        WP_CLI::log("products with image: {$withImage}");
        WP_CLI::log("posts carrying a Xero item code: {$withXero}");
    }

    // ------------------------------------------------------------------ internals

    /** @return array{0: array<int, array<string,string>>, 1: array<string, array<int, array<string,string>>>} */
    private function readCatalogue(string $file): array
    {
        $fh = fopen($file, 'r');
        if (!$fh) {
            WP_CLI::error("Cannot open {$file}");
        }
        $header = fgetcsv($fh);
        if (!$header) {
            WP_CLI::error('Empty CSV');
        }
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $header[0]);
        $products = [];
        $variations = [];
        while (($cells = fgetcsv($fh)) !== false) {
            if (count($cells) !== count($header)) {
                continue;
            }
            $row = array_combine($header, $cells);
            if ($row['row_type'] === 'variation') {
                $variations[$row['parent_sku']][] = $row;
            } else {
                $products[] = $row;
            }
        }
        fclose($fh);
        return [$products, $variations];
    }

    private function importProduct(array $row, array $variationRows): void
    {
        $sku = trim($row['sku']);
        $isVariable = $row['row_type'] === 'variable';
        $hash = md5(wp_json_encode([$row, $variationRows, $this->skipImages, $this->noSiblingImages]));

        $existingId = wc_get_product_id_by_sku($sku);
        $product = $existingId ? wc_get_product($existingId) : null;
        if ($product && !$this->force && $product->get_meta(self::META_HASH, true) === $hash) {
            $this->stats['skipped']++;
            return;
        }
        if ($product && $product->get_parent_id()) {
            // SKU currently belongs to a variation of something else; remove it and start clean.
            if (!$this->dryRun) {
                $product->delete(true);
            }
            $product = null;
        }
        $wantedType = $isVariable ? 'variable' : 'simple';
        if ($product && $product->get_type() !== $wantedType) {
            if (!$this->dryRun) {
                $product->delete(true);
            }
            $product = null;
        }
        if ($this->dryRun) {
            WP_CLI::log(sprintf('[dry] %s %s "%s" cats=%s image=%s variations=%d', $product ? 'update' : 'create', $sku, $row['name'], $row['category_ids'], $row['image_file'], count($variationRows)));
            return;
        }

        $isNew = $product === null;
        $product = $product ?: ($isVariable ? new WC_Product_Variable() : new WC_Product_Simple());
        $this->applyCommonFields($product, $row);
        $product->set_sku($sku);
        $product->set_status('publish');
        $product->set_catalog_visibility($row['visibility'] === 'hidden' ? 'hidden' : 'visible');
        $product->set_description($row['description']);
        $product->set_short_description($row['short_description']);
        $product->set_category_ids($this->resolveCategories($row));
        $product->set_tax_status($row['tax_status'] === 'none' ? 'none' : 'taxable');
        $product->update_meta_data(self::META_ZEN_ID, $row['zen_product_id']);
        $product->update_meta_data(self::META_TIER, $row['match_tier']);
        $product->update_meta_data(self::META_ENQUIRE, $row['enquire_only'] === 'yes' ? 'yes' : 'no');

        if (!$this->skipImages) {
            $imageId = $this->resolveImage($row);
            if ($imageId) {
                $product->set_image_id($imageId);
            }
        }

        if ($isVariable) {
            $labels = array_values(array_unique(array_map(fn($v) => $v['variation_label'], $variationRows)));
            $attribute = new WC_Product_Attribute();
            $attribute->set_id(0);
            $attribute->set_name(self::ATTRIBUTE_NAME);
            $attribute->set_options($labels);
            $attribute->set_position(0);
            $attribute->set_visible(true);
            $attribute->set_variation(true);
            $product->set_attributes([$attribute]);
            $product->set_manage_stock(false);
            $product->set_regular_price('');
        } else {
            $product->set_regular_price($row['regular_price']);
            $this->applyStock($product, $row);
        }
        $product->update_meta_data(self::META_HASH, $hash);
        $productId = $product->save();
        $isNew ? $this->stats['created']++ : $this->stats['updated']++;

        if ($isVariable) {
            $this->syncVariations($productId, $variationRows);
            WC_Product_Variable::sync($productId);
        }
        wc_delete_product_transients($productId);
    }

    private function applyCommonFields(WC_Product $product, array $row): void
    {
        $product->set_name($row['name']);
        $product->update_meta_data(self::META_XERO_CODE, $row['row_type'] === 'variable' ? '' : trim($row['sku']));
    }

    private function applyStock(WC_Product $product, array $row): void
    {
        if ($row['manage_stock'] === 'yes') {
            $product->set_manage_stock(true);
            $product->set_stock_quantity((int) $row['stock_qty']);
            $product->set_stock_status(((int) $row['stock_qty']) > 0 ? 'instock' : 'outofstock');
        } else {
            $product->set_manage_stock(false);
            $product->set_stock_status($row['stock_status'] ?: 'instock');
        }
        $product->set_backorders('no');
    }

    private function syncVariations(int $parentId, array $rows): void
    {
        $keep = [];
        $attrKey = sanitize_title(self::ATTRIBUTE_NAME);
        foreach ($rows as $row) {
            $sku = trim($row['sku']);
            $existingId = wc_get_product_id_by_sku($sku);
            $variation = $existingId ? wc_get_product($existingId) : null;
            if ($variation && (!$variation instanceof WC_Product_Variation || $variation->get_parent_id() !== $parentId)) {
                $variation->delete(true);
                $variation = null;
            }
            $variation = $variation ?: new WC_Product_Variation();
            $variation->set_parent_id($parentId);
            $variation->set_sku($sku);
            $variation->set_status('publish');
            $variation->set_attributes([$attrKey => $row['variation_label']]);
            $variation->set_regular_price($row['regular_price']);
            $this->applyStock($variation, $row);
            $variation->update_meta_data(self::META_XERO_CODE, $sku);
            $variation->update_meta_data(self::META_ENQUIRE, $row['enquire_only'] === 'yes' ? 'yes' : 'no');
            $keep[] = $variation->save();
            $this->stats['variations']++;
        }
        // drop variations that are no longer in the catalogue
        $parent = wc_get_product($parentId);
        foreach ($parent->get_children() as $childId) {
            if (!in_array($childId, $keep, true)) {
                $child = wc_get_product($childId);
                if ($child) {
                    $child->delete(true);
                }
            }
        }
    }

    private function resolveImage(array $row): int
    {
        $file = trim($row['image_file']);
        if ($file === '' || $this->imagesDir === '') {
            return 0;
        }
        if ($this->noSiblingImages && str_contains($row['flags'], 'image_from_sibling')) {
            return 0;
        }
        if (isset($this->attachmentCache[$file])) {
            return $this->attachmentCache[$file];
        }
        $existing = get_posts([
            'post_type' => 'attachment',
            'post_status' => 'any',
            'posts_per_page' => 1,
            'fields' => 'ids',
            'meta_key' => self::META_SOURCE_IMAGE,
            'meta_value' => $file,
        ]);
        if ($existing) {
            return $this->attachmentCache[$file] = (int) $existing[0];
        }
        $path = $this->imagesDir . '/' . $file;
        if (!is_readable($path)) {
            WP_CLI::warning("image missing: {$path}");
            return $this->attachmentCache[$file] = 0;
        }
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $tmp = wp_tempnam(basename($file));
        copy($path, $tmp);
        $name = sanitize_file_name(basename($file));
        $id = media_handle_sideload(['name' => $name, 'tmp_name' => $tmp], 0, $row['name']);
        if (is_wp_error($id)) {
            @unlink($tmp);
            WP_CLI::warning("image failed {$file}: " . $id->get_error_message());
            return $this->attachmentCache[$file] = 0;
        }
        update_post_meta($id, self::META_SOURCE_IMAGE, $file);
        update_post_meta($id, '_wp_attachment_image_alt', $row['name']);
        $this->stats['images']++;
        return $this->attachmentCache[$file] = (int) $id;
    }

    private function parseIds(string $list): array
    {
        return array_values(array_filter(array_map('intval', preg_split('/[|,;]+/', $list) ?: [])));
    }

    private array $slugCache = [];

    /** Slugs survive a database rebuild; numeric ids are only a fallback when no slug column exists. */
    private function resolveCategories(array $row): array
    {
        $slugs = array_filter(array_map('trim', preg_split('/[|,;]+/', (string) ($row['category_slugs'] ?? '')) ?: []));
        if (!$slugs) {
            return $this->parseIds((string) ($row['category_ids'] ?? ''));
        }
        $ids = [];
        foreach ($slugs as $slug) {
            if (!array_key_exists($slug, $this->slugCache)) {
                $term = get_term_by('slug', $slug, 'product_cat');
                $this->slugCache[$slug] = $term instanceof WP_Term ? (int) $term->term_id : 0;
                if (!$this->slugCache[$slug]) {
                    WP_CLI::warning("category slug not found on this site: {$slug}");
                }
            }
            if ($this->slugCache[$slug]) {
                $ids[] = $this->slugCache[$slug];
            }
        }
        return array_values(array_unique($ids));
    }

    private function disableExpensiveHooks(): void
    {
        // no emails, no deferred product sync noise while bulk loading
        remove_all_actions('woocommerce_product_set_stock');
        remove_all_actions('woocommerce_variation_set_stock');
        add_filter('woocommerce_defer_transactional_emails', '__return_true');
        if (function_exists('wc_get_container')) {
            add_filter('woocommerce_product_import_process_item_data', '__return_null');
        }
        wp_defer_term_counting(true);
        wp_defer_comment_counting(true);
    }

    private function recountTerms(): void
    {
        wp_defer_term_counting(false);
        wp_defer_comment_counting(false);
        if (function_exists('wc_recount_all_terms')) {
            wc_recount_all_terms();
        }
    }

    private function releaseMemory(): void
    {
        global $wpdb, $wp_object_cache;
        $wpdb->queries = [];
        if (is_object($wp_object_cache) && method_exists($wp_object_cache, 'flush')) {
            wp_cache_flush();
        }
        $this->attachmentCache = array_slice($this->attachmentCache, -500, null, true);
        gc_collect_cycles();
    }
}

WP_CLI::add_command('rural catalogue', 'Rural_Catalogue_Command');
