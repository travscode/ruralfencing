import { animate } from 'motion/mini'
import Lenis from 'lenis'

const ease = [0.22, 1, 0.36, 1]

function initHomepageMotion() {
	const content = document.querySelector('#content')
	const hero = content?.querySelector('.home-hero')
	if (!hero || !('IntersectionObserver' in window) || !Element.prototype.animate) return

	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
	const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
	let lenis
	const active = new Map()
	const pending = new Map()
	let restoreHeading = () => {}

	function finish(element) {
		active.get(element)?.stop()
		active.delete(element)
		pending.delete(element)
		element.style.removeProperty('opacity')
		element.style.removeProperty('transform')
	}

	function reveal(element, delay = 0) {
		pending.delete(element)
		const animation = animate(element, {
			opacity: [0, 1],
			transform: ['translateY(10px)', 'translateY(0px)'],
		}, { duration: 0.75, delay, ease })
		active.set(element, animation)
		animation.then(() => {
			if (active.get(element) === animation) finish(element)
		})
	}

	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue
			const delay = pending.get(entry.target)
			observer.unobserve(entry.target)
			if (delay !== undefined) reveal(entry.target, delay)
		}
	}, { threshold: 0, rootMargin: '0px 0px -24px 0px' })

	function prepare(element, delay = 0) {
		// Restored scroll positions and hash destinations should already be readable.
		if (element.getBoundingClientRect().top < window.innerHeight) return
		pending.set(element, delay)
		element.style.opacity = '0'
		element.style.transform = 'translateY(10px)'
		observer.observe(element)
	}

	function animateHeading() {
		const heading = hero.querySelector('h1')
		if (!heading) return
		const original = heading.textContent
		const accessible = document.createElement('span')
		accessible.className = 'sr-only'
		accessible.textContent = original
		const visual = document.createElement('span')
		visual.setAttribute('aria-hidden', 'true')
		const letters = []
		for (const part of original.trim().split(/(\s+)/)) {
			if (/^\s+$/.test(part)) {
				visual.append(document.createTextNode(' '))
				continue
			}
			const word = document.createElement('span')
			word.style.whiteSpace = 'nowrap'
			for (const character of part) {
				const letter = document.createElement('span')
				letter.textContent = character
				word.append(letter)
				letters.push(letter)
			}
			visual.append(word)
		}
		heading.replaceChildren(accessible, visual)
		restoreHeading = () => {
			letters.forEach(finish)
			heading.textContent = original
		}
		letters.forEach((letter, index) => {
			const animation = animate(letter, { opacity: [0, 1] }, {
				duration: 0.28, delay: index * (0.95 / letters.length), ease,
			})
			active.set(letter, animation)
			if (index === letters.length - 1) animation.then(restoreHeading)
		})
	}

	if (!reducedMotion.matches) {
		if (window.scrollY < 40 && !window.location.hash) {
			animateHeading()
			const body = hero.querySelector('p')
			if (body) reveal(body, 0.35)
			hero.querySelectorAll('.wp-block-button').forEach((button, i) => reveal(button, 0.5 + i * 0.07))
		}
		for (const section of content.querySelectorAll(':scope > section:not(.home-hero)')) {
			if (section.matches('.rural-category-spotlight')) {
				prepare(section.firstElementChild.firstElementChild)
				section.querySelectorAll('.rural-category-spotlight__img').forEach((image, i) => prepare(image, i * 0.09))
			} else if (section.matches('.rural-cta')) {
				section.querySelectorAll('.rural-cta__gallery, .rural-cta__content').forEach((element, i) => prepare(element, i * 0.09))
			} else {
				// Animate content, leaving section backgrounds and spacing stationary.
				for (const element of section.children) prepare(element)
			}
		}
	}

	// Never leave a keyboard destination waiting for an entrance animation.
	content.addEventListener('focusin', (event) => {
		for (const element of [...pending.keys(), ...active.keys()]) {
			if (element.contains(event.target)) {
				observer.unobserve(element)
				finish(element)
			}
		}
	})

	function syncScrollLock() {
		if (!lenis) return
		const locked = getComputedStyle(document.body).overflowY === 'hidden'
			|| document.body.classList.contains('mobile-menu-open')
		if (locked) lenis.stop()
		else lenis.start()
	}

	function syncSmoothScrolling() {
		lenis?.destroy()
		lenis = undefined
		if (reducedMotion.matches || !finePointer.matches) return
		lenis = new Lenis({
			autoRaf: true,
			lerp: 0.14,
			smoothWheel: true,
			syncTouch: false,
			anchors: true,
			allowNestedScroll: true,
		})
		syncScrollLock()
	}

	new MutationObserver(syncScrollLock).observe(document.body, {
		attributes: true, attributeFilter: ['style', 'class'],
	})
	reducedMotion.addEventListener('change', () => {
		if (reducedMotion.matches) {
			observer.disconnect()
			for (const element of [...pending.keys(), ...active.keys()]) finish(element)
			restoreHeading()
		}
		syncSmoothScrolling()
	})
	finePointer.addEventListener('change', syncSmoothScrolling)
	window.addEventListener('beforeprint', () => {
		observer.disconnect()
		for (const element of [...pending.keys(), ...active.keys()]) finish(element)
		restoreHeading()
	})
	syncSmoothScrolling()
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initHomepageMotion)
} else {
	initHomepageMotion()
}
