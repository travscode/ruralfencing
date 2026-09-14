# Rural Xero Sync

Keeps WooCommerce stock in step with Xero and posts paid web orders to Xero as sales invoices.
No MyWorks or other middleman: the site talks to the Xero Accounting API directly.

## How stock actually moves in Xero

Quantity on hand of a tracked item is **read-only** through the Xero API. It only changes when an
authorised transaction posts against the item: a sales invoice reduces it, a bill increases it.
So the plugin has two halves:

| Direction | Mechanism | Frequency |
|---|---|---|
| Xero -> Woo | `GET /Items` with `If-Modified-Since`, write `QuantityOnHand` (and optionally the sales price) onto the product or variation whose `_xero_item_code` / SKU matches | every N minutes on Action Scheduler (default 15) |
| Woo -> Xero | on payment, build an `ACCREC` invoice with one line per SKU (`ItemCode`), `Status: AUTHORISED`, POST `/Invoices`; optionally PUT `/Payments` | immediately, via Action Scheduler, with retries |

Xero refuses to authorise an invoice that would push a tracked item negative. When that happens the
plugin creates the invoice as DRAFT instead and leaves an order note, so the sale is never lost.

## Who does what

- **Developer (once):** create the Xero app, paste the Client ID and secret into the Xero Sync page.
- **Bookkeeper:** log in with the "Bookkeeper (Xero Sync)" role. That login sees only the Xero Sync page
  (top-level menu), where they click Connect, pick accounts and tax rates from dropdowns filled from Xero,
  and decide GST inclusive/exclusive, invoice status and payment recording. A checklist at the top shows
  what is still missing. Create the user under Users > Add New with that role.
- **Shop staff:** nothing. Each order gets a Xero box with the invoice link and a "Send to Xero now" button.

## Setup

1. In Xero: [developer.xero.com/app/manage](https://developer.xero.com/app/manage) > New app > "Web app".
   Redirect URI = the value shown on the settings page (`https://<site>/wp-json/rural-xero/v1/callback`).
   Copy the Client ID and generate a Client secret.
   A Xero **Custom Connection** (client credentials, single organisation) also works: choose that auth
   mode on the settings page.
2. WordPress: the **Xero Sync** menu. Paste the id and secret, save, click **Connect to Xero**. A user who
   is an adviser/admin of the Xero organisation must be the one signing in.
3. Set the accounting options. The ones the bookkeeper needs to confirm:
   - amounts GST inclusive or exclusive (web prices are normally inclusive)
   - sales account code for lines without an item code (shipping, fees, discounts)
   - whether to record a payment, and to which bank account code
   - contact per customer or one "Website Sales" contact
4. Click **Full pull** once. Check the unknown-codes list on the page: those are Xero items with no product.
5. Make sure WP-Cron actually runs. On cPanel add a cron job such as
   `*/5 * * * * wget -q -O - https://<site>/wp-cron.php?doing_wp_cron >/dev/null 2>&1`
   (or `wp cron event run --due-now`). Action Scheduler rides on it.

## WP-CLI

```
wp rural xero status
wp rural xero connect-url          # print the authorise URL instead of clicking the button
wp rural xero pull-stock [--full]
wp rural xero items --search=RR6   # proves the connection, shows QOH and the matching Woo id
wp rural xero push-order 123 --preview   # show the invoice payload
wp rural xero push-order 123
```

## Data the plugin stores

- `rural_xero_settings` option
- `rural_xero_tokens` option (AES-256 encrypted with AUTH_KEY): access token, refresh token, tenant id
- product meta `_xero_item_id`, `_xero_last_sync`; the importer sets `_xero_item_code`
- order meta `_xero_invoice_id`, `_xero_invoice_number`, `_xero_payment_id`, `_xero_sync_attempts`
- log: WooCommerce > Status > Logs, source `rural-xero-sync`

## Not covered (yet)

Refunds and cancellations are not sent to Xero (a credit note would be needed). Items created in Xero
after the import are reported as "unknown codes" rather than auto-created as products.
