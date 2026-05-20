import { gsap } from 'gsap'

let animationCleanup = null

export default function initFooterMenuAnimation() {
	const containers = document.querySelectorAll('.footer-menu-container')

	// Early return if no containers found
	if (!containers.length) {
		return
	}

	const selectors = document.querySelectorAll('.footer-menu-selector')

	// Handle link hover
	function handleLinkHover(link, selector) {
		const linkRect = link.getBoundingClientRect()
		const containerRect = link
			.closest('.footer-menu-container')
			.getBoundingClientRect()

		// Calculate relative position within the container
		const relativeTop = linkRect.top - containerRect.top
		const linkHeight = linkRect.height

		// Center the selector on the link
		const targetY = relativeTop + linkHeight / 2 - 6 // 6px is half of selector height (h-3 = 12px)

		// Kill any existing animations on the selector
		gsap.killTweensOf(selector)

		gsap.to(selector, {
			opacity: 1,
			y: targetY,
			duration: 0.3,
			ease: 'power2.out',
		})
	}

	// Handle container leave
	function handleContainerLeave(selector) {
		// Kill any existing animations on the selector
		gsap.killTweensOf(selector)

		gsap.to(selector, {
			opacity: 0,
			duration: 0.2,
			ease: 'power2.out',
		})
	}

	// Setup event listeners for each container
	containers.forEach((container, index) => {
		const selector = selectors[index]
		const links = container.querySelectorAll('a')

		// Early return if no links found
		if (!links.length) return

		// Set initial state
		gsap.set(selector, {
			opacity: 0,
			y: 0,
		})

		// Add hover listeners to each link
		links.forEach((link) => {
			link.addEventListener('mouseenter', () => handleLinkHover(link, selector))
		})

		// Hide selector when leaving the entire container
		container.addEventListener('mouseleave', () =>
			handleContainerLeave(selector)
		)
	})

	// Return cleanup function to kill the animation
	animationCleanup = function killFooterMenuAnimation() {
		containers.forEach((container, index) => {
			const selector = selectors[index]
			const links = container.querySelectorAll('a')

			// Remove event listeners
			links.forEach((link) => {
				link.removeEventListener('mouseenter', () =>
					handleLinkHover(link, selector)
				)
			})

			container.removeEventListener('mouseleave', () =>
				handleContainerLeave(selector)
			)

			// Kill any running animations and reset selector
			gsap.killTweensOf(selector)
			gsap.set(selector, { opacity: 0, y: 0 })
		})

		animationCleanup = null
	}

	return animationCleanup
}

export function killFooterMenuAnimation() {
	if (animationCleanup) {
		animationCleanup()
	}
}
