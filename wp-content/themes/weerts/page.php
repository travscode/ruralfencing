<?php

use Timber\Timber;

$context = Timber::context();
$post = Timber::get_post();
$context['post'] = $post;

if (post_password_required($post->ID)) {
    Timber::render('single-password.twig', $context);
    return;
}

$templates = ['page-' . $post->post_name . '.twig', 'page.twig'];

if (get_post_meta($post->ID, '_rural_guide_source', true)) {
    $image = basename((string) get_post_meta($post->ID, '_rural_guide_image', true));
    $context['guide_image_url'] = $image ? get_stylesheet_directory_uri() . '/images/' . $image : '';
    array_unshift($templates, 'page-help-guide.twig');
}

if (is_front_page()) {
    array_unshift($templates, 'front-page.twig');
}

Timber::render($templates, $context);
