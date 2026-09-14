<?php

use Timber\Timber;

$context = Timber::context();
$post = Timber::get_post();
$context['post'] = $post;

if (post_password_required($post->ID)) {
    Timber::render('single-password.twig', $context);
    return;
}

if (!function_exists('wc_get_product')) {
    Timber::render('single.twig', $context);
    return;
}

$product = wc_get_product($post->ID);
if (!$product instanceof WC_Product) {
    Timber::render('single.twig', $context);
    return;
}

$context['product'] = $product;
$context['title'] = (string) $product->get_name();

$breadcrumb_items = [
    [
        'title' => (string) __('Home', 'rural-boilerplate'),
        'url' => (string) home_url('/'),
    ],
];

$product_terms = get_the_terms($post->ID, 'product_cat');
$primary_term = null;
$primary_term_ancestors = [];
if (is_array($product_terms)) {
    foreach ($product_terms as $term) {
        if (!$term instanceof WP_Term) {
            continue;
        }
        $ancestors = get_ancestors((int) $term->term_id, 'product_cat');
        $ancestors = array_map('intval', is_array($ancestors) ? $ancestors : []);
        if ($primary_term === null || count($ancestors) > count($primary_term_ancestors)) {
            $primary_term = $term;
            $primary_term_ancestors = $ancestors;
        }
    }
}

if ($primary_term instanceof WP_Term) {
    $ancestor_ids = array_reverse($primary_term_ancestors);
    foreach ($ancestor_ids as $ancestor_id) {
        $ancestor = get_term((int) $ancestor_id, 'product_cat');
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

    $term_link = get_term_link($primary_term, 'product_cat');
    if (is_wp_error($term_link)) {
        $term_link = '';
    }

    $breadcrumb_items[] = [
        'title' => (string) $primary_term->name,
        'url' => (string) $term_link,
    ];
}

$breadcrumb_items[] = [
    'title' => (string) $product->get_name(),
    'url' => '',
];

$context['breadcrumb_items'] = $breadcrumb_items;

$theme_dir = get_stylesheet_directory();
$theme_uri = get_stylesheet_directory_uri();

$top = $primary_term;
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

$image_url = '';
$image_id = (int) $product->get_image_id();
if ($image_id) {
    $img = wp_get_attachment_image_url($image_id, 'full');
    if (is_string($img)) {
        $image_url = $img;
    }
}
if (!$image_url && function_exists('wc_placeholder_img_src')) {
    $image_url = (string) wc_placeholder_img_src('full');
}
$context['image_url'] = $image_url;

$gallery_urls = [];
foreach ((array) $product->get_gallery_image_ids() as $gid) {
    $u = wp_get_attachment_image_url((int) $gid, 'full');
    if (is_string($u) && $u !== '') {
        $gallery_urls[] = $u;
    }
}
$context['gallery_urls'] = $gallery_urls;

$badge = null;
$published_ts = strtotime((string) get_the_date('c', $post->ID));
$is_new = $published_ts ? ($published_ts > (time() - 30 * DAY_IN_SECONDS)) : false;
if ($product->is_featured()) {
    $badge = 'FEATURED';
} elseif ($is_new) {
    $badge = 'NEW';
}
$context['product_badge'] = $badge;

$sku = (string) $product->get_sku();
$context['sku'] = $sku;

$regular_price = $product->get_regular_price();
$sale_price = $product->get_sale_price();
$context['regular_price_html'] = $regular_price !== '' ? wc_price((float) $regular_price) : '';
$context['sale_price_html'] = $sale_price !== '' ? wc_price((float) $sale_price) : '';
$context['price_html'] = (string) $product->get_price_html();
$enquire_only = $product->get_meta('_weerts_enquire_only', true) === 'yes';
$is_in_stock = $product->is_in_stock();
$is_purchasable = $product->is_purchasable();
$context['enquire_only'] = $enquire_only;
$context['is_in_stock'] = $is_in_stock;
$context['is_purchasable'] = $is_purchasable;
$context['enquiry_status'] = isset($_GET['enquiry']) ? sanitize_key((string) wp_unslash($_GET['enquiry'])) : '';
$context['enquiry_form_action'] = admin_url('admin-post.php');
$context['enquiry_intro'] =
    'To make an order or get more information on this product, speak to one of our team on 1800 010 319 or fill in the form below.';

$variation_ui = null;
$default_selection = [];
if ($product instanceof WC_Product_Variable) {
    $attrs = $product->get_variation_attributes();
    $available = $product->get_available_variations();
    $default_selection = array_filter((array) $product->get_default_attributes());

    // No default set in Woo: preselect the first option that is actually in stock.
    if (!$default_selection && $available) {
        $pick = null;
        $is_pre_order = static fn(array $c): bool => (bool) preg_match('/pre.?order/i', implode(' ', array_map('strval', (array) ($c['attributes'] ?? []))));
        // first pass: in stock and not a pre-order; second pass: anything in stock
        foreach ([false, true] as $allow_pre_order) {
            foreach ($available as $candidate) {
                if (!empty($candidate['is_in_stock']) && !empty($candidate['is_purchasable']) && ($allow_pre_order || !$is_pre_order($candidate))) {
                    $pick = $candidate;
                    break 2;
                }
            }
        }
        $pick = $pick ?: $available[0];
        foreach ((array) ($pick['attributes'] ?? []) as $key => $value) {
            $default_selection[preg_replace('/^attribute_/', '', (string) $key)] = (string) $value;
        }
    }

    foreach ($attrs as $attr_name => $options) {
        if (!is_array($options) || empty($options)) {
            continue;
        }

        $label = wc_attribute_label($attr_name);
        $taxonomy = taxonomy_exists($attr_name) ? $attr_name : null;
        $field_key = sanitize_title($attr_name);
        $buttons = [];

        foreach ($options as $opt) {
            $opt = (string) $opt;
            if ($opt === '') {
                continue;
            }
            $btn_label = $opt;
            if ($taxonomy) {
                $term = get_term_by('slug', $opt, $taxonomy);
                if ($term instanceof WP_Term) {
                    $btn_label = (string) $term->name;
                }
            }
            $in_stock = false;
            foreach ($available as $candidate) {
                $cand_value = (string) ($candidate['attributes']['attribute_' . $field_key] ?? '');
                if ($cand_value === '' || $cand_value === $opt) {
                    $in_stock = $in_stock || !empty($candidate['is_in_stock']);
                }
            }
            $buttons[] = [
                'value' => $opt,
                'label' => $btn_label,
                'selected' => (string) ($default_selection[$field_key] ?? '') === $opt,
                'in_stock' => $in_stock,
            ];
        }

        $variation_ui = [
            'name' => $field_key,
            'label' => $label,
            'buttons' => $buttons,
        ];
        break;
    }
}
$context['variation_ui'] = $variation_ui;

ob_start();
if (!$enquire_only && $is_purchasable && $is_in_stock && $product instanceof WC_Product_Variable) {
    $available_variations = $product->get_available_variations();
    $attributes = $product->get_variation_attributes();
    $selected_attributes = $default_selection;

    printf(
        '<form class="variations_form cart rural-product__cart" action="%s" method="post" enctype="multipart/form-data" data-product_id="%d" data-product_variations="%s">',
        esc_url($product->get_permalink()),
        (int) $product->get_id(),
        esc_attr(wp_json_encode($available_variations))
    );

    echo '<div class="variations" aria-hidden="true" style="display:none;">';
    foreach ($attributes as $attribute_name => $options) {
        wc_dropdown_variation_attribute_options(
            [
                'options' => $options,
                'attribute' => $attribute_name,
                'product' => $product,
                'selected' => isset($selected_attributes[sanitize_title($attribute_name)])
                    ? $selected_attributes[sanitize_title($attribute_name)]
                    : '',
            ]
        );
    }
    echo '</div>';

    echo '<div class="single_variation_wrap">';
    // Woo renders its own price/availability block here; we keep it out of sight and update the
    // theme's own price/SKU elements from the found_variation event instead.
    echo '<div class="single_variation hidden" aria-hidden="true"></div>';
    wc_get_template('single-product/add-to-cart/variation.php');

    echo '<div class="woocommerce-variation-add-to-cart variations_button">';
    woocommerce_quantity_input(
        [
            'min_value' => 1,
            'max_value' => $product->get_max_purchase_quantity(),
            'input_value' => 1,
        ]
    );

    echo '<button type="submit" class="single_add_to_cart_button !inline-flex overflow-hidden rounded-md no-underline !border-0 !bg-transparent !p-0 focus:!outline-none focus:!shadow-none" disabled="disabled">';
    echo '<span class="!flex items-center bg-goldenrod px-[26px] py-7 text-birch" aria-hidden="true">';
    echo Timber::compile('icons/cart.twig', ['class' => 'h-6 w-6']);
    echo '</span>';
    echo '<span class="!flex items-center bg-white py-8 pl-[30px] pr-[60px] font-heading text-b3 uppercase tracking-button text-birch hover:bg-goldenrod">Add to Cart</span>';
    echo '</button>';
    printf('<input type="hidden" name="add-to-cart" value="%d" />', (int) $product->get_id());
    printf('<input type="hidden" name="product_id" value="%d" />', (int) $product->get_id());
    echo '<input type="hidden" name="variation_id" class="variation_id" value="0" />';
    echo '</div>';

    echo '</div>';
    echo '</form>';
} elseif (!$enquire_only && $is_purchasable && $is_in_stock) {
    printf(
        '<form class="cart rural-product__cart" action="%s" method="post" enctype="multipart/form-data">',
        esc_url($product->get_permalink())
    );
    woocommerce_quantity_input(
        [
            'min_value' => 1,
            'max_value' => $product->get_max_purchase_quantity(),
            'input_value' => 1,
        ],
        $product,
        false
    );
    printf('<input type="hidden" name="add-to-cart" value="%d" />', (int) $product->get_id());
    echo '<button type="submit" class="single_add_to_cart_button !inline-flex overflow-hidden rounded-md no-underline !border-0 !bg-transparent !p-0 focus:!outline-none focus:!shadow-none">';
    echo '<span class="!flex items-center bg-goldenrod px-[26px] py-7 text-birch" aria-hidden="true">';
    echo Timber::compile('icons/cart.twig', ['class' => 'h-6 w-6']);
    echo '</span>';
    echo '<span class="!flex items-center bg-white py-8 pl-[30px] pr-[60px] font-heading text-b3 uppercase tracking-button text-birch hover:bg-goldenrod">Add to Cart</span>';
    echo '</button>';
    echo '</form>';
} elseif (!$enquire_only) {
    echo '<div class="flex flex-col gap-4">';
    echo '<div class="inline-flex overflow-hidden rounded-md opacity-60">';
    echo '<span class="flex items-center bg-goldenrod px-[26px] py-7 text-birch" aria-hidden="true">';
    echo Timber::compile('icons/cart.twig', ['class' => 'h-6 w-6']);
    echo '</span>';
    echo '<span class="flex items-center bg-white py-8 pl-[30px] pr-[60px] font-heading text-b3 uppercase tracking-button text-birch">';
    echo esc_html($is_in_stock ? __('Unavailable', 'rural-boilerplate') : __('Out of Stock', 'rural-boilerplate'));
    echo '</span>';
    echo '</div>';
    echo '<p class="text-t7 leading-[23px] text-birch/70">';
    echo esc_html(
        $is_in_stock
            ? __('This product is currently unavailable for purchase.', 'rural-boilerplate')
            : __('This product is currently out of stock and cannot be added to the cart.', 'rural-boilerplate')
    );
    echo '</p>';
    echo '</div>';
}
$context['add_to_cart_html'] = (string) ob_get_clean();

$spec_lines = [];
foreach ($product->get_attributes() as $attribute) {
    if (!$attribute instanceof WC_Product_Attribute || !$attribute->get_visible()) {
        continue;
    }
    $name = wc_attribute_label($attribute->get_name());
    $values = $product->get_attribute($attribute->get_name());
    if ($values === '') {
        continue;
    }
    $spec_lines[] = [
        'name' => (string) $name,
        'value' => (string) $values,
    ];
}
$context['spec_lines'] = $spec_lines;

$related_ids = wc_get_related_products((int) $product->get_id(), 12, [(int) $product->get_id()]);
if ($related_ids === [] && $primary_term instanceof WP_Term) {
    $fallback_ids = get_posts(
        [
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => 12,
            'fields' => 'ids',
            'post__not_in' => [(int) $product->get_id()],
            'tax_query' => [
                [
                    'taxonomy' => 'product_cat',
                    'field' => 'term_id',
                    'terms' => [(int) $primary_term->term_id],
                    'include_children' => true,
                ],
            ],
            'orderby' => 'date',
            'order' => 'DESC',
        ]
    );

    $related_ids = array_map('intval', is_array($fallback_ids) ? $fallback_ids : []);
}

$related_ids = array_values(array_filter(array_map('intval', $related_ids)));
$context['related_products_shortcode'] = $related_ids !== []
    ? '[weerts_products limit="12" columns="4" ids="' . esc_attr(implode(',', $related_ids)) . '" show_badges="true" show_sale_flash="false"]'
    : '';

Timber::render('single-product.twig', $context);
