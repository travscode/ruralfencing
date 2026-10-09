<?php
/** Run only in a disposable WordPress Playground, never against a real database. */
if (PHP_SAPI !== 'cli' || !is_file('/wordpress/wp-load.php') || !defined('RURAL_SEO_TEST') || RURAL_SEO_TEST !== '1') {
    exit('Requires a disposable Playground and RURAL_SEO_TEST=1.');
}
require '/wordpress/wp-load.php';
ini_set('display_errors', '1');
error_reporting(E_ALL & ~E_DEPRECATED);

function check($condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "PASS: {$message}\n";
}

// Exercise command logic without loading WP-CLI's separate process bootstrap.
class WP_CLI {
    public static function log($message): void {}
    public static function success($message): void {}
    public static function warning($message): void {}
    public static function error($message): void { throw new RuntimeException($message); }
    public static function add_command($name, $class): void {}
}
require '/wordpress/wp-content/mu-plugins/rural-seo/cli.php';

check(defined('WPSEO_VERSION'), 'Yoast is active');
check(class_exists('WooCommerce'), 'WooCommerce is active');
$cli = new Rural_SEO_CLI();
$visibility = get_option('blog_public');
$cli->setup([], ['apply' => true, 'logo-file' => '/theme/images/favicon-rural-fencing.png']);
check(get_option('blog_public') === $visibility, 'Setup preserves search visibility');
check(WPSEO_Options::get('enable_xml_sitemap') === true, 'Yoast XML sitemaps enabled');
check(WPSEO_Options::get('company_or_person') === 'company', 'Yoast configured as a business');
check((int) WPSEO_Options::get('company_logo_id') > 0, 'Business has the logo required for Yoast Organization output');

$home = wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Home', 'post_name' => 'home']);
$about = wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'About', 'post_name' => 'about']);
update_option('show_on_front', 'page');
update_option('page_on_front', $home);
$file = '/seo/legacy-metadata.json';
$snapshot = json_decode(file_get_contents($file), true);
foreach ($snapshot['rows'] as $row) {
    if ($row['type'] === 'product_cat') {
        wp_insert_term($row['slug'], 'product_cat', ['slug' => $row['slug']]);
    }
}
$term = get_term_by('slug', 'treated-pine-poles', 'product_cat');
$cli->import([], ['file' => $file]);
check(WPSEO_Taxonomy_Meta::get_term_meta($term, 'product_cat', 'title') === '', 'Dry run does not save term metadata');
$cli->import([], ['file' => $file, 'apply' => true]);
$expected = array_values(array_filter($snapshot['rows'], fn($row) => $row['slug'] === 'treated-pine-poles'))[0];
check(WPSEO_Taxonomy_Meta::get_term_meta($term, 'product_cat', 'title') === $expected['title'], 'Legacy category title imported exactly');
check(WPSEO_Taxonomy_Meta::get_term_meta($term, 'product_cat', 'desc') === $expected['description'], 'Legacy category description imported exactly');
check(get_post_meta($home, '_yoast_wpseo_title', true) !== '', 'Static homepage metadata imported');
check(get_post_meta($about, '_yoast_wpseo_metadesc', true) !== '', 'Page metadata imported');
$edited_meta = WPSEO_Taxonomy_Meta::get_term_meta($term, 'product_cat');
$edited_meta['wpseo_title'] = 'SEO team edited this';
$edited_meta['wpseo_canonical'] = 'https://example.test/editor-canonical/';
$edited_meta['wpseo_desc'] = '';
WPSEO_Taxonomy_Meta::set_values($term->term_id, 'product_cat', $edited_meta);
$cli->import([], ['file' => $file, 'apply' => true]);
check(WPSEO_Taxonomy_Meta::get_term_meta($term, 'product_cat', 'title') === 'SEO team edited this', 'Repeated import preserves editor changes');
check(WPSEO_Taxonomy_Meta::get_term_meta($term, 'product_cat', 'canonical') === 'https://example.test/editor-canonical/', 'Import preserves unrelated Yoast fields');

$test_home = 'https://rural.travis.work';
// Playground defines WP_HOME, so changing the database option alone is ineffective.
add_filter('home_url', static function ($url) use (&$test_home) {
    return $test_home . wp_parse_url($url, PHP_URL_PATH);
});
update_option('blog_public', 1);
check(Rural_SEO::robots('', 1) === "User-agent: *\nDisallow: /\n", 'Known demo stays blocked even with blog_public=1');
check(Rural_SEO::yoast_robots(['index' => 'index'])['index'] === 'noindex', 'Demo overrides Yoast index directive');
check(Rural_SEO::robots_meta(['index' => true])['noindex'] === true, 'Demo overrides core index directive');
$test_home = 'https://www.ruralfencingsupplies.com.au';
$robots = Rural_SEO::robots("User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n", 1);
check(strpos($robots, 'Disallow: /wp-admin/') !== false && strpos($robots, '/sitemap_index.xml') !== false, 'Public robots preserves admin rule and advertises Yoast sitemap');
check(strpos($robots, 'Disallow: /wp-content/') === false, 'Public rules allow render assets');
update_option('blog_public', 0);
check(Rural_SEO::robots('', 0) === "User-agent: *\nDisallow: /\n", 'Search Engine Visibility remains respected');
update_option('blog_public', 1);

$graph = Rural_SEO::organization(['@id' => 'https://example.test/#organization', '@type' => 'Organization']);
check($graph['@id'] === 'https://example.test/#organization' && $graph['@type'] === 'Store', 'Business schema preserves Yoast identity');
check($graph['address']['postalCode'] === '6109', 'Business address matches contact page');

$product = new WC_Product_Simple();
$product->set_name('Test pine pole');
$product->set_status('publish');
$product->set_regular_price('40');
$product->set_price('40');
$product->set_category_ids([$term->term_id]);
$product->save();
// Supply a populated product object directly to the generator as the Timber template does.
$product->set_price('40');
$product->set_regular_price('40');
$GLOBALS['post'] = get_post($product->get_id());
WC()->structured_data->generate_product_data($product);
$schema = WC()->structured_data->get_data();
$products = array_values(array_filter($schema, fn($item) => $item['@type'] === 'Product'));
check(count($products) === 1 && isset($products[0]['offers']), 'WooCommerce generates one purchasable product with real offers');
$product->update_meta_data('_weerts_enquire_only', 'yes');
check(!isset(Rural_SEO::product_schema($products[0], $product)['offers']), 'Enquiry-only products do not claim a purchasable offer');
wp_insert_post(['post_type' => 'page', 'post_status' => 'draft', 'post_title' => 'Hidden Contact', 'post_name' => 'contact']);
$llms = Rural_SEO::llms();
check(strpos($llms, 'text/html') === false && strpos($llms, '## Product categories') !== false, 'AI directory contains populated categories');
check(strpos($llms, 'Hidden Contact') === false, 'AI directory excludes draft pages');
check(strpos($llms, 'rural.travis.work') === false, 'AI directory uses current domain');
check(Rural_SEO::description('An edited description') === 'An edited description', 'Description fallback preserves saved metadata');

$product->update_meta_data('_rural_zen_product_id', '123');
$product->save();
$source_html = '<title>Legacy pole</title><meta name="description" content="Legacy description"><input name="products_id" value="123">';
add_filter('pre_http_request', static function () use (&$source_html) {
    return ['headers' => [], 'body' => $source_html, 'response' => ['code' => 200, 'message' => 'OK'], 'cookies' => []];
});
$cli->collect_products([], ['file' => '/tmp/products-verified.json']);
$captured = json_decode(file_get_contents('/tmp/products-verified.json'), true);
check(count($captured['rows']) === 1 && $captured['rows'][0]['status'] === 'ready', 'Product collector verifies the legacy ID before copying metadata');
$source_html = '<title>Homepage</title><meta name="description" content="Generic shop description">';
$cli->collect_products([], ['file' => '/tmp/products-soft-404.json']);
$captured = json_decode(file_get_contents('/tmp/products-soft-404.json'), true);
check($captured['rows'][0]['status'] === 'review', 'Product collector rejects soft-404/homepage metadata');

// Syntax-check the custom template as well without invoking the Timber renderer.
token_get_all(file_get_contents('/theme/single-product.php'), TOKEN_PARSE);
echo "All integration checks passed.\n";
