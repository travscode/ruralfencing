<?php

use Timber\Timber;

$context = Timber::context();
$context['posts'] = Timber::get_posts();
$author = get_queried_object();
$context['title'] = $author && isset($author->display_name) ? $author->display_name : __('Author Archive', 'rural-boilerplate');

Timber::render(['author.twig', 'archive.twig'], $context);
