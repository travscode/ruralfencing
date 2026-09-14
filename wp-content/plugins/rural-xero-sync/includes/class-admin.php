<?php

namespace Rural_Xero;

/**
 * The "Xero Sync" admin screen. Written for the client's bookkeeper: a dedicated role that only
 * sees this page, account and tax-rate pickers filled from Xero, and a checklist instead of jargon.
 */
final class Admin
{
    public const CAP = 'manage_rural_xero';
    public const ROLE = 'rural_bookkeeper';
    public const PAGE = 'rural-xero-sync';

    private static ?Admin $instance = null;

    public static function instance(): Admin
    {
        return self::$instance ??= new self();
    }

    public function hooks(): void
    {
        add_action('init', [self::class, 'register_role']);
        add_action('admin_menu', function (): void {
            add_menu_page('Xero Sync', 'Xero Sync', self::CAP, self::PAGE, [$this, 'render'], 'dashicons-update-alt', 56);
        });
        add_action('admin_post_rural_xero_save', [$this, 'save']);
        add_action('admin_post_rural_xero_connect', [$this, 'connect']);
        add_action('admin_post_rural_xero_disconnect', [$this, 'disconnect']);
        add_action('admin_post_rural_xero_pull', [$this, 'pull']);
        add_action('admin_post_rural_xero_refresh_lists', [$this, 'refresh_lists']);
        add_action('admin_post_rural_xero_push_order', [$this, 'push_order']);
        add_action('admin_init', [$this, 'keep_bookkeeper_on_page']);
    }

    /** A "Bookkeeper" role that can only use this screen. Administrators get the capability too. */
    public static function register_role(): void
    {
        if (!get_role(self::ROLE)) {
            add_role(self::ROLE, 'Bookkeeper (Xero Sync)', ['read' => true, self::CAP => true]);
        }
        $admin = get_role('administrator');
        if ($admin && !$admin->has_cap(self::CAP)) {
            $admin->add_cap(self::CAP);
        }
        $manager = get_role('shop_manager');
        if ($manager && !$manager->has_cap(self::CAP)) {
            $manager->add_cap(self::CAP);
        }
    }

    /** Bookkeepers land on the Xero page instead of the dashboard, and cannot wander elsewhere. */
    public function keep_bookkeeper_on_page(): void
    {
        $user = wp_get_current_user();
        if (!$user || !in_array(self::ROLE, (array) $user->roles, true) || count((array) $user->roles) > 1) {
            return;
        }
        global $pagenow;
        $allowed = ['admin.php', 'admin-post.php', 'profile.php', 'admin-ajax.php'];
        $isOurPage = $pagenow === 'admin.php' && ($_GET['page'] ?? '') === self::PAGE;
        if (!in_array($pagenow, $allowed, true) || ($pagenow === 'admin.php' && !$isOurPage)) {
            wp_safe_redirect(admin_url('admin.php?page=' . self::PAGE));
            exit;
        }
        show_admin_bar(false);
    }

    private function guard(): void
    {
        if (!current_user_can(self::CAP)) {
            wp_die('You do not have permission to manage the Xero connection.');
        }
    }

    private function back(array $args): void
    {
        wp_safe_redirect(add_query_arg(['page' => self::PAGE] + $args, admin_url('admin.php')));
        exit;
    }

    public function save(): void
    {
        check_admin_referer('rural_xero_save');
        $this->guard();
        $values = wp_unslash($_POST['rural_xero'] ?? []);
        foreach (['stock_sync_enabled', 'sync_prices', 'order_sync_enabled'] as $flag) {
            $values[$flag] = isset($values[$flag]) ? 'yes' : 'no';
        }
        if (isset($values['client_secret']) && $values['client_secret'] === '') {
            unset($values['client_secret']);
        }
        Settings::update($values);
        Stock_Sync::instance()->ensure_schedule();
        $this->back(['xero' => 'saved']);
    }

    public function connect(): void
    {
        check_admin_referer('rural_xero_connect');
        $this->guard();
        if (Settings::get('auth_mode') === 'client_credentials') {
            $result = OAuth::instance()->connect_client_credentials();
            $this->back(is_wp_error($result) ? ['xero' => 'error', 'detail' => $result->get_error_message()] : ['xero' => 'connected']);
        }
        wp_redirect(OAuth::instance()->authorize_url());
        exit;
    }

    public function disconnect(): void
    {
        check_admin_referer('rural_xero_disconnect');
        $this->guard();
        OAuth::instance()->disconnect();
        delete_transient('rural_xero_accounts');
        delete_transient('rural_xero_tax_rates');
        if (function_exists('as_unschedule_all_actions')) {
            as_unschedule_all_actions(Stock_Sync::HOOK);
        }
        $this->back(['xero' => 'disconnected']);
    }

    public function pull(): void
    {
        check_admin_referer('rural_xero_pull');
        $this->guard();
        $result = Stock_Sync::instance()->pull(isset($_GET['full']));
        $this->back(is_wp_error($result) ? ['xero' => 'error', 'detail' => $result->get_error_message()] : ['xero' => 'pulled']);
    }

    public function refresh_lists(): void
    {
        check_admin_referer('rural_xero_refresh_lists');
        $this->guard();
        Api::accounts(true);
        Api::tax_rates(true);
        $this->back(['xero' => 'refreshed']);
    }

    public function push_order(): void
    {
        $orderId = (int) ($_GET['order_id'] ?? 0);
        check_admin_referer('rural_xero_push_' . $orderId);
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Not allowed');
        }
        $order = wc_get_order($orderId);
        if ($order) {
            $result = Order_Sync::instance()->push($order);
            if (is_wp_error($result)) {
                $order->add_order_note('Xero sync failed (manual): ' . $result->get_error_message());
                $order->save();
            }
        }
        wp_safe_redirect(wp_get_referer() ?: admin_url('edit.php?post_type=shop_order'));
        exit;
    }

    // ------------------------------------------------------------------ rendering

    /** Select box fed from Xero, or a text box when we cannot reach Xero yet. */
    private function account_field(string $name, string $current, array $accounts, array $preferTypes, string $emptyLabel): void
    {
        if (!$accounts) {
            printf('<input type="text" name="rural_xero[%s]" value="%s" placeholder="account code, e.g. 200"> <span class="description">connect to Xero to pick from a list</span>', esc_attr($name), esc_attr($current));
            return;
        }
        $preferred = array_filter($accounts, fn($a) => in_array($a['Type'] ?? '', $preferTypes, true));
        $others = array_filter($accounts, fn($a) => !in_array($a['Type'] ?? '', $preferTypes, true) && !empty($a['Code']));
        printf('<select name="rural_xero[%s]">', esc_attr($name));
        printf('<option value="">%s</option>', esc_html($emptyLabel));
        if ($preferred) {
            echo '<optgroup label="Suggested">';
            foreach ($preferred as $a) {
                printf('<option value="%s" %s>%s &middot; %s</option>', esc_attr($a['Code']), selected($current, $a['Code'], false), esc_html($a['Code']), esc_html($a['Name']));
            }
            echo '</optgroup>';
        }
        if ($others) {
            echo '<optgroup label="All other accounts">';
            foreach ($others as $a) {
                printf('<option value="%s" %s>%s &middot; %s (%s)</option>', esc_attr($a['Code']), selected($current, $a['Code'], false), esc_html($a['Code']), esc_html($a['Name']), esc_html($a['Type'] ?? ''));
            }
            echo '</optgroup>';
        }
        echo '</select>';
    }

    private function tax_field(string $current, array $rates): void
    {
        if (!$rates) {
            printf('<input type="text" name="rural_xero[tax_type]" value="%s" placeholder="e.g. OUTPUT"> <span class="description">connect to Xero to pick from a list</span>', esc_attr($current));
            return;
        }
        echo '<select name="rural_xero[tax_type]"><option value="">Use the tax rate set on each item in Xero (recommended)</option>';
        foreach ($rates as $r) {
            printf('<option value="%s" %s>%s (%s%%)</option>', esc_attr($r['TaxType']), selected($current, $r['TaxType'], false), esc_html($r['Name']), esc_html($r['EffectiveRate'] ?? $r['DisplayTaxRate'] ?? ''));
        }
        echo '</select>';
    }

    public function render(): void
    {
        $this->guard();
        $s = Settings::all();
        $oauth = OAuth::instance();
        $tokens = $oauth->tokens();
        $connected = $oauth->is_connected();
        $last = Stock_Sync::instance()->last();
        $errors = get_option('rural_xero_recent_errors', []);
        $notice = sanitize_key($_GET['xero'] ?? '');
        $detail = sanitize_text_field(wp_unslash($_GET['detail'] ?? ''));
        $next = function_exists('as_next_scheduled_action') ? as_next_scheduled_action(Stock_Sync::HOOK) : false;
        $accounts = $connected ? Api::accounts() : [];
        $rates = $connected ? Api::tax_rates() : [];
        $isAdmin = current_user_can('manage_options');
        $post = esc_url(admin_url('admin-post.php'));

        $steps = [
            ['App credentials saved', $s['client_id'] !== '' && $s['client_secret'] !== '', 'A developer creates the app at developer.xero.com and pastes the Client ID and secret below.'],
            ['Connected to Xero', $connected, 'Someone who is an adviser or admin of the Xero organisation clicks Connect and approves.'],
            ['Stock pulled at least once', !empty($last), 'Click "Pull everything now" after connecting. Runs on its own afterwards.'],
            ['Sales account chosen for shipping and fees', $s['sales_account_code'] !== '', 'Product lines use the account on each Xero item. Shipping, fees and discounts need one account of their own.'],
            ['GST setting confirmed', true, 'Web prices are GST inclusive unless the shop is set up otherwise. Change below if the bookkeeper says so.'],
        ];
        ?>
        <style>
            .rxs-wrap { max-width: 1000px; }
            .rxs-card { background:#fff; border:1px solid #dcdcde; border-radius:6px; padding:18px 22px; margin:16px 0; }
            .rxs-card h2 { margin-top:0; }
            .rxs-steps { list-style:none; margin:0; padding:0; }
            .rxs-steps li { padding:6px 0 6px 30px; position:relative; }
            .rxs-steps li::before { content:"\2713"; position:absolute; left:4px; top:5px; width:18px; height:18px; border-radius:50%; text-align:center; line-height:18px; font-size:12px; color:#fff; background:#c3c4c7; }
            .rxs-steps li.done::before { background:#1a7f37; }
            .rxs-steps small { display:block; color:#646970; }
            .rxs-status { font-weight:600; }
            .rxs-ok { color:#1a7f37; } .rxs-bad { color:#b32d2e; }
            .rxs-wrap .form-table th { width:260px; }
            .rxs-wrap select, .rxs-wrap input[type=text], .rxs-wrap input[type=password] { min-width:360px; max-width:100%; }
            .rxs-help { color:#646970; font-size:13px; margin:4px 0 0; }
        </style>
        <div class="wrap rxs-wrap">
            <h1>Xero Sync</h1>
            <p>This keeps the website's stock levels in step with Xero, and sends each paid web order to Xero as a sales invoice so Xero can take the stock off. Nothing here changes prices or stock in Xero itself.</p>

            <?php if ($notice === 'connected') : ?><div class="notice notice-success"><p>Connected to Xero. Now click <strong>Pull everything now</strong>.</p></div><?php endif; ?>
            <?php if ($notice === 'saved') : ?><div class="notice notice-success"><p>Settings saved.</p></div><?php endif; ?>
            <?php if ($notice === 'pulled') : ?><div class="notice notice-success"><p>Stock pulled from Xero.</p></div><?php endif; ?>
            <?php if ($notice === 'refreshed') : ?><div class="notice notice-success"><p>Account and tax lists refreshed from Xero.</p></div><?php endif; ?>
            <?php if ($notice === 'disconnected') : ?><div class="notice notice-info"><p>Disconnected from Xero.</p></div><?php endif; ?>
            <?php if ($notice === 'error') : ?><div class="notice notice-error"><p>Xero said: <?php echo esc_html($detail); ?></p></div><?php endif; ?>

            <div class="rxs-card">
                <h2>Setup checklist</h2>
                <ul class="rxs-steps">
                    <?php foreach ($steps as [$label, $done, $help]) : ?>
                        <li class="<?php echo $done ? 'done' : ''; ?>"><?php echo esc_html($label); ?><small><?php echo esc_html($help); ?></small></li>
                    <?php endforeach; ?>
                </ul>
            </div>

            <div class="rxs-card">
                <h2>Connection</h2>
                <p class="rxs-status">
                    <?php if ($connected) : ?>
                        <span class="rxs-ok">Connected</span> to <?php echo esc_html($tokens['tenant_name'] ?: $tokens['tenant_id']); ?>
                        since <?php echo esc_html(wp_date('j M Y, g:i a', (int) ($tokens['connected_at'] ?? 0))); ?>
                    <?php else : ?>
                        <span class="rxs-bad">Not connected</span>
                    <?php endif; ?>
                </p>
                <p>
                    <?php if ($connected) : ?>
                        <a class="button button-primary" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=rural_xero_pull&full=1'), 'rural_xero_pull')); ?>">Pull everything now</a>
                        <a class="button" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=rural_xero_pull'), 'rural_xero_pull')); ?>">Pull recent changes</a>
                        <a class="button" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=rural_xero_refresh_lists'), 'rural_xero_refresh_lists')); ?>">Refresh account lists</a>
                        <form method="post" action="<?php echo $post; ?>" style="display:inline;margin-left:1em" onsubmit="return confirm('Disconnect from Xero? Stock will stop syncing until someone reconnects.');">
                            <?php wp_nonce_field('rural_xero_disconnect'); ?><input type="hidden" name="action" value="rural_xero_disconnect">
                            <button class="button-link-delete">Disconnect</button>
                        </form>
                    <?php elseif ($s['client_id'] && $s['client_secret']) : ?>
                        <form method="post" action="<?php echo $post; ?>" style="display:inline">
                            <?php wp_nonce_field('rural_xero_connect'); ?><input type="hidden" name="action" value="rural_xero_connect">
                            <button class="button button-primary button-hero">Connect to Xero</button>
                        </form>
                        <span class="rxs-help">You will be sent to Xero to sign in and approve. Use a login that is an adviser or admin of the organisation.</span>
                    <?php else : ?>
                        <em>The app credentials below have to be saved before you can connect.</em>
                    <?php endif; ?>
                </p>
                <table class="form-table" role="presentation">
                    <tr><th>Last stock pull</th><td>
                        <?php if ($last) : ?>
                            <?php echo esc_html(wp_date('j M Y, g:i a', (int) $last['completed_at'])); ?>.
                            Xero sent <?php echo (int) $last['items']; ?> items, <?php echo (int) $last['updated']; ?> products changed,
                            <?php echo (int) $last['unknown']; ?> Xero codes have no product on the website.
                            <?php if (!empty($last['unknown_sample'])) : ?><p class="rxs-help">Codes without a product: <?php echo esc_html(implode(', ', array_slice($last['unknown_sample'], 0, 15))); ?><?php echo count($last['unknown_sample']) > 15 ? ' …' : ''; ?></p><?php endif; ?>
                        <?php else : ?>never<?php endif; ?>
                        <?php if ($next) : ?><p class="rxs-help">Next automatic pull: <?php echo esc_html(wp_date('j M Y, g:i a', $next)); ?></p><?php endif; ?>
                    </td></tr>
                    <tr><th>Recent problems</th><td>
                        <?php if ($errors) : foreach (array_slice((array) $errors, 0, 6) as $e) : ?>
                            <div><code><?php echo esc_html(wp_date('j M, g:i a', (int) $e['time'])); ?></code> <?php echo esc_html($e['message']); ?></div>
                        <?php endforeach; else : ?>none<?php endif; ?>
                        <?php if ($isAdmin) : ?><p class="rxs-help"><a href="<?php echo esc_url(admin_url('admin.php?page=wc-status&tab=logs&source=' . Logger::SOURCE)); ?>">Full technical log</a></p><?php endif; ?>
                    </td></tr>
                </table>
            </div>

            <form method="post" action="<?php echo $post; ?>">
                <?php wp_nonce_field('rural_xero_save'); ?>
                <input type="hidden" name="action" value="rural_xero_save">

                <div class="rxs-card">
                    <h2>Accounting settings</h2>
                    <p class="rxs-help">These decide how each web order appears in Xero. Product lines always use the item's own sales account and tax rate from Xero.</p>
                    <table class="form-table" role="presentation">
                        <tr><th>Web prices include GST?</th><td>
                            <select name="rural_xero[line_amount_types]">
                                <option value="Inclusive" <?php selected($s['line_amount_types'], 'Inclusive'); ?>>Yes, prices on the website include GST</option>
                                <option value="Exclusive" <?php selected($s['line_amount_types'], 'Exclusive'); ?>>No, GST is added on top</option>
                            </select></td></tr>
                        <tr><th>Sales account for shipping, fees and lines without an item code</th><td>
                            <?php $this->account_field('sales_account_code', (string) $s['sales_account_code'], $accounts, ['REVENUE', 'SALES'], 'Not set (orders with shipping will fail until this is chosen)'); ?>
                        </td></tr>
                        <tr><th>Shipping account (optional)</th><td>
                            <?php $this->account_field('shipping_account_code', (string) $s['shipping_account_code'], $accounts, ['REVENUE', 'SALES'], 'Same as the sales account'); ?>
                        </td></tr>
                        <tr><th>Discount account (optional)</th><td>
                            <?php $this->account_field('discount_account_code', (string) $s['discount_account_code'], $accounts, ['REVENUE', 'SALES', 'EXPENSE'], 'Same as the sales account'); ?>
                        </td></tr>
                        <tr><th>Tax rate for those extra lines</th><td>
                            <?php $this->tax_field((string) $s['tax_type'], $rates); ?>
                        </td></tr>
                        <tr><th>Record the payment in Xero too?</th><td>
                            <?php $this->account_field('payment_account_code', (string) $s['payment_account_code'], $accounts, ['BANK'], 'No, create the invoice only (mark it paid in Xero during reconciliation)'); ?>
                            <p class="rxs-help">Choose the bank or clearing account the web payments land in. The invoice is then marked paid straight away.</p>
                        </td></tr>
                        <tr><th>Invoice status</th><td>
                            <select name="rural_xero[invoice_status]">
                                <option value="AUTHORISED" <?php selected($s['invoice_status'], 'AUTHORISED'); ?>>Approved (stock comes off in Xero immediately)</option>
                                <option value="DRAFT" <?php selected($s['invoice_status'], 'DRAFT'); ?>>Draft (someone approves each one in Xero; stock moves then)</option>
                            </select></td></tr>
                        <tr><th>Customer contact in Xero</th><td>
                            <select name="rural_xero[contact_mode]">
                                <option value="customer" <?php selected($s['contact_mode'], 'customer'); ?>>One contact per customer, matched by name</option>
                                <option value="single" <?php selected($s['contact_mode'], 'single'); ?>>One shared contact for all web sales</option>
                            </select>
                            <input type="text" name="rural_xero[single_contact_name]" value="<?php echo esc_attr($s['single_contact_name']); ?>" placeholder="Website Sales" style="min-width:200px">
                        </td></tr>
                        <tr><th>Invoice number prefix</th><td><input type="text" name="rural_xero[invoice_prefix]" value="<?php echo esc_attr($s['invoice_prefix']); ?>" style="min-width:120px"> <span class="rxs-help">e.g. WEB-1234 for web order 1234</span></td></tr>
                        <tr><th>Due days</th><td><input type="number" min="0" name="rural_xero[due_days]" value="<?php echo (int) $s['due_days']; ?>" style="min-width:80px"></td></tr>
                    </table>
                </div>

                <div class="rxs-card">
                    <h2>What syncs</h2>
                    <table class="form-table" role="presentation">
                        <tr><th>Stock from Xero to the website</th><td>
                            <label><input type="checkbox" name="rural_xero[stock_sync_enabled]" <?php checked($s['stock_sync_enabled'], 'yes'); ?>> On, every
                            <input type="number" min="5" name="rural_xero[stock_sync_minutes]" value="<?php echo (int) $s['stock_sync_minutes']; ?>" style="min-width:70px;width:70px"> minutes</label>
                        </td></tr>
                        <tr><th>Prices from Xero to the website</th><td>
                            <label><input type="checkbox" name="rural_xero[sync_prices]" <?php checked($s['sync_prices'], 'yes'); ?>> On. The Xero sales price becomes the website price.</label>
                        </td></tr>
                        <tr><th>Orders from the website to Xero</th><td>
                            <label><input type="checkbox" name="rural_xero[order_sync_enabled]" <?php checked($s['order_sync_enabled'], 'yes'); ?>> On, when</label>
                            <select name="rural_xero[order_trigger]">
                                <option value="paid" <?php selected($s['order_trigger'], 'paid'); ?>>the order is paid</option>
                                <option value="processing" <?php selected($s['order_trigger'], 'processing'); ?>>the order is marked Processing</option>
                                <option value="completed" <?php selected($s['order_trigger'], 'completed'); ?>>the order is marked Completed</option>
                            </select>
                        </td></tr>
                    </table>
                </div>

                <div class="rxs-card">
                    <h2>Xero app (developer)</h2>
                    <p class="rxs-help">Created once at <a href="https://developer.xero.com/app/manage" target="_blank" rel="noopener">developer.xero.com</a>. Redirect URI must be exactly <code><?php echo esc_html($oauth->redirect_uri()); ?></code>.</p>
                    <table class="form-table" role="presentation">
                        <tr><th>App type</th><td>
                            <select name="rural_xero[auth_mode]">
                                <option value="oauth" <?php selected($s['auth_mode'], 'oauth'); ?>>Standard web app (someone clicks Connect)</option>
                                <option value="client_credentials" <?php selected($s['auth_mode'], 'client_credentials'); ?>>Custom connection (client credentials)</option>
                            </select></td></tr>
                        <tr><th>Client ID</th><td><input type="text" name="rural_xero[client_id]" value="<?php echo esc_attr($s['client_id']); ?>" autocomplete="off"></td></tr>
                        <tr><th>Client secret</th><td><input type="password" name="rural_xero[client_secret]" value="" placeholder="<?php echo $s['client_secret'] ? 'saved, leave blank to keep' : ''; ?>" autocomplete="new-password"></td></tr>
                    </table>
                </div>

                <?php submit_button('Save settings'); ?>
            </form>

            <?php if ($isAdmin) : ?>
                <div class="rxs-card">
                    <h2>Give the bookkeeper access</h2>
                    <p>Create a user with the role <strong>Bookkeeper (Xero Sync)</strong> under <a href="<?php echo esc_url(admin_url('user-new.php')); ?>">Users &rsaquo; Add New</a>. That login sees only this page: no products, orders or settings.</p>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }
}
