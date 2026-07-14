<?php

function weerts_get_block_pattern_content(string $key): string
{
    static $cache = [];

    if (array_key_exists($key, $cache)) {
        return (string) $cache[$key];
    }

    $path = __DIR__ . '/block-pattern-' . $key . '.html';
    if (!file_exists($path)) {
        $cache[$key] = '';
        return '';
    }

    $content = file_get_contents($path);
    if (!is_string($content)) {
        $cache[$key] = '';
        return '';
    }

    $cache[$key] = $content;

    return $content;
}

function weerts_register_block_patterns(string $theme_uri): void
{
    $default_bg = $theme_uri . '/images/home_bg.jpg';

    $home_hero_template = weerts_get_block_pattern_content('home-hero');
    if ($home_hero_template !== '') {
        register_block_pattern(
            'weerts/home-hero',
            [
                'title' => __('Home: Hero', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => sprintf($home_hero_template, esc_url($default_bg)),
            ]
        );
    }

    $location_strip = weerts_get_block_pattern_content('location-strip');
    if ($location_strip !== '') {
        register_block_pattern(
            'weerts/location-strip',
            [
                'title' => __('Home: Location strip', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => $location_strip,
            ]
        );
    }

    $home_intro = weerts_get_block_pattern_content('home-intro');
    if ($home_intro !== '') {
        register_block_pattern(
            'weerts/home-intro',
            [
                'title' => __('Home: Intro', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => $home_intro,
            ]
        );
    }

    $home_product_carousel = weerts_get_block_pattern_content('home-product-carousel');
    if ($home_product_carousel !== '') {
        register_block_pattern(
            'weerts/home-product-carousel',
            [
                'title' => __('Home: Product carousel', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => $home_product_carousel,
            ]
        );
    }

    $spotlight_icon = $theme_uri . '/images/icon-fencing.svg';
    $spotlight_img_1 = $theme_uri . '/images/category-fencing-1.png';
    $spotlight_img_2 = $theme_uri . '/images/category-fencing-2-62a8e6.png';
    $spotlight_img_3 = $theme_uri . '/images/category-fencing-3.png';

    $home_category_spotlight_template = weerts_get_block_pattern_content('home-category-spotlight');
    if ($home_category_spotlight_template !== '') {
        register_block_pattern(
            'weerts/home-category-spotlight',
            [
                'title' => __('Home: Category spotlight', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => sprintf(
                    $home_category_spotlight_template,
                    esc_url($spotlight_icon),
                    esc_url($spotlight_img_1),
                    esc_url($spotlight_img_2),
                    esc_url($spotlight_img_3)
                ),
            ]
        );
    }

    $home_category_spotlight_reverse_template = weerts_get_block_pattern_content('home-category-spotlight-reverse');
    if ($home_category_spotlight_reverse_template !== '') {
        register_block_pattern(
            'weerts/home-category-spotlight-reverse',
            [
                'title' => __('Home: Category spotlight (Reverse)', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => sprintf(
                    $home_category_spotlight_reverse_template,
                    esc_url($spotlight_icon),
                    esc_url($spotlight_img_1),
                    esc_url($spotlight_img_2),
                    esc_url($spotlight_img_3)
                ),
            ]
        );
    }

    $search_icon = $theme_uri . '/images/icon-search-30.svg';

    $home_search_strip_template = weerts_get_block_pattern_content('home-search-strip');
    if ($home_search_strip_template !== '') {
        register_block_pattern(
            'weerts/home-search-strip',
            [
                'title' => __('Home: Search strip', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => sprintf(
                    $home_search_strip_template,
                    esc_url($search_icon),
                    esc_url(home_url('/'))
                ),
            ]
        );
    }

    $home_faq = weerts_get_block_pattern_content('home-faq');
    if ($home_faq !== '') {
        register_block_pattern(
            'weerts/home-faq',
            [
                'title' => __('Home: FAQs', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => $home_faq,
            ]
        );
    }

    $cta_primary_image = $theme_uri . '/images/cta-primary.png';

    $home_cta_primary_template = weerts_get_block_pattern_content('home-cta-primary');
    if ($home_cta_primary_template !== '') {
        register_block_pattern(
            'weerts/home-cta-primary',
            [
                'title' => __('Home: CTA (Primary)', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => sprintf($home_cta_primary_template, esc_url($cta_primary_image)),
            ]
        );
    }

    $internal_banner_bg = $theme_uri . '/images/internal-banner-bg-1c16be.png';

    $internal_hero_template = weerts_get_block_pattern_content('internal-hero');
    if ($internal_hero_template !== '') {
        register_block_pattern(
            'weerts/internal-hero',
            [
                'title' => __('Internal: Mini hero', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => sprintf($internal_hero_template, esc_url($internal_banner_bg)),
            ]
        );
    }

    $txt_img_1 = $theme_uri . '/images/txt-img-block-1.png';
    $txt_img_2 = $theme_uri . '/images/txt-img-block-2.png';

    $txt_img_template = weerts_get_block_pattern_content('txt-img');
    if ($txt_img_template !== '') {
        register_block_pattern(
            'weerts/txt-img',
            [
                'title' => __('Internal: Text + Image', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => sprintf($txt_img_template, esc_url($txt_img_1)),
            ]
        );
    }

    $txt_img_reverse_template = weerts_get_block_pattern_content('txt-img-reverse');
    if ($txt_img_reverse_template !== '') {
        register_block_pattern(
            'weerts/txt-img-reverse',
            [
                'title' => __('Internal: Text + Image (Reverse)', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => sprintf($txt_img_reverse_template, esc_url($txt_img_2)),
            ]
        );
    }

    $txt_img_3 = $theme_uri . '/images/txt-img-block-3.png';
    $pdf_icon = $theme_uri . '/images/icon-pdf.svg';

    $txt_img_multi_cta_template = weerts_get_block_pattern_content('txt-img-multi-cta');
    if ($txt_img_multi_cta_template !== '') {
        register_block_pattern(
            'weerts/txt-img-multi-cta',
            [
                'title' => __('Internal: Text + Image (Multi CTA)', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => sprintf(
                    $txt_img_multi_cta_template,
                    esc_url($txt_img_3),
                    esc_url($pdf_icon)
                ),
            ]
        );
    }

    $quote_icon = $theme_uri . '/images/icon-quote-marks.svg';

    $testimonials_carousel_template = weerts_get_block_pattern_content('testimonials-carousel');
    if ($testimonials_carousel_template !== '') {
        register_block_pattern(
            'weerts/testimonials-carousel',
            [
                'title' => __('Home: Testimonials carousel', 'rural-boilerplate'),
                'categories' => ['weerts'],
                'content' => sprintf($testimonials_carousel_template, esc_url($quote_icon)),
            ]
        );
    }
}
