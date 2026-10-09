# SEO checklist implementation

Source: [SEO QA log, rows 5–9](https://docs.google.com/spreadsheets/d/1qlquMTSfuL-ImVfFS-7HGt3KBlgIwp-jIJwnJ_zD6KQ/edit#gid=1696459753).

The implementation uses **Yoast SEO** (tested with 28.6) for editable titles/descriptions,
canonical links, social metadata, XML sitemaps and the WebSite/WebPage/Organization graph.
`wp-content/mu-plugins/rural-seo.php` supplies site-specific behavior. The deploy workflow
copies this integration and the migration files. Installing/activating Yoast and importing
database metadata are separate, one-time steps. These have **not** been run on the demo.

## Setup on the demo

Take a database backup outside the public web root before applying changes. Run from the
WordPress root, after deploying this branch. If an SEO plugin is already active, resolve
that conflict before activating Yoast. Never run multiple SEO plugins together.

```sh
wp plugin list --status=active
wp plugin install wordpress-seo --version=28.6 --activate
wp rural seo setup
wp rural seo setup --apply
wp rural seo import --file=scripts/seo/legacy-metadata.json
wp rural seo import --file=scripts/seo/legacy-metadata.json --apply
wp yoast index --reindex
wp cache flush
```

Purge the host/CDN page cache too. Check that real `robots.txt`, `sitemap.xml` or `llms.txt`
files in the web root are not taking precedence over WordPress. Do not remove an existing
file without checking its contents. Yoast's own static llms.txt generation is disabled
by setup because the site integration serves a dynamic version.

The importer fills **empty fields only**, reports unresolved targets, and never replaces
an editor's saved Yoast values. Preview output shows the exact metadata to be imported.
Do not mark migration complete while unresolved rows remain.

Yoast requires a logo before generating Organization schema. Setup reuses an existing
Yoast logo, custom logo or site icon; otherwise it imports the theme's 500px brand icon
into the media library once. Use `--logo-file=/path/to/logo.png` to supply another approved logo.

## Legacy metadata coverage

`source-map.json` maps 25 product categories, the static homepage, About, Contact and Privacy pages to
verified legacy URLs. `legacy-metadata.json` stores the captured title and description,
source URL and capture time. The full original description is retained even if it is
longer than current snippet guidance. The live Treated Pine Poles description currently
also includes the business name prefix; the supplied QA screenshot omitted that prefix.
Some legacy titles contain existing encoding artifacts; these are preserved for the SEO
team to review rather than silently rewriting approved metadata.

Refresh the snapshot, then review the diff, using:

```sh
python3 scripts/seo/collect_metadata.py --map scripts/seo/source-map.json --output scripts/seo/legacy-metadata.json
```

Categories needing mapping/content review: `accessories`, `boundary-accessories`,
`boundary-posts`, `panels`, `posts`, `safety-gate-latches-hinges`. Do not map `accessories`
to the old irrigation Accessories page: its new parent is Aluminium Boundary Fencing.
`featured`, `new-products`, `specials` and `uncategorized` have no approved legacy mapping.
New/utility pages also need editorial review; Cart, Checkout and My Account are set to
noindex by setup. Review whether Sample Page should remain published.

Product migration requires the server database's `_rural_zen_product_id` values. The
collector uses those identities, verifies the source product's hidden product ID, and
refuses homepage/soft-404 responses. New products and unverifiable IDs are flagged.
It does not write WordPress data or make remote requests during frontend page loads.

```sh
wp rural seo collect-products --file=/private-backup-path/products-000.json --limit=100 --offset=0
wp rural seo import --file=/private-backup-path/products-000.json
# Review the capture and dry run before applying it.
wp rural seo import --file=/private-backup-path/products-000.json --apply
```

Repeat with offsets 100, 200, etc. and a new output filename until all published products
are covered. Then reindex Yoast. Missing descriptions receive a modest contextual fallback
at render time; this is not a substitute for completing the legacy migration.

## Crawl rules and launch

- The known `rural.travis.work` demo, non-production WordPress environments, and sites
  with Search Engine Visibility disabled return `Disallow: /` and noindex directives.
- Production honors `blog_public` and preserves WordPress/Yoast rules, adds search and
  add-to-cart parameter exclusions, and advertises the active sitemap. CSS/JS remain crawlable.
- `/sitemap.xml` redirects permanently to Yoast's `/sitemap_index.xml` (or WordPress's
  `/wp-sitemap.xml` if Yoast is not active). This works without a new rewrite rule.
- `/llms.txt` returns UTF-8 plain text with published information pages and nonempty
  top-level product categories. Links use the current site's domain. This is a reference
  file for AI tools, not a guaranteed ranking feature.
- The business schema extends Yoast's existing organization node, preserving its `@id`
  and graph relationships. Address, phone and hours match the current contact template.
- The custom Timber product template now invokes WooCommerce's product schema generator;
  enquiry-only items do not advertise a zero-dollar offer. No reviews or ratings are invented.

At launch, confirm the production domain, WordPress environment and Search Engine
Visibility setting. Do not enable indexing on the demo merely to make a crawler report green.
Keep Yoast current after this tested installation; the deployment does not downgrade it.

## Acceptance checks on the deployed site

1. Treated Pine Poles: exactly one title, meta description and canonical. Compare saved
   metadata with the snapshot. Check several categories, products and information pages.
2. Demo robots/noindex remain restrictive. In production, inspect robots.txt and make
   sure the advertised sitemap is reachable and contains production URLs only.
3. `/sitemap.xml` redirects to a valid XML index; open the linked page, product and
   product-category sitemaps and check their URLs and exclusions.
4. `/llms.txt` responds 200 with `text/plain` and working links, no draft/private content.
5. Inspect homepage and product JSON-LD; run Google's Rich Results Test on representative
   purchasable and enquiry-only products. Review actual business details with the owner.
6. Finish product collection/import and resolve mapping gaps before signing off QA row 5.

General forms/tracking QA (row 3) and mobile/design QA (row 4, linked Pastel canvas) are
separate from these five SEO requests and are not marked completed by this work.

## Regression tests

Extract the official Yoast 28.6 plugin archive to a temporary directory, then run:

```sh
YOAST_PLUGIN_PATH=/tmp/wordpress-seo bash scripts/seo/test.sh
```

The runner uses a disposable WordPress Playground database (WordPress 6.8, PHP 8.2),
the repository's WooCommerce plugin, and Yoast. It does not connect to the demo database.
Tests cover dry runs, exact legacy metadata, preserving editor changes and canonical
URLs, production/demo crawl rules, schema, draft exclusion in llms.txt, and rejecting
soft-404 responses during product migration. The deploy workflow also lints changed PHP.
