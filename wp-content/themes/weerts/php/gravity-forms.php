<?php

add_action('wp_enqueue_scripts', 'enqueue_contact_form_scripts');

function enqueue_contact_form_scripts()
{
    wp_enqueue_script('jquery');

    if (class_exists('GFForms')) {
        $form_id = 1;

        // Enqueue form-specific scripts
        gravity_form_enqueue_scripts($form_id, true);

        // Enqueue base styles
        wp_enqueue_style('gforms_css');
        wp_enqueue_style('gforms_ready_class_css');
        wp_enqueue_style('gforms_browsers_css');
    }

    // Localize script for AJAX
    wp_localize_script('weerts', 'wpAjax', array(
        'ajaxurl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('wp_ajax')
    ));
}
