# Helpful Info migration

The 12 Information Pages linked from the legacy site's sidebar were crawled on 9 October 2026. `legacy-information-snapshot.json` records their complete extracted page text, source URLs, image references, links and response hashes. Refresh with `python3 scripts/content/crawl_legacy.py` and review the diff. This is an information-page crawl, not a catalogue or blog migration.

`wp-content/mu-plugins/rural-helpful/guides.json` contains the edited guides. They retain the original topics and practical checklists, with shorter sentences and headings. Old prices, model-specific stock promises, dated standards references and blanket electric-fence safety claims are excluded. Source photos/PDFs are inventoried but not hotlinked. The templates reuse existing theme images and components.

## Update and launch

The deployment workflow copies the plugin and runs `deploy.php`, which creates the guides **only on rural.travis.work**. It never imports automatically on the legacy/production domain. No database writes run on frontend requests.

For another environment, from its WordPress root:

```sh
wp rural helpful import
wp rural helpful import --apply
```

The first command is a preview. The second creates `/help/` if needed and 12 published child pages. Existing pages are matched by source URL and preserved, including editor changes, changed slugs, drafts and trash. Unowned slug collisions abort before writing. The importer does not change menus stored in the database: the shared desktop/mobile menu displays published Helpful Info children instead of placeholder links. Other navigation is unchanged.

Edit the resulting pages in WordPress. `page-help.twig` becomes the index; imported guides use `page-help-guide.twig`. Draft/password-protected pages are excluded from navigation. The source URL and theme image are stored as post metadata. A legacy information URL redirects only when it would otherwise be a 404 and its imported destination is public; valid product/page routes are never overridden.

At launch, migrate these WordPress page records with the database or run the import explicitly. Verify `/help/`, each guide, mobile navigation and all old URLs on the final domain. Existing blog content under `blog.ruralfencingsupplies.com.au` remains a separate migration. Gatemaster remains an external link.

## Tests

Run only in a disposable WordPress Playground:

```sh
npx @wp-playground/cli@3.1.56 php --php=8.2 --wp=6.8 --define RURAL_CONTENT_TEST 1 \
  --mount "$PWD/wp-content/mu-plugins/rural-helpful.php:/wordpress/wp-content/mu-plugins/rural-helpful.php" \
  --mount "$PWD/wp-content/mu-plugins/rural-helpful:/wordpress/wp-content/mu-plugins/rural-helpful" \
  --mount "$PWD/scripts/content:/content" -- /content/test-integration.php
```

Covers preview-only operation, collision preflight, all 12 pages and redirects, repeated imports, edited content/permalinks, and unpublished destinations.

## Tips featured images

`rural-helpful/tip-images.json` maps all 15 staging tip articles to 10 reviewed, topic-matched photographs from the original blog. `rural-tip-images.php` imports them into local WordPress media, generates normal image sizes, and adds descriptive alt text. The cards and article headers use these local attachments rather than hotlinks.

Staging deployment runs the import automatically. Elsewhere, preview with `wp rural tips images`, then apply with `wp rural tips images --apply`. The importer replaces only the recorded seed images or missing selections, preserves later editor choices, and reuses already imported media. Original thumbnail IDs remain in `_rural_tip_previous_thumbnail` for rollback. Migrate uploads and attachment records with the database at launch.

Run the image migration tests in disposable WordPress:

```sh
npx @wp-playground/cli@3.1.56 php --php=8.2 --wp=6.8 --define RURAL_CONTENT_TEST 1 \
  --mount "$PWD/wp-content/mu-plugins/rural-tip-images.php:/wordpress/wp-content/mu-plugins/rural-tip-images.php" \
  --mount "$PWD/scripts/content:/content" -- /content/test-tip-images.php
```

Covers dry runs, local attachment creation, shared-image reuse, alt text, repeat imports, previous thumbnail retention, editorial preservation, and source validation.
