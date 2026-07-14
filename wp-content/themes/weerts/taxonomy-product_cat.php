<?php

use Timber\Timber;

$context = Timber::context();
$term = get_queried_object();

if (!$term instanceof WP_Term) {
    Timber::render(['archive.twig', 'index.twig'], $context);
    return;
}

$term_link = get_term_link($term, 'product_cat');
if (is_wp_error($term_link)) {
    $term_link = '';
}

$context['term'] = $term;
$context['term_link'] = (string) $term_link;
$context['title'] = single_term_title('', false);

$breadcrumb_items = [
    [
        'title' => (string) __('Home', 'rural-boilerplate'),
        'url' => (string) home_url('/'),
    ],
];

$ancestor_ids = get_ancestors((int) $term->term_id, 'product_cat');
$ancestor_ids = array_reverse(array_map('intval', is_array($ancestor_ids) ? $ancestor_ids : []));
foreach ($ancestor_ids as $ancestor_id) {
    $ancestor = get_term($ancestor_id, 'product_cat');
    if (!$ancestor instanceof WP_Term) {
        continue;
    }
    $ancestor_link = get_term_link($ancestor, 'product_cat');
    if (is_wp_error($ancestor_link)) {
        $ancestor_link = '';
    }
    $breadcrumb_items[] = [
        'title' => (string) $ancestor->name,
        'url' => (string) $ancestor_link,
    ];
}

$breadcrumb_items[] = [
    'title' => (string) $term->name,
    'url' => '',
];

$context['breadcrumb_items'] = $breadcrumb_items;

$child_terms = get_terms(
    [
        'taxonomy' => 'product_cat',
        'hide_empty' => false,
        'parent' => (int) $term->term_id,
        'orderby' => 'name',
        'order' => 'ASC',
    ]
);

$has_children = is_array($child_terms) && count($child_terms) > 0;

$category_cards = [];
if (is_array($child_terms)) {
    foreach ($child_terms as $child_term) {
        if (!$child_term instanceof WP_Term) {
            continue;
        }
        $child_link = get_term_link($child_term, 'product_cat');
        if (is_wp_error($child_link)) {
            $child_link = '';
        }

        $thumbnail_id = (int) get_term_meta((int) $child_term->term_id, 'thumbnail_id', true);
        $image_url = $thumbnail_id ? wp_get_attachment_image_url($thumbnail_id, 'large') : '';

        $category_cards[] = [
            'id' => (int) $child_term->term_id,
            'name' => (string) $child_term->name,
            'link' => (string) $child_link,
            'image_url' => $image_url ? (string) $image_url : '',
        ];
    }
}

$context['category_cards'] = $category_cards;

$theme_dir = get_stylesheet_directory();
$theme_uri = get_stylesheet_directory_uri();

$top = $term;
while ($top instanceof WP_Term && (int) $top->parent > 0) {
    $maybe = get_term((int) $top->parent, 'product_cat');
    if (!$maybe instanceof WP_Term) {
        break;
    }
    $top = $maybe;
}

$icon_candidates = [];
if ($top instanceof WP_Term) {
    $icon_candidates[] = 'icon-' . $top->slug . '.svg';
    if (strpos((string) $top->slug, 'fencing') !== false) {
        $icon_candidates[] = 'icon-fencing.svg';
    }
}
$icon_candidates[] = 'icon-fencing.svg';

$banner_icon_url = '';
foreach ($icon_candidates as $file) {
    if (file_exists($theme_dir . '/images/' . $file)) {
        $banner_icon_url = $theme_uri . '/images/' . $file;
        break;
    }
}

$context['banner_icon_url'] = $banner_icon_url;

$optional_seo_content = null;
if (isset($context['site']) && $context['site'] instanceof RuralBoilerplateSite) {
    $seo_fields = $context['site']->get_product_cat_seo_fields((int) $term->term_id);
    if (!empty($seo_fields['enabled'])) {
        $paragraphs = preg_split('/\r\n|\r|\n/', (string) $seo_fields['paragraphs']) ?: [];
        $list_items = preg_split('/\r\n|\r|\n/', (string) $seo_fields['list_items']) ?: [];

        $optional_seo_content = [
            'eyebrow' => (string) $seo_fields['eyebrow'],
            'title' => (string) $seo_fields['title'],
            'body' => (string) $seo_fields['body'],
            'body_html' => (string) $seo_fields['body_html'],
            'paragraphs' => array_values(array_filter(array_map('trim', $paragraphs), 'strlen')),
            'list_items' => array_values(array_filter(array_map('trim', $list_items), 'strlen')),
            'image_url' => (string) $seo_fields['image_url'],
            'reverse' => !empty($seo_fields['reverse']),
            'cta_url' => (string) $seo_fields['cta_url'],
            'cta_text' => (string) $seo_fields['cta_text'],
            'cta2_url' => (string) $seo_fields['cta2_url'],
            'cta2_text' => (string) $seo_fields['cta2_text'],
            'cta2_icon' => (string) $seo_fields['cta2_icon'],
        ];
    }
}

$context['optional_seo_content'] = $optional_seo_content;

$products = [];
$pagination = '';
$showing_count = 0;
$total_count = 0;
$price_min = null;
$price_max = null;
$price_min_possible = null;
$price_max_possible = null;

if (!$has_children && function_exists('wc_get_product')) {
    $raw_min_price = isset($_GET['min_price']) ? (float) wp_unslash($_GET['min_price']) : null;
    $raw_max_price = isset($_GET['max_price']) ? (float) wp_unslash($_GET['max_price']) : null;
    $price_min = is_numeric($raw_min_price) ? max(0.0, (float) $raw_min_price) : null;
    $price_max = is_numeric($raw_max_price) ? max(0.0, (float) $raw_max_price) : null;

    $sort = isset($_GET['sort']) ? sanitize_text_field((string) wp_unslash($_GET['sort'])) : '';
    $sort = $sort !== '' ? $sort : 'name_asc';

    $sort_map = [
        'name_asc' => ['orderby' => 'title', 'order' => 'ASC'],
        'name_desc' => ['orderby' => 'title', 'order' => 'DESC'],
        'price_asc' => ['orderby' => 'meta_value_num', 'order' => 'ASC', 'meta_key' => '_price'],
        'price_desc' => ['orderby' => 'meta_value_num', 'order' => 'DESC', 'meta_key' => '_price'],
        'newest' => ['orderby' => 'date', 'order' => 'DESC'],
        'oldest' => ['orderby' => 'date', 'order' => 'ASC'],
    ];

    if (!array_key_exists($sort, $sort_map)) {
        $sort = 'name_asc';
    }

    $context['sort'] = $sort;

    $paged = (int) get_query_var('paged');
    if ($paged < 1) {
        $paged = (int) get_query_var('page');
    }
    if ($paged < 1) {
        $paged = 1;
    }

    $tax_query = [
        [
            'taxonomy' => 'product_cat',
            'field' => 'term_id',
            'terms' => [(int) $term->term_id],
            'include_children' => false,
        ],
    ];

    $meta_query = [];
    if ($price_min !== null) {
        $meta_query[] = [
            'key' => '_price',
            'value' => (string) $price_min,
            'compare' => '>=',
            'type' => 'DECIMAL(10,2)',
        ];
    }
    if ($price_max !== null) {
        $meta_query[] = [
            'key' => '_price',
            'value' => (string) $price_max,
            'compare' => '<=',
            'type' => 'DECIMAL(10,2)',
        ];
    }

    $per_page = 9;
    $query_args = [
        'post_type' => 'product',
        'post_status' => 'publish',
        'posts_per_page' => $per_page,
        'paged' => $paged,
        'tax_query' => $tax_query,
        'meta_query' => $meta_query,
        'orderby' => $sort_map[$sort]['orderby'],
        'order' => $sort_map[$sort]['order'],
    ];

    if (isset($sort_map[$sort]['meta_key'])) {
        $query_args['meta_key'] = $sort_map[$sort]['meta_key'];
    }

    $query = new WP_Query($query_args);

    $total_count = (int) $query->found_posts;
    $showing_count = is_array($query->posts) ? count($query->posts) : 0;

    foreach ($query->posts as $product_post) {
        if (!$product_post instanceof WP_Post) {
            continue;
        }
        $product = wc_get_product($product_post->ID);
        if (!$product instanceof WC_Product) {
            continue;
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
                    '<span class="text-t1 leading-[26px] text-terracotta-clay line-through">' .
                    wp_kses_post(wc_price((float) $regular)) .
                    '</span> ' .
                    '<span class="text-t3 font-bold leading-[26px] text-birch">' .
                    wp_kses_post(wc_price((float) $sale)) .
                    '</span>';
            }
        }
        if ($price_html === '') {
            $price_html =
                '<span class="text-t3 font-bold leading-[26px] text-birch">' .
                wp_kses_post($product->get_price_html()) .
                '</span>';
        }

        $published_ts = strtotime((string) get_the_date('c', $product_post));
        $is_new = $published_ts ? ($published_ts > (time() - 30 * DAY_IN_SECONDS)) : false;

        $badge = null;
        if ($product->is_featured()) {
            $badge = 'FEATURED';
        } elseif ($is_new) {
            $badge = 'NEW';
        }

        $products[] = [
            'id' => (int) $product_post->ID,
            'title' => (string) get_the_title($product_post),
            'link' => (string) get_permalink($product_post),
            'image_url' => (string) $image_url,
            'price_html' => (string) $price_html,
            'badge' => $badge,
        ];
    }

    if ($query->max_num_pages > 1) {
        $add_args = [];
        if ($price_min !== null) {
            $add_args['min_price'] = (string) $price_min;
        }
        if ($price_max !== null) {
            $add_args['max_price'] = (string) $price_max;
        }
        if ($sort !== '') {
            $add_args['sort'] = $sort;
        }

        $pagination = (string) paginate_links(
            [
                'total' => (int) $query->max_num_pages,
                'current' => $paged,
                'add_args' => $add_args,
                'type' => 'list',
            ]
        );
    }

    $min_post = get_posts(
        [
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => 1,
            'fields' => 'ids',
            'tax_query' => $tax_query,
            'meta_key' => '_price',
            'orderby' => 'meta_value_num',
            'order' => 'ASC',
        ]
    );
    if (is_array($min_post) && !empty($min_post)) {
        $p = wc_get_product((int) $min_post[0]);
        if ($p instanceof WC_Product) {
            $price_min_possible = (float) $p->get_price();
        }
    }

    $max_post = get_posts(
        [
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => 1,
            'fields' => 'ids',
            'tax_query' => $tax_query,
            'meta_key' => '_price',
            'orderby' => 'meta_value_num',
            'order' => 'DESC',
        ]
    );
    if (is_array($max_post) && !empty($max_post)) {
        $p = wc_get_product((int) $max_post[0]);
        if ($p instanceof WC_Product) {
            $price_max_possible = (float) $p->get_price();
        }
    }
}

$context['products'] = $products;
$context['pagination'] = $pagination;
$context['showing_count'] = $showing_count;
$context['total_count'] = $total_count;
$context['price_min'] = $price_min;
$context['price_max'] = $price_max;
$context['price_min_possible'] = $price_min_possible;
$context['price_max_possible'] = $price_max_possible;

$templates = $has_children
    ? ['taxonomy-product_cat.twig']
    : ['taxonomy-product_cat-products.twig', 'taxonomy-product_cat.twig'];

Timber::render($templates, $context);
