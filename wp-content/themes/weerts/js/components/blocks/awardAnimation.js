import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Store the timeline reference globally so it can be killed
let workBlockTimeline = null

export function awardBlockAnimations() {
	const containers = document.querySelectorAll('.awards-block')

	if (!containers) return

	containers.forEach((container) => {
		const ceremonyRows = container.querySelectorAll(':scope .ceremony-row > *')

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

		workBlockTimeline.from(ceremonyRows, {
			opacity: 0,
			yPercent: 100,
			stagger: 0.1,
		})

		return workBlockTimeline
	})
}

export function killawardBlockAnimations() {
	if (workBlockTimeline) {
		// Kill the timeline and its ScrollTrigger
		workBlockTimeline.kill()
		workBlockTimeline = null
	}
}
