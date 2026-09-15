<?php
/**
 * Login. Registration happens at checkout, so the second column explains that instead of a form,
 * unless registration is switched on in WooCommerce settings.
 *
 * @version 9.9.0
 */

defined('ABSPATH') || exit;

do_action('woocommerce_before_customer_login_form');
$registration = 'yes' === get_option('woocommerce_enable_myaccount_registration');
?>
<div class="rural-login" id="customer_login">
	<section class="rural-account__card rural-login__card" aria-labelledby="rural-login-title">
		<h2 id="rural-login-title" class="rural-account__title">Log in</h2>
		<p class="rural-account__muted">See your orders, save addresses and check out faster.</p>

		<form class="woocommerce-form woocommerce-form-login login rural-account__form" method="post" novalidate>
			<?php do_action('woocommerce_login_form_start'); ?>
			<p class="woocommerce-form-row form-row">
				<label for="username">Email address</label>
				<input type="text" class="woocommerce-Input woocommerce-Input--text input-text" name="username" id="username" autocomplete="username" inputmode="email" value="<?php echo (!empty($_POST['username']) && is_string($_POST['username'])) ? esc_attr(wp_unslash($_POST['username'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing ?>" required aria-required="true" />
			</p>
			<p class="woocommerce-form-row form-row">
				<label for="password">Password</label>
				<input class="woocommerce-Input woocommerce-Input--text input-text" type="password" name="password" id="password" autocomplete="current-password" required aria-required="true" />
			</p>
			<?php do_action('woocommerce_login_form'); ?>
			<div class="rural-login__row">
				<label class="rural-login__remember woocommerce-form__label woocommerce-form__label-for-checkbox woocommerce-form-login__rememberme">
					<input class="woocommerce-form__input woocommerce-form__input-checkbox" name="rememberme" type="checkbox" id="rememberme" value="forever" /> <span>Keep me logged in</span>
				</label>
				<a class="rural-account__link" href="<?php echo esc_url(wp_lostpassword_url()); ?>">Forgot your password?</a>
			</div>
			<div class="rural-account__form-actions">
				<?php wp_nonce_field('woocommerce-login', 'woocommerce-login-nonce'); ?>
				<button type="submit" class="rural-button rural-button--submit woocommerce-form-login__submit" name="login" value="Log in"><span><svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1 6h9.5M6.5 2l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></span><span>Log in</span></button>
			</div>
			<?php do_action('woocommerce_login_form_end'); ?>
		</form>
	</section>

	<?php if ($registration) : ?>
		<section class="rural-account__card rural-login__card" aria-labelledby="rural-register-title">
			<h2 id="rural-register-title" class="rural-account__title">Create an account</h2>
			<form method="post" class="woocommerce-form woocommerce-form-register register rural-account__form" <?php do_action('woocommerce_register_form_tag'); ?>>
				<?php do_action('woocommerce_register_form_start'); ?>
				<?php if ('no' === get_option('woocommerce_registration_generate_username')) : ?>
					<p class="woocommerce-form-row form-row">
						<label for="reg_username">Username</label>
						<input type="text" class="woocommerce-Input woocommerce-Input--text input-text" name="username" id="reg_username" autocomplete="username" value="<?php echo (!empty($_POST['username'])) ? esc_attr(wp_unslash($_POST['username'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing ?>" required aria-required="true" />
					</p>
				<?php endif; ?>
				<p class="woocommerce-form-row form-row">
					<label for="reg_email">Email address</label>
					<input type="email" class="woocommerce-Input woocommerce-Input--text input-text" name="email" id="reg_email" autocomplete="email" value="<?php echo (!empty($_POST['email'])) ? esc_attr(wp_unslash($_POST['email'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing ?>" required aria-required="true" />
				</p>
				<?php if ('no' === get_option('woocommerce_registration_generate_password')) : ?>
					<p class="woocommerce-form-row form-row">
						<label for="reg_password">Password</label>
						<input type="password" class="woocommerce-Input woocommerce-Input--text input-text" name="password" id="reg_password" autocomplete="new-password" required aria-required="true" />
					</p>
				<?php else : ?>
					<p class="rural-account__muted">We will email you a link to set your password.</p>
				<?php endif; ?>
				<?php do_action('woocommerce_register_form'); ?>
				<div class="rural-account__form-actions">
					<?php wp_nonce_field('woocommerce-register', 'woocommerce-register-nonce'); ?>
					<button type="submit" class="rural-button rural-button--submit woocommerce-form-register__submit" name="register" value="Register"><span><svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1 6h9.5M6.5 2l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></span><span>Create account</span></button>
				</div>
				<?php do_action('woocommerce_register_form_end'); ?>
			</form>
		</section>
	<?php else : ?>
		<section class="rural-account__card rural-login__card rural-login__card--new" aria-labelledby="rural-new-title">
			<h2 id="rural-new-title" class="rural-account__title">New here?</h2>
			<p>Your account is created automatically the first time you check out. There is nothing to set up in advance.</p>
			<ul class="rural-login__benefits">
				<li>Track every order and its status</li>
				<li>Saved delivery and billing addresses</li>
				<li>Faster checkout next time</li>
			</ul>
			<?php echo weerts_account_button('Browse products', wc_get_page_permalink('shop')); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			<p class="rural-account__muted rural-login__help">Ordered before but never logged in? Use <a class="rural-account__link" href="<?php echo esc_url(wp_lostpassword_url()); ?>">forgot your password</a> with the email on your order.</p>
		</section>
	<?php endif; ?>
</div>

<?php do_action('woocommerce_after_customer_login_form'); ?>
