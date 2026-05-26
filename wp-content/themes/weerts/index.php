<?php

use Timber\Timber;

$context = Timber::context();
$context['posts'] = Timber::get_posts();
$context['title'] = get_the_title((int) get_option('page_for_posts')) ?: __('Latest Posts', 'rural-boilerplate');

Timber::render(['index.twig'], $context);
