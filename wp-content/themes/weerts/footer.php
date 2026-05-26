<?php

use Timber\Timber;

/**
 * Flushes the buffered plugin content into the Timber wrapper template.
 */
$timber_context = $GLOBALS['timberContext'] ?? null;

if ($timber_context === null) {
    throw new RuntimeException('Timber context not set in footer.');
}

$timber_context['content'] = ob_get_clean();

Timber::render(['page-plugin.twig'], $timber_context);
