import gsap from 'gsap'

let accordionCleanups = []
let accordionInstances = new Map()

export default function initAccordions() {
	const accordionHeaders = document.querySelectorAll('.accordion-header')

	if (!accordionHeaders.length) {
		return
	}

	// Clear existing instances to prevent duplicates
	killAccordions()

	accordionHeaders.forEach((header, index) => {
		const accordionInstance = createAccordionInstance(header, index)
		accordionInstances.set(header, accordionInstance)
	})
}

function createAccordionInstance(header, index) {
	const isActive = header.classList.contains('active')
	const accordionContent = header.nextElementSibling
	const plusIcon = header.querySelector('.menu-plus')

	if (!accordionContent || !plusIcon) {
		console.warn(
			`Accordion ${index}: Missing required elements (content or plus icon)`
		)
		return null
	}

	// Store animation references for cleanup
	let contentAnimation = null
	let iconAnimation = null

	// Set initial state
	gsap.set(accordionContent, {
		height: isActive ? 'auto' : 0,
	})

	const openAccordion = () => {
		if (header.classList.contains('active')) return

		header.classList.add('active')

		// Kill existing animations
		if (contentAnimation) contentAnimation.kill()
		if (iconAnimation) iconAnimation.kill()

		// Rotate plus icon to X
		iconAnimation = gsap.to(plusIcon, {
			rotate: 135,
			duration: 0.3,
			ease: 'power1.out',
		})

		// Animate content open with proper height calculation
		gsap.set(accordionContent, { height: 'auto' })
		const targetHeight = accordionContent.offsetHeight

		contentAnimation = gsap.fromTo(
			accordionContent,
			{ height: 0 },
			{
				height: targetHeight + 24,
				duration: 1,
				ease: 'elastic.out(1, 1.5)',
			}
		)
	}

	const closeAccordion = () => {
		if (!header.classList.contains('active')) return

		header.classList.remove('active')

		// Kill existing animations
		if (contentAnimation) contentAnimation.kill()
		if (iconAnimation) iconAnimation.kill()

		// Rotate plus icon back to +
		iconAnimation = gsap.to(plusIcon, {
			rotate: 0,
			duration: 0.3,
			ease: 'power1.out',
		})

		// Animate content closed
		contentAnimation = gsap.to(accordionContent, {
			height: 0,
			duration: 1,
			ease: 'elastic.out(1, 1.5)',
		})
	}

	const onClick = (event) => {
		event.preventDefault()

		const isCurrentlyActive = header.classList.contains('active')

		if (isCurrentlyActive) {
			// Close this accordion
			closeAccordion()
		} else {
			// Close all other accordions first
			closeAllAccordions(header)
			// Then open this one
			openAccordion()
		}
	}

	// Add click event listener
	header.addEventListener('click', onClick)

	// Store cleanup function
	const cleanup = () => {
		if (contentAnimation) {
			contentAnimation.kill()
			contentAnimation = null
		}
		if (iconAnimation) {
			iconAnimation.kill()
			iconAnimation = null
		}
		header.removeEventListener('click', onClick)
	}

	accordionCleanups.push(cleanup)

	return {
		header,
		accordionContent,
		plusIcon,
		openAccordion,
		closeAccordion,
		cleanup,
		isActive: () => header.classList.contains('active'),
	}
}

function closeAllAccordions(exceptHeader = null) {
	accordionInstances.forEach((instance, header) => {
		// Skip the header we want to keep open and headers that are already closed
		if (header === exceptHeader || !instance?.isActive()) {
			return
		}

		instance.closeAccordion()
	})
}

export function killAccordions() {
	// Clean up all existing accordions
	accordionCleanups.forEach((cleanup) => cleanup())
	accordionCleanups = []
	accordionInstances.clear()
}

// Optional: Utility function to open a specific accordion by index or element
export function openAccordion(target) {
	let targetHeader = null

	if (typeof target === 'number') {
		// Open by index
		const headers = Array.from(accordionInstances.keys())
		targetHeader = headers[target]
	} else if (target instanceof HTMLElement) {
		// Open by element
		targetHeader = target
	}

	if (targetHeader && accordionInstances.has(targetHeader)) {
		const instance = accordionInstances.get(targetHeader)
		if (!instance.isActive()) {
			closeAllAccordions(targetHeader)
			instance.openAccordion()
		}
	}
}

// Optional: Utility function to close all accordions
export function closeAllAccordionsExternal() {
	closeAllAccordions()
}
