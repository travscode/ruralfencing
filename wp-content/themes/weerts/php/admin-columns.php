<?php
// inc/admin‑columns.php

// 1) Add the "Work" column after the Title for Award posts
add_filter( 'manage_award_posts_columns', function( array $cols ) {
    $new = [];
    foreach ( $cols as $key => $label ) {
        $new[ $key ] = $label;
        if ( 'title' === $key ) {
            $new['work'] = __( 'Work', 'your-textdomain' );
        }
    }
    return $new;
} );

// 2) Populate that column for Award posts
add_action( 'manage_award_posts_custom_column', function( $column, $post_id ) {
    if ( 'work' !== $column ) {
        return;
    }

    // grab whatever ACF returned (IDs or Post Objects)
    $items = get_field( 'work', $post_id );

    if ( empty( $items ) ) {
        echo '—';
        return;
    }

    // normalise to array
    $items = is_array( $items ) ? $items : [ $items ];

    $links = [];
    foreach ( $items as $item ) {
        // if it's an object you'll get ->ID, otherwise cast to int
        $id = is_object( $item ) ? $item->ID : intval( $item );
        if ( $id ) {
            $links[] = sprintf(
                '<a href="%s">%s</a>',
                esc_url( get_edit_post_link( $id ) ),
                esc_html( get_the_title( $id ) )
            );
        }
    }

    echo $links ? implode( ', ', $links ) : '—';
}, 10, 2 );

// 3) Make Award Work column sortable
add_filter( 'manage_edit-award_sortable_columns', function( $cols ) {
    $cols['work'] = 'work';
    return $cols;
} );

add_action( 'pre_get_posts', function( $query ) {
    if (
        is_admin()
        && $query->is_main_query()
        && 'award' === $query->get('post_type')
        && 'work' === $query->get('orderby')
    ) {
        $query->set( 'meta_key', 'work' );
        $query->set( 'orderby',   'meta_value' );
    }
} );

// 4) Add the "Services" column after the Title for Work posts
add_filter( 'manage_work_posts_columns', function( array $cols ) {
    $new = [];
    foreach ( $cols as $key => $label ) {
        $new[ $key ] = $label;
        if ( 'title' === $key ) {
            $new['services'] = __( 'Services', 'your-textdomain' );
        }
    }
    return $new;
} );

// 5) Populate that column for Work posts
add_action( 'manage_work_posts_custom_column', function( $column, $post_id ) {
    if ( 'services' !== $column ) {
        return;
    }

    // grab whatever ACF returned (IDs or Post Objects)
    $items = get_field( 'work_services', $post_id );

    if ( empty( $items ) ) {
        echo '—';
        return;
    }

    // normalise to array
    $items = is_array( $items ) ? $items : [ $items ];

    $links = [];
    foreach ( $items as $item ) {
        // if it's an object you'll get ->ID, otherwise cast to int
        $id = is_object( $item ) ? $item->ID : intval( $item );
        if ( $id ) {
            $links[] = sprintf(
                '<a href="%s">%s</a>',
                esc_url( get_edit_post_link( $id ) ),
                esc_html( get_the_title( $id ) )
            );
        }
    }

    echo $links ? implode( ', ', $links ) : '—';
}, 10, 2 );

// 6) Make Work Services column sortable
add_filter( 'manage_edit-work_sortable_columns', function( $cols ) {
    $cols['services'] = 'services';
    return $cols;
} );

add_action( 'pre_get_posts', function( $query ) {
    if (
        is_admin()
        && $query->is_main_query()
        && 'work' === $query->get('post_type')
        && 'services' === $query->get('orderby')
    ) {
        $query->set( 'meta_key', 'work_services' );
        $query->set( 'orderby',   'meta_value' );
    }
} );
