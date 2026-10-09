<?php
if (PHP_SAPI !== 'cli' || !defined('RURAL_CONTENT_TEST') || RURAL_CONTENT_TEST !== '1') { exit('Disposable test runtime required.'); }
require '/wordpress/wp-load.php';
function check($condition, $message) { if (!$condition) { throw new RuntimeException($message); } echo "PASS $message\n"; }
$before = count(get_pages());
Rural_Helpful_Content::import(false);
check(count(get_pages()) === $before, 'Dry run does not modify pages');
$parent = wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_name' => 'help', 'post_title' => 'Helpful Info', 'post_content' => 'Existing editor content']);
$conflict = wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_parent' => $parent, 'post_name' => 'automatic-gates', 'post_title' => 'Existing unrelated page']);
try { Rural_Helpful_Content::import(true); check(false, 'Must reject collision'); }
catch (RuntimeException $e) { check(str_contains($e->getMessage(), 'unowned'), 'Unowned slug collision blocks import'); }
check(count(get_pages(['child_of' => $parent])) === 1, 'Conflict check makes no partial imports');
wp_delete_post($conflict, true);
Rural_Helpful_Content::import(true);
check(count(get_pages(['child_of' => $parent])) === 12, 'All twelve guides created beneath Helpful Info');
check(get_post($parent)->post_content === 'Existing editor content', 'Index editor content preserved');
foreach (Rural_Helpful_Content::guides() as $guide) {
    $page = get_page_by_path('help/' . $guide['slug']);
    check($page && $page->post_status === 'publish', $guide['slug'] . ' is published');
    check(str_contains($page->post_content, '<h2>') && !str_contains($page->post_content, '\n'), 'Clean section markup');
    check(Rural_Helpful_Content::legacy_target(wp_parse_url($guide['source'], PHP_URL_PATH)) === get_permalink($page), 'Legacy URL maps to new guide');
}
$page = get_page_by_path('help/automatic-gates');
wp_update_post(['ID' => $page->ID, 'post_content' => '<p>Editor revision</p>', 'post_name' => 'gate-planning']);
Rural_Helpful_Content::import(true);
check(count(get_pages(['child_of' => $parent])) === 12, 'Repeat import creates no duplicates after slug edit');
check(get_post($page->ID)->post_content === '<p>Editor revision</p>', 'Editor changes preserved');
check(Rural_Helpful_Content::legacy_target('/Information-Automatic-Gates') === get_permalink($page->ID), 'Redirect follows edited permalink');
wp_update_post(['ID' => $page->ID, 'post_status' => 'draft']);
Rural_Helpful_Content::import(true);
check(get_post($page->ID)->post_status === 'draft', 'Unpublishing is preserved');
check(Rural_Helpful_Content::legacy_target('/Information-Automatic-Gates') === '', 'Draft is not a redirect destination');
check(Rural_Helpful_Content::legacy_target('/unrelated-page') === '', 'Unrelated URLs are untouched');
echo "ALL CONTENT TESTS PASSED\n";
