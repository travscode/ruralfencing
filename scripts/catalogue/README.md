# Catalogue pipeline: Xero + Zen Cart -> WooCommerce

One deterministic path from the source data to a finished WooCommerce catalogue.
Rerun it as often as you like; manual decisions live in two small CSVs that survive reruns.

```
ignore/xero_export_products.csv          Xero items (source of truth for SKU, price, stock, active/archived)
ignore/ruralfen_14RTS.sql                Zen Cart dump (names, descriptions, photos, old categories)
ignore/images/                           Zen Cart photos
ignore/Rural Data Migration - Zen to Woo Categories MAP.csv   hand-reviewed Zen category -> Woo category sheet
ignore/catalogue/woo_categories.json     live Woo category tree (see below)
        |
        v
scripts/catalogue/build_catalogue.py
        |
        v
ignore/catalogue/products.csv            one row per Woo product / variation
ignore/catalogue/review.csv              rows worth a human look (flags column says why)
ignore/catalogue/unmatched_zen.csv       enabled Zen products no active Xero item points at
ignore/catalogue/images_manifest.txt     the photo files the import needs
ignore/catalogue/summary.txt
        |
        v
wp rural catalogue import                (plugin: wp-content/plugins/rural-catalogue)
```

## 1. Build the catalogue

```bash
# refresh the Woo category tree first if categories changed on the site
wp term list product_cat --fields=term_id,name,slug,parent,count --format=json > ignore/catalogue/woo_categories.json

python3 scripts/catalogue/build_catalogue.py
```

What it does, in order, for every **Active** Xero item:

1. **Match a Zen Cart product** so we can reuse its name, description, photo and old category.
   Zen's SKU is the bracketed suffix of the product name (`... (RR6 21)`). Tiers, best first:
   `code_exact`, `code_norm` (punctuation/case ignored), `name_last_exact` / `name_last_norm`
   (Xero ItemName is `GROUP:SUBGROUP:CODE`, the last segment is often the old SKU when the ItemCode is a barcode),
   `name_segment`, `code_prefix` / `name_last_prefix` (Zen SKU is the start of the Xero code, e.g. `RR6 21 D/R END`),
   `fuzzy` (numbers agree both ways and most words overlap; conservative).
2. **Group variations.** When several Xero SKUs land on one Zen product they become one variable product
   (`ZEN-<zen id>` parent) with an `Option` attribute, one variation per Xero SKU. Labels come from the part
   of the code after the shared SKU (`D/R End`, `S/R Pre Order`, `Standard`).
3. **Categories.** Zen product -> its Zen categories -> the sheet -> Woo term ids, then every ancestor is added.
   Items with no Zen product use `ignore/catalogue/xero_prefix_category_map.csv`, keyed on the Xero
   ItemName prefix (`IRRIG`, `IRRIG:PUMPS`, ...). Level-2 rows override level-1 rows when filled in.
4. **Images.** Zen photo when matched. Otherwise the most common photo among matched items in the same
   Xero folder (`image_from_sibling` flag; the importer can skip these with `--no-sibling-images`).
5. **Price / stock / tax** straight from Xero. Tracked items manage stock; untracked ones do not.
   Zero-price items become enquire-only. Fees and services (`service_item`) import hidden from the catalogue.

### Files you edit

- `ignore/catalogue/xero_prefix_category_map.csv`: set `woo_id` and put `manual` in `source` so a
  regeneration (`--regen-prefix-map`) keeps your choice. `evidence` shows where matched siblings went.
- `ignore/catalogue/overrides.csv`: per-SKU decisions. Columns: `xero_sku`, `zen_product_id`
  (`none` forces no match), `woo_category_ids` (`24|37`), `name`, `skip` (`1` drops the item).

## 2. Import into WooCommerce

The `rural-catalogue` plugin adds WP-CLI commands. Run them on the server that owns the uploads folder.

```bash
rsync -az --files-from=ignore/catalogue/images_manifest.txt ignore/images/ user@host:~/catalogue-import/images/
rsync -az ignore/catalogue/products.csv user@host:~/catalogue-import/products.csv

wp rural catalogue import --file=~/catalogue-import/products.csv --images=~/catalogue-import/images --dry-run --limit=10
wp rural catalogue import --file=~/catalogue-import/products.csv --images=~/catalogue-import/images
wp rural catalogue status
```

The import is idempotent: products are found by SKU, unchanged rows are skipped via a stored hash,
photos are uploaded once and reused (`_rural_source_image` meta). Use `--offset/--limit` to chunk
on a small server, `--sku=` to redo one product, `--force` to rewrite unchanged rows.

`wp rural catalogue purge --yes [--attachments]` empties the shop.

Every product carries `_xero_item_code` meta (variations too), which the Xero sync plugin uses.
