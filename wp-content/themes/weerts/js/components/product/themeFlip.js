import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let productFlipTrigger = null

export default function initProductThemeFlip() {
	const hero = document.querySelector('#product-hero')
	if (!hero) return

	// Flip theme once the hero's bottom crosses the top of the viewport
	productFlipTrigger = ScrollTrigger.create({
		trigger: hero,
		start: '80% top',
		onEnter: () => document.body.classList.add('theme-flip'),
		onLeaveBack: () => document.body.classList.remove('theme-flip'),
	})

	ScrollTrigger.refresh()
}

export function killProductThemeFlip() {
	if (productFlipTrigger) {
		productFlipTrigger.kill()
		productFlipTrigger = null
	}
	// Ensure body class is clean
	document.body.classList.remove('theme-flip')
}