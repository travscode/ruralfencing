import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)

let lenis

export default function initSmoothScrolling() {
	lenis = new Lenis({
		lerp: 0.175,
		autoRaf: true,
		overscroll: false,
	})
}

export function getLenis() {
	return lenis
}

// Kill functions for page transitions
export function killSmoothScrolling() {
	if (lenis) {
		lenis.destroy()
		lenis = null
	}
}

export function killScrollTriggers() {
	ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
}
