import Swup from 'swup'
import SwupPreloadPlugin from '@swup/preload-plugin'
import SwupProgressPlugin from '@swup/progress-plugin'
import SwupA11yPlugin from '@swup/a11y-plugin'
import gsap from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { setTheme } from './components/menus'
import { getLenis } from './utils/smooth-scroll'

gsap.registerPlugin(ScrambleTextPlugin)

let swup
let canvas, ctx
let pixelRatio

export default function initSwup() {
	swup = new Swup({
		animateHistoryBrowsing: true,
		plugins: [
			new SwupPreloadPlugin(),
			new SwupProgressPlugin({
				className: 'swup-progress-bar',
				transition: 300,
				delay: 300,
				initialValue: 0.0,
				finishAnimation: true,
			}),
			new SwupA11yPlugin(),
		],
	})

	// Correct way to handle link:click in Swup
	swup.hooks.on('link:click', (visit) => {
		// Check if visit and visit.to exist before accessing properties
		if (visit && visit.to && visit.to.url) {
			const url = new URL(visit.to.url, window.location.origin)
			if (url.pathname === '/contact' || url.pathname === '/contact/') {
				// Prevent Swup from handling this
				visit.skip = true
				// Do a hard navigation
				window.location.href = visit.to.url
			}
		}
	})

	// Alternative: Use native click handler (more reliable)
	document.addEventListener(
		'click',
		(e) => {
			const link = e.target.closest('a')
			if (link && link.href) {
				try {
					const url = new URL(link.href)
					if (url.pathname === '/contact' || url.pathname === '/contact/') {
						e.preventDefault()
						e.stopImmediatePropagation() // Stop other handlers including Swup
						window.location.href = link.href
					}
				} catch (err) {
					// Invalid URL, let normal handling continue
				}
			}
		},
		true
	) // Use capture phase to run before Swup

	// Your existing popstate handler
	window.addEventListener('popstate', (event) => {
		if (swup) {
			const currentUrl = window.location.pathname
			// Check if we're navigating to contact
			if (currentUrl === '/contact' || currentUrl === '/contact/') {
				window.location.href = currentUrl
				return
			}
			swup.loadPage({ url: currentUrl })
		}
	})

	createCanvas()
}

const createCanvas = () => {
	canvas = document.createElement('canvas')
	ctx = canvas.getContext('2d')

	// Get device pixel ratio for high-DPI displays
	pixelRatio = 1

	canvas.style.cssText = `
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 100;
		pointer-events: none;
		opacity: 1;
	`

	document.body.appendChild(canvas)

	const resize = () => {
		// Set display size
		canvas.style.width = window.innerWidth + 'px'
		canvas.style.height = window.innerHeight + 'px'

		// Set actual size in memory (scaled up for high-DPI)
		canvas.width = window.innerWidth * pixelRatio
		canvas.height = window.innerHeight * pixelRatio

		// Reset transform and scale the drawing context so everything draws at the correct size
		ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform matrix
		ctx.scale(pixelRatio, pixelRatio)

		// Redraw the current state if animation is playing
		if (fadeTimeline && !fadeTimeline.paused()) {
			const progress = fadeTimeline.progress()
			const vw = window.innerWidth
			const initialRadius = vw * 2
			const currentRadius = initialRadius - initialRadius * progress
			drawKeyhole(currentRadius)
		}
	}

	resize()
	window.addEventListener('resize', resize)
}

const drawKeyhole = (radius) => {
	const scaledWidth = canvas.width / pixelRatio
	const scaledHeight = canvas.height / pixelRatio
	const centerX = scaledWidth / 2
	const centerY = scaledHeight / 2

	ctx.clearRect(0, 0, scaledWidth, scaledHeight)
	ctx.save()
	ctx.beginPath()
	ctx.rect(0, 0, scaledWidth, scaledHeight)
	ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true)
	ctx.clip()
	ctx.fillStyle = '#000000'
	ctx.fillRect(0, 0, scaledWidth, scaledHeight)
	ctx.restore()
}

// Create the timeline only once
const fadeTimeline = gsap.timeline({
	paused: true,
	defaults: {
		duration: 0.75,
		ease: 'expo.inOut',
	},
})

const replaceSlug = (url) => {
	const container = document.querySelector('[page-loading-text]')
	const cleanUrl = url.replace(/^\/+|\/+$/g, '')
	const parts = cleanUrl.split('/')
	const slug = parts[parts.length - 1]

	// If slug is empty or just whitespace, return 'Home'
	if (!slug || slug.trim() === '') {
		container.innerHTML = 'Home'
		return
	}

	// Check if URL contains 'posts' and return 'Pulse'
	if (parts.includes('posts')) {
		container.innerHTML = 'Pulse'
		container.style.width = 'fit-content'
		return
	}

	const title = slug
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')

	container.innerHTML = title
	container.style.width = 'fit-content'
}

const updateLines = (banner, container) => {
	container.offsetHeight

	let bannerRect = banner.getBoundingClientRect()
	let headingRect = container.getBoundingClientRect()

	const padding = 16 // 1rem in pixels

	const paddedWidth = headingRect.width + padding * 2
	const paddedHeight = headingRect.height

	const widthPct = (paddedWidth / bannerRect.width) * 100
	const heightPct = (paddedHeight / bannerRect.height) * 100

	const leftPositions = [
		50 - widthPct / 1.5,
		50 - ((headingRect.width / bannerRect.width) * 100) / 2,
		50 + ((headingRect.width / bannerRect.width) * 100) / 2,
		50 + widthPct / 1.5,
	]

	const topPositions = [
		50 - heightPct / 2, // Top edge of padded area
		50 + heightPct / 2, // Bottom edge of padded area
	]

	// Return the positions for GSAP to animate
	return { leftPositions, topPositions }
}

const addOnTimeline = () => {
	const container = document.querySelector('[page-loading-text]')
	const banner = document.querySelector('.transition-effect')
	const vertLines = banner.querySelectorAll('.vertical-line')
	const horizLines = banner.querySelectorAll('.horizontal-line')
	const { leftPositions, topPositions } = updateLines(banner, container)
	const text = container.innerHTML
	const { width, height } = container.getBoundingClientRect()
	const outerText = document.querySelector('.outer-text')
	outerText.style.width = width + 'px'
	outerText.style.height = height + 'px'
	container.innerHTML = ''

	// Calculate initial and final radius for canvas
	const vw = window.innerWidth
	const initialRadius = vw * 2 // 200vw converted to pixels
	const finalRadius = 3.5 // 7px/2 for radius

	gsap.set([...vertLines, ...horizLines], {
		transition: 'none',
	})

	// Clear previous animations from the timeline
	fadeTimeline.clear()

	// Set initial canvas state
	drawKeyhole(initialRadius)

	// Rebuild the base timeline with line animations and canvas
	fadeTimeline
		.to(
			{},
			{
				duration: 1.0,
				ease: 'power2.inOut',
				onUpdate: function () {
					const progress = this.progress()
					const currentRadius = initialRadius - initialRadius * progress
					drawKeyhole(currentRadius)
				},
			}
		)
		.to(
			'.all-content',
			{
				opacity: 0,
				duration: 0.5,
			},
			'<=0.5'
		)
		.to('.transition-effect', { opacity: 1, duration: 0.25 }, '<=0.25')
		.to(vertLines[1], {
			left: leftPositions[1] + '%',
			opacity: 1,
			duration: 0.5,
		})
		.to(
			vertLines[2],
			{ left: leftPositions[2] + '%', opacity: 1, duration: 0.5 },
			'<='
		)
		.to(
			horizLines[0],
			{ top: topPositions[0] + '%', opacity: 1, duration: 0.5 },
			'<='
		)
		.to(
			horizLines[1],
			{ top: topPositions[1] + '%', opacity: 1, duration: 0.5 },
			'<='
		)
		.to(
			vertLines[0],
			{ left: leftPositions[0] + '%', opacity: 1, duration: 0.5 },
			'<=25%'
		)
		.to(
			vertLines[3],
			{ left: leftPositions[3] + '%', opacity: 1, duration: 0.5 },
			'<='
		)
		.to(
			'.inner-circle',
			{
				x: -width / 2 + 26,
				duration: 0.25,
				ease: 'power2.out',
			},
			'<='
		)
		.to(
			'.transition-effect .internal-heading-plus',
			{
				opacity: 1,
				scale: 1,
				duration: 0.5,
			},
			'<='
		)
		.to(
			container,
			{
				opacity: 1,
				scrambleText: {
					text: text,
				},
				duration: 0.3,
				ease: 'power2.out',
			},
			'<='
		)
}

export function swupHooks(init, kill) {
	let lenis = getLenis()

	swup.hooks.replace('animation:out:await', async (visit) => {
		replaceSlug(visit.to.url)
		addOnTimeline()
		await fadeTimeline.play().then(() => {
			setTheme(visit.to.url)
			kill()
		})
	})

	swup.hooks.replace('animation:in:await', async () => {
		lenis.scrollTo(0)
		init()
		await fadeTimeline.reverse()
	})
}
