<?php

use Timber\Timber;

class PostsApiRoute
{
    public function __construct()
    {
        add_action('rest_api_init', array($this, 'register_api_routes'));
    }

    public function register_api_routes()
    {
        register_rest_route('start/v1', '/posts', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_posts'),
            'permission_callback' => '__return_true',
        ));
    }

    public function get_posts($request)
    {
        $page = (int) $request->get_param('page') ?: 1;
        $category = sanitize_text_field($request->get_param('category'));

        $posts = $this->query_posts($page, $category);

        if (!$posts) {
            return new WP_Error('no_posts', 'No posts available', array('status' => 404));
        }

        $html = $this->render_posts($posts);

        if (!$html) {
            return new WP_Error('no_html', 'No HTML rendered', array('status' => 500));
        }

        // Get total posts for hasMore calculation
        $total_posts = $this->get_total_posts($category);
        $posts_per_page = 10;
        $hasMore = ($page * $posts_per_page) < $total_posts;

        return new WP_REST_Response(array(
            'html' => $html,
            'hasMore' => $hasMore,
            'success' => true
        ), 200);
    }

    private function query_posts($page, $category)
    {
        $args = array(
            'post_type' => 'post',
            'posts_per_page' => 10,
            'paged' => $page
        );

        if ($category) {
            $args['tax_query'] = array(
                array(
                    'taxonomy' => 'category',
                    'field' => 'slug',
                    'terms' => $category
                ),
            );
        }

        return Timber::get_posts($args);
    }

    private function get_total_posts($category)
    {
        $args = array(
            'post_type' => 'post',
            'posts_per_page' => -1,
            'fields' => 'ids'
        );

        if ($category) {
            $args['tax_query'] = array(
                array(
                    'taxonomy' => 'category',
                    'field' => 'slug',
                    'terms' => $category
                ),
            );
        }

        $query = new WP_Query($args);
        return $query->found_posts;
    }

    private function render_posts($posts)
    {
        $html = '';

        foreach ($posts as $post) {
            $context = Timber::context();
            $context['post'] = $post;
            $html .= Timber::compile('partials/posts/tease-post.twig', $context);
        }

        return $html;
    }
}

new PostsApiRoute();
