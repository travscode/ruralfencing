export default class CanvasAnimation {
	constructor(canvasId) {
		this.canvas = document.getElementById(canvasId)
		this.ctx = this.canvas.getContext('2d')
		this.rings = [
			{ radius: 200, speed: 40, fontSize: 14, opacity: 1.0, dir: 1 },
			{ radius: 225, speed: 45, fontSize: 14, opacity: 0.8, dir: -1 },
			{ radius: 250, speed: 50, fontSize: 14, opacity: 0.7, dir: 1 },
			{ radius: 280, speed: 55, fontSize: 14, opacity: 0.6, dir: -1 },
			{ radius: 340, speed: 65, fontSize: 14, opacity: 0.5, dir: 1 },
			{ radius: 400, speed: 75, fontSize: 14, opacity: 0.3, dir: -1 },
			{ radius: 500, speed: 100, fontSize: 14, opacity: 0.1, dir: 1 },
			{ radius: 600, speed: 125, fontSize: 14, opacity: 0.05, dir: -1 },
			{ radius: 780, speed: 150, fontSize: 14, opacity: 0.05, dir: 1 },
			{ radius: 950, speed: 200, fontSize: 14, opacity: 0.01, dir: -1 },
		]

		this.phrase = 'NEVER STOP STARTING • '
		this.FONT_STACK = 'Aktiv Grotesk, system-ui, sans-serif'
		this.FONT_WEIGHT = 500
		this.dpr = window.devicePixelRatio || 1
		this.width = 0
		this.height = 0
		this.cx = 0
		this.cy = 0
		this.startTime = performance.now()
		this.animationPaused = false
		this.bitmaps = []

		this.init()
	}

	init() {
		this.resizeHandler = this.resize.bind(this)
		window.addEventListener('resize', this.resizeHandler, { passive: true })
		this.resize()
		this.render()
	}

	resize() {
		const clientWidth = document
			.querySelector('.contact-hero')
			.getBoundingClientRect().width
		const clientHeight = document
			.querySelector('.contact-hero')
			.getBoundingClientRect().height

		this.width = Math.floor(clientWidth * this.dpr)
		this.height = Math.floor(clientHeight * this.dpr)
		this.canvas.width = this.width
		this.canvas.height = this.height
		this.canvas.style.width = clientWidth + 'px'
		this.canvas.style.height = clientHeight + 'px'
		this.cx = this.width / 2
		this.cy = this.height / 2
		this.buildCaches()
	}

	buildCaches() {
		this.bitmaps.length = 0
		this.rings.forEach((ring, idx) => {
			const fs = ring.fontSize * this.dpr
			const r = ring.radius * this.dpr
			const off = this.buildRingBitmap(r, fs, ring.opacity)
			this.bitmaps[idx] = off
		})
	}

	buildRingBitmap(r, fs, opacity) {
		const pad = fs * 3
		const size = Math.ceil((r + fs + pad) * 2)
		const off = document.createElement('canvas')
		off.width = size
		off.height = size
		const c = off.getContext('2d')
		c.imageSmoothingEnabled = true
		c.textBaseline = 'middle'
		c.textAlign = 'left'
		c.font = `${this.FONT_WEIGHT} ${fs}px ${this.FONT_STACK}`
		c.fillStyle = '#ffffff'
		c.globalAlpha = opacity

		const circumference = 2 * Math.PI * r
		const phraseWidth = c.measureText(this.phrase).width
		const repeats = Math.max(4, Math.ceil((circumference / phraseWidth) * 2))
		const text = this.phrase.repeat(repeats)

		c.save()
		c.translate(size / 2, size / 2)
		let angle = 0
		const full = Math.PI * 2

		for (let i = 0; angle < full; i++) {
			const ch = text[i % text.length]
			let adv = c.measureText(ch).width

			// Add minimum width for narrow characters like 'I'
			if (ch === 'I' || ch === 'l' || ch === '|' || ch === '•') {
				adv = Math.max(adv, fs * 0.6) // Ensure minimum width
			}

			const charAngle = adv / r

			c.save()
			c.rotate(angle - Math.PI / 2)
			const w = c.measureText(ch).width
			c.fillText(ch, -w / 2, -r)
			c.restore()

			angle += charAngle
		}

		c.restore()
		return { canvas: off, size, opacity }
	}

	render = (now) => {
		if (this.animationPaused) {
			requestAnimationFrame(this.render)
			return
		}

		const t = now - this.startTime
		this.ctx.clearRect(0, 0, this.width, this.height)
		this.ctx.save()
		this.ctx.translate(this.cx, this.cy)

		for (let i = 0; i < this.rings.length; i++) {
			const ring = this.rings[i]
			const dir = ring.dir
			const basePeriod = Math.max(0.001, ring.speed)
			const omega = (dir * (Math.PI * 2)) / (basePeriod * 1000)
			const angle = omega * t

			const bmp = this.bitmaps[i]
			if (!bmp) continue
			this.ctx.save()
			this.ctx.rotate(angle)
			this.ctx.globalAlpha = bmp.opacity
			this.ctx.drawImage(bmp.canvas, -bmp.size / 2, -bmp.size / 2)
			this.ctx.restore()
		}

		this.ctx.restore()
		requestAnimationFrame(this.render)
	}

	pause() {
		this.animationPaused = true
	}

	resume() {
		this.animationPaused = false
	}

	hide() {
		this.canvas.classList.add('circles-hidden')
		this.pause()
	}

	show() {
		this.canvas.classList.remove('circles-hidden')
		this.resume()
	}

	kill() {
		// Stop the animation loop
		this.animationPaused = true

		// Remove event listeners to prevent memory leaks
		if (this.resizeHandler) {
			window.removeEventListener('resize', this.resizeHandler)
		}

		// Clear the canvas
		if (this.ctx) {
			this.ctx.clearRect(0, 0, this.width, this.height)
		}

		// Clean up bitmap caches
		this.bitmaps.forEach((bitmap) => {
			if (bitmap && bitmap.canvas) {
				// Clear the offscreen canvas
				const ctx = bitmap.canvas.getContext('2d')
				if (ctx) {
					ctx.clearRect(0, 0, bitmap.canvas.width, bitmap.canvas.height)
				}
			}
		})
		this.bitmaps.length = 0

		// Clear references
		this.canvas = null
		this.ctx = null
		this.rings = null
		this.resizeHandler = null
	}
}
