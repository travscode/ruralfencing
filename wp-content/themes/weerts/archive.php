<?php

use Timber\Timber;

$context = Timber::context();
$context['posts'] = Timber::get_posts();
$context['title'] = get_the_archive_title();
$context['description'] = get_the_archive_description();

Timber::render(['archive.twig', 'index.twig'], $context);
