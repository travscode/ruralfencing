<?php

/**
 * Buffers plugin-driven templates so Timber can render them inside Twig.
 */
$GLOBALS['timberContext'] = Timber\Timber::context();
ob_start();
