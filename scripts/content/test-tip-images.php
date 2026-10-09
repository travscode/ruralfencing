<?php
if (PHP_SAPI !== 'cli' || !defined('RURAL_CONTENT_TEST') || RURAL_CONTENT_TEST !== '1') { exit('Disposable test environment required.'); }
require '/wordpress/wp-load.php';
function check_image($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
    echo "PASS $message\n";
}
$downloads = 0;
add_filter('pre_http_request', static function ($pre, $args, $url) use (&$downloads) {
    if ($url !== 'https://blog.ruralfencingsupplies.com.au/wp-content/uploads/test.png') { return $pre; }
    $downloads++;
    file_put_contents($args['filename'], base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='));
    return ['headers' => ['content-type' => 'image/png'], 'body' => '', 'response' => ['code' => 200, 'message' => 'OK'], 'cookies' => []];
}, 10, 3);
$rows = [];
foreach (['image-test-one', 'image-test-two'] as $slug) {
    $id = wp_insert_post(['post_type' => 'post', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $slug]);
    update_post_meta($id, '_thumbnail_id', 900001);
    $rows[] = ['slug' => $slug, 'expected_thumbnail_id' => 900001, 'source_image' => 'https://blog.ruralfencingsupplies.com.au/wp-content/uploads/test.png', 'source_page' => 'https://blog.ruralfencingsupplies.com.au/test/', 'alt' => 'Fence beside a paddock'];
}
Rural_Tip_Images::import(false, $rows);
check_image($downloads === 0, 'Preview downloads nothing');
Rural_Tip_Images::import(true, $rows);
$one = get_page_by_path('image-test-one', OBJECT, 'post');
$two = get_page_by_path('image-test-two', OBJECT, 'post');
$attachment = get_post_thumbnail_id($one);
check_image($attachment && is_file(get_attached_file($attachment)), 'Featured image is stored locally');
check_image($attachment === get_post_thumbnail_id($two) && $downloads === 1, 'Shared sources reuse one attachment');
check_image(get_post_meta($attachment, '_wp_attachment_image_alt', true) === 'Fence beside a paddock', 'Alt text saved');
check_image((int) get_post_meta($one->ID, '_rural_tip_previous_thumbnail', true) === 900001, 'Previous selection retained for rollback');
Rural_Tip_Images::import(true, $rows);
check_image($downloads === 1, 'Repeated import does not duplicate media');
update_post_meta($one->ID, '_thumbnail_id', 900002);
Rural_Tip_Images::import(true, $rows);
check_image(get_post_thumbnail_id($one) === 900002, 'Editor selection preserved');
$bad = $rows[0];
$bad['expected_thumbnail_id'] = 900002;
$bad['source_image'] = 'https://example.com/wrong.png';
$rejected = false;
try { Rural_Tip_Images::import(true, [$bad]); }
catch (RuntimeException $error) { $rejected = str_contains($error->getMessage(), 'Unapproved image source'); }
check_image($rejected && get_post_thumbnail_id($one) === 900002, 'Unapproved sources rejected without changing the article');
echo "ALL IMAGE IMPORT TESTS PASSED\n";
