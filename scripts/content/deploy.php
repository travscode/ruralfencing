<?php
/** Staging deployment helper. No content is written on ordinary web requests. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__, 2) . '/wp-load.php';
if (wp_parse_url(home_url('/'), PHP_URL_HOST) !== 'rural.travis.work') {
    fwrite(STDERR, "Skipping automatic content import outside rural.travis.work. Use the reviewed WP-CLI import for launch.\n");
    exit(0);
}
if (!class_exists('Rural_Helpful_Content')) { throw new RuntimeException('Helpful content plugin is missing.'); }
foreach (Rural_Helpful_Content::import(true) as $row) {
    echo $row['action'] . ': ' . $row['path'] . "\n";
}
if (!class_exists('Rural_Tip_Images')) { throw new RuntimeException('Tips image plugin is missing.'); }
foreach (Rural_Tip_Images::import(true) as $row) {
    echo $row['action'] . ': ' . $row['slug'] . "\n";
}
wp_cache_flush();
