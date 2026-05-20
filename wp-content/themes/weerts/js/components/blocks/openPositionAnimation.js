import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

// Store the timeline reference globally so it can be killed
let workBlockTimeline = null

export function openPositionAnimation() {
	const containers = document.querySelectorAll('[data-block="open_positions"]')

	if (!containers) return

	containers.forEach((container) => {
		const headings = container.querySelectorAll(
			':scope .heading-container > *, :scope .scramble-inner .scramble-part'
		)

		workBlockTimeline = gsap.timeline({
			scrollTrigger: {
				trigger: container,
				start: 'top 75%',
				toggleActions: 'play none none reverse',
			},
			defaults: {
				duration: 0.5,
				ease: 'power2.out',
			},
		})

		workBlockTimeline.from(headings, {
			opacity: 0,
			yPercent: 100,
			stagger: 0.1,
		})

		return workBlockTimeline
	})
}

export function killopenPositionAnimation() {
	if (workBlockTimeline) {
		// Kill the timeline and its ScrollTrigger
		workBlockTimeline.kill()
		workBlockTimeline = null
	}
}
