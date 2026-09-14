<?php

namespace Rural_Xero;

use WP_CLI;

/**
 * `wp rural xero ...`
 */
final class CLI
{
    /**
     * Show connection state and the last stock pull.
     *
     * @when after_wp_load
     */
    public function status(): void
    {
        $oauth = OAuth::instance();
        $t = $oauth->tokens();
        WP_CLI::log('connected: ' . ($oauth->is_connected() ? 'yes (' . ($t['tenant_name'] ?? $t['tenant_id']) . ')' : 'no'));
        if ($t) {
            WP_CLI::log('access token expires: ' . wp_date('Y-m-d H:i:s', (int) ($t['expires_at'] ?? 0)));
        }
        WP_CLI::log('redirect uri: ' . $oauth->redirect_uri());
        $last = Stock_Sync::instance()->last();
        WP_CLI::log('last pull: ' . ($last ? wp_json_encode($last) : 'never'));
        if (function_exists('as_next_scheduled_action')) {
            $next = as_next_scheduled_action(Stock_Sync::HOOK);
            WP_CLI::log('next pull: ' . ($next ? wp_date('Y-m-d H:i:s', $next) : 'not scheduled'));
        }
    }

    /**
     * Print the URL a Xero admin should open to authorise this site.
     *
     * @when after_wp_load
     */
    public function connect_url(): void
    {
        WP_CLI::line(OAuth::instance()->authorize_url());
    }

    /**
     * Pull stock (and prices) from Xero now.
     *
     * ## OPTIONS
     *
     * [--full]
     * : Ignore the last-run timestamp and fetch every item
     *
     * @when after_wp_load
     */
    public function pull_stock(array $args, array $assoc): void
    {
        $result = Stock_Sync::instance()->pull(isset($assoc['full']));
        if (is_wp_error($result)) {
            WP_CLI::error($result->get_error_message());
        }
        WP_CLI::success(wp_json_encode($result));
    }

    /**
     * Push one order to Xero as an invoice.
     *
     * ## OPTIONS
     *
     * <order_id>
     * : The order id
     *
     * [--preview]
     * : Print the invoice payload without sending it
     *
     * @when after_wp_load
     */
    public function push_order(array $args, array $assoc): void
    {
        $order = wc_get_order((int) $args[0]);
        if (!$order) {
            WP_CLI::error('No such order');
        }
        if (isset($assoc['preview'])) {
            $invoice = Order_Sync::instance()->build_invoice($order);
            if (is_wp_error($invoice)) {
                WP_CLI::error($invoice->get_error_message());
            }
            WP_CLI::line(wp_json_encode($invoice, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            return;
        }
        $result = Order_Sync::instance()->push($order);
        if (is_wp_error($result)) {
            WP_CLI::error($result->get_error_message());
        }
        WP_CLI::success(wp_json_encode($result));
    }

    /**
     * Look up items in Xero by code fragment (checks the connection works).
     *
     * ## OPTIONS
     *
     * [--search=<text>]
     * : Filter on item code / name
     *
     * @when after_wp_load
     */
    public function items(array $args, array $assoc): void
    {
        $query = [];
        if (!empty($assoc['search'])) {
            $s = str_replace('"', '', (string) $assoc['search']);
            $query['where'] = 'Code.Contains("' . $s . '") OR Name.Contains("' . $s . '")';
        }
        $data = Api::get('Items', $query);
        if (is_wp_error($data)) {
            WP_CLI::error($data->get_error_message());
        }
        $rows = [];
        foreach ($data['Items'] ?? [] as $item) {
            $rows[] = [
                'Code' => $item['Code'] ?? '',
                'Name' => mb_substr((string) ($item['Name'] ?? ''), 0, 50),
                'Tracked' => !empty($item['IsTrackedAsInventory']) ? 'yes' : 'no',
                'QOH' => $item['QuantityOnHand'] ?? '',
                'Price' => $item['SalesDetails']['UnitPrice'] ?? '',
                'Woo' => Stock_Sync::find_product_id((string) ($item['Code'] ?? '')) ?: '-',
            ];
        }
        WP_CLI\Utils\format_items('table', $rows, ['Code', 'Name', 'Tracked', 'QOH', 'Price', 'Woo']);
    }
}
