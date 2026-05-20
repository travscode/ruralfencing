<?php
/**
 * Template Name: Product Page
 * Description: Custom product page with unique header and page builder blocks.
 */

use Timber\Timber;

$context = Timber::context();
$post = Timber::get_post();
$context['post'] = $post;

Timber::render('template-product.twig', $context);