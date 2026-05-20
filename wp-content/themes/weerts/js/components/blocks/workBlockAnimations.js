import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Store the timeline reference globally so it can be killed
let workBlockTimeline = null

export function workBlockAnimation() {
	const container = document.querySelector('#work-block')

	if (!container) return

	// Kill any existing timeline first
	killWorkBlockAnimation()

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

	workBlockTimeline.from(
		'.portfolio-item',
		{
			opacity: 0,
			y: 48,
			stagger: 0.1,
		},
		'<=50%'
	)

	return workBlockTimeline
}

export function killWorkBlockAnimation() {
	if (workBlockTimeline) {
		// Kill the timeline and its ScrollTrigger
		workBlockTimeline.kill()
		workBlockTimeline = null
	}
}
