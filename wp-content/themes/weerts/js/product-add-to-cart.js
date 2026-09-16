/**
 * Product Add to Cart functionality with AJAX and button state management
 */

;(function () {
	'use strict'

	// Store cart data
	const cartData = window.weertsCartData || {
		wcAjaxUrl: '/wp-admin/admin-ajax.php',
		cartUrl: '/cart',
	}
	/**
	 * Initialize add to cart functionality
	 */
	function initAddToCart() {
		// Find all add to cart forms
		const forms = document.querySelectorAll('form.cart')

		forms.forEach((form) => {
			const button = form.querySelector('.single_add_to_cart_button')
			if (!button) return

			// Store original button text
			const textSpan = button.querySelector('span:last-child')
			const originalText = textSpan ? textSpan.textContent : 'Add to Cart'
			button.dataset.originalText = originalText

			// Handle form submission
			form.addEventListener('submit', function (e) {
				e.preventDefault()
				handleAddToCart(form, button, textSpan, originalText)
			})
		})
	}

	/**
	 * Handle the add to cart AJAX request
	 */
	function handleAddToCart(form, button, textSpan, originalText) {
		// Get form data
		const formData = new FormData(form)
		const productId = formData.get('add-to-cart') || formData.get('product_id')
		const requestUrl = cartData.wcAjaxUrl.replace('%%endpoint%%', 'add_to_cart')

		if (!productId) {
			showNotification('Error: Product ID not found', 'error')
			return
		}

		// Variable product with nothing resolved yet: ask for an option instead of posting a bad request.
		if (form.classList.contains('variations_form') && !Number(formData.get('variation_id') || 0)) {
			showNotification('Please choose an option first', 'error')
			return
		}

		// Update button state to "Adding to cart..."
		setButtonState(button, textSpan, 'adding', originalText)
		button.disabled = true

		// Prepare AJAX data for WooCommerce's add_to_cart endpoint.
		// Woo's wc-ajax=add_to_cart resolves the variation from product_id, so send the variation's own id.
		const variationId = Number(formData.get('variation_id') || 0)
		const ajaxData = new URLSearchParams()
		ajaxData.append('product_id', variationId > 0 ? variationId : productId)
		ajaxData.append('variation_id', variationId)
		ajaxData.append('quantity', formData.get('quantity') || 1)
		ajaxData.append('security', cartData.addToCartNonce || '')

		// Add variation attributes if present
		for (const [key, value] of formData.entries()) {
			if (key.startsWith('attribute_')) {
				ajaxData.append(key, value)
			}
		}

		fetch(requestUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: ajaxData,
		})
			.then((response) => {
				return response.json()
			})
			.then((data) => {
				const isSuccessfulAddToCart =
					Boolean(data?.success) ||
					(Boolean(data) &&
						!Boolean(data?.error) &&
						(Boolean(data?.fragments) || Boolean(data?.cart_hash)))
				if (isSuccessfulAddToCart) {
					// Show "Item added!" state
					setButtonState(button, textSpan, 'added', originalText)
					showNotification('Item added to cart!', 'success')

					// Update cart fragments if available
					if (data.fragments) {
						updateCartFragments(data.fragments)
					}

					// After 500ms, change to "Go to cart"
					setTimeout(() => {
						setButtonState(button, textSpan, 'goToCart', originalText)
						button.disabled = false
						// Change click behavior to go to cart
						button.onclick = function (e) {
							e.preventDefault()
							window.location.href = cartData.cartUrl
						}
					}, 500)
				} else {
					// Show error
					setButtonState(button, textSpan, 'error', originalText)
					showNotification(data.message || 'Error adding to cart', 'error')
					button.disabled = false
				}
			})
			.catch((error) => {
				console.error('Add to cart error:', error)
				setButtonState(button, textSpan, 'error', originalText)
				showNotification('Network error. Please try again.', 'error')
				button.disabled = false
			})
	}

	/**
	 * Update button visual state
	 */
	function setButtonState(button, textSpan, state, originalText) {
		if (!textSpan) return

		switch (state) {
			case 'adding':
				textSpan.textContent = 'Adding to cart...'
				button.classList.add('opacity-75')
				break
			case 'added':
				textSpan.textContent = 'Item added!'
				button.classList.remove('opacity-75')
				button.classList.add('bg-green-50')
				break
			case 'goToCart':
				textSpan.textContent = 'Go to cart'
				button.classList.remove('bg-green-50')
				button.classList.add('cursor-pointer')
				break
			case 'error':
				textSpan.textContent = originalText
				button.classList.remove('opacity-75')
				break
		}
	}

	/**
	 * Update cart fragments (mini cart, etc.)
	 */
	function updateCartFragments(fragments) {
		if (!fragments) return
		Object.keys(fragments).forEach((selector) => {
			const elements = document.querySelectorAll(selector)
			elements.forEach((el) => {
				el.innerHTML = fragments[selector]
			})
		})
	}

	/**
	 * Show notification toast
	 */
	function showNotification(message, type = 'info') {
		// Create notification container if it doesn't exist
		let container = document.getElementById('weerts-cart-notifications')
		if (!container) {
			container = document.createElement('div')
			container.id = 'weerts-cart-notifications'
			container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2'
			document.body.appendChild(container)
		}

		const notification = document.createElement('div')
		notification.className = `transform transition-all duration-300 translate-x-full opacity-0 px-6 py-3 rounded-lg shadow-lg text-white ${
			type === 'success'
				? 'bg-deep-green'
				: type === 'error'
				? 'bg-terracotta-clay'
				: 'bg-birch'
		}`
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

	// Initialize when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initAddToCart)
	} else {
		initAddToCart()
	}
})()
