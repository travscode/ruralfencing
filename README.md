# Rural Timber Boilerplate

A stripped-back WordPress boilerplate for building new sites with Timber, Twig, Tailwind CSS, and a minimal ESBuild pipeline.

This repository has been cleaned back to the essentials. It keeps the WordPress setup, a minimal Timber theme, and the front-end build tools, while removing the old project-specific PHP, ACF structures, CSS, JavaScript animations, and custom templates.

## What You Get

- A WordPress project root with Composer-based setup
- A starter theme at `wp-content/themes/weerts`
- Timber for Twig-based templating
- Tailwind CSS with PostCSS
- ESBuild for a small JavaScript bundle
- Minimal archive, page, single, search, author, and `404` templates
- Two menu locations: `primary` and `footer`

## Requirements

Before you start, make sure you have:

- PHP `8.1+`
- Composer
- Node.js
- `pnpm`
- A local database
- A local WordPress-ready web server or local environment

## Important Paths

- `wp-content/themes/weerts`: the starter theme
- `wp-content/themes/weerts/functions.php`: theme bootstrap and asset loading
- `wp-content/themes/weerts/templates`: Twig templates
- `wp-content/themes/weerts/templates/partials`: shared Twig partials
- `wp-content/themes/weerts/css`: Tailwind entry files
- `wp-content/themes/weerts/js`: JavaScript entry file
- `wp-content/themes/weerts/static`: compiled asset output

## Step-By-Step Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd ruralfencing
```

### 2. Install the root Composer dependencies

From the project root:

```bash
composer install
```

### 3. Create a local database

Create a database for the project in your local database tool of choice.

Make note of:

- database name
- username
- password
- host
- port

### 4. Configure WordPress

Update the local WordPress configuration for your environment so it points to the correct database and local site URL.

Check the root config files in this repo, especially:

- `wp-config.php`

If your local setup also uses extra environment files outside the repo, make sure those match too.

### 5. Install the theme Composer dependencies

The theme loads Timber from inside the theme itself, so install the theme-level PHP dependencies:

```bash
cd wp-content/themes/weerts
composer install
```

### 6. Install the theme Node dependencies

Still in `wp-content/themes/weerts`:

```bash
pnpm install
```

### 7. Build the assets once

Generate the initial compiled CSS and JavaScript:

```bash
pnpm run build
```

This creates:

- `static/style.css`
- `static/editor.css`
- `static/site.js`

### 8. Open the site locally

Start the local WordPress server from the project root:

```bash
./serve-local.sh
```

This uses the tracked high-limit PHP overrides in `.php/conf.d/99-local-dev.ini`, which helps avoid local plugin install and upload timeouts in `wp-admin`.

To use a different host or port:

```bash
./serve-local.sh 127.0.0.1 9090
```

Then load the site in your browser.

If WordPress has not been installed yet, complete the normal WordPress installation flow.

### 9. Activate the theme

In WordPress admin:

- go to `Appearance > Themes`
- activate `Rural Timber Boilerplate`

### 10. Create the starter menus

In WordPress admin:

- go to `Appearance > Menus`
- create a menu and assign it to `Primary Menu`
- create a second menu and assign it to `Footer Menu`

### 11. Start development mode

From `wp-content/themes/weerts`:

```bash
pnpm run dev
```

This watches and rebuilds:

- `css/main.css` -> `static/style.css`
- `css/editor.css` -> `static/editor.css`
- `js/index.js` -> `static/site.js`

## Daily Workflow

### Start development

From the project root, start WordPress:

```bash
./serve-local.sh
```

From `wp-content/themes/weerts`:

```bash
pnpm run dev
```

Then edit:

- Twig templates in `templates`
- shared partials in `templates/partials`
- front-end styles in `css/main.css`
- editor styles in `css/editor.css`
- JavaScript in `js/index.js`
- theme setup in `functions.php`

### Make a production build

Before deploying or handing work off:

```bash
pnpm run build
```

## How The Theme Works

The theme uses Timber to connect WordPress PHP templates to Twig templates.

Examples:

- `page.php` renders `page.twig`
- `single.php` renders `single.twig`
- `archive.php` renders `archive.twig`
- `search.php` renders `search.twig`
- `author.php` renders `author.twig`
- `404.php` renders `404.twig`

The global layout lives in:

- `wp-content/themes/weerts/templates/base.twig`

## How Styling Works

Tailwind runs through PostCSS.

The main front-end stylesheet starts at:

- `wp-content/themes/weerts/css/main.css`

The editor stylesheet starts at:

- `wp-content/themes/weerts/css/editor.css`

Tailwind scans:

- theme root PHP files
- Twig templates in `templates`
- JavaScript files in `js`

The Tailwind config is:

- `wp-content/themes/weerts/tailwind.config.cjs`

## How JavaScript Works

The JavaScript layer is intentionally minimal.

The entry file is:

- `wp-content/themes/weerts/js/index.js`

It builds to:

- `wp-content/themes/weerts/static/site.js`

If you want more JavaScript later, add new modules under `js` and import them into `js/index.js`.

## Plugins

This boilerplate is intentionally light on plugins.

Out of the box, the theme only expects Timber, which is installed through Composer inside the theme.

You do not need to add:

- ACF
- Gravity Forms
- animation libraries
- custom helper plugins

Unless your project genuinely needs them later.

## Recommended First Tasks

Once the boilerplate is running, a sensible next pass is to:

- rename the theme folder from `weerts` to your final project slug
- update the theme metadata in `style.css`
- update the text domain if you want it to match the final slug
- replace the starter homepage copy in `templates/front-page.twig`
- build your own Twig partials and design system

## Troubleshooting

### Timber is missing

If you see the Timber fallback message:

- run `composer install` inside `wp-content/themes/weerts`
- confirm `wp-content/themes/weerts/vendor/autoload.php` exists

### Styles or scripts are missing

- run `pnpm install`
- run `pnpm run build` or `pnpm run dev`
- confirm compiled files exist in `wp-content/themes/weerts/static`

### Tailwind classes are not appearing

- make sure the classes exist in files covered by `tailwind.config.cjs`
- rerun `pnpm run build`

## Command Reference

From `wp-content/themes/weerts`:

```bash
composer install
pnpm install
pnpm run dev
pnpm run build
```

From the project root:

```bash
./serve-local.sh
```
