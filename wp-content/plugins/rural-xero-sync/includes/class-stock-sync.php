<?php

namespace Rural_Xero;

use WP_Error;

/**
 * Xero -> WooCommerce. Pulls Items on a schedule and writes QuantityOnHand (and optionally price)
 * onto the product or variation that carries the same item code.
 */
final class Stock_Sync
{
    public const HOOK = 'rural_xero_pull_stock';
    private const OPTION_LAST = 'rural_xero_last_pull';

    private static ?Stock_Sync $instance = null;

    public static function instance(): Stock_Sync
    {
        return self::$instance ??= new self();
    }

    public function hooks(): void
    {
        add_action(self::HOOK, [$this, 'run_scheduled']);
        add_action('init', [$this, 'ensure_schedule']);
    }

    /** Keep exactly one recurring action at the configured interval. */
    public function ensure_schedule(): void
    {
        if (!function_exists('as_next_scheduled_action') || !OAuth::instance()->is_connected()) {
            return;
        }
        $minutes = max(5, (int) Settings::get('stock_sync_minutes'));
        $wanted = Settings::get('stock_sync_enabled') === 'yes';
        $existing = as_next_scheduled_action(self::HOOK);
        $stored = (int) get_option('rural_xero_schedule_minutes', 0);
        if (!$wanted) {
            if ($existing) {
                as_unschedule_all_actions(self::HOOK);
            }
            return;
        }
        if ($existing && $stored === $minutes) {
            return;
        }
        as_unschedule_all_actions(self::HOOK);
        as_schedule_recurring_action(time() + 60, $minutes * MINUTE_IN_SECONDS, self::HOOK, [], 'rural-xero');
        update_option('rural_xero_schedule_minutes', $minutes, false);
    }

    public function run_scheduled(): void
    {
        $result = $this->pull();
        if (is_wp_error($result)) {
            Logger::error('Scheduled stock pull failed', ['error' => $result->get_error_message()]);
        }
    }

    /**
     * Pull items modified since the last successful run (or everything with $full).
     *
     * @return array|WP_Error summary
     */
    public function pull(bool $full = false)
    {
        $last = get_option(self::OPTION_LAST, []);
        $headers = [];
        if (!$full && !empty($last['completed_at'])) {
            // small overlap so nothing falls between two runs
            $headers['If-Modified-Since'] = gmdate('Y-m-d\TH:i:s', (int) $last['completed_at'] - 5 * MINUTE_IN_SECONDS);
        }
        $started = time();
        $data = Api::get('Items', [], $headers);
        if (is_wp_error($data)) {
            return $data;
        }
        $summary = ['started_at' => $started, 'completed_at' => time(), 'full' => $full, 'items' => 0, 'updated' => 0, 'unknown' => 0, 'skipped' => 0];
        if (!empty($data['not_modified'])) {
            update_option(self::OPTION_LAST, $summary, false);
            return $summary;
        }
        $items = $data['Items'] ?? [];
        $summary['items'] = count($items);
        $unknown = [];
        foreach ($items as $item) {
            $code = trim((string) ($item['Code'] ?? ''));
            if ($code === '') {
                continue;
            }
            $productId = self::find_product_id($code);
            if (!$productId) {
                $summary['unknown']++;
                if (count($unknown) < 50) {
                    $unknown[] = $code;
                }
                continue;
            }
            $changed = $this->apply_item($productId, $item);
            $changed ? $summary['updated']++ : $summary['skipped']++;
        }
        $summary['completed_at'] = time();
        $summary['unknown_sample'] = $unknown;
        update_option(self::OPTION_LAST, $summary, false);
        Logger::info('Stock pull', $summary);
        return $summary;
    }

    /** Product or variation id that carries this Xero item code (meta first, then SKU). */
    public static function find_product_id(string $code): int
    {
        global $wpdb;
        $id = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT pm.post_id FROM {$wpdb->postmeta} pm JOIN {$wpdb->posts} p ON p.ID = pm.post_id
             WHERE pm.meta_key = '_xero_item_code' AND pm.meta_value = %s AND p.post_status <> 'trash' LIMIT 1",
            $code
        ));
        if ($id) {
            return $id;
        }
        return (int) wc_get_product_id_by_sku($code);
    }

    /** Write one Xero item onto a product/variation. Returns true when something changed. */
    public function apply_item(int $productId, array $item): bool
    {
        $product = wc_get_product($productId);
        if (!$product) {
            return false;
        }
        $changed = false;
        $tracked = !empty($item['IsTrackedAsInventory']);
        if ($tracked) {
            $qty = max(0, (int) floor((float) ($item['QuantityOnHand'] ?? 0)));
            if (!$product->get_manage_stock()) {
                $product->set_manage_stock(true);
                $changed = true;
            }
            if ((int) $product->get_stock_quantity() !== $qty || $changed) {
                $product->set_stock_quantity($qty);
                $product->set_stock_status($qty > 0 ? 'instock' : 'outofstock');
                $changed = true;
            }
        } elseif ($product->get_manage_stock()) {
            $product->set_manage_stock(false);
            $product->set_stock_status('instock');
            $changed = true;
        }
        if (Settings::get('sync_prices') === 'yes' && isset($item['SalesDetails']['UnitPrice'])) {
            $price = wc_format_decimal((string) $item['SalesDetails']['UnitPrice'], 2);
            if ((float) $price > 0 && wc_format_decimal($product->get_regular_price(), 2) !== $price) {
                $product->set_regular_price($price);
                $changed = true;
            }
        }
        if (!empty($item['ItemID']) && $product->get_meta('_xero_item_id', true) !== $item['ItemID']) {
            $product->update_meta_data('_xero_item_id', $item['ItemID']);
            $changed = true;
        }
        if ($changed) {
            $product->update_meta_data('_xero_last_sync', time());
            $product->save();
            if ($product->get_parent_id()) {
                \WC_Product_Variable::sync($product->get_parent_id());
            }
        }
        return $changed;
    }

    public function last(): array
    {
        $last = get_option(self::OPTION_LAST, []);
        return is_array($last) ? $last : [];
    }
}
