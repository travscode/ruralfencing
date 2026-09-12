# Dale feedback and responsive review

Branch: `codex/article-pastel-feedback` · 11 September 2026

Reviewed all 34 active comments by Dale Wallace on [the Pastel canvas](https://usepastel.com/link/okj9wem3#/). The source of truth is the top-level frames on [Figma Design Phase 2](https://www.figma.com/design/HaVC3A4rNs92snbCt7FGzV?node-id=4212-1263), including article frame `4314:6472`. References in comments were treated as design feedback, not authorization to publish or contact anyone.

Changes are local and uncommitted. No deployment, Pastel status changes or replies have been made. “Implemented” below means code is ready for WordPress review, not verified on the staging site.

| Comment | Request | Implementation / remaining work |
| --- | --- | --- |
| 1 | Favicon | Added Dale's supplied image as the fallback; a configured WordPress Site Icon takes priority. |
| 2 | Navigation typography and hover | 17px links, underline hover/focus treatment. |
| 3 | Products/account/cart hover | Birch overlay treatment on green navigation. |
| 4 | Hero button icons and hover | Figma fencing, gates and irrigation SVGs; gold hover and right-hand rounding. |
| 5 | Social hover | Green circles and white icons in location blocks. |
| 6 | Product card hover and tags | 70% birch image overlay, View Product label and arrow, 12px badges. |
| 7 | Category buttons | Reduced desktop vertical padding; gold hover. Phone targets remain at least 44px tall. |
| 8 | Gates homepage block | Added Gates & Accessories with Figma photos and category links. |
| 9 | Irrigation icon | Replaced with Figma SVG. |
| 10 | Irrigation category buttons | Added Irrigation, Pumps and Water Tanks. |
| 11 | FAQ gap | Shared FAQ columns use a 60px gap; stack on phones/tablets. |
| 12 | CTA icon and carousel | Stripes beside heading; three photos, swipe/keyboard navigation, previous/next buttons and live counter. |
| 13 | Primary buttons | Gold hover, rounding only on the right, shared Figma arrow. PDF icon colour is preserved. |
| 14 | Footer socials | 60px circles; white circle and green icon on hover. |
| 15 | Footer spacing | Removed horizontal rules and increased lower separation; mobile spacing adjusted separately. |
| 16 | Footer labels | Title case, 16px body typography. |
| 17 | Services spacing | Reduced the shared image/content section spacing by roughly two thirds. |
| 18 | Category cards | Tenon 22px titles, dark image overlay and white hover label. |
| 19 | Category sidebar | Uses the actual WooCommerce category tree, including nested categories. Collapsible on mobile. Product/category imports remain WordPress content work. |
| 20 | Sale tag | Small cyan tag, including the individual product display. |
| 21 | Product enquiry | Contact action opens the existing enquiry form for purchasable and enquiry-only products; name/selected options prefill; scrollable mobile dialog, Escape and focus return. Sending email still needs WordPress validation. |
| 22 | Where to Next | Shared image/card composition with 50px arrow square and responsive stacking. |
| 23 | Helpful Info dropdown | Recursive WordPress menu children supported; published descendants of `/help` are used as a fallback. The additional pages/menu assignment could not be verified. Populate/configure these in WordPress to finish this item. No page content was invented or migrated. |
| 24 | Form heights | Reduced contact and advanced-search field padding; responsive enquiry fields. |
| 25 | Submit hover | Contact submit turns green with white text. |
| 26 | Cart and checkout | Cart Tailwind rules now compile into the built stylesheet instead of loading raw `@apply`. Added responsive cart, native checkout, account and block button styling. Removed duplicate cart totals and fixed quantity-input class arguments. CheckoutWC receives brand tokens through `cfw_custom_css_properties`; native checkout layout rules exclude it. Requires a real cart and checkout session to verify the active plugin/template and gateways. |
| 27 | Blog hero | Stripes beside text, 86px desktop heading, desktop filter alignment, stacked mobile controls. |
| 28 | Blog cards | 12px tags, 50% birch image overlay, green heading and gold button on hover/focus. |
| 29 | Article title | 86px desktop; 56px on phones. |
| 30 | Article H2 spacing | Larger separation before sections, 80px desktop / 48px mobile. |
| 31 | Article H3 spacing | 16px before the following content. |
| 32 | Blockquote spacing | 80px desktop / 48px mobile before and after. |
| 33 | Sharing | Exact five Figma icons: copy, Facebook, LinkedIn, X, ChatGPT. Copy reports success/failure. ChatGPT link contains an article-summary/source-memory request; it cannot guarantee ChatGPT will remember a domain. |
| 34 | Article ending | Replaced Related Posts with shared About-page Where to Next. |

## Responsive decisions

- Compact mobile header; site links move into a disclosure menu. Product navigation becomes a full-width category drill-down with back controls. Search stays available across the phone width.
- Text/image sections and cards stack in reading order; category collages use one wide image above two smaller images. Smaller type and section spacing retain hierarchy.
- CTA copy comes first visually on mobile, followed by an in-flow swipe gallery. Forms fit the viewport and use readable input sizes.
- Cart items use labelled rows on small screens and the totals follow the items. CheckoutWC retains its own responsive flow.
- Added focus states, disclosure handling, enquiry/search focus management and reduced-motion support.
- Corrected homepage and Helpful Info category links to the current root-level catalogue URLs.

## Verification completed

- Production `pnpm run build`: application CSS, editor CSS and JavaScript completed successfully.
- All 14 preview templates rendered: Home, About, Services, Helpful Info, Contact, blog archive, article, category landing, product listing, product, search results, account, cart and checkout.
- Browser checks at 320, 768 and 1440px found no document horizontal overflow across these templates. Additional 390px checks covered mobile composition and interactions.
- Verified enquiry prefill/fit/Escape/focus return, three-level product navigation/back controls, advanced-search drawer, CTA carousel movement/counter, responsive sidebar, article sharing and desktop typography/icon dimensions.
- JavaScript syntax, PHP static parsing of changed controllers/cart template, and `git diff --check` passed.

## WordPress verification still required

The local preview uses TwigJS with saved public page content and representative fixtures for products, menus, cart and checkout. PHP, Composer/Timber and a local WordPress database are not running here. It is a layout preview, not an operating shop.

Before closing the Pastel comments, run the built branch in WordPress and check the configured Helpful Info pages/menu; actual product images, categories, variable products and sale badges; enquiry/contact delivery; cart quantity/coupon/shipping updates; and CheckoutWC's enabled template, payment gateways and mobile checkout flow. No checkout purchase or external form submission was performed.

The repository deploys pushes to `main` automatically. This branch has not been merged or pushed to trigger that workflow.
