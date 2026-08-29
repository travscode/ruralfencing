/**
 * Custom Cart JavaScript for Rural Fencing Theme
 * Enhances cart functionality with AJAX updates and improved UX
 */

(function () {
	'use strict'

	// Store cart data from localized script
	const cartData = window.weertsCartData || {}

	/**
	 * Initialize cart functionality when DOM is ready
	 */
	function initCart() {
		initQuantityUpdates()
		initRemoveButtons()
		initCouponForm()
		initUpdateCartButton()
		initShippingCalculator()
		initCartNotifications()
	}

	/**
	 * Handle quantity input changes with debounced updates
	 */
	function initQuantityUpdates() {
		const quantityInputs = document.querySelectorAll('.weerts-qty-input')

		quantityInputs.forEach((input) => {
			// Store initial value to detect changes
			input.dataset.initialValue = input.value

			// Handle change event
			input.addEventListener('change', function () {
				const newValue = parseInt(this.value, 10)
				const minValue = parseInt(this.min, 10) || 0
				const maxValue = parseInt(this.max, 10) || 9999

				// Validate quantity
				if (isNaN(newValue) || newValue < minValue) {
					this.value = minValue
				} else if (newValue > maxValue) {
					this.value = maxValue
				}

				// Show visual feedback
				showInputFeedback(this, 'updating')

				// Submit the cart form after a short delay
				debouncedUpdateCart()
			})

			// Prevent invalid input
			input.addEventListener('keypress', function (e) {
				// Allow only numbers
				if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
					e.preventDefault()
				}
			})
		})
	}

	/**
	 * Handle remove item buttons with confirmation
	 */
	function initRemoveButtons() {
		const removeButtons = document.querySelectorAll('.weerts-cart-remove')

		removeButtons.forEach((button) => {
			button.addEventListener('click', function (e) {
				e.preventDefault()

				const cartItemKey = this.closest('.weerts-cart-row')?.dataset
					?.cartItemKey
				const productName =
					this.closest('.weerts-cart-row')?.querySelector(
						'.weerts-cart-product-name'
					)?.textContent || 'this item'

				// Show confirmation
				if (
					confirm(
						`Are you sure you want to remove "${productName}" from your cart?`
					)
				) {
					// Show loading state
					showNotification('Removing item...', 'info')

					// Navigate to the remove URL
					window.location.href = this.href
				}
			})
		})
	}

	/**
	 * Handle coupon form submission
	 */
	function initCouponForm() {
		const couponForm = document.querySelector('.weerts-coupon-form')
		const couponInput = document.querySelector('.weerts-coupon-input')
		const couponButton = document.querySelector('.weerts-coupon-btn')

		if (couponForm) {
			couponForm.addEventListener('submit', function (e) {
				const code = couponInput?.value?.trim()

				if (!code) {
					e.preventDefault()
					showInputFeedback(couponInput, 'error')
					couponInput?.focus()
					return
				}

				// Show loading state
				if (couponButton) {
					couponButton.disabled = true
					couponButton.dataset.originalText = couponButton.textContent
					couponButton.textContent = 'Applying...'
				}

				showNotification('Applying coupon...', 'info')
			})
		}

		// Clear error state on input
		if (couponInput) {
			couponInput.addEventListener('input', function () {
				this.classList.remove('border-red-500', 'focus:border-red-500')
			})
		}
	}

	/**
	 * Handle update cart button
	 */
	function initUpdateCartButton() {
		const updateButton = document.querySelector(
			'button[name="update_cart"]'
		)
		const cartForm = document.querySelector('.woocommerce-cart-form')

		if (updateButton && cartForm) {
			updateButton.addEventListener('click', function (e) {
				// Check if any quantities have changed
				const inputs = cartForm.querySelectorAll('.weerts-qty-input')
				let hasChanges = false

				inputs.forEach((input) => {
					if (input.value !== input.dataset.initialValue) {
						hasChanges = true
					}
				})

				if (!hasChanges) {
					e.preventDefault()
					showNotification('No changes to update', 'info')
					return
				}

				// Show loading state
				this.disabled = true
				this.dataset.originalText = this.textContent
				this.textContent = 'Updating...'

				showNotification('Updating cart...', 'info')
			})
		}
	}

	/**
	 * Initialize shipping calculator if present
	 */
	function initShippingCalculator() {
		const calculatorButton = document.querySelector('.shipping-calculator-button')

		if (calculatorButton) {
			calculatorButton.addEventListener('click', function (e) {
				// The form is toggled by WooCommerce, we just add smooth animation
				const form = document.querySelector('.shipping-calculator-form')
				if (form) {
					form.style.transition = 'opacity 0.3s ease, max-height 0.3s ease'
				}
			})
		}
	}

	/**
	 * Initialize cart notifications system
	 */
	function initCartNotifications() {
		// Create notification container if it doesn't exist
		if (!document.getElementById('weerts-cart-notifications')) {
			const container = document.createElement('div')
			container.id = 'weerts-cart-notifications'
			container.className =
				'fixed bottom-4 right-4 z-50 flex flex-col gap-2'
			document.body.appendChild(container)
		}
	}

	/**
	 * Show a notification message
	 */
	function showNotification(message, type = 'info') {
		const container = document.getElementById('weerts-cart-notifications')
		if (!container) return

		const notification = document.createElement('div')
		notification.className = `weerts-cart-notice weerts-cart-notice--${type} transform transition-all duration-300 translate-x-full opacity-0`
		notification.textContent = message

		container.appendChild(notification)

		// Animate in
		requestAnimationFrame(() => {
			notification.classList.remove('translate-x-full', 'opacity-0')
		})

		// Remove after delay
		setTimeout(() => {
			notification.classList.add('translate-x-full', 'opacity-0')
			setTimeout(() => {
				notification.remove()
			}, 300)
		}, 3000)
	}

	/**
	 * Show visual feedback on input fields
	 */
	function showInputFeedback(input, state) {
		if (!input) return

		// Remove existing feedback classes
		input.classList.remove('border-green-500', 'border-red-500', 'focus:border-green-500', 'focus:border-red-500')

		switch (state) {
			case 'updating':
				input.classList.add('opacity-60')
				break
			case 'success':
				input.classList.add('border-green-500', 'focus:border-green-500')
				setTimeout(() => {
					input.classList.remove('border-green-500', 'focus:border-green-500')
				}, 2000)
				break
			case 'error':
				input.classList.add('border-red-500', 'focus:border-red-500')
				input.classList.add('animate-pulse')
				setTimeout(() => {
					input.classList.remove('animate-pulse')
				}, 500)
				break
			default:
				input.classList.remove('opacity-60')
		}
	}

	/**
	 * Debounced cart update function
	 */
	let updateTimeout = null
	function debouncedUpdateCart() {
		if (updateTimeout) {
			clearTimeout(updateTimeout)
		}
		updateTimeout = setTimeout(() => {
			const updateButton = document.querySelector('button[name="update_cart"]')
			if (updateButton) {
				updateButton.click()
			}
		}, 500)
	}

	// Initialize cart when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initCart)
	} else {
		initCart()
	}
})()
