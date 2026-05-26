<?php

use Timber\Timber;

$context = Timber::context();
$context['posts'] = Timber::get_posts();
$context['title'] = sprintf(__('Search results for "%s"', 'rural-boilerplate'), get_search_query());

Timber::render(['search.twig', 'archive.twig', 'index.twig'], $context);
