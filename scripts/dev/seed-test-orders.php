<?php
/**
 * Seed a test customer with orders in every state the account area shows, plus a second
 * customer with no orders for the empty state. Rerunnable: existing test users are reused
 * and their orders replaced.
 *
 *   wp eval-file scripts/dev/seed-test-orders.php
 *
 * Prints the user ids created. Only for test sites.
 */

if (!defined('WP_CLI') || !WP_CLI) {
    exit('Run through WP-CLI.');
}

$make_user = static function (string $login, string $email, string $first, string $last, array $address): int {
    $id = username_exists($login) ?: email_exists($email);
    if (!$id) {
        $id = wp_insert_user(['user_login' => $login, 'user_email' => $email, 'user_pass' => wp_generate_password(24), 'role' => 'customer', 'first_name' => $first, 'last_name' => $last, 'display_name' => $first]);
    }
    $customer = new WC_Customer((int) $id);
    $customer->set_first_name($first);
    $customer->set_last_name($last);
    foreach (['billing', 'shipping'] as $type) {
        $customer->{"set_{$type}_first_name"}($first);
        $customer->{"set_{$type}_last_name"}($last);
        foreach ($address as $k => $v) {
            $customer->{"set_{$type}_{$k}"}($v);
        }
    }
    $customer->set_billing_email($email);
    $customer->set_billing_phone('0412 345 678');
    $customer->save();
    return (int) $id;
};

$jane = $make_user('jane.farmer', 'jane.farmer@example.com', 'Jane', 'Farmer', ['address_1' => '148 Brookton Highway', 'city' => 'Roleystone', 'state' => 'WA', 'postcode' => '6111', 'country' => 'AU']);
$sam = $make_user('sam.newcustomer', 'sam.new@example.com', 'Sam', 'Nguyen', ['address_1' => '', 'city' => '', 'state' => 'WA', 'postcode' => '', 'country' => 'AU']);

// wipe Jane's previous seeded orders so the script is rerunnable
foreach (wc_get_orders(['customer_id' => $jane, 'limit' => -1, 'status' => array_keys(wc_get_order_statuses())]) as $old) {
    $old->delete(true);
}

$find = static function (string $sku) {
    $id = wc_get_product_id_by_sku($sku);
    return $id ? wc_get_product($id) : null;
};
$pick = static function (int $n) {
    $q = new WP_Query(['post_type' => 'product', 'posts_per_page' => $n, 'orderby' => 'rand', 'meta_query' => [['key' => '_thumbnail_id', 'compare' => 'EXISTS'], ['key' => '_price', 'value' => 5, 'compare' => '>=', 'type' => 'NUMERIC']], 'tax_query' => [['taxonomy' => 'product_type', 'field' => 'slug', 'terms' => 'simple']]]);
    return array_map(static fn($p) => wc_get_product($p->ID), $q->posts);
};

$orders = [
    ['status' => 'processing', 'days_ago' => 2, 'items' => 3, 'shipping' => ['flat_rate', 'Delivery (Perth metro)', 45], 'paid' => true, 'note' => 'Please leave at the side gate if no one is home.'],
    ['status' => 'on-hold', 'days_ago' => 1, 'items' => 1, 'shipping' => ['local_pickup', 'Pickup from Maddington', 0], 'paid' => false, 'gateway' => 'bacs'],
    ['status' => 'completed', 'days_ago' => 21, 'items' => 2, 'shipping' => ['flat_rate', 'Delivery (Perth metro)', 45], 'paid' => true, 'customer_note' => 'Dispatched with Toll. Tracking number RF7781290.'],
    ['status' => 'completed', 'days_ago' => 120, 'items' => 4, 'shipping' => ['local_pickup', 'Pickup from Maddington', 0], 'paid' => true, 'variation' => 'RR6 21 D/R END'],
    ['status' => 'cancelled', 'days_ago' => 65, 'items' => 1, 'shipping' => ['flat_rate', 'Delivery (Perth metro)', 45], 'paid' => false],
    ['status' => 'pending', 'days_ago' => 0, 'items' => 2, 'shipping' => ['flat_rate', 'Delivery (Perth metro)', 45], 'paid' => false],
];

$customer = new WC_Customer($jane);
$billing = $customer->get_billing();
$shipping = $customer->get_shipping();
$created = [];

foreach ($orders as $spec) {
    $order = wc_create_order(['customer_id' => $jane, 'created_via' => 'seed']);
    $products = $pick($spec['items']);
    if (!empty($spec['variation']) && ($v = $find($spec['variation']))) {
        array_unshift($products, $v);
    }
    foreach ($products as $i => $product) {
        if ($product) {
            $order->add_product($product, $i === 0 ? 2 : 1);
        }
    }
    $order->set_address($billing, 'billing');
    $order->set_address($shipping, 'shipping');
    [$method_id, $method_title, $cost] = $spec['shipping'];
    $ship = new WC_Order_Item_Shipping();
    $ship->set_method_id($method_id);
    $ship->set_method_title($method_title);
    $ship->set_total((string) $cost);
    $order->add_item($ship);
    $order->set_payment_method($spec['gateway'] ?? 'cod');
    $order->set_payment_method_title(($spec['gateway'] ?? 'cod') === 'bacs' ? 'Direct bank transfer' : 'Card');
    if (!empty($spec['note'])) {
        $order->set_customer_note($spec['note']);
    }
    $order->calculate_totals();
    $date = (new DateTime('now', wp_timezone()))->modify("-{$spec['days_ago']} days")->format('Y-m-d H:i:s');
    $order->set_date_created($date);
    if ($spec['paid']) {
        $order->set_date_paid($date);
        $order->set_transaction_id('TEST-' . wp_rand(100000, 999999));
    }
    $order->set_status($spec['status']);
    $order->save();
    if (!empty($spec['customer_note'])) {
        $order->add_order_note($spec['customer_note'], true);
    }
    $created[] = $order->get_id() . ':' . $spec['status'];
}

WP_CLI::success(sprintf('jane.farmer user=%d orders=[%s]; sam.newcustomer user=%d (no orders)', $jane, implode(' ', $created), $sam));
