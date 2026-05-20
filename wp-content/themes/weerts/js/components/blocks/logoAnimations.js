import gsap from 'gsap'

let logoBlockInterval
let activeTimelines = []

export default function logoBlockAnimations() {
	const logoContainer = document.querySelector('[logo-block]')

	if (!logoContainer) return

	// Get all logo slots
	const logoSlots = logoContainer.querySelectorAll('[data-logo-slot]')

	if (!logoSlots.length) return

	// Initialize each slot
	logoSlots.forEach((slot) => {
		const visibleLogo = slot.querySelector('.visible-logo')
		const additionalLogos = slot.querySelectorAll('.additional-logo')

		if (!additionalLogos.length) return // Skip slots with no additional logos

		// Set initial state - visible logo at 0, additional logos below
		gsap.set(visibleLogo, {
			yPercent: 0,
		})
		gsap.set(additionalLogos, {
			yPercent: 300,
		})

		// Keep track of current logo index for this slot
		slot.currentLogoIndex = 0 // Start with 0 (visible logo is showing)
		slot.allLogosInSlot = [visibleLogo, ...additionalLogos]
	})

	function cycleSingleSlot(slot) {
		const visibleLogo = slot.querySelector('.visible-logo')
		const additionalLogos = slot.querySelectorAll('.additional-logo')

		if (!additionalLogos.length) return

		const allLogos = [visibleLogo, ...additionalLogos]
		const currentIndex = slot.currentLogoIndex
		const nextIndex = (currentIndex + 1) % allLogos.length

		const currentLogo = allLogos[currentIndex]
		const nextLogo = allLogos[nextIndex]

		const tl = gsap.timeline()

		// Track this timeline so we can kill it later
		activeTimelines.push(tl)

		// Animate current logo out
		tl.to(currentLogo, {
			yPercent: -300,
			duration: 0.65,
			ease: 'power2.inOut',
		})
			// Animate next logo in
			.fromTo(
				nextLogo,
				{ yPercent: 300 },
				{
					yPercent: 0,
					duration: 0.65,
					ease: 'power2.inOut',
				},
				'<'
			)
			// Remove from active timelines when complete
			.call(() => {
				const index = activeTimelines.indexOf(tl)
				if (index > -1) {
					activeTimelines.splice(index, 1)
				}
			})

		slot.currentLogoIndex = nextIndex
	}

	function cycleAllSlots() {
		// Group slots by row (assuming they're laid out in a grid)
		const slotsPerRow = Math.ceil(logoSlots.length / 2) // Adjust if you know the exact layout
		const row1 = Array.from(logoSlots).slice(0, slotsPerRow)
		const row2 = Array.from(logoSlots).slice(slotsPerRow)

		// Create timelines for each row with internal stagger
		const row1Timeline = gsap.timeline()
		const row2Timeline = gsap.timeline()

		// Track these timelines
		activeTimelines.push(row1Timeline, row2Timeline)

		// Row 1 - stagger within the row
		row1.forEach((slot, index) => {
			const additionalLogos = slot.querySelectorAll('.additional-logo')
			if (!additionalLogos.length) return

			row1Timeline.add(() => cycleSingleSlot(slot), index * 0.06)
		})

		// Row 2 - stagger within the row, starts at the same time as row 1
		row2.forEach((slot, index) => {
			const additionalLogos = slot.querySelectorAll('.additional-logo')
			if (!additionalLogos.length) return

			row2Timeline.add(() => cycleSingleSlot(slot), index * 0.06)
		})

		// Remove row timelines from tracking when complete
		row1Timeline.call(() => {
			const index = activeTimelines.indexOf(row1Timeline)
			if (index > -1) {
				activeTimelines.splice(index, 1)
			}
		})

		row2Timeline.call(() => {
			const index = activeTimelines.indexOf(row2Timeline)
			if (index > -1) {
				activeTimelines.splice(index, 1)
			}
		})
	}

	// Start the cycling
	logoBlockInterval = setInterval(cycleAllSlots, 3000)

	// Return cleanup function
	return () => {
		killLogoBlockAnimations()
	}
}

export function killLogoBlockAnimations() {
	// Clear the interval
	if (logoBlockInterval) {
		clearInterval(logoBlockInterval)
		logoBlockInterval = null
	}

	// Kill all active timelines
	activeTimelines.forEach((timeline) => {
		if (timeline) timeline.kill()
	})
	activeTimelines = []

	// Reset all logo positions to initial state
	const logoContainer = document.querySelector('[logo-block]')
	if (logoContainer) {
		const logoSlots = logoContainer.querySelectorAll('[data-logo-slot]')

		logoSlots.forEach((slot) => {
			const visibleLogo = slot.querySelector('.visible-logo')
			const additionalLogos = slot.querySelectorAll('.additional-logo')

			// Reset to initial positions
			if (visibleLogo) {
				gsap.set(visibleLogo, {
					clearProps: 'transform',
				})
			}

			if (additionalLogos.length) {
				gsap.set(additionalLogos, {
					clearProps: 'transform',
				})
			}

			// Clean up custom properties
			delete slot.currentLogoIndex
			delete slot.allLogosInSlot
		})
	}
}
