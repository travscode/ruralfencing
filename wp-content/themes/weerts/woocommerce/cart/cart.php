<?php
/**
 * Cart Page
 *
 * This template is used to display the WooCommerce cart page with a custom design
 * matching the Rural Fencing style guide.
 *
 * @package Weerts
 * @version 1.0.0
 */

defined( 'ABSPATH' ) || exit;

// Ensure WooCommerce is active
if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
	esc_html_e( 'WooCommerce cart is not available.', 'weerts' );
	return;
}

// Get cart object
$cart = WC()->cart;
$cart_items = $cart->get_cart();
$cart_subtotal = $cart->get_cart_subtotal();
$cart_total = $cart->get_cart_total();

// Get shipping methods
$shipping_packages = WC()->shipping()->get_packages();
$chosen_shipping_methods = WC()->session->get( 'chosen_shipping_methods' );

// Get cart item count
$cart_item_count = $cart->get_cart_contents_count();

// Check if cart is empty
$is_cart_empty = $cart->is_empty();

do_action( 'woocommerce_before_cart' );
?>

<div class="weerts-cart-page">
    <!-- Cart Header -->
    <div class="weerts-cart-header">
        <div class="container">
            <?php if ( ! $is_cart_empty ) : ?>
                <span class="weerts-cart-count">
                    <?php
                    /* translators: %d: number of items in cart */
                    printf( esc_html__( '%d items', 'weerts' ), $cart_item_count );
                    ?>
                </span>
            <?php endif; ?>
        </div>
    </div>

    <!-- Cart Content -->
    <div class="weerts-cart-content">
        <div class="container">
            <?php if ( $is_cart_empty ) : ?>
                <!-- Empty Cart State -->
                <div class="weerts-cart-empty">
                    <div class="weerts-cart-empty-icon">
                        <?php get_template_part( 'templates/icons/cart' ); ?>
                    </div>
                    <h2 class="weerts-cart-empty-title"><?php esc_html_e( 'Your cart is empty', 'weerts' ); ?></h2>
                    <p class="weerts-cart-empty-text"><?php esc_html_e( 'Looks like you have not added any products to your cart yet.', 'weerts' ); ?></p>
                    <a href="<?php echo esc_url( get_permalink( wc_get_page_id( 'shop' ) ) ); ?>" class="weerts-btn weerts-btn--primary">
                        <?php esc_html_e( 'Continue Shopping', 'weerts' ); ?>
                    </a>
                </div>
            <?php else : ?>
                <!-- Cart Layout: Items + Sidebar -->
                <div class="weerts-cart-layout">
                    <!-- Cart Items Section -->
                    <div class="weerts-cart-main">
                        <form class="woocommerce-cart-form" action="<?php echo esc_url( wc_get_cart_url() ); ?>" method="post">
                            <?php do_action( 'woocommerce_before_cart_table' ); ?>
                            
                            <div class="weerts-cart-table">
                                <!-- Table Header -->
                                <div class="weerts-cart-table-header">
                                    <div class="weerts-cart-col weerts-cart-col-product"><?php esc_html_e( 'Product', 'weerts' ); ?></div>
                                    <div class="weerts-cart-col weerts-cart-col-price"><?php esc_html_e( 'Price', 'weerts' ); ?></div>
                                    <div class="weerts-cart-col weerts-cart-col-quantity"><?php esc_html_e( 'Quantity', 'weerts' ); ?></div>
                                    <div class="weerts-cart-col weerts-cart-col-subtotal"><?php esc_html_e( 'Subtotal', 'weerts' ); ?></div>
                                    <div class="weerts-cart-col weerts-cart-col-remove"></div>
                                </div>

                                <!-- Table Body -->
                                <div class="weerts-cart-table-body">
                                    <?php foreach ( $cart_items as $cart_item_key => $cart_item ) : ?>
                                        <?php
                                        $_product = apply_filters( 'woocommerce_cart_item_product', $cart_item['data'], $cart_item, $cart_item_key );
                                        $product_id = apply_filters( 'woocommerce_cart_item_product_id', $cart_item['product_id'], $cart_item, $cart_item_key );

                                        if ( $_product && $_product->exists() && $cart_item['quantity'] > 0 && apply_filters( 'woocommerce_cart_item_visible', true, $cart_item, $cart_item_key ) ) :
                                            $product_permalink = apply_filters( 'woocommerce_cart_item_permalink', $_product->is_visible() ? $_product->get_permalink( $cart_item ) : '', $cart_item, $cart_item_key );
                                            $thumbnail = apply_filters( 'woocommerce_cart_item_thumbnail', $_product->get_image( 'woocommerce_thumbnail' ), $cart_item, $cart_item_key );
                                            $product_name = apply_filters( 'woocommerce_cart_item_name', $_product->get_name(), $cart_item, $cart_item_key );
                                            $product_price = apply_filters( 'woocommerce_cart_item_price', WC()->cart->get_product_price( $_product ), $cart_item, $cart_item_key );
                                            $product_subtotal = apply_filters( 'woocommerce_cart_item_subtotal', WC()->cart->get_product_subtotal( $_product, $cart_item['quantity'] ), $cart_item, $cart_item_key );
                                            
                                            // Get product categories
                                            $product_cats = get_the_terms( $product_id, 'product_cat' );
                                            $category_name = '';
                                            if ( $product_cats && ! is_wp_error( $product_cats ) ) {
                                                $category_name = $product_cats[0]->name;
                                            }
                                            ?>
                                            <div class="weerts-cart-row <?php echo esc_attr( apply_filters( 'woocommerce_cart_item_class', 'cart_item', $cart_item, $cart_item_key ) ); ?>" data-cart-item-key="<?php echo esc_attr( $cart_item_key ); ?>">
                                                <!-- Product Info -->
                                                <div class="weerts-cart-col weerts-cart-col-product">
                                                    <div class="weerts-cart-product">
                                                        <div class="weerts-cart-product-image">
                                                            <?php if ( $product_permalink ) : ?>
                                                                <a href="<?php echo esc_url( $product_permalink ); ?>">
                                                                    <?php echo wp_kses_post( $thumbnail ); ?>
                                                                </a>
                                                            <?php else : ?>
                                                                <?php echo wp_kses_post( $thumbnail ); ?>
                                                            <?php endif; ?>
                                                        </div>
                                                        <div class="weerts-cart-product-details">
                                                            <?php if ( $category_name ) : ?>
                                                                <span class="weerts-cart-product-category"><?php echo esc_html( $category_name ); ?></span>
                                                            <?php endif; ?>
                                                            <h3 class="weerts-cart-product-name">
                                                                <?php if ( $product_permalink ) : ?>
                                                                    <a href="<?php echo esc_url( $product_permalink ); ?>"><?php echo esc_html( $product_name ); ?></a>
                                                                <?php else : ?>
                                                                    <?php echo esc_html( $product_name ); ?>
                                                                <?php endif; ?>
                                                            </h3>
                                                            <?php
                                                            // Display variation data
                                                            echo wc_get_formatted_cart_item_data( $cart_item );
                                                            ?>
                                                        </div>
                                                    </div>
                                                </div>

                                                <!-- Price -->
                                                <div class="weerts-cart-col weerts-cart-col-price" data-title="<?php esc_attr_e( 'Price', 'weerts' ); ?>">
                                                    <span class="weerts-cart-label"><?php esc_html_e( 'Price:', 'weerts' ); ?></span>
                                                    <?php echo wp_kses_post( $product_price ); ?>
                                                </div>

                                                <!-- Quantity -->
                                                <div class="weerts-cart-col weerts-cart-col-quantity" data-title="<?php esc_attr_e( 'Quantity', 'weerts' ); ?>">
                                                    <span class="weerts-cart-label"><?php esc_html_e( 'Qty:', 'weerts' ); ?></span>
                                                    <?php
                                                    if ( $_product->is_sold_individually() ) {
                                                        $product_quantity = sprintf( '1 <input type="hidden" name="cart[%s][qty]" value="1" />', $cart_item_key );
                                                    } else {
                                                        $product_quantity = woocommerce_quantity_input(
                                                            array(
                                                                'input_name'   => "cart[{$cart_item_key}][qty]",
                                                                'input_value'  => $cart_item['quantity'],
                                                                'max_value'    => $_product->get_max_purchase_quantity(),
                                                                'min_value'    => '0',
                                                                'product_name' => $_product->get_name(),
                                                                'classes'      => ['input-text', 'qty', 'text', 'weerts-qty-input'],
                                                            ),
                                                            $_product,
                                                            false
                                                        );
                                                    }
                                                    echo apply_filters( 'woocommerce_cart_item_quantity', $product_quantity, $cart_item_key, $cart_item );
                                                    ?>
                                                </div>

                                                <!-- Subtotal -->
                                                <div class="weerts-cart-col weerts-cart-col-subtotal" data-title="<?php esc_attr_e( 'Subtotal', 'weerts' ); ?>">
                                                    <span class="weerts-cart-label"><?php esc_html_e( 'Subtotal:', 'weerts' ); ?></span>
                                                    <?php echo wp_kses_post( $product_subtotal ); ?>
                                                </div>

                                                <!-- Remove Button -->
                                                <div class="weerts-cart-col weerts-cart-col-remove">
                                                    <?php
                                                    echo apply_filters(
                                                        'woocommerce_cart_item_remove_link',
                                                        sprintf(
                                                            '<a href="%s" class="weerts-cart-remove" aria-label="%s" data-product_id="%s" data-product_sku="%s"><span class="weerts-cart-remove-icon">&times;</span><span class="weerts-cart-remove-text">%s</span></a>',
                                                            esc_url( wc_get_cart_remove_url( $cart_item_key ) ),
                                                            esc_attr( sprintf( __( 'Remove %s from cart', 'weerts' ), wp_strip_all_tags( $product_name ) ) ),
                                                            esc_attr( $product_id ),
                                                            esc_attr( $_product->get_sku() ),
                                                            esc_html__( 'Remove', 'weerts' )
                                                        ),
                                                        $cart_item_key
                                                    );
                                                    ?>
                                                </div>
                                            </div>
                                        <?php endif; ?>
                                    <?php endforeach; ?>
                                </div>
                            </div>

                            <?php do_action( 'woocommerce_before_cart_collaterals' ); ?>

                            <!-- Cart Actions -->
                            <div class="weerts-cart-actions">
                                <div class="weerts-cart-coupon">
                                    <?php if ( wc_coupons_enabled() ) : ?>
                                        <div class="weerts-coupon-form">
                                            <label for="coupon_code" class="weerts-coupon-label"><?php esc_html_e( 'Have a coupon?', 'weerts' ); ?></label>
                                            <div class="weerts-coupon-input-group">
                                                <input type="text" name="coupon_code" class="input-text weerts-coupon-input" id="coupon_code" value="" placeholder="<?php esc_attr_e( 'Enter coupon code', 'weerts' ); ?>" />
                                                <button type="submit" class="button weerts-coupon-btn" name="apply_coupon" value="<?php esc_attr_e( 'Apply', 'weerts' ); ?>"><?php esc_html_e( 'Apply', 'weerts' ); ?></button>
                                            </div>
                                        </div>
                                    <?php endif; ?>
                                </div>
                                
                                <div class="weerts-cart-update">
                                    <button type="submit" class="button weerts-btn weerts-btn--outline" name="update_cart" value="<?php esc_attr_e( 'Update Cart', 'weerts' ); ?>"><?php esc_html_e( 'Update Cart', 'weerts' ); ?></button>
                                </div>
                            </div>

                            <?php do_action( 'woocommerce_cart_actions' ); ?>
                            <?php wp_nonce_field( 'woocommerce-cart', 'woocommerce-cart-nonce' ); ?>
                            
                            <?php do_action( 'woocommerce_after_cart_table' ); ?>
                        </form>
                    </div>

                    <!-- Cart Sidebar / Collaterals -->
                    <div class="weerts-cart-sidebar">
                        <div class="weerts-cart-collaterals">
                            <?php do_action( 'woocommerce_cart_collaterals' ); ?>
                            

                        </div>
                    </div>
                </div>
            <?php endif; ?>
        </div>
    </div>

    <!-- Cart Cross-sells -->
    <?php do_action( 'woocommerce_after_cart' ); ?>
</div>
