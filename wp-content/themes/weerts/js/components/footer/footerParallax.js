import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let footerParallaxTimeline = null
let footerResizeObserver = null
let mm = null

export function footerParallax() {
	const footer = document.querySelector('footer')
	const main = document.querySelector('main')

	if (!footer || !main) return

	// Clean up existing matchMedia if it exists
	if (mm) {
		mm.kill()
	}

	// Create matchMedia instance
	mm = gsap.matchMedia()

	const initAnimation = () => {
		// Kill old timeline if exists
		if (footerParallaxTimeline) {
			footerParallaxTimeline.scrollTrigger?.kill()
			footerParallaxTimeline.kill()
		}

		let { height } = footer.getBoundingClientRect()
		const vh = window.innerHeight

		height = Math.min(height, vh - 80)

		footerParallaxTimeline = gsap.timeline({
			scrollTrigger: {
				trigger: main,
				start: 'bottom bottom',
				end: `+=${height}px bottom`,
				scrub: true,
			},
			defaults: { ease: 'none' },
		})

		footerParallaxTimeline.fromTo(footer, { yPercent: -50 }, { yPercent: 0 })
	}

	// Only run on desktop (768px and up)
	mm.add('(min-width: 768px)', () => {
		// Initial animation
		initAnimation()

		// Observe footer size changes
		if (!footerResizeObserver) {
			footerResizeObserver = new ResizeObserver(() => {
				initAnimation()
			})
			footerResizeObserver.observe(footer)
		}

		// Cleanup function for when leaving this breakpoint
		return () => {
			if (footerParallaxTimeline) {
				footerParallaxTimeline.scrollTrigger?.kill()
				footerParallaxTimeline.kill()
				footerParallaxTimeline = null
			}
			if (footerResizeObserver) {
				footerResizeObserver.disconnect()
				footerResizeObserver = null
			}
		}
	})
}

export function cleanupFooterParallax() {
	if (mm) {
		mm.kill()
		mm = null
	}
	if (footerParallaxTimeline) {
		footerParallaxTimeline.scrollTrigger?.kill()
		footerParallaxTimeline.kill()
		footerParallaxTimeline = null
	}
	if (footerResizeObserver) {
		footerResizeObserver.disconnect()
		footerResizeObserver = null
	}
}
