import gsap from 'gsap'
import SplitText from 'gsap/SplitText'

let resizeTimer
let masterTimeline
let handleResize
let splitTextInstance // Track the SplitText instance

gsap.registerPlugin(SplitText)

export default function initInternalBanner() {
	const banner = document.querySelector('.internal-banner')
	if (!banner) return

	const heading = banner.querySelector('.internal-banner-heading')
	const vertLines = banner.querySelectorAll('.vertical-line')
	const horizLines = banner.querySelectorAll('.horizontal-line')

	if (!heading) return

	// Cache DOM measurements
	let bannerRect, headingRect

	const createMasterTimeline = () => {
		// Kill existing timeline and SplitText instance
		if (masterTimeline) masterTimeline.kill()
		if (splitTextInstance) splitTextInstance.revert()

		// Reset any existing styles on the heading
		gsap.set('.internal-banner-heading div', {
			clearProps: 'all',
		})

		// Ensure heading is visible before creating SplitText
		gsap.set('.internal-banner-heading div', {
			opacity: 0, // Start invisible, we'll fade in after split
		})

		// Force a reflow before creating SplitText
		heading.offsetHeight

		// Create fresh SplitText instance
		splitTextInstance = SplitText.create('.internal-banner-heading div', {
			mask: 'chars',
			type: 'chars',
		})

		// Set initial states for animation
		gsap.set(splitTextInstance.chars, {
			yPercent: 100,
		})

		// Now make the heading visible
		gsap.set('.internal-banner-heading div', {
			opacity: 1,
		})

		// Create master timeline
		masterTimeline = gsap.timeline()

		// 1. Initial delay
		masterTimeline.set({}, {}, 0.1)

		// Animate split text characters
		masterTimeline.fromTo(
			splitTextInstance.chars,
			{
				yPercent: 100,
			},
			{
				yPercent: 0,
				duration: 0.4,
				ease: 'power2.out',
				stagger: {
					each: 0.025,
					from: 'center',
				},
			},
			0.4
		)

		// 2. Force layout recalculation and animate lines
		masterTimeline.call(
			() => {
				// Force a reflow to ensure accurate measurements
				heading.offsetHeight

				// Update measurements after reflow
				bannerRect = banner.getBoundingClientRect()
				headingRect = heading.getBoundingClientRect()

				// Calculate heading center relative to banner
				const leftOffset =
					((headingRect.left +
						headingRect.width / 2 -
						(bannerRect.left + bannerRect.width / 2)) /
						bannerRect.width) *
					100
				const topOffset =
					((headingRect.top +
						headingRect.height / 2 -
						(bannerRect.top + bannerRect.height / 2)) /
						bannerRect.height) *
					100

				const widthPct = (headingRect.width / bannerRect.width) * 100
				const heightPct = (headingRect.height / bannerRect.height) * 100

				// Vertical lines need horizontal (left) positioning
				const leftPositions = [
					50 + leftOffset - widthPct / 1.5, // Left quarter
					50 + leftOffset - widthPct / 2, // Left edge
					50 + leftOffset + widthPct / 2, // Right edge
					50 + leftOffset + widthPct / 1.5, // Right quarter
				]

				// Horizontal lines need vertical (top) positioning
				const topPositions = [
					50 + topOffset - heightPct / 2, // Top edge
					50 + topOffset + heightPct / 2, // Bottom edge
				]

				// Animate lines with fresh measurements
				gsap.to(vertLines, {
					duration: 0.6,
					ease: 'power2.out',
					left: (i) => leftPositions[i] + '%',
				})

				gsap.to(horizLines, {
					duration: 0.6,
					ease: 'power2.out',
					top: (i) => topPositions[i] + '%',
				})

				gsap.to('.internal-heading-plus', {
					opacity: 1,
					duration: 0.25,
					stagger: 0.1,
				})
			},
			null,
			0.45
		)

		// 3. Text scramble preparation (at 0.8s)
		masterTimeline.call(
			() => {
				// Preserve original width
				const origWidth = heading.getBoundingClientRect().width
				gsap.set(heading, {
					width: origWidth + 'px',
					whiteSpace: 'nowrap',
				})
			},
			null,
			1.4
		)

		// 4. Text scramble animation (at 0.8s)
		const chars = 'eatbcdf190$*()+=/il1|!.,;:-'

		// Get text nodes
		const walker = document.createTreeWalker(
			heading,
			NodeFilter.SHOW_TEXT,
			(node) =>
				node.textContent.trim()
					? NodeFilter.FILTER_ACCEPT
					: NodeFilter.FILTER_REJECT
		)

		const textNodes = []
		let node
		while ((node = walker.nextNode())) {
			textNodes.push(node)
		}

		const originals = textNodes.map((n) => n.textContent)

		// Add scramble animation to master timeline
		masterTimeline.to(
			{},
			{
				duration: 0.3,
				ease: 'none',
				onUpdate: function () {
					textNodes.forEach((textNode, i) => {
						const original = originals[i]
						textNode.textContent = original
							.split('')
							.map((char) =>
								char === ' '
									? ' '
									: chars[Math.floor(Math.random() * chars.length)]
							)
							.join('')
					})
				},
				onComplete: function () {
					// Restore original text and styling
					textNodes.forEach((textNode, i) => {
						textNode.textContent = originals[i]
					})
					gsap.set(heading, {
						width: '',
						whiteSpace: '',
					})
				},
			},
			1.4
		)
	}

	// Initial timeline creation
	createMasterTimeline()

	// Debounced resize handler
	handleResize = () => {
		clearTimeout(resizeTimer)
		resizeTimer = setTimeout(() => {
			requestAnimationFrame(createMasterTimeline)
		}, 100)
	}

	window.addEventListener('resize', handleResize)

	return () => {
		window.removeEventListener('resize', handleResize)
		clearTimeout(resizeTimer)
		if (masterTimeline) masterTimeline.kill()
		if (splitTextInstance) splitTextInstance.revert()
	}
}

export function killInternalBanner() {
	window.removeEventListener('resize', handleResize)
	clearTimeout(resizeTimer)
	if (masterTimeline) masterTimeline.kill()
	if (splitTextInstance) splitTextInstance.revert()
}
