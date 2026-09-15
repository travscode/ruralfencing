<?php
/**
 * My Account: menu, labels and helpers used by the templates in woocommerce/myaccount/.
 */

// Menu: drop Downloads (nothing digital is sold), speak the customer's language.
add_filter('woocommerce_account_menu_items', static function (array $items): array {
    unset($items['downloads'], $items['payment-methods']);
    $labels = [
        'dashboard' => 'Overview',
        'orders' => 'Orders',
        'edit-address' => 'Addresses',
        'edit-account' => 'Account details',
        'customer-logout' => 'Log out',
    ];
    $ordered = [];
    foreach ($labels as $key => $label) {
        if (isset($items[$key])) {
            $ordered[$key] = $label;
        }
    }
    return $ordered + $items;
}, 20);

// Orders list: ten per page.
add_filter('woocommerce_my_account_my_orders_query', static function (array $args): array {
    $args['limit'] = 10;
    return $args;
});

// Customers get things delivered; "shipping" is warehouse language.
add_filter('gettext_woocommerce', static function (string $translated, string $text): string {
    if (!function_exists('is_account_page') || !is_account_page()) {
        return $translated;
    }
    return $text === 'Shipping address' ? 'Delivery address' : $translated;
}, 10, 2);

// The account page uses its own header rather than the generic page title.
add_filter('woocommerce_account_menu_item_classes', static fn(array $classes) => $classes);

if (!function_exists('weerts_account_icon')) {
    /** Small inline icons for the account navigation. */
    function weerts_account_icon(string $endpoint): string
    {
        $icons = [
            'dashboard' => '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>',
            'orders' => '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5 10 3l7 3.5v7L10 17l-7-3.5z"/><path d="M3 6.5 10 10l7-3.5M10 10v7"/></svg>',
            'edit-address' => '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 18s6-5.2 6-9.5A6 6 0 0 0 4 8.5C4 12.8 10 18 10 18z"/><circle cx="10" cy="8.5" r="2.2"/></svg>',
            'edit-account' => '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="7" r="3.5"/><path d="M3.5 17.5c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5"/></svg>',
            'customer-logout' => '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H8M12.5 14l4-4-4-4M16.5 10H8"/></svg>',
        ];
        return $icons[$endpoint] ?? '';
    }
}

if (!function_exists('weerts_order_status_chip')) {
    /**
     * Customer-facing status label and tone.
     *
     * @return array{label:string, tone:string}
     */
    function weerts_order_status_chip(WC_Order $order): array
    {
        $map = [
            'pending' => ['Awaiting payment', 'muted'],
            'on-hold' => ['On hold', 'gold'],
            'processing' => ['Being prepared', 'cyan'],
            'completed' => ['Completed', 'green'],
            'cancelled' => ['Cancelled', 'clay'],
            'refunded' => ['Refunded', 'muted'],
            'failed' => ['Payment failed', 'clay'],
            'draft' => ['Draft', 'muted'],
        ];
        $status = $order->get_status();
        [$label, $tone] = $map[$status] ?? [wc_get_order_status_name($status), 'muted'];
        return ['label' => $label, 'tone' => $tone];
    }
}

if (!function_exists('weerts_order_status_chip_html')) {
    function weerts_order_status_chip_html(WC_Order $order): string
    {
        $chip = weerts_order_status_chip($order);
        return sprintf('<span class="rural-chip rural-chip--%s">%s</span>', esc_attr($chip['tone']), esc_html($chip['label']));
    }
}

if (!function_exists('weerts_order_status_explainer')) {
    /** One plain sentence a customer can act on. */
    function weerts_order_status_explainer(WC_Order $order): string
    {
        switch ($order->get_status()) {
            case 'pending':
                return 'We have not received payment for this order yet. Pay now to get it moving.';
            case 'on-hold':
                return 'We are waiting for your payment to clear. Once it does, we will start preparing your order.';
            case 'processing':
                return 'Payment received. Our warehouse team is preparing your order.';
            case 'completed':
                return $order->has_shipping_method('local_pickup') || $order->has_shipping_method('pickup_location')
                    ? 'This order has been collected. Thanks for shopping with us.'
                    : 'This order has been dispatched. Thanks for shopping with us.';
            case 'cancelled':
                return 'This order was cancelled. Nothing was charged for it.';
            case 'refunded':
                return 'This order has been refunded.';
            case 'failed':
                return 'The payment for this order did not go through. You can try again below.';
        }
        return '';
    }
}

if (!function_exists('weerts_order_item_thumbs')) {
    /**
     * Up to $max product images for an order, plus how many more items there are.
     *
     * @return array{thumbs: string[], more: int, count: int}
     */
    function weerts_order_item_thumbs(WC_Order $order, int $max = 3): array
    {
        $thumbs = [];
        $count = 0;
        foreach ($order->get_items('line_item') as $item) {
            $count++;
            if (count($thumbs) >= $max) {
                continue;
            }
            $product = $item instanceof WC_Order_Item_Product ? $item->get_product() : null;
            $thumbs[] = $product ? $product->get_image('woocommerce_thumbnail', ['loading' => 'lazy']) : wc_placeholder_img('woocommerce_thumbnail');
        }
        return ['thumbs' => $thumbs, 'more' => max(0, $count - count($thumbs)), 'count' => $count];
    }
}

if (!function_exists('weerts_account_button')) {
    /** The theme's arrow button, as HTML, for PHP templates. */
    function weerts_account_button(string $label, string $url, string $variant = 'primary', array $attrs = []): string
    {
        $extra = '';
        foreach ($attrs as $k => $v) {
            $extra .= ' ' . esc_attr($k) . '="' . esc_attr($v) . '"';
        }
        if ($variant === 'ghost') {
            return sprintf('<a class="rural-account__btn rural-account__btn--ghost" href="%s"%s>%s</a>', esc_url($url), $extra, esc_html($label));
        }
        $arrow = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1 6h9.5M6.5 2l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>';
        return sprintf('<a class="rural-button" href="%s"%s><span>%s</span><span>%s</span></a>', esc_url($url), $extra, $arrow, esc_html($label));
    }
}

if (!function_exists('weerts_customer_first_name')) {
    function weerts_customer_first_name(WP_User $user): string
    {
        $name = trim((string) $user->first_name);
        if ($name === '') {
            $customer = new WC_Customer($user->ID);
            $name = trim((string) $customer->get_billing_first_name());
        }
        return $name !== '' ? $name : (string) $user->display_name;
    }
}
