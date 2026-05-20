<?php

use Timber\Timber;

function get_post_categories()
{
    $args = array(
        'taxonomy' => 'category',
        'hide_empty' => true,
        'exclude' => 'general'
    );

    return Timber::get_terms($args);
}

function get_pulse_posts($posts_per_page = 3)
{
    $args = array(
        'post_type' => 'post',
        'posts_per_page' => $posts_per_page,
        'orderby' => 'date',
        'order' => 'DESC',
    );

    return Timber::get_posts($args);
}

function get_prev_post($current_post)
{
    // Try to get the previous post
    $args = [
        'post_type' => 'post',
        'posts_per_page' => 1,
        'orderby' => 'date',
        'order' => 'DESC',
        'date_query' => [
            [
                'before' => $current_post->post_date,
                'inclusive' => false,
            ],
        ],
    ];

    $prev_posts = Timber::get_posts($args);

    if (!empty($prev_posts)) {
        return $prev_posts[0];
    }

    // Fallback: get the latest post (excluding the current one)
    $fallback_args = [
        'post_type' => 'post',
        'posts_per_page' => 1,
        'orderby' => 'date',
        'order' => 'DESC',
        'post__not_in' => [$current_post->ID],
    ];

    $latest_posts = Timber::get_posts($fallback_args);

    return !empty($latest_posts) ? $latest_posts[0] : null;
}
