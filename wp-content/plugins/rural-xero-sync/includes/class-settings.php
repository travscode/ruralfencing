<?php

namespace Rural_Xero;

/**
 * Plugin options with defaults. Stored in one option row: rural_xero_settings.
 */
final class Settings
{
    public const OPTION = 'rural_xero_settings';

    public static function defaults(): array
    {
        return [
            'auth_mode' => 'oauth',            // oauth (authorisation code) | client_credentials (Xero custom connection)
            'client_id' => '',
            'client_secret' => '',
            'stock_sync_enabled' => 'yes',
            'stock_sync_minutes' => 15,
            'sync_prices' => 'yes',            // Xero SalesDetails.UnitPrice -> regular price
            'order_sync_enabled' => 'yes',
            'order_trigger' => 'paid',         // paid | processing | completed
            'invoice_status' => 'AUTHORISED',  // AUTHORISED decrements stock; DRAFT does not
            'line_amount_types' => 'Inclusive',
            'contact_mode' => 'customer',      // customer | single
            'single_contact_name' => 'Website Sales',
            'sales_account_code' => '',        // blank = let Xero default from the item
            'shipping_account_code' => '',
            'discount_account_code' => '',
            'tax_type' => '',                  // e.g. OUTPUT; blank = default from item / account
            'payment_account_code' => '',      // bank account code; blank = do not record payments
            'invoice_prefix' => 'WEB-',
            'due_days' => 0,
        ];
    }

    public static function all(): array
    {
        $saved = get_option(self::OPTION, []);
        return array_merge(self::defaults(), is_array($saved) ? $saved : []);
    }

    public static function get(string $key)
    {
        $all = self::all();
        return $all[$key] ?? null;
    }

    public static function update(array $values): void
    {
        $clean = [];
        foreach (self::defaults() as $key => $default) {
            if (!array_key_exists($key, $values)) {
                $clean[$key] = self::all()[$key];
                continue;
            }
            $clean[$key] = is_int($default) ? (int) $values[$key] : sanitize_text_field((string) $values[$key]);
        }
        update_option(self::OPTION, $clean, false);
    }
}
