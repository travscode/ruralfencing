<?php

/**
 * Template Name: Privacy Policy
 *
 * This is a custom page template for the Privacy Policy page.
 * Uses Timber to render the template-privacy.twig file.
 *
 * @package YourThemeName
 * @since 1.0.0
 */

use Timber\Timber;

// Get the Timber context
$context = Timber::context();

// Get the current post object
$post = Timber::get_post();

// Add the post to the context
$context['post'] = $post;

// Render the template
Timber::render('template-privacy.twig', $context);
