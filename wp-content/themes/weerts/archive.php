<?php

use Timber\Timber;

$context = Timber::context();
$request_uri = isset($_SERVER['REQUEST_URI']) && is_string($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
$request_path = parse_url($request_uri, PHP_URL_PATH);
$request_path = is_string($request_path) ? trim($request_path, '/') : '';
$is_blog_archive = preg_match('#^tips(?:/|$)#', $request_path) === 1;

if ($is_blog_archive) {
    $context['posts'] = Timber::get_posts();
    $context['pagination'] = $context['posts']->pagination();
    $context['hero_title'] = 'Fencing, Gates & Irrigation Blog';
    $context['hero_body'] = 'Tips and advice on the right products to use for your fencing, gates and irrigation needs.';

    $selected_category_slug = (string) get_query_var('category_name');
    $selected_category_label = __('Show all', 'rural-boilerplate');
    $queried_object = get_queried_object();
    if ($queried_object instanceof WP_Term && $queried_object->taxonomy === 'category') {
        $selected_category_slug = (string) $queried_object->slug;
        $selected_category_label = (string) $queried_object->name;
    } elseif ($selected_category_slug !== '') {
        $selected_term = get_term_by('slug', $selected_category_slug, 'category');
        if ($selected_term instanceof WP_Term) {
            $selected_category_label = (string) $selected_term->name;
        }
    }

    $category_options = [
        [
            'label' => __('Show all', 'rural-boilerplate'),
            'slug' => '',
            'url' => (string) home_url('/tips/'),
        ],
    ];

    $categories = get_categories(
        [
            'taxonomy' => 'category',
            'hide_empty' => true,
            'orderby' => 'name',
            'order' => 'ASC',
        ]
    );

    foreach ($categories as $category) {
        if (!$category instanceof WP_Term) {
            continue;
        }

        $category_options[] = [
            'label' => (string) $category->name,
            'slug' => (string) $category->slug,
            'url' => (string) home_url('/tips/' . $category->slug . '/'),
        ];
    }

    $context['category_options'] = $category_options;
    $context['selected_category_slug'] = $selected_category_slug;
    $context['selected_category_label'] = $selected_category_label;

    Timber::render(['archive-posts.twig'], $context);
    return;
}

$context['posts'] = Timber::get_posts();
$context['title'] = get_the_archive_title();
$context['description'] = get_the_archive_description();

Timber::render(['archive.twig', 'index.twig'], $context);
