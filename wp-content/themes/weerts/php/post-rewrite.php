<?php

/**
 * RELIABLE METHOD: Change WordPress post URLs to /pulse/
 * This is the method that actually works consistently
 */

// Step 1: Change the permalink structure properly
function change_post_permalink_structure()
{
    global $wp_rewrite;

    // Set the post permalink structure
    $wp_rewrite->extra_permastructs['post']['struct'] = '/pulse/%postname%/';
    $wp_rewrite->extra_permastructs['post']['with_front'] = false;
}
add_action('init', 'change_post_permalink_structure', 1);

// Step 2: Add the rewrite rule
function add_pulse_rewrite_rule()
{
    add_rewrite_rule(
        '^pulse/([^/]+)/?$',
        'index.php?name=$matches[1]',
        'top'
    );
}
add_action('init', 'add_pulse_rewrite_rule', 1);

// Step 3: Handle old URL redirects
function redirect_old_urls_to_pulse()
{
    $request_uri = trim($_SERVER['REQUEST_URI'], '/');

    // Check for old /posts/ pattern
    if (preg_match('#^posts/([^/]+)/?$#', $request_uri, $matches)) {
        $slug = $matches[1];
        wp_redirect(home_url('/pulse/' . $slug . '/'), 301);
        exit;
    }

    // Also handle default WordPress patterns like /2024/01/post-name/
    if (preg_match('#^\d{4}/\d{2}/([^/]+)/?$#', $request_uri, $matches)) {
        $slug = $matches[1];
        // Check if this is actually a post
        $post = get_page_by_path($slug, OBJECT, 'post');
        if ($post) {
            wp_redirect(home_url('/pulse/' . $slug . '/'), 301);
            exit;
        }
    }
}
add_action('template_redirect', 'redirect_old_urls_to_pulse');
