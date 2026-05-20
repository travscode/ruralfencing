let activeContainer = null
let activeHandlers = null

export default function setupDotHighlighting(radius = 150) {
	const container = document.querySelector('.highlight-dots')
	if (!container) return

	// Store references for the kill function
	activeContainer = container

	const updateDots = (centerX, centerY) => {
		const dots = container.querySelectorAll('.dot')

		dots.forEach((dot) => {
			const rect = dot.getBoundingClientRect()
			const containerRect = container.getBoundingClientRect()

			const dotX = rect.left + rect.width / 2 - containerRect.left
			const dotY = rect.top + rect.height / 2 - containerRect.top

			const distance = Math.sqrt(
				Math.pow(centerX - dotX, 2) + Math.pow(centerY - dotY, 2)
			)

			if (distance <= radius) {
				const proximityFactor = 1 - distance / radius
				const opacity = 0.1 + (1.0 - 0.1) * proximityFactor * 1.1

				dot.style.opacity = opacity
				dot.style.transform = `scale(${1 + proximityFactor * 1.1})`
				dot.style.transition =
					'opacity 0.25s ease-out, transform 0.25s ease-out'
			} else {
				dot.style.opacity = 0.1
				dot.style.transform = 'scale(1)'
				dot.style.transition =
					'opacity 0.25s ease-out, transform 0.25s ease-out'
			}
		})
	}

	const handleMouseMove = (e) => {
		const containerRect = container.getBoundingClientRect()
		const mouseX = e.clientX - containerRect.left
		const mouseY = e.clientY - containerRect.top

		updateDots(mouseX, mouseY)
	}

	const handleMouseLeave = () => {
		const dots = container.querySelectorAll('.dot')
		dots.forEach((dot) => {
			dot.style.opacity = 0.1
			dot.style.transform = 'scale(1)'
		})
	}

	// Store handlers for cleanup
	activeHandlers = { handleMouseMove, handleMouseLeave }

	// Add event listeners
	container.addEventListener('mousemove', handleMouseMove)
	container.addEventListener('mouseleave', handleMouseLeave)
}

export function killDotHighlighting() {
	if (!activeContainer || !activeHandlers) return

	// Remove event listeners
	activeContainer.removeEventListener(
		'mousemove',
		activeHandlers.handleMouseMove
	)
	activeContainer.removeEventListener(
		'mouseleave',
		activeHandlers.handleMouseLeave
	)

	// Reset all dots to default state
	const dots = activeContainer.querySelectorAll('.dot')
	dots.forEach((dot) => {
		dot.style.opacity = ''
		dot.style.transform = ''
		dot.style.transition = ''
	})

	// Clear references
	activeContainer = null
	activeHandlers = null
}
