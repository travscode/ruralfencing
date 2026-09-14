<?php
/**
 * Shared helpers for product listings (category pages and search results):
 * card data, sort options, price filters and pagination in the shape the Twig partials expect.
 */

if (!function_exists('weerts_listing_sort_map')) {
    /**
     * Sort keys used by the listing toolbar -> WP_Query args.
     * "relevance" only makes sense when a search term is present.
     */
    function weerts_listing_sort_map(bool $with_relevance = false): array
    {
        $map = [];
        if ($with_relevance) {
            $map['relevance'] = ['label' => 'Relevance', 'orderby' => 'relevance', 'order' => 'DESC'];
        }
        $map += [
            'name_asc' => ['label' => 'Product Name (A–Z)', 'orderby' => 'title', 'order' => 'ASC'],
            'name_desc' => ['label' => 'Product Name (Z–A)', 'orderby' => 'title', 'order' => 'DESC'],
            'price_asc' => ['label' => 'Price (Low–High)', 'orderby' => 'meta_value_num', 'order' => 'ASC', 'meta_key' => '_price'],
            'price_desc' => ['label' => 'Price (High–Low)', 'orderby' => 'meta_value_num', 'order' => 'DESC', 'meta_key' => '_price'],
            'newest' => ['label' => 'Newest', 'orderby' => 'date', 'order' => 'DESC'],
            'oldest' => ['label' => 'Oldest', 'orderby' => 'date', 'order' => 'ASC'],
        ];
        return $map;
    }
}

if (!function_exists('weerts_listing_sort_options')) {
    /** [{value,label}] for the toolbar select. */
    function weerts_listing_sort_options(bool $with_relevance = false): array
    {
        $out = [];
        foreach (weerts_listing_sort_map($with_relevance) as $key => $def) {
            $out[] = ['value' => $key, 'label' => $def['label']];
        }
        return $out;
    }
}

if (!function_exists('weerts_listing_price_meta_query')) {
    /** Price bounds from the toolbar -> meta_query clauses. */
    function weerts_listing_price_meta_query(?float $min, ?float $max): array
    {
        $meta_query = [];
        if ($min !== null) {
            $meta_query[] = ['key' => '_price', 'value' => (string) $min, 'compare' => '>=', 'type' => 'DECIMAL(10,2)'];
        }
        if ($max !== null) {
            $meta_query[] = ['key' => '_price', 'value' => (string) $max, 'compare' => '<=', 'type' => 'DECIMAL(10,2)'];
        }
        return $meta_query;
    }
}

if (!function_exists('weerts_product_card_data')) {
    /**
     * Everything partials/product-card.twig needs for one product.
     *
     * @param WP_Post|int $product_post
     */
    function weerts_product_card_data($product_post): ?array
    {
        $product_post = $product_post instanceof WP_Post ? $product_post : get_post((int) $product_post);
        if (!$product_post instanceof WP_Post || !function_exists('wc_get_product')) {
            return null;
        }
        $product = wc_get_product($product_post->ID);
        if (!$product instanceof WC_Product) {
            return null;
        }

        $image_url = '';
        $image_id = (int) $product->get_image_id();
        if ($image_id) {
            $img = wp_get_attachment_image_url($image_id, 'large');
            if (is_string($img)) {
                $image_url = $img;
            }
        }
        if (!$image_url && function_exists('wc_placeholder_img_src')) {
            $image_url = (string) wc_placeholder_img_src('large');
        }

        $price_html = '';
        if ($product->is_on_sale()) {
            $regular = $product->get_regular_price();
            $sale = $product->get_sale_price();
            if ($regular !== '' && $sale !== '') {
                $price_html =
                    '<span class="text-t1 leading-[26px] text-birch/60 line-through">' . wp_kses_post(wc_price((float) $regular)) . '</span> ' .
                    '<span class="text-t3 font-bold leading-[26px] text-terracotta-clay">' . wp_kses_post(wc_price((float) $sale)) . '</span>';
            }
        }
        if ($price_html === '') {
            $price_html = '<span class="text-t3 font-bold leading-[26px] text-terracotta-clay">' . wp_kses_post($product->get_price_html()) . '</span>';
        }

        $published_ts = strtotime((string) get_the_date('c', $product_post));
        $is_new = $published_ts ? ($published_ts > (time() - 30 * DAY_IN_SECONDS)) : false;

        $badge = null;
        if ($product->is_featured()) {
            $badge = 'FEATURED';
        } elseif ($is_new) {
            $badge = 'NEW';
        }

        $category_names = [];
        foreach ((array) $product->get_category_ids() as $cat_id) {
            $term = get_term((int) $cat_id, 'product_cat');
            if ($term instanceof WP_Term && (int) $term->parent === 0) {
                $category_names[] = (string) $term->name;
            }
        }

        return [
            'id' => (int) $product_post->ID,
            'title' => (string) get_the_title($product_post),
            'link' => (string) get_permalink($product_post),
            'image_url' => (string) $image_url,
            'price_html' => (string) $price_html,
            'badge' => $badge,
            'sku' => (string) $product->get_sku(),
            'in_stock' => $product->is_in_stock(),
            'category' => $category_names ? (string) $category_names[0] : '',
        ];
    }
}

if (!function_exists('weerts_build_pagination')) {
    /**
     * Pagination in the same shape Timber's PostCollection::pagination() returns, so one Twig
     * partial serves blog archives, category pages and search results.
     *
     * @return array{pages: array, prev: ?array, next: ?array}|null
     */
    function weerts_build_pagination(int $total_pages, int $current, array $add_args = []): ?array
    {
        if ($total_pages < 2) {
            return null;
        }
        $current = max(1, min($current, $total_pages));
        $link = static function (int $page) use ($add_args): string {
            $url = get_pagenum_link($page, false);
            $url = remove_query_arg(array_keys($add_args), $url);
            $args = array_filter($add_args, static fn($v) => $v !== null && $v !== '');
            return $args ? add_query_arg(array_map('rawurlencode', $args), $url) : $url;
        };

        $window = [];
        foreach ([1, 2, $current - 1, $current, $current + 1, $total_pages - 1, $total_pages] as $n) {
            if ($n >= 1 && $n <= $total_pages) {
                $window[$n] = true;
            }
        }
        ksort($window);

        $pages = [];
        $previous_n = 0;
        foreach (array_keys($window) as $n) {
            if ($previous_n && $n - $previous_n > 1) {
                $pages[] = ['title' => '…', 'link' => null, 'ellipsis' => true];
            }
            $pages[] = ['title' => (string) $n, 'link' => $n === $current ? null : $link($n), 'current' => $n === $current];
            $previous_n = $n;
        }

        return [
            'pages' => $pages,
            'prev' => $current > 1 ? ['link' => $link($current - 1)] : null,
            'next' => $current < $total_pages ? ['link' => $link($current + 1)] : null,
        ];
    }
}

if (!function_exists('weerts_current_page_number')) {
    function weerts_current_page_number(): int
    {
        $paged = (int) get_query_var('paged');
        if ($paged < 1) {
            $paged = (int) get_query_var('page');
        }
        return max(1, $paged);
    }
}

if (!function_exists('weerts_sku_product_ids')) {
    /**
     * Products whose SKU (or a variation's SKU) contains the term. Customers search by part codes.
     *
     * @return int[]
     */
    function weerts_sku_product_ids(string $term): array
    {
        global $wpdb;
        $term = trim($term);
        if ($term === '' || strlen($term) < 2) {
            return [];
        }
        $like = '%' . $wpdb->esc_like($term) . '%';
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT p.ID, p.post_parent, p.post_type FROM {$wpdb->posts} p
             JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = '_sku'
             WHERE p.post_status = 'publish' AND p.post_type IN ('product','product_variation') AND m.meta_value LIKE %s
             LIMIT 500",
            $like
        ));
        $ids = [];
        foreach ((array) $rows as $row) {
            $ids[] = $row->post_type === 'product_variation' ? (int) $row->post_parent : (int) $row->ID;
        }
        return array_values(array_unique(array_filter($ids)));
    }
}

if (!function_exists('weerts_search_products_query')) {
    /**
     * WP_Query for a product search that also matches SKUs, honouring the listing filters.
     *
     * @param array{term:string, paged:int, per_page:int, sort:string, category_slug:string, availability:string, price_min:?float, price_max:?float} $args
     */
    function weerts_search_products_query(array $args): WP_Query
    {
        global $wpdb;
        $term = (string) $args['term'];
        $sort_map = weerts_listing_sort_map(true);
        $sort = isset($sort_map[$args['sort']]) ? $args['sort'] : 'relevance';

        $query_args = [
            'post_type' => 'product',
            'post_status' => 'publish',
            's' => $term,
            'posts_per_page' => (int) $args['per_page'],
            'paged' => (int) $args['paged'],
            'ignore_sticky_posts' => true,
            'orderby' => $sort_map[$sort]['orderby'],
            'order' => $sort_map[$sort]['order'],
            'meta_query' => weerts_listing_price_meta_query($args['price_min'], $args['price_max']),
            'tax_query' => [],
        ];
        if (isset($sort_map[$sort]['meta_key'])) {
            $query_args['meta_key'] = $sort_map[$sort]['meta_key'];
        }
        if ($args['category_slug'] !== '') {
            $query_args['tax_query'][] = ['taxonomy' => 'product_cat', 'field' => 'slug', 'terms' => [$args['category_slug']], 'include_children' => true];
        }
        if ($args['availability'] === 'instock') {
            $query_args['meta_query'][] = ['key' => '_stock_status', 'value' => 'instock'];
        } elseif ($args['availability'] === 'onsale' && function_exists('wc_get_product_ids_on_sale')) {
            $on_sale = wc_get_product_ids_on_sale();
            $query_args['post__in'] = $on_sale ? array_map('intval', $on_sale) : [0];
        }
        // hide products the shop has marked as hidden from the catalogue
        if (function_exists('wc_get_product_visibility_term_ids')) {
            $visibility = wc_get_product_visibility_term_ids();
            if (!empty($visibility['exclude-from-search'])) {
                $query_args['tax_query'][] = ['taxonomy' => 'product_visibility', 'field' => 'term_taxonomy_id', 'terms' => [(int) $visibility['exclude-from-search']], 'operator' => 'NOT IN'];
            }
        }

        $sku_ids = weerts_sku_product_ids($term);
        $filter = static function (string $search, WP_Query $q) use ($sku_ids, $wpdb): string {
            if (!$sku_ids || !$q->get('weerts_sku_search')) {
                return $search;
            }
            $trimmed = trim($search);
            if (stripos($trimmed, 'AND') !== 0) {
                return $search;
            }
            $inner = trim(substr($trimmed, 3));
            $ids = implode(',', array_map('intval', $sku_ids));
            return " AND ( {$inner} OR {$wpdb->posts}.ID IN ({$ids}) ) ";
        };
        $query_args['weerts_sku_search'] = true;
        add_filter('posts_search', $filter, 20, 2);
        $query = new WP_Query($query_args);
        remove_filter('posts_search', $filter, 20);
        return $query;
    }
}
