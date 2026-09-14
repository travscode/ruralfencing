<?php

namespace Rural_Xero;

/**
 * Thin wrapper over WC_Logger. Entries land in WooCommerce > Status > Logs under source "rural-xero-sync".
 */
final class Logger
{
    public const SOURCE = 'rural-xero-sync';

    public static function log(string $level, string $message, array $context = []): void
    {
        if (!function_exists('wc_get_logger')) {
            return;
        }
        if ($context) {
            $message .= ' ' . wp_json_encode($context, JSON_UNESCAPED_SLASHES);
        }
        wc_get_logger()->log($level, $message, ['source' => self::SOURCE]);
    }

    public static function info(string $message, array $context = []): void
    {
        self::log('info', $message, $context);
    }

    public static function error(string $message, array $context = []): void
    {
        self::log('error', $message, $context);
        $recent = get_option('rural_xero_recent_errors', []);
        if (!is_array($recent)) {
            $recent = [];
        }
        array_unshift($recent, ['time' => time(), 'message' => $message]);
        update_option('rural_xero_recent_errors', array_slice($recent, 0, 20), false);
    }
}
