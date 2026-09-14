<?php
/**
 * Search results. Products are the primary result set and use the same grid, toolbar and
 * pagination as category pages. Help articles (blog posts) are surfaced as a secondary set:
 * a notice above the products with a jump link, and a compact grid below.
 *
 * ?s=term                  products first, articles secondary
 * ?s=term&post_type=post   articles first, with a link back to the products
 */

use Timber\Timber;

$context = Timber::context();

$term = trim((string) get_search_query(false));
$requested_type = isset($_GET['post_type']) ? sanitize_key((string) wp_unslash($_GET['post_type'])) : '';
$mode = $requested_type === 'post' ? 'articles' : 'products';
$paged = weerts_current_page_number();

$context['search_term'] = $term;
$context['mode'] = $mode;
$context['title'] = $term !== ''
    ? sprintf($mode === 'articles' ? 'Help articles for "%s"' : 'Results for "%s"', $term)
    : ($mode === 'articles' ? 'Help articles' : 'Search');
$context['breadcrumb_items'] = [
    ['title' => (string) __('Home', 'rural-boilerplate'), 'url' => (string) home_url('/')],
    ['title' => 'Search', 'url' => $mode === 'articles' ? add_query_arg(['s' => $term], home_url('/')) : ''],
];
if ($mode === 'articles') {
    $context['breadcrumb_items'][] = ['title' => 'Help articles', 'url' => ''];
}

$theme_dir = get_stylesheet_directory();
$theme_uri = get_stylesheet_directory_uri();
$context['banner_icon_url'] = file_exists($theme_dir . '/images/icon-fencing.svg') ? $theme_uri . '/images/icon-fencing.svg' : '';

// ---------------------------------------------------------------- filters shared with the advanced search drawer
$raw_min = isset($_GET['min_price']) && $_GET['min_price'] !== '' ? (float) wp_unslash($_GET['min_price']) : null;
$raw_max = isset($_GET['max_price']) && $_GET['max_price'] !== '' ? (float) wp_unslash($_GET['max_price']) : null;
$price_min = $raw_min !== null ? max(0.0, $raw_min) : null;
$price_max = $raw_max !== null ? max(0.0, $raw_max) : null;
$category_slug = isset($_GET['product_cat']) ? sanitize_title((string) wp_unslash($_GET['product_cat'])) : '';
$availability = isset($_GET['weerts_availability']) ? sanitize_key((string) wp_unslash($_GET['weerts_availability'])) : '';

$sort = isset($_GET['sort']) ? sanitize_key((string) wp_unslash($_GET['sort'])) : '';
if ($sort === '' && isset($_GET['weerts_sort'])) {
    // the advanced search drawer uses its own sort keys
    $sort = ['newest' => 'newest', 'price_low' => 'price_asc', 'price_high' => 'price_desc'][sanitize_key((string) wp_unslash($_GET['weerts_sort']))] ?? '';
}
$sort_map = weerts_listing_sort_map(true);
if (!isset($sort_map[$sort])) {
    $sort = 'relevance';
}

$category_label = '';
if ($category_slug !== '') {
    $cat_term = get_term_by('slug', $category_slug, 'product_cat');
    $category_label = $cat_term instanceof WP_Term ? (string) $cat_term->name : '';
}

$hidden_fields = ['s' => $term];
if ($category_slug !== '') {
    $hidden_fields['product_cat'] = $category_slug;
}
if ($availability !== '') {
    $hidden_fields['weerts_availability'] = $availability;
}
$pagination_args = array_merge($hidden_fields, [
    'sort' => $sort !== 'relevance' ? $sort : '',
    'min_price' => $price_min !== null ? (string) $price_min : '',
    'max_price' => $price_max !== null ? (string) $price_max : '',
]);

// ---------------------------------------------------------------- products
$products = [];
$product_total = 0;
$product_pagination = null;
$per_page = 12;

if ($term !== '' && function_exists('wc_get_product')) {
    $product_query = weerts_search_products_query([
        'term' => $term,
        'paged' => $mode === 'products' ? $paged : 1,
        'per_page' => $mode === 'products' ? $per_page : 1,
        'sort' => $sort,
        'category_slug' => $category_slug,
        'availability' => $availability,
        'price_min' => $price_min,
        'price_max' => $price_max,
    ]);
    $product_total = (int) $product_query->found_posts;
    if ($mode === 'products') {
        foreach ($product_query->posts as $product_post) {
            $card = weerts_product_card_data($product_post);
            if ($card) {
                $products[] = $card;
            }
        }
        $product_pagination = weerts_build_pagination((int) $product_query->max_num_pages, $paged, $pagination_args);
    }
}

// ---------------------------------------------------------------- help articles
$articles = [];
$article_total = 0;
$article_pagination = null;
$articles_preview_count = 3;

if ($term !== '') {
    $article_query = new WP_Query([
        'post_type' => 'post',
        'post_status' => 'publish',
        's' => $term,
        'posts_per_page' => $mode === 'articles' ? 9 : $articles_preview_count,
        'paged' => $mode === 'articles' ? $paged : 1,
        'ignore_sticky_posts' => true,
        'orderby' => 'relevance',
    ]);
    $article_total = (int) $article_query->found_posts;
    $articles = Timber::get_posts($article_query);
    if ($mode === 'articles') {
        $article_pagination = weerts_build_pagination((int) $article_query->max_num_pages, $paged, ['s' => $term, 'post_type' => 'post']);
    }
}

$context['products'] = $products;
$context['product_total'] = $product_total;
$context['showing_count'] = count($products);
$context['product_pagination'] = $product_pagination;
$context['articles'] = $articles;
$context['article_total'] = $article_total;
$context['article_pagination'] = $article_pagination;
$context['articles_preview_count'] = $articles_preview_count;
$context['sort'] = $sort;
$context['sort_options'] = weerts_listing_sort_options(true);
$context['price_min'] = $price_min;
$context['price_max'] = $price_max;
$context['hidden_fields'] = $hidden_fields;
$context['category_label'] = $category_label;
$context['availability'] = $availability;
$context['products_url'] = add_query_arg(array_filter(['s' => $term, 'product_cat' => $category_slug ?: null]), home_url('/'));
$context['articles_url'] = add_query_arg(['s' => $term, 'post_type' => 'post'], home_url('/'));
$context['clear_filters_url'] = add_query_arg(['s' => $term], home_url('/'));
$context['has_filters'] = $category_slug !== '' || $availability !== '' || $price_min !== null || $price_max !== null;

Timber::render(['search.twig'], $context);
