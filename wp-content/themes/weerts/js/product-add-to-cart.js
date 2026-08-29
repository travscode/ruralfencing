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
	const debugServerUrl = 'http://127.0.0.1:7777/event'
	const debugSessionId = 'product-cart-error'

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

		// #region debug-point A:submit-start
		fetch(debugServerUrl, {
			method: 'POST',
			body: JSON.stringify({
				sessionId: debugSessionId,
				runId: 'pre-fix',
				hypothesisId: 'A',
				location: 'product-add-to-cart.js:40',
				msg: '[DEBUG] add to cart submit started',
				data: {
					productId,
					quantity: formData.get('quantity') || 1,
					variationId: formData.get('variation_id') || 0,
					requestUrl,
					hasNonce: Boolean(cartData.addToCartNonce),
					attributes: Array.from(formData.entries()).filter(([key]) =>
						key.startsWith('attribute_')
					),
				},
				ts: Date.now(),
			}),
		}).catch(() => {})
		// #endregion

		if (!productId) {
			// #region debug-point B:missing-product-id
			fetch(debugServerUrl, {
				method: 'POST',
				body: JSON.stringify({
					sessionId: debugSessionId,
					runId: 'pre-fix',
					hypothesisId: 'B',
					location: 'product-add-to-cart.js:46',
					msg: '[DEBUG] product id missing before request',
					data: { formEntries: Array.from(formData.entries()) },
					ts: Date.now(),
				}),
			}).catch(() => {})
			// #endregion
			showNotification('Error: Product ID not found', 'error')
			return
		}

		// Update button state to "Adding to cart..."
		setButtonState(button, textSpan, 'adding', originalText)
		button.disabled = true

		// Prepare AJAX data for WooCommerce's add_to_cart endpoint
		const ajaxData = new URLSearchParams()
		ajaxData.append('product_id', productId)
		ajaxData.append('variation_id', formData.get('variation_id') || 0)
		ajaxData.append('quantity', formData.get('quantity') || 1)
		ajaxData.append('security', cartData.addToCartNonce || '')

		// Add variation attributes if present
		for (const [key, value] of formData.entries()) {
			if (key.startsWith('attribute_')) {
				ajaxData.append(key, value)
			}
		}

		// Make AJAX request to WooCommerce's endpoint
		// #region debug-point C:request-dispatch
		fetch(debugServerUrl, {
			method: 'POST',
			body: JSON.stringify({
				sessionId: debugSessionId,
				runId: 'pre-fix',
				hypothesisId: 'C',
				location: 'product-add-to-cart.js:67',
				msg: '[DEBUG] dispatching add to cart request',
				data: { requestUrl, payload: Object.fromEntries(ajaxData.entries()) },
				ts: Date.now(),
			}),
		}).catch(() => {})
		// #endregion
		fetch(requestUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: ajaxData,
		})
			.then((response) => {
				// #region debug-point D:response-meta
				fetch(debugServerUrl, {
					method: 'POST',
					body: JSON.stringify({
						sessionId: debugSessionId,
						runId: 'pre-fix',
						hypothesisId: 'D',
						location: 'product-add-to-cart.js:77',
						msg: '[DEBUG] add to cart response received',
						data: {
							ok: response.ok,
							status: response.status,
							statusText: response.statusText,
							redirected: response.redirected,
							responseUrl: response.url,
							contentType: response.headers.get('content-type') || '',
						},
						ts: Date.now(),
					}),
				}).catch(() => {})
				response
					.clone()
					.text()
					.then((rawText) =>
						fetch(debugServerUrl, {
							method: 'POST',
							body: JSON.stringify({
								sessionId: debugSessionId,
								runId: 'pre-fix',
								hypothesisId: 'D',
								location: 'product-add-to-cart.js:78',
								msg: '[DEBUG] add to cart raw response body',
								data: { bodyPreview: rawText.slice(0, 800) },
								ts: Date.now(),
							}),
						}).catch(() => {})
					)
					.catch(() => {})
				// #endregion
				return response.json()
			})
			.then((data) => {
				// #region debug-point E:parsed-payload
				fetch(debugServerUrl, {
					method: 'POST',
					body: JSON.stringify({
						sessionId: debugSessionId,
						runId: 'pre-fix',
						hypothesisId: 'E',
						location: 'product-add-to-cart.js:84',
						msg: '[DEBUG] parsed add to cart payload',
						data: {
							success: Boolean(data?.success),
							message: data?.message || '',
							hasFragments: Boolean(data?.fragments),
							keys: data && typeof data === 'object' ? Object.keys(data) : [],
						},
						ts: Date.now(),
					}),
				}).catch(() => {})
				// #endregion
				if (data.success) {
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
				// #region debug-point E:request-catch
				fetch(debugServerUrl, {
					method: 'POST',
					body: JSON.stringify({
						sessionId: debugSessionId,
						runId: 'pre-fix',
						hypothesisId: 'E',
						location: 'product-add-to-cart.js:108',
						msg: '[DEBUG] add to cart request threw',
						data: {
							name: error?.name || '',
							message: error?.message || String(error),
						},
						ts: Date.now(),
					}),
				}).catch(() => {})
				// #endregion
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
