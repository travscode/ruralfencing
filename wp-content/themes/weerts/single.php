<?php

use Timber\Timber;

$context = Timber::context();
$post = Timber::get_post();

if (!$post) {
    status_header(404);
    Timber::render('404.twig', $context);
    return;
}

$context['post'] = $post;

if (post_password_required($post->ID)) {
    Timber::render('single-password.twig', $context);
    return;
}

if ($post->post_type === 'post') {
    $image_url = get_the_post_thumbnail_url($post->ID, 'full');
    $context['hero_image_url'] = is_string($image_url) ? $image_url : '';
    $context['post_date_display'] = (string) get_the_date('d M Y', $post->ID);

    $category_links = [];
    $post_categories = get_the_category($post->ID);
    if (is_array($post_categories)) {
        foreach ($post_categories as $category) {
            if (!$category instanceof WP_Term) {
                continue;
            }

            $category_links[] = [
                'name' => (string) $category->name,
                'slug' => (string) $category->slug,
                'url' => (string) home_url('/tips/' . $category->slug . '/'),
            ];
        }
    }

    $context['post_category_links'] = $category_links;

    $permalink = (string) get_permalink($post->ID);
    $encoded_url = rawurlencode($permalink);
    $encoded_title = rawurlencode((string) get_the_title($post->ID));
    $context['share_url'] = $permalink;
    $context['share_links'] = [
        [
            'label' => 'Facebook',
            'url' => 'https://www.facebook.com/sharer/sharer.php?u=' . $encoded_url,
            'icon' => 'facebook',
        ],
        [
            'label' => 'LinkedIn',
            'url' => 'https://www.linkedin.com/sharing/share-offsite/?url=' . $encoded_url,
            'icon' => 'linkedin',
        ],
        [
            'label' => 'X',
            'url' => 'https://twitter.com/intent/tweet?url=' . $encoded_url . '&text=' . $encoded_title,
            'icon' => 'x',
        ],
    ];

    $related_args = [
        'post_type' => 'post',
        'post_status' => 'publish',
        'posts_per_page' => 3,
        'post__not_in' => [$post->ID],
        'ignore_sticky_posts' => true,
        'orderby' => 'date',
        'order' => 'DESC',
    ];

    $category_ids = array_values(
        array_filter(
            array_map(
                static function ($category): int {
                    return $category instanceof WP_Term ? (int) $category->term_id : 0;
                },
                is_array($post_categories) ? $post_categories : []
            )
        )
    );

    if ($category_ids !== []) {
        $related_args['category__in'] = $category_ids;
    }

    $related_posts = Timber::get_posts($related_args);
    if (count($related_posts) === 0) {
        unset($related_args['category__in']);
        $related_posts = Timber::get_posts($related_args);
    }

    $context['related_posts'] = $related_posts;

    Timber::render('single-post.twig', $context);
    return;
}

Timber::render(['single-' . $post->post_type . '.twig', 'single.twig'], $context);
