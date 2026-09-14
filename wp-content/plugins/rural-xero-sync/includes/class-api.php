<?php

namespace Rural_Xero;

use WP_Error;

/**
 * Minimal Xero Accounting API client: bearer auth, tenant header, JSON, retry on 429.
 */
final class Api
{
    private const BASE = 'https://api.xero.com/api.xro/2.0/';

    public static function get(string $path, array $query = [], array $headers = [])
    {
        return self::request('GET', $path, $query, null, $headers);
    }

    public static function post(string $path, array $body, array $query = [])
    {
        return self::request('POST', $path, $query, $body);
    }

    public static function put(string $path, array $body, array $query = [])
    {
        return self::request('PUT', $path, $query, $body);
    }

    private static function request(string $method, string $path, array $query, ?array $body, array $headers = [], int $attempt = 1)
    {
        $token = OAuth::instance()->access_token();
        if (is_wp_error($token)) {
            return $token;
        }
        $url = self::BASE . ltrim($path, '/');
        if ($query) {
            $url = add_query_arg(array_map('rawurlencode', $query), $url);
        }
        $args = [
            'method' => $method,
            'timeout' => 60,
            'headers' => array_merge([
                'Authorization' => 'Bearer ' . $token,
                'xero-tenant-id' => OAuth::instance()->tenant_id(),
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ], $headers),
        ];
        if ($body !== null) {
            $args['body'] = wp_json_encode($body);
        }
        $response = wp_remote_request($url, $args);
        if (is_wp_error($response)) {
            return $response;
        }
        $code = (int) wp_remote_retrieve_response_code($response);
        $data = json_decode((string) wp_remote_retrieve_body($response), true);
        if ($code === 429 && $attempt < 3) {
            $wait = (int) (wp_remote_retrieve_header($response, 'retry-after') ?: 5);
            sleep(min($wait, 30));
            return self::request($method, $path, $query, $body, $headers, $attempt + 1);
        }
        if ($code === 304) {
            return ['not_modified' => true];
        }
        if ($code < 200 || $code >= 300) {
            $message = self::error_message($data, $code);
            return new WP_Error('rural_xero_api', $message, ['status' => $code, 'body' => $data]);
        }
        return is_array($data) ? $data : [];
    }

    /** Chart of accounts, cached for an hour. Returns [] when not connected or on error. */
    public static function accounts(bool $refresh = false): array
    {
        return self::cached_list('rural_xero_accounts', 'Accounts', 'Accounts', $refresh, static function (array $a): bool {
            return ($a['Status'] ?? '') === 'ACTIVE';
        });
    }

    /** Active tax rates, cached for an hour. */
    public static function tax_rates(bool $refresh = false): array
    {
        return self::cached_list('rural_xero_tax_rates', 'TaxRates', 'TaxRates', $refresh, static function (array $t): bool {
            return ($t['Status'] ?? '') === 'ACTIVE';
        });
    }

    private static function cached_list(string $key, string $path, string $field, bool $refresh, callable $keep): array
    {
        if (!$refresh) {
            $cached = get_transient($key);
            if (is_array($cached)) {
                return $cached;
            }
        }
        if (!OAuth::instance()->is_connected()) {
            return [];
        }
        $data = self::get($path);
        if (is_wp_error($data)) {
            return [];
        }
        $list = array_values(array_filter($data[$field] ?? [], $keep));
        set_transient($key, $list, HOUR_IN_SECONDS);
        return $list;
    }

    /** Flatten Xero's validation error structure into one readable line. */
    public static function error_message($data, int $code): string
    {
        if (!is_array($data)) {
            return "HTTP {$code}";
        }
        $parts = [];
        if (!empty($data['Message'])) {
            $parts[] = $data['Message'];
        }
        if (!empty($data['Detail'])) {
            $parts[] = $data['Detail'];
        }
        foreach ($data['Elements'] ?? [] as $element) {
            foreach ($element['ValidationErrors'] ?? [] as $ve) {
                $parts[] = $ve['Message'] ?? '';
            }
            foreach ($element['LineItems'] ?? [] as $li) {
                foreach ($li['ValidationErrors'] ?? [] as $ve) {
                    $parts[] = ($li['ItemCode'] ?? '') . ': ' . ($ve['Message'] ?? '');
                }
            }
        }
        if (!empty($data['Title'])) {
            $parts[] = $data['Title'];
        }
        return $parts ? "HTTP {$code}: " . implode(' | ', array_filter($parts)) : "HTTP {$code}";
    }
}
