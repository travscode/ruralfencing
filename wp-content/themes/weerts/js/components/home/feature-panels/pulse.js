class SimpleASCII {
	constructor(canvas) {
		this.canvas = canvas
		this.ctx = canvas.getContext('2d')
		this.time = 0
		this.animationId = null
		this.fontSize = 14
		this.charWidth = 8.4
		this.charHeight = 16
		this.cols = 0
		this.rows = 0
		this.streams = []

		this.resize()
		this.initStreams()
		this.animate()
	}

	resize() {
		this.canvas.width = this.canvas.offsetWidth * devicePixelRatio
		this.canvas.height = this.canvas.offsetHeight * devicePixelRatio
		this.ctx.scale(devicePixelRatio, devicePixelRatio)

		this.cols = Math.floor(this.canvas.offsetWidth / this.charWidth)
		this.rows = Math.floor(this.canvas.offsetHeight / this.charHeight)

		this.ctx.font = `${this.fontSize}px 'Courier New', monospace`
		this.ctx.textAlign = 'left'
		this.ctx.textBaseline = 'top'
	}

	initStreams() {
		// Create a few vertical streams
		for (let i = 0; i < Math.floor(this.cols / 8); i++) {
			this.streams.push({
				x: Math.floor(Math.random() * this.cols),
				y: Math.floor(Math.random() * this.rows),
				speed: 0.3 + Math.random() * 0.5,
				chars: ['0', '1', '|', '▌', '▐', '█'],
				trail: [],
			})
		}
	}

	animate() {
		const w = this.canvas.offsetWidth
		const h = this.canvas.offsetHeight

		// Clear canvas
		this.ctx.fillStyle = '#000000'
		this.ctx.fillRect(0, 0, w, h)

		// Draw simple wave across the screen
		const waveY = this.rows / 2
		const amplitude = 3

		for (let x = 0; x < this.cols; x++) {
			const wave = Math.sin(x * 0.2 + this.time * 0.05) * amplitude
			const y = Math.floor(waveY + wave)

			if (y >= 0 && y < this.rows) {
				const intensity = Math.sin(x * 0.1 + this.time * 0.03) * 0.3 + 0.7
				this.ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`
				this.ctx.fillText('~', x * this.charWidth, y * this.charHeight)
			}
		}

		// Update and draw streams
		this.streams.forEach((stream) => {
			stream.y += stream.speed

			// Reset if off screen
			if (stream.y > this.rows + 5) {
				stream.y = -5
				stream.x = Math.floor(Math.random() * this.cols)
			}

			// Draw stream with fading trail
			for (let i = 0; i < 8; i++) {
				const trailY = Math.floor(stream.y - i)
				if (trailY >= 0 && trailY < this.rows) {
					const alpha = ((8 - i) / 8) * 0.6
					const char =
						stream.chars[Math.floor(Math.random() * stream.chars.length)]

					this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
					this.ctx.fillText(
						char,
						stream.x * this.charWidth,
						trailY * this.charHeight
					)
				}
			}
		})

		// Add occasional random characters
		if (Math.random() < 0.02) {
			const x = Math.floor(Math.random() * this.cols)
			const y = Math.floor(Math.random() * this.rows)
			const chars = ['+', '*', '·', '°', '○']
			const char = chars[Math.floor(Math.random() * chars.length)]

			this.ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.random() * 0.4})`
			this.ctx.fillText(char, x * this.charWidth, y * this.charHeight)
		}

		this.time += 1
		this.animationId = requestAnimationFrame(() => this.animate())
	}

	kill() {
		if (this.animationId) {
			cancelAnimationFrame(this.animationId)
		}
	}
}

let asciiInstance = null

export default function initASCIIOscilloscope() {
	const canvas = document.getElementById('ascii-canvas')
	if (!canvas) {
		return null
	}
	asciiInstance = new SimpleASCII(canvas)
	return asciiInstance
}

export function killASCIIOscilloscope() {
	if (asciiInstance) {
		asciiInstance.kill()
	}
}
