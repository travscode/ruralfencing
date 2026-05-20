import gsap from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'

gsap.registerPlugin(ScrambleTextPlugin)

// Store cleanup functions
let buttonCleanups = []
let scrambledInnerCleanups = []
let continuousTimelines = []

export default function initButtons() {
	if (!document.querySelector('.scramble-text')) return

	const buttons = document.querySelectorAll('.scramble-text')

	buttons.forEach((button) => {
		let scrambleTimer = null
		let isScrambling = false

		const createScrambleEffect = (element) => {
			// Preserve original width and text
			const originalText = element.textContent.trim()
			const origWidth = element.getBoundingClientRect().width
			element.style.width = origWidth + 'px'
			element.style.whiteSpace = 'nowrap'

			// Use consistent character set
			const chars = 'eatbcdf190$*()+=/il1|!.,;:-'
			const duration = 240
			const interval = 40
			let elapsed = 0

			return {
				start: () => {
					if (isScrambling) return
					isScrambling = true

					scrambleTimer = setInterval(() => {
						// Direct character replacement maintaining exact length
						const scrambledText = originalText
							.split('')
							.map((char) =>
								char === ' '
									? ' '
									: chars[Math.floor(Math.random() * chars.length)]
							)
							.join('')

						element.textContent = scrambledText

						elapsed += interval
						if (elapsed >= duration) {
							clearInterval(scrambleTimer)
							// Restore original text and styling
							element.textContent = originalText
							element.style.width = ''
							element.style.whiteSpace = ''
							isScrambling = false
							elapsed = 0
						}
					}, interval)
				},

				stop: () => {
					if (scrambleTimer) {
						clearInterval(scrambleTimer)
						// Restore original text immediately
						element.textContent = originalText
						element.style.width = ''
						element.style.whiteSpace = ''
						isScrambling = false
						elapsed = 0
					}
				},
			}
		}

		const scrambler = createScrambleEffect(button)

		const onEnter = () => scrambler.start()
		const onLeave = () => scrambler.stop()

		button.addEventListener('mouseenter', onEnter)
		button.addEventListener('mouseleave', onLeave)

		// Store cleanup function
		buttonCleanups.push(() => {
			clearInterval(scrambleTimer)
			button.removeEventListener('mouseenter', onEnter)
			button.removeEventListener('mouseleave', onLeave)
		})
	})
}

export function scrambledInner() {
	if (!document.querySelector('.scramble-inner')) return

	const buttons = document.querySelectorAll('.scramble-inner')

	buttons.forEach((button) => {
		let scrambleTimer = null
		let isScrambling = false

		const scrambleParts = button.querySelectorAll('.scramble-part')
		const originals = Array.from(scrambleParts).map((part) =>
			part.textContent.trim()
		)

		const chars = 'eatbcdf190$*()+=/il1|!.,;:-'
		const duration = 240
		const interval = 40
		let elapsed = 0

		const createScrambleEffect = () => ({
			start: () => {
				if (isScrambling) return
				isScrambling = true

				scrambleTimer = setInterval(() => {
					scrambleParts.forEach((part, i) => {
						const origWidth = part.getBoundingClientRect().width
						part.style.width = origWidth + 'px'
						part.style.whiteSpace = 'nowrap'
						const orig = originals[i]
						const scrambled = orig
							.split('')
							.map((c) =>
								c === ' '
									? ' '
									: chars[Math.floor(Math.random() * chars.length)]
							)
							.join('')
						part.textContent = scrambled
					})

					elapsed += interval
					if (elapsed >= duration) {
						clearInterval(scrambleTimer)
						scrambleParts.forEach((part, i) => {
							part.textContent = originals[i]
						})
						isScrambling = false
						elapsed = 0
					}
				}, interval)
			},
			stop: () => {
				if (scrambleTimer) {
					clearInterval(scrambleTimer)
					scrambleParts.forEach((part, i) => {
						part.textContent = originals[i]
						part.style.width = ''
						part.style.whiteSpace = ''
					})
					isScrambling = false
					elapsed = 0
				}
			},
		})

		const scrambler = createScrambleEffect()

		const onEnter = () => scrambler.start()
		const onLeave = () => scrambler.stop()

		button.addEventListener('mouseenter', onEnter)
		button.addEventListener('mouseleave', onLeave)

		// Store cleanup function
		scrambledInnerCleanups.push(() => {
			clearInterval(scrambleTimer)
			button.removeEventListener('mouseenter', onEnter)
			button.removeEventListener('mouseleave', onLeave)
		})
	})

	// Abort early if no elements need the effect
	if (!document.querySelector('.scramble-text, .scramble-text-parent')) return

	/* ────────────────────────────────────
     Shared constants & helpers
     ──────────────────────────────────── */
	const CHARS = 'eatbcdf190$*()+=/il1|!.,;:-'
	const DURATION = 240
	const INTERVAL = 40
	const scramblers = new WeakMap() // per‑element state

	function createScrambler(el) {
		const originalText = el.textContent.trim()
		let timer = null,
			elapsed = 0,
			active = false

		const restore = () => {
			el.textContent = originalText
			el.style.width = ''
			el.style.whiteSpace = ''
		}

		return {
			start() {
				if (active) return
				active = true
				const { width } = el.getBoundingClientRect()
				el.style.width = `${width}px`
				el.style.whiteSpace = 'nowrap'

				timer = setInterval(() => {
					el.textContent = originalText
						.split('')
						.map((c) =>
							c === ' ' ? ' ' : CHARS[(Math.random() * CHARS.length) | 0]
						)
						.join('')

					if ((elapsed += INTERVAL) >= DURATION) {
						clearInterval(timer)
						restore()
						active = false
						elapsed = 0
					}
				}, INTERVAL)
			},

			stop() {
				if (!timer) return
				clearInterval(timer)
				restore()
				active = false
				elapsed = 0
			},
		}
	}

	const getScrambler = (el) =>
		scramblers.get(el) ||
		(scramblers.set(el, createScrambler(el)), scramblers.get(el))

	/* ────────────────────────────────────
     Event‑delegated handlers
     ──────────────────────────────────── */
	function onEnter(e) {
		const host = e.target.closest('.scramble-text, .scramble-text-parent')
		if (!host || host.contains(e.relatedTarget)) return // mimic mouseenter

		if (host.classList.contains('scramble-text')) {
			getScrambler(host).start()
		} else {
			// .scramble-text-parent
			host
				.querySelectorAll('.scramble-text')
				.forEach((el) => getScrambler(el).start())
		}
	}

	function onLeave(e) {
		const host = e.target.closest('.scramble-text, .scramble-text-parent')
		if (!host || host.contains(e.relatedTarget)) return // mimic mouseleave

		if (host.classList.contains('scramble-text')) {
			getScrambler(host).stop()
		} else {
			// .scramble-text-parent
			host
				.querySelectorAll('.scramble-text')
				.forEach((el) => getScrambler(el).stop())
		}
	}

	document.addEventListener('mouseover', onEnter)
	document.addEventListener('mouseout', onLeave)

	// Store cleanup for document listeners
	scrambledInnerCleanups.push(() => {
		document.removeEventListener('mouseover', onEnter)
		document.removeEventListener('mouseout', onLeave)
	})
}

export function continuousScramble() {
	const chars = 'eatbcdf190$*()+=/il1|!.,;:-'

	const targets = document.querySelectorAll('.continuous-scramble')

	if (targets.length === 0) return

	targets.forEach((target) => {
		const tl = gsap.timeline({
			repeat: -1,
			repeatDelay: 2,
		})

		tl.to(target, {
			duration: 0.5,
			ease: 'sine.in',
			scrambleText: {
				text: target.innerText,
				speed: 2,
				chars: chars,
			},
		})

		continuousTimelines.push(tl)
	})

	const loadingDots = document.querySelectorAll('.loading-dot')

	if (!loadingDots.length) return

	const dotTl = gsap.timeline({ repeat: -1 })

	loadingDots.forEach((dot, index) => {
		dotTl.fromTo(
			dot,
			{ opacity: 0 },
			{
				opacity: 1,
				duration: 0.4,
				ease: 'power2.inOut',
				yoyo: true,
				repeat: 1,
			},
			index * 0.3
		)
	})

	continuousTimelines.push(dotTl)
}

export function killButtons() {
	// Kill all button timers and event listeners
	buttonCleanups.forEach((cleanup) => cleanup())
	buttonCleanups = []

	// Kill scrambledInner timers and event listeners
	scrambledInnerCleanups.forEach((cleanup) => cleanup())
	scrambledInnerCleanups = []

	// Kill all GSAP timelines
	continuousTimelines.forEach((tl) => tl.kill())
	continuousTimelines = []
}
