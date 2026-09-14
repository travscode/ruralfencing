<?php

namespace Rural_Xero;

use WC_Order;
use WP_Error;

/**
 * WooCommerce -> Xero. A paid order becomes an ACCREC invoice in Xero. When the invoice is
 * AUTHORISED, Xero itself decrements QuantityOnHand for every tracked item on it, which is the
 * only way stock moves through the Xero API. Work runs on Action Scheduler so checkout stays fast.
 */
final class Order_Sync
{
    public const HOOK = 'rural_xero_push_order';
    private const META_INVOICE_ID = '_xero_invoice_id';
    private const META_INVOICE_NUMBER = '_xero_invoice_number';
    private const META_PAYMENT_ID = '_xero_payment_id';
    private const META_ATTEMPTS = '_xero_sync_attempts';
    private const MAX_ATTEMPTS = 6;

    private static ?Order_Sync $instance = null;

    public static function instance(): Order_Sync
    {
        return self::$instance ??= new self();
    }

    public function hooks(): void
    {
        add_action(self::HOOK, [$this, 'process'], 10, 1);
        $trigger = (string) Settings::get('order_trigger');
        if ($trigger === 'processing') {
            add_action('woocommerce_order_status_processing', [$this, 'enqueue']);
        } elseif ($trigger === 'completed') {
            add_action('woocommerce_order_status_completed', [$this, 'enqueue']);
        } else {
            add_action('woocommerce_payment_complete', [$this, 'enqueue']);
            add_action('woocommerce_order_status_processing', [$this, 'enqueue']);
            add_action('woocommerce_order_status_completed', [$this, 'enqueue']);
        }
        add_action('add_meta_boxes', [$this, 'meta_box']);
    }

    public function enqueue($orderId): void
    {
        if (Settings::get('order_sync_enabled') !== 'yes' || !function_exists('as_enqueue_async_action')) {
            return;
        }
        $order = wc_get_order($orderId);
        if (!$order || $order->get_meta(self::META_INVOICE_ID, true)) {
            return;
        }
        if (as_has_scheduled_action(self::HOOK, ['order_id' => (int) $orderId], 'rural-xero')) {
            return;
        }
        as_enqueue_async_action(self::HOOK, ['order_id' => (int) $orderId], 'rural-xero');
    }

    /** Action Scheduler entry point. */
    public function process($orderId): void
    {
        $order = wc_get_order((int) $orderId);
        if (!$order) {
            return;
        }
        $result = $this->push($order);
        if (is_wp_error($result)) {
            $attempts = (int) $order->get_meta(self::META_ATTEMPTS, true) + 1;
            $order->update_meta_data(self::META_ATTEMPTS, $attempts);
            $order->add_order_note(sprintf('Xero sync failed (attempt %d): %s', $attempts, $result->get_error_message()));
            $order->save();
            Logger::error('Order push failed', ['order' => $order->get_id(), 'attempt' => $attempts, 'error' => $result->get_error_message()]);
            if ($attempts < self::MAX_ATTEMPTS && function_exists('as_schedule_single_action')) {
                $delay = min(6 * HOUR_IN_SECONDS, (int) (5 * MINUTE_IN_SECONDS * (2 ** ($attempts - 1))));
                as_schedule_single_action(time() + $delay, self::HOOK, ['order_id' => $order->get_id()], 'rural-xero');
            }
        }
    }

    /**
     * Create the invoice (and payment) for an order. Idempotent: an order with an invoice id is left alone.
     *
     * @return array|WP_Error the Xero invoice
     */
    public function push(WC_Order $order)
    {
        if ($order->get_meta(self::META_INVOICE_ID, true)) {
            return ['already' => true, 'InvoiceID' => $order->get_meta(self::META_INVOICE_ID, true)];
        }
        $invoice = $this->build_invoice($order);
        if (is_wp_error($invoice)) {
            return $invoice;
        }
        $response = Api::post('Invoices', ['Invoices' => [$invoice]], ['unitdp' => 4]);
        if (is_wp_error($response) && $invoice['Status'] === 'AUTHORISED' && $this->is_stock_error($response)) {
            // Xero refuses to authorise when a tracked item would go negative. Save as DRAFT so the
            // sale is still recorded; a person reconciles stock and approves it in Xero.
            $invoice['Status'] = 'DRAFT';
            $order->add_order_note('Xero would not authorise the invoice (insufficient stock in Xero). Created as DRAFT instead: ' . $response->get_error_message());
            $response = Api::post('Invoices', ['Invoices' => [$invoice]], ['unitdp' => 4]);
        }
        if (is_wp_error($response)) {
            return $response;
        }
        $created = $response['Invoices'][0] ?? null;
        if (!$created || empty($created['InvoiceID'])) {
            return new WP_Error('rural_xero_invoice', 'Xero returned no invoice.');
        }
        $order->update_meta_data(self::META_INVOICE_ID, $created['InvoiceID']);
        $order->update_meta_data(self::META_INVOICE_NUMBER, $created['InvoiceNumber'] ?? '');
        $order->add_order_note(sprintf('Xero invoice %s created (%s).', $created['InvoiceNumber'] ?? $created['InvoiceID'], $created['Status'] ?? ''));
        $order->save();
        Logger::info('Invoice created', ['order' => $order->get_id(), 'invoice' => $created['InvoiceNumber'] ?? $created['InvoiceID'], 'status' => $created['Status'] ?? '']);

        $bank = (string) Settings::get('payment_account_code');
        if ($bank !== '' && ($created['Status'] ?? '') === 'AUTHORISED' && $order->is_paid()) {
            $payment = Api::put('Payments', ['Payments' => [[
                'Invoice' => ['InvoiceID' => $created['InvoiceID']],
                'Account' => ['Code' => $bank],
                'Date' => ($order->get_date_paid() ?: $order->get_date_created())->date('Y-m-d'),
                'Amount' => (float) $order->get_total(),
                'Reference' => $order->get_payment_method_title() . ' ' . $order->get_transaction_id(),
            ]]]);
            if (is_wp_error($payment)) {
                $order->add_order_note('Xero payment could not be recorded: ' . $payment->get_error_message());
                Logger::error('Payment failed', ['order' => $order->get_id(), 'error' => $payment->get_error_message()]);
            } else {
                $order->update_meta_data(self::META_PAYMENT_ID, $payment['Payments'][0]['PaymentID'] ?? '');
                $order->save();
            }
        }
        return $created;
    }

    private function is_stock_error(WP_Error $error): bool
    {
        return (bool) preg_match('/stock|quantity on hand|negative/i', $error->get_error_message());
    }

    /** @return array|WP_Error */
    public function build_invoice(WC_Order $order)
    {
        $lines = [];
        $salesAccount = (string) Settings::get('sales_account_code');
        $taxType = (string) Settings::get('tax_type');
        foreach ($order->get_items('line_item') as $item) {
            /** @var \WC_Order_Item_Product $item */
            $product = $item->get_product();
            $code = $product ? (string) ($product->get_meta('_xero_item_code', true) ?: $product->get_sku()) : '';
            $qty = (float) $item->get_quantity();
            if ($qty <= 0) {
                continue;
            }
            $lineTotal = (float) $item->get_total() + (float) $item->get_total_tax();
            if (Settings::get('line_amount_types') === 'Exclusive') {
                $lineTotal = (float) $item->get_total();
            }
            $line = [
                'Description' => $item->get_name(),
                'Quantity' => $qty,
                'UnitAmount' => round($lineTotal / $qty, 4),
            ];
            if ($code !== '') {
                $line['ItemCode'] = $code;
            } elseif ($salesAccount !== '') {
                $line['AccountCode'] = $salesAccount;
            } else {
                return new WP_Error('rural_xero_line', sprintf('Order line "%s" has no Xero item code and no sales account is configured.', $item->get_name()));
            }
            if ($salesAccount !== '' && $code === '') {
                $line['AccountCode'] = $salesAccount;
            }
            if ($taxType !== '') {
                $line['TaxType'] = $taxType;
            }
            $lines[] = $line;
        }
        if (!$lines) {
            return new WP_Error('rural_xero_empty', 'Order has no product lines.');
        }
        $shippingAccount = (string) Settings::get('shipping_account_code') ?: $salesAccount;
        foreach ($order->get_items('shipping') as $ship) {
            $amount = (float) $ship->get_total() + (Settings::get('line_amount_types') === 'Exclusive' ? 0 : (float) $ship->get_total_tax());
            if ($amount == 0.0) {
                continue;
            }
            if ($shippingAccount === '') {
                return new WP_Error('rural_xero_shipping', 'Order has shipping but no shipping/sales account code is configured.');
            }
            $line = ['Description' => 'Shipping: ' . $ship->get_name(), 'Quantity' => 1, 'UnitAmount' => round($amount, 4), 'AccountCode' => $shippingAccount];
            if ($taxType !== '') {
                $line['TaxType'] = $taxType;
            }
            $lines[] = $line;
        }
        foreach ($order->get_items('fee') as $fee) {
            $amount = (float) $fee->get_total() + (Settings::get('line_amount_types') === 'Exclusive' ? 0 : (float) $fee->get_total_tax());
            if ($amount == 0.0 || $salesAccount === '') {
                continue;
            }
            $line = ['Description' => $fee->get_name(), 'Quantity' => 1, 'UnitAmount' => round($amount, 4), 'AccountCode' => $salesAccount];
            if ($taxType !== '') {
                $line['TaxType'] = $taxType;
            }
            $lines[] = $line;
        }
        $discount = (float) $order->get_discount_total() + (Settings::get('line_amount_types') === 'Exclusive' ? 0 : (float) $order->get_discount_tax());
        if ($discount > 0) {
            $account = (string) Settings::get('discount_account_code') ?: $salesAccount;
            if ($account !== '') {
                $line = ['Description' => 'Discount' . ($order->get_coupon_codes() ? ' (' . implode(', ', $order->get_coupon_codes()) . ')' : ''), 'Quantity' => 1, 'UnitAmount' => -round($discount, 4), 'AccountCode' => $account];
                if ($taxType !== '') {
                    $line['TaxType'] = $taxType;
                }
                $lines[] = $line;
            }
        }

        $date = ($order->get_date_paid() ?: $order->get_date_created());
        $due = clone $date;
        $due->modify('+' . max(0, (int) Settings::get('due_days')) . ' days');
        return [
            'Type' => 'ACCREC',
            'Contact' => $this->contact($order),
            'Date' => $date->date('Y-m-d'),
            'DueDate' => $due->date('Y-m-d'),
            'InvoiceNumber' => (string) Settings::get('invoice_prefix') . $order->get_order_number(),
            'Reference' => 'Web order #' . $order->get_order_number(),
            'Status' => Settings::get('invoice_status') === 'DRAFT' ? 'DRAFT' : 'AUTHORISED',
            'LineAmountTypes' => Settings::get('line_amount_types') === 'Exclusive' ? 'Exclusive' : 'Inclusive',
            'CurrencyCode' => $order->get_currency(),
            'LineItems' => $lines,
        ];
    }

    private function contact(WC_Order $order): array
    {
        if (Settings::get('contact_mode') === 'single') {
            return ['Name' => (string) Settings::get('single_contact_name') ?: 'Website Sales'];
        }
        $name = trim($order->get_billing_company() ?: $order->get_formatted_billing_full_name());
        if ($name === '') {
            $name = $order->get_billing_email() ?: 'Web customer';
        }
        $contact = ['Name' => $name];
        if ($order->get_billing_email()) {
            $contact['EmailAddress'] = $order->get_billing_email();
        }
        if ($order->get_billing_company()) {
            $contact['FirstName'] = $order->get_billing_first_name();
            $contact['LastName'] = $order->get_billing_last_name();
        }
        if ($order->get_billing_phone()) {
            $contact['Phones'] = [['PhoneType' => 'DEFAULT', 'PhoneNumber' => $order->get_billing_phone()]];
        }
        $contact['Addresses'] = [[
            'AddressType' => 'POBOX',
            'AddressLine1' => $order->get_billing_address_1(),
            'AddressLine2' => $order->get_billing_address_2(),
            'City' => $order->get_billing_city(),
            'Region' => $order->get_billing_state(),
            'PostalCode' => $order->get_billing_postcode(),
            'Country' => $order->get_billing_country(),
        ]];
        return $contact;
    }

    public function meta_box(): void
    {
        $screen = function_exists('wc_get_page_screen_id') ? wc_get_page_screen_id('shop-order') : 'shop_order';
        add_meta_box('rural-xero-order', 'Xero', function ($post_or_order): void {
            $order = $post_or_order instanceof WC_Order ? $post_or_order : wc_get_order($post_or_order->ID);
            if (!$order) {
                return;
            }
            $number = $order->get_meta(self::META_INVOICE_NUMBER, true);
            $id = $order->get_meta(self::META_INVOICE_ID, true);
            if ($id) {
                printf('<p>Invoice <strong>%s</strong><br><a href="%s" target="_blank" rel="noopener">Open in Xero</a></p>', esc_html($number ?: $id), esc_url('https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=' . $id));
            } else {
                echo '<p>Not sent to Xero yet.</p>';
            }
            $url = wp_nonce_url(admin_url('admin-post.php?action=rural_xero_push_order&order_id=' . $order->get_id()), 'rural_xero_push_' . $order->get_id());
            printf('<p><a class="button" href="%s">%s</a></p>', esc_url($url), $id ? 'Re-check' : 'Send to Xero now');
        }, $screen, 'side');
    }
}
