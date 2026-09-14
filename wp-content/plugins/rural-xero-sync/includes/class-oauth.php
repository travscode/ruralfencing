<?php

namespace Rural_Xero;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Xero OAuth2. Supports the standard authorisation-code flow (a Xero admin clicks "Connect")
 * and client-credentials for a Xero Custom Connection. Tokens are stored encrypted in wp_options.
 */
final class OAuth
{
    private const AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
    private const TOKEN_URL = 'https://identity.xero.com/connect/token';
    private const CONNECTIONS_URL = 'https://api.xero.com/connections';
    private const SCOPES = 'openid profile email offline_access accounting.transactions accounting.contacts accounting.settings.read';
    private const OPTION = 'rural_xero_tokens';

    private static ?OAuth $instance = null;

    public static function instance(): OAuth
    {
        return self::$instance ??= new self();
    }

    public function hooks(): void
    {
        add_action('rest_api_init', function (): void {
            register_rest_route('rural-xero/v1', '/callback', [
                'methods' => 'GET',
                'callback' => [$this, 'handle_callback'],
                'permission_callback' => '__return_true',
            ]);
        });
    }

    public function redirect_uri(): string
    {
        return rest_url('rural-xero/v1/callback');
    }

    public function is_connected(): bool
    {
        $t = $this->tokens();
        return !empty($t['tenant_id']) && (!empty($t['refresh_token']) || Settings::get('auth_mode') === 'client_credentials');
    }

    public function tokens(): array
    {
        $raw = get_option(self::OPTION, '');
        if (!$raw) {
            return [];
        }
        $json = $this->decrypt((string) $raw);
        $data = $json ? json_decode($json, true) : null;
        return is_array($data) ? $data : [];
    }

    public function save_tokens(array $tokens): void
    {
        update_option(self::OPTION, $this->encrypt(wp_json_encode($tokens)), false);
    }

    public function disconnect(): void
    {
        delete_option(self::OPTION);
    }

    /** URL a Xero admin visits to authorise this site. */
    public function authorize_url(): string
    {
        $state = wp_generate_password(24, false);
        set_transient('rural_xero_oauth_state_' . $state, get_current_user_id(), 10 * MINUTE_IN_SECONDS);
        return self::AUTHORIZE_URL . '?' . http_build_query([
            'response_type' => 'code',
            'client_id' => Settings::get('client_id'),
            'redirect_uri' => $this->redirect_uri(),
            'scope' => self::SCOPES,
            'state' => $state,
        ]);
    }

    public function handle_callback(WP_REST_Request $request)
    {
        $state = (string) $request->get_param('state');
        $code = (string) $request->get_param('code');
        $error = (string) $request->get_param('error');
        $owner = $state ? get_transient('rural_xero_oauth_state_' . $state) : false;
        if ($error) {
            Logger::error('OAuth callback error', ['error' => $error, 'description' => $request->get_param('error_description')]);
            return $this->redirect_back('error', $error);
        }
        if (!$state || $owner === false || !$code) {
            return $this->redirect_back('error', 'invalid_state');
        }
        delete_transient('rural_xero_oauth_state_' . $state);

        $token = $this->request_token([
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $this->redirect_uri(),
        ]);
        if (is_wp_error($token)) {
            Logger::error('Token exchange failed', ['error' => $token->get_error_message()]);
            return $this->redirect_back('error', 'token_exchange');
        }
        $tenant = $this->pick_tenant($token['access_token']);
        if (is_wp_error($tenant)) {
            Logger::error('No Xero organisation on connection', ['error' => $tenant->get_error_message()]);
            return $this->redirect_back('error', 'no_tenant');
        }
        $this->save_tokens([
            'access_token' => $token['access_token'],
            'refresh_token' => $token['refresh_token'] ?? '',
            'expires_at' => time() + (int) ($token['expires_in'] ?? 1800),
            'tenant_id' => $tenant['tenantId'],
            'tenant_name' => $tenant['tenantName'] ?? '',
            'connected_at' => time(),
        ]);
        Logger::info('Connected to Xero', ['tenant' => $tenant['tenantName'] ?? $tenant['tenantId']]);
        Stock_Sync::instance()->ensure_schedule();
        return $this->redirect_back('connected');
    }

    /** Connect a Xero Custom Connection (client credentials). */
    public function connect_client_credentials()
    {
        $token = $this->request_token(['grant_type' => 'client_credentials', 'scope' => 'accounting.transactions accounting.contacts accounting.settings.read']);
        if (is_wp_error($token)) {
            return $token;
        }
        $tenant = $this->pick_tenant($token['access_token']);
        if (is_wp_error($tenant)) {
            return $tenant;
        }
        $this->save_tokens([
            'access_token' => $token['access_token'],
            'refresh_token' => '',
            'expires_at' => time() + (int) ($token['expires_in'] ?? 1800),
            'tenant_id' => $tenant['tenantId'],
            'tenant_name' => $tenant['tenantName'] ?? '',
            'connected_at' => time(),
        ]);
        Stock_Sync::instance()->ensure_schedule();
        return true;
    }

    /** A valid access token, refreshing when needed. */
    public function access_token()
    {
        $t = $this->tokens();
        if (empty($t['tenant_id'])) {
            return new WP_Error('rural_xero_not_connected', 'Xero is not connected.');
        }
        if (!empty($t['access_token']) && (int) $t['expires_at'] - 90 > time()) {
            return $t['access_token'];
        }
        // one refresh at a time
        $lock = 'rural_xero_refresh_lock';
        if (get_transient($lock)) {
            usleep(1500000);
            $t = $this->tokens();
            if (!empty($t['access_token']) && (int) $t['expires_at'] - 90 > time()) {
                return $t['access_token'];
            }
        }
        set_transient($lock, 1, 30);
        try {
            if (Settings::get('auth_mode') === 'client_credentials') {
                $token = $this->request_token(['grant_type' => 'client_credentials', 'scope' => 'accounting.transactions accounting.contacts accounting.settings.read']);
            } else {
                if (empty($t['refresh_token'])) {
                    return new WP_Error('rural_xero_no_refresh', 'No refresh token stored; reconnect to Xero.');
                }
                $token = $this->request_token(['grant_type' => 'refresh_token', 'refresh_token' => $t['refresh_token']]);
            }
            if (is_wp_error($token)) {
                Logger::error('Token refresh failed', ['error' => $token->get_error_message()]);
                return $token;
            }
            $t['access_token'] = $token['access_token'];
            $t['expires_at'] = time() + (int) ($token['expires_in'] ?? 1800);
            if (!empty($token['refresh_token'])) {
                $t['refresh_token'] = $token['refresh_token'];
            }
            $this->save_tokens($t);
            return $t['access_token'];
        } finally {
            delete_transient($lock);
        }
    }

    public function tenant_id(): string
    {
        return (string) ($this->tokens()['tenant_id'] ?? '');
    }

    private function request_token(array $body)
    {
        $id = (string) Settings::get('client_id');
        $secret = (string) Settings::get('client_secret');
        if ($id === '' || $secret === '') {
            return new WP_Error('rural_xero_no_credentials', 'Client ID / secret not configured.');
        }
        $response = wp_remote_post(self::TOKEN_URL, [
            'timeout' => 30,
            'headers' => [
                'Authorization' => 'Basic ' . base64_encode($id . ':' . $secret),
                'Content-Type' => 'application/x-www-form-urlencoded',
            ],
            'body' => $body,
        ]);
        if (is_wp_error($response)) {
            return $response;
        }
        $data = json_decode((string) wp_remote_retrieve_body($response), true);
        if (wp_remote_retrieve_response_code($response) !== 200 || empty($data['access_token'])) {
            return new WP_Error('rural_xero_token', 'Xero token endpoint: ' . ($data['error'] ?? 'HTTP ' . wp_remote_retrieve_response_code($response)));
        }
        return $data;
    }

    private function pick_tenant(string $accessToken)
    {
        $response = wp_remote_get(self::CONNECTIONS_URL, [
            'timeout' => 30,
            'headers' => ['Authorization' => 'Bearer ' . $accessToken, 'Accept' => 'application/json'],
        ]);
        if (is_wp_error($response)) {
            return $response;
        }
        $list = json_decode((string) wp_remote_retrieve_body($response), true);
        if (!is_array($list) || !$list) {
            return new WP_Error('rural_xero_no_tenant', 'Xero returned no connected organisations.');
        }
        foreach ($list as $conn) {
            if (($conn['tenantType'] ?? '') === 'ORGANISATION') {
                return $conn;
            }
        }
        return $list[0];
    }

    private function redirect_back(string $status, string $detail = ''): WP_REST_Response
    {
        $url = add_query_arg(['page' => 'rural-xero-sync', 'xero' => $status, 'detail' => $detail], admin_url('admin.php'));
        $response = new WP_REST_Response(null, 302);
        $response->header('Location', $url);
        return $response;
    }

    private function key(): string
    {
        return hash('sha256', (defined('AUTH_KEY') ? AUTH_KEY : 'rural') . '|rural-xero', true);
    }

    private function encrypt(string $plain): string
    {
        if (!function_exists('openssl_encrypt')) {
            return base64_encode($plain);
        }
        $iv = random_bytes(16);
        $cipher = openssl_encrypt($plain, 'aes-256-cbc', $this->key(), OPENSSL_RAW_DATA, $iv);
        return 'enc:' . base64_encode($iv . $cipher);
    }

    private function decrypt(string $stored): string
    {
        if (!str_starts_with($stored, 'enc:')) {
            return (string) base64_decode($stored, true);
        }
        $raw = base64_decode(substr($stored, 4), true);
        if ($raw === false || strlen($raw) < 17) {
            return '';
        }
        $plain = openssl_decrypt(substr($raw, 16), 'aes-256-cbc', $this->key(), OPENSSL_RAW_DATA, substr($raw, 0, 16));
        return $plain === false ? '' : $plain;
    }
}
