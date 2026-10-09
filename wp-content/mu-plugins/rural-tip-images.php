<?php
/**
 * Plugin Name: Rural Tips Image Migration
 * Description: Explicit, repeatable import of reviewed legacy blog photos into local featured images.
 */
if (!defined('ABSPATH')) { exit; }

final class Rural_Tip_Images
{
    public static function manifest(): array
    {
        $rows = json_decode((string) file_get_contents(__DIR__ . '/rural-helpful/tip-images.json'), true);
        if (!is_array($rows)) { throw new RuntimeException('Invalid tips image manifest.'); }
        return $rows;
    }

    private static function usable(int $id): bool
    {
        $file = $id ? get_attached_file($id) : false;
        return $file && is_file($file) && wp_attachment_is_image($id);
    }

    /** Existing editor selections are preserved; only the recorded broken seed images are replaced. */
    public static function import(bool $apply = false, ?array $rows = null): array
    {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $result = [];
        foreach ($rows ?? self::manifest() as $row) {
            $post = get_page_by_path($row['slug'], OBJECT, 'post');
            if (!$post || $post->post_status !== 'publish') {
                $result[] = ['slug' => $row['slug'], 'action' => 'skipped: not a published article'];
                continue;
            }
            $current = (int) get_post_thumbnail_id($post);
            $ours = $current && get_post_meta($current, '_rural_tip_image_source', true) === $row['source_image'];
            if ($ours && self::usable($current)) {
                $result[] = ['slug' => $row['slug'], 'action' => 'already imported'];
                continue;
            }
            if ($current && $current !== (int) $row['expected_thumbnail_id'] && !$ours) {
                $result[] = ['slug' => $row['slug'], 'action' => 'preserved editor image'];
                continue;
            }
            $parts = wp_parse_url($row['source_image']);
            if (($parts['scheme'] ?? '') !== 'https' || ($parts['host'] ?? '') !== 'blog.ruralfencingsupplies.com.au'
                || !str_starts_with($parts['path'] ?? '', '/wp-content/uploads/')) {
                throw new RuntimeException('Unapproved image source for ' . $row['slug']);
            }
            if (!$apply) {
                $result[] = ['slug' => $row['slug'], 'action' => 'would import original blog image'];
                continue;
            }
            // Reuse local media when several articles share the same source photo.
            $attachments = get_posts([
                'post_type' => 'attachment', 'post_status' => 'inherit', 'numberposts' => -1,
                'meta_key' => '_rural_tip_image_source', 'meta_value' => $row['source_image'],
            ]);
            $id = 0;
            foreach ($attachments as $attachment) {
                if (self::usable($attachment->ID)) { $id = $attachment->ID; break; }
            }
            if (!$id) {
                $temp = download_url($row['source_image'], 30);
                if (is_wp_error($temp)) { throw new RuntimeException($row['slug'] . ': ' . $temp->get_error_message()); }
                $mime = wp_get_image_mime($temp);
                if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || filesize($temp) > 15 * MB_IN_BYTES) {
                    wp_delete_file($temp);
                    throw new RuntimeException('Source is not an acceptable image for ' . $row['slug']);
                }
                $id = media_handle_sideload(['name' => basename($parts['path']), 'tmp_name' => $temp], $post->ID, $row['alt']);
                if (is_wp_error($id)) {
                    wp_delete_file($temp);
                    throw new RuntimeException($row['slug'] . ': ' . $id->get_error_message());
                }
                update_post_meta($id, '_wp_attachment_image_alt', $row['alt']);
                update_post_meta($id, '_rural_tip_image_source', $row['source_image']);
                update_post_meta($id, '_rural_tip_image_source_page', $row['source_page']);
            }
            if (!metadata_exists('post', $post->ID, '_rural_tip_previous_thumbnail')) {
                update_post_meta($post->ID, '_rural_tip_previous_thumbnail', $current);
            }
            if (!set_post_thumbnail($post->ID, $id)) { throw new RuntimeException('Could not set featured image for ' . $row['slug']); }
            $result[] = ['slug' => $row['slug'], 'action' => 'featured image set: ' . $id];
        }
        return $result;
    }
}

if (defined('WP_CLI') && WP_CLI) {
    WP_CLI::add_command('rural tips images', static function (array $args, array $options): void {
        try {
            \WP_CLI\Utils\format_items('table', Rural_Tip_Images::import(isset($options['apply'])), ['slug', 'action']);
        } catch (Throwable $error) { WP_CLI::error($error->getMessage()); }
    });
}
