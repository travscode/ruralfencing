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

if (is_front_page()) {
    array_unshift($templates, 'front-page.twig');
}

Timber::render($templates, $context);
