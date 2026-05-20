import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let videoAnimations = []

export function videoBlockAnimations() {
	// Find all video block containers
	const containers = document.querySelectorAll('[id^="video-block-container-"]')
	
	containers.forEach(container => {
		createVideoAnimation(container)
	})
}

function createVideoAnimation(container) {
	const mm = gsap.matchMedia()

	if (window.innerWidth < 1024) return

	mm.add('(min-width: 1024px)', () => {
		if (!container) return

		const animation = gsap
			.timeline({
				scrollTrigger: {
					trigger: container,
					start: 'center center',
					end: '+=100% center',
					ease: 'power2.out',
					pin: true,
					scrub: true,
				},
			})
			.to(`#${container.id} .video-wrap`, {
				width: '100%',
				borderWidth: 0,
			})
			.to(
				`#${container.id} .video-wrap > div`,
				{
					padding: '0px',
					borderWidth: 0,
				},
				'<='
			)

		// Store animation for cleanup
		videoAnimations.push(animation)
	})
}

export function killVideoBlockAnimations() {
	videoAnimations.forEach(animation => {
		if (animation.scrollTrigger) {
			animation.scrollTrigger.kill()
		}
		animation.kill()
	})
	videoAnimations = []
}