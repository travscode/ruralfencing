<?php

use Timber\Timber;

$context = Timber::context();
$post = Timber::get_post();
$context['post'] = $post;

if (post_password_required($post->ID)) {
    Timber::render('single-password.twig', $context);
    return;
}

Timber::render(['single-' . $post->post_type . '.twig', 'single.twig'], $context);
