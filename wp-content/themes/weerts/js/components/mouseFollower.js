import gsap from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'

// Register the plugin
gsap.registerPlugin(ScrambleTextPlugin)

// Global mouse position tracker
let lastMousePosition = { x: null, y: null }

// External function that can be called from anywhere
export function forceMouseUpdate() {
	const mouseEl = document.querySelector('.mouse-follower')

	if (
		!mouseEl ||
		lastMousePosition.x === null ||
		lastMousePosition.y === null
	) {
		return false // No mouse follower found or no mouse position tracked
	}

	// Find element at current mouse position
	const elementBelow = document.elementFromPoint(
		lastMousePosition.x,
		lastMousePosition.y
	)

	if (!elementBelow) return false

	// Find the closest element with data-mouse-content
	const target = elementBelow.closest('[data-mouse-content]')

	if (target) {
		// Force a mouseout first to reset the state, then mouseover to refresh
		const mouseOutEvent = new MouseEvent('mouseout', {
			bubbles: true,
			cancelable: true,
			view: window,
			clientX: lastMousePosition.x,
			clientY: lastMousePosition.y,
			relatedTarget: document.body,
		})

		Object.defineProperty(mouseOutEvent, 'target', {
			value: target,
			enumerable: true,
		})

		// Dispatch mouseout to clear current state
		target.dispatchEvent(mouseOutEvent)

		// Small delay to ensure mouseout is processed
		setTimeout(() => {
			// Create a synthetic mouseover event
			const mouseOverEvent = new MouseEvent('mouseover', {
				bubbles: true,
				cancelable: true,
				view: window,
				clientX: lastMousePosition.x,
				clientY: lastMousePosition.y,
			})

			// Set the target property
			Object.defineProperty(mouseOverEvent, 'target', {
				value: target,
				enumerable: true,
			})

			// Dispatch the event to trigger the existing mouseover logic
			target.dispatchEvent(mouseOverEvent)
		}, 10)

		return true
	}

	return false // No hoverable element found
}

// Alternative version that uses the mouse follower's animated position
export function forceMouseUpdateFromFollower() {
	const mouseEl = document.querySelector('.mouse-follower')

	if (!mouseEl) {
		return false // No mouse follower found
	}

	// Get current animated position from GSAP
	const currentX = gsap.getProperty(mouseEl, 'x') || 0
	const currentY = gsap.getProperty(mouseEl, 'y') || 0

	// Find element at follower position
	const elementBelow = document.elementFromPoint(currentX, currentY)

	if (!elementBelow) return false

	const target = elementBelow.closest('[data-mouse-content]')

	if (target) {
		// Force a mouseout first to reset the state, then mouseover to refresh
		const mouseOutEvent = new MouseEvent('mouseout', {
			bubbles: true,
			cancelable: true,
			view: window,
			clientX: currentX,
			clientY: currentY,
			relatedTarget: document.body,
		})

		Object.defineProperty(mouseOutEvent, 'target', {
			value: target,
			enumerable: true,
		})

		target.dispatchEvent(mouseOutEvent)

		// Small delay to ensure mouseout is processed
		setTimeout(() => {
			const mouseOverEvent = new MouseEvent('mouseover', {
				bubbles: true,
				cancelable: true,
				view: window,
				clientX: currentX,
				clientY: currentY,
			})

			Object.defineProperty(mouseOverEvent, 'target', {
				value: target,
				enumerable: true,
			})

			target.dispatchEvent(mouseOverEvent)
		}, 10)

		return true
	}

	return false
}

// Force hide any current content (useful for clearing state)
export function forceMouseHide() {
	const mouseEl = document.querySelector('.mouse-follower')

	if (!mouseEl) return false

	// Find any currently hovered element and trigger mouseout
	const currentTarget = document.querySelector('[data-mouse-content]:hover')

	if (currentTarget) {
		const syntheticEvent = new MouseEvent('mouseout', {
			bubbles: true,
			cancelable: true,
			view: window,
			clientX: lastMousePosition.x || 0,
			clientY: lastMousePosition.y || 0,
			relatedTarget: document.body, // Simulate moving to body
		})

		Object.defineProperty(syntheticEvent, 'target', {
			value: currentTarget,
			enumerable: true,
		})

		currentTarget.dispatchEvent(syntheticEvent)
		return true
	}

	return false
}

export default function mouseFollower() {
	const el = createMouseElement()
	mouseActiveState(el)
	handleMouseMove(el)
	const { revert: revertHoverContent, killAnimations } = handleHoverContent(el)

	// Return the revert function for external use
	return {
		revert: () => revertMouseState(el, revertHoverContent, killAnimations),
	}
}

function createMouseElement() {
	const el = document.createElement('div')
	el.classList.add('mouse-follower')
	// Add content container - initially hidden
	const contentEl = document.createElement('div')
	contentEl.classList.add('mouse-content')
	// Start with display: none to remove from DOM flow
	contentEl.style.display = 'none'
	el.appendChild(contentEl)
	document.body.appendChild(el)
	return el
}

function handleMouseMove(el) {
	const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' })
	const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' })

	window.addEventListener('mousemove', (e) => {
		// Update global mouse position tracker
		lastMousePosition.x = e.clientX
		lastMousePosition.y = e.clientY

		xTo(e.clientX)
		yTo(e.clientY)
	})

	// Return the quickTo functions so they can be preserved
	return { xTo, yTo }
}

function mouseActiveState(el) {
	const activeTl = gsap
		.timeline({
			paused: true,
			defaults: {
				duration: 0.2,
				ease: 'power2.inOut',
			},
		})
		.to(el, { scale: 0.75 })

	window.addEventListener('click', () => {
		activeTl.play().then(() => activeTl.reverse())
	})

	return activeTl
}

function handleHoverContent(el) {
	const contentEl = el.querySelector('.mouse-content')
	let currentTarget = null
	let currentContent = null // Track current content
	let hideTimeout = null
	let animationTl = null
	let isAnimating = false

	// Helper function to safely kill current animation
	const killCurrentAnimation = () => {
		if (animationTl) {
			animationTl.kill()
			animationTl = null
		}
		isAnimating = false
	}

	// Helper function to smoothly transition to new content
	const transitionToNewContent = (newTarget, newContent) => {
		const reversedContent = newContent.split('').reverse().join('')

		// Set new content and measure width
		contentEl.textContent = reversedContent
		contentEl.style.display = 'block'

		// Ensure opacity is at 1 for content transitions
		gsap.set(contentEl, { opacity: 1 })

		const contentWidth = contentEl.scrollWidth
		const totalWidth = 18 + 16 + contentWidth

		currentTarget = newTarget
		currentContent = newContent // Update current content
		isAnimating = true

		// Smooth transition: resize and scramble to new content
		animationTl = gsap
			.timeline({
				onComplete: () => {
					isAnimating = false
					// Ensure final state is correct
					gsap.set(contentEl, { opacity: 1 })
				},
				onInterrupt: () => {
					isAnimating = false
					// Ensure opacity is correct even if interrupted
					gsap.set(contentEl, { opacity: 1 })
				},
			})
			.to(el, {
				width: totalWidth,
				duration: 0.2,
				ease: 'power2.out',
				overwrite: 'auto',
			})
			.to(
				contentEl,
				{
					scrambleText: {
						text: newContent,
						chars: 'eatbcdf190$*()+=/il1|!.,;:-',
						revealDelay: 0.05,
						tweenLength: false,
					},
					opacity: 1, // Explicitly ensure opacity reaches 1
					duration: 0.3,
					ease: 'power2.out',
				},
				'-=0.1'
			)
	}

	document.addEventListener(
		'mouseover',
		(e) => {
			const target = e.target.closest('[data-mouse-content]')

			if (target) {
				const content = target.getAttribute('data-mouse-content')

				// Check if it's a different target OR the same target with different content
				if (target !== currentTarget || content !== currentContent) {
					// Clear any pending hide timeout
					if (hideTimeout) {
						clearTimeout(hideTimeout)
						hideTimeout = null
					}

					// Kill any current animation smoothly
					killCurrentAnimation()

					if (
						el.classList.contains('has-content') &&
						target === currentTarget
					) {
						// Same target but different content - just update the content
						currentContent = content
						isAnimating = true

						// Get current width and calculate new width
						const reversedContent = content.split('').reverse().join('')
						contentEl.textContent = reversedContent
						const contentWidth = contentEl.scrollWidth
						const totalWidth = 18 + 16 + contentWidth

						animationTl = gsap
							.timeline({
								onComplete: () => {
									isAnimating = false
									gsap.set(contentEl, { opacity: 1 })
								},
								onInterrupt: () => {
									isAnimating = false
									gsap.set(contentEl, { opacity: 1 })
								},
							})
							.to(el, {
								width: totalWidth,
								duration: 0.2,
								ease: 'power2.out',
								overwrite: 'auto',
							})
							.to(
								contentEl,
								{
									scrambleText: {
										text: content,
										chars: 'eatbcdf190$*()+=/il1|!.,;:-',
										revealDelay: 0.05,
										tweenLength: false,
									},
									opacity: 1,
									duration: 0.3,
									ease: 'power2.out',
								},
								'-=0.1'
							)
					} else if (el.classList.contains('has-content')) {
						// Already expanded - smooth transition to new content
						// Ensure content is visible before transitioning
						gsap.set(contentEl, { opacity: 1, display: 'block' })
						transitionToNewContent(target, content)
					} else {
						// First time expanding
						const reversedContent = content.split('').reverse().join('')

						el.classList.add('has-content')
						currentTarget = target
						currentContent = content // Set current content
						isAnimating = true

						// Set content and measure width
						contentEl.textContent = reversedContent
						contentEl.style.display = 'block'

						const contentWidth = contentEl.scrollWidth
						const totalWidth = 18 + 16 + contentWidth

						// Set initial scrambled state
						gsap.set(contentEl, {
							opacity: 0, // Start from 0 for first expansion
							scrambleText: {
								text: reversedContent,
								chars: 'eatbcdf190$*()+=/il1|!.,;:-',
							},
						})

						animationTl = gsap
							.timeline({
								onComplete: () => {
									isAnimating = false
									// Ensure final opacity is correct
									gsap.set(contentEl, { opacity: 1 })
								},
								onInterrupt: () => {
									isAnimating = false
									// If interrupted while expanding, ensure content is visible
									if (el.classList.contains('has-content')) {
										gsap.set(contentEl, { opacity: 1, display: 'block' })
									}
								},
							})
							.to(el, {
								width: totalWidth,
								duration: 0.3,
								ease: 'power2.out',
								overwrite: 'auto',
							})
							.to(
								contentEl,
								{ opacity: 1, duration: 0.2, ease: 'power2.out' },
								'-=0.1'
							)
							.to(
								contentEl,
								{
									scrambleText: {
										text: content,
										chars: 'eatbcdf190$*()+=/il1|!.,;:-',
										revealDelay: 0.1,
										tweenLength: false,
									},
									opacity: 1, // Explicitly ensure opacity stays at 1
									duration: 0.5,
									ease: 'power2.out',
								},
								'-=0.1'
							)
					}
				}
			}
		},
		{ passive: true }
	) // Add passive flag for better scroll performance

	document.addEventListener(
		'mouseout',
		(e) => {
			const target = e.target.closest('[data-mouse-content]')

			// Check if target exists, matches current target, and handle relatedTarget safely
			if (
				target &&
				target === currentTarget &&
				(!e.relatedTarget || !target.contains(e.relatedTarget))
			) {
				hideTimeout = setTimeout(() => {
					if (currentTarget === target) {
						const currentText = contentEl.textContent

						// Clear current target and content first
						currentTarget = null
						currentContent = null

						killCurrentAnimation()
						isAnimating = true

						// Animate back to circle with scramble out effect
						animationTl = gsap
							.timeline({
								onComplete: () => {
									isAnimating = false
									// Ensure clean final state
									gsap.set(contentEl, { opacity: 0, display: 'none' })
								},
								onInterrupt: () => {
									isAnimating = false
									// If interrupted during hide, force clean state
									gsap.set(contentEl, { opacity: 0, display: 'none' })
									contentEl.textContent = ''
									el.classList.remove('has-content')
								},
							})
							.to(contentEl, {
								scrambleText: {
									text: currentText.replace(/./g, ' '),
									chars: 'eatbcdf190$*()+=/il1|!.,;:-',
									revealDelay: 0.05,
									tweenLength: false,
								},
								duration: 0.3,
								ease: 'power2.in',
							})
							.to(
								contentEl,
								{ opacity: 0, duration: 0.15, ease: 'power2.in' },
								'-=0.1'
							)
							.to(
								el,
								{
									width: 18,
									duration: 0.25,
									ease: 'power2.inOut',
									overwrite: 'auto',
									onComplete: () => {
										contentEl.style.display = 'none'
										contentEl.textContent = ''
										el.classList.remove('has-content')
									},
								},
								'-=0.2'
							)
					}
				}, 50)
			}
		},
		{ passive: true }
	)

	// Return cleanup functions
	return {
		revert: () => {
			currentTarget = null
			currentContent = null
			killCurrentAnimation()
			if (hideTimeout) {
				clearTimeout(hideTimeout)
				hideTimeout = null
			}
		},
		killAnimations: () => {
			killCurrentAnimation()
		},
	}
}

export function revertMouseState(
	el = null,
	revertHoverContent = null,
	killAnimations = null
) {
	if (!el) {
		el = document.querySelector('.mouse-follower')
	}

	if (!el) return
	const contentEl = el.querySelector('.mouse-content')

	// Clean up hover content state first
	if (revertHoverContent) revertHoverContent()
	if (killAnimations) killAnimations()

	// Kill all tweens related to the mouse follower
	gsap.killTweensOf(contentEl)

	// Force immediate reset to clean state
	gsap.set(el, {
		width: 18,
		scale: 1,
		clearProps: 'width,scale', // Clear inline styles
	})
	gsap.set(contentEl, {
		opacity: 0,
		display: 'none',
		clearProps: 'opacity',
	})

	// Reset content and classes
	contentEl.textContent = ''
	el.classList.remove('has-content')
}
