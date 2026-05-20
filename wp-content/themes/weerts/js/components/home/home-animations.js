import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger)

export default function homeAnimations() {
	awardPin()
	servicesAnimation()
	videoAnimation()
	pulseAnimation()
	featurePanels()
}

function selectedWorkAnimation() {
	const container = document.querySelector('#home-selected-works')

	if (!container) return

	let tl = gsap.timeline({
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

	tl.from('#home-selected-works .header-container > * ', {
		opacity: 0,
		y: 48,
		stagger: 0.1,
	}).from(
		'.portfolio-item',
		{
			opacity: 0,
			y: 48,
			stagger: 0.1,
		},
		'<=50%'
	)
}

function awardPin() {
	const pin = document.querySelector('.pin-award')

	if (!pin) return

	let tl = gsap.timeline({
		scrollTrigger: {
			trigger: pin,
			start: 'center center',
			endTrigger: '#home-three-awards',
			end: `bottom center+=${pin.clientHeight}`,
			pin: true,
			pinSpacing: false,
		},
	})
}

function servicesAnimation() {
	const container = document.querySelector('#home-services')

	if (!container) return

	const headerContainer = document.querySelectorAll('.header-container')

	headerContainer.forEach((el) => {
		replaceIndent(el)
	})

	let tl = gsap.timeline({
		scrollTrigger: {
			trigger: container,
			start: 'top 75%',
			toggleActions: 'play none none reverse',
		},
		delay: 0.25,
		defaults: {
			duration: 0.5,
			ease: 'power2.out',
		},
	})

	let splitheading = SplitText.create('#home-services .header-container > *', {
		mask: 'lines',
		autoSplit: true,
		onSplit: (self) => {
			if (tl) {
				tl.clear()
			}
			tl.from(self.lines, {
				opacity: 0,
				yPercent: 100,
				stagger: 0.1,
			})
		},
	})

	let tl2 = gsap.timeline({
		scrollTrigger: {
			trigger: '#home-service-grid',
			start: 'top 75%',
			toggleActions: 'play none none reverse',
		},
		delay: 0.25,
		defaults: {
			duration: 0.5,
			ease: 'power2.out',
		},
	})

	tl2.from('#home-service-grid .text-item', {
		opacity: 0,
		xPercent: 50,
		stagger: 0.05,
	})
}

function videoAnimation() {
	// Only handle home video animation here
	createVideoAnimation('#home-video-container')
	
	// Video blocks are now handled by videoBlockAnimation.js through AnimationBlocksBootstrap
}

function createVideoAnimation(containerSelector) {
	const mm = gsap.matchMedia()

	if (window.innerWidth < 1024) return

	mm.add('(min-width: 1024px)', () => {
		const container = document.querySelector(containerSelector)
		if (!container) return

		gsap
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
			.to(`${containerSelector} .video-wrap`, {
				width: '100%',
				borderWidth: 0,
			})
			.to(
				`${containerSelector} .video-wrap > div`,
				{
					padding: '0px',
					borderWidth: 0,
				},
				'<='
			)
	})
}

function pulseAnimation() {
	const container = document.querySelector('#home-pulse')

	return

	if (!container) return

	let tl = gsap.timeline({
		scrollTrigger: {
			trigger: container,
			start: 'top 75%',
			toggleActions: 'play none none reverse',
		},
		delay: 0.25,
		defaults: {
			duration: 0.5,
			ease: 'power2.out',
		},
	})

	tl.from('#home-pulse img', {
		opacity: 0,
	})
		.from(
			'#home-pulse .header-items > *',
			{
				yPercent: 100,
				opacity: 0,
			},
			'<='
		)
		.from('#home-pulse article h3, #home-pulse article p', {
			yPercent: 100,
			opacity: 0,
		})
}

function featurePanels() {
	const container = document.querySelector('#feature-panels')

	if (!container) return

	let splitheading = SplitText.create('#feature-panels .block-content > *', {
		mask: 'lines',
	})

	let tl = gsap.timeline({
		scrollTrigger: {
			trigger: container,
			start: 'top 75%',
			toggleActions: 'play none none reverse',
		},
		delay: 0.25,
		defaults: {
			duration: 0.5,
			ease: 'power2.out',
		},
	})

	tl.from(splitheading.lines, {
		opacity: 0,
		yPercent: 100,
		stagger: 0.1,
	})
}

export function replaceIndent(el) {
	if (!el.classList.contains('indent-6')) return

	el.classList.remove('indent-6')
	const span = document.createElement('span')
	span.style.width = '24px'
	span.style.display = 'inline-block'
	el.querySelector(':scope > *:is(h1,h2,h3,h4,h5,h6)')?.prepend(span)
}
