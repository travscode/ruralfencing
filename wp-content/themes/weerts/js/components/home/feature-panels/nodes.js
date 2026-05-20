class Node {
	constructor(x, y) {
		this.x = x
		this.y = y
		this.intensity = 0
		this.phase = Math.random() * Math.PI * 2
		this.frequency = 0.02 + Math.random() * 0.03
		this.baseIntensity = Math.random() * 0.3 + 0.1
		this.connections = []
	}

	update(time, nodes) {
		// Get influence from connected nodes
		let influence = 0
		this.connections.forEach((node) => {
			if (node.intensity > 0.2) {
				influence += node.intensity * 0.3
			}
		})

		// Autonomous pulse + social influence
		const autonomousPulse = Math.sin(time * this.frequency + this.phase)
		this.intensity =
			this.baseIntensity * Math.max(0, autonomousPulse * 0.7 + influence)
	}

	render(ctx) {
		if (this.intensity > 0.05) {
			const radius = 2 + this.intensity * 8
			const alpha = Math.min(this.intensity * 1.5, 0.9)

			// Glow
			const gradient = ctx.createRadialGradient(
				this.x,
				this.y,
				0,
				this.x,
				this.y,
				radius * 2
			)
			gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.3})`)
			gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

			ctx.fillStyle = gradient
			ctx.beginPath()
			ctx.arc(this.x, this.y, radius * 2, 0, Math.PI * 2)
			ctx.fill()

			// Core
			ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
			ctx.beginPath()
			ctx.arc(this.x, this.y, radius * 0.3, 0, Math.PI * 2)
			ctx.fill()
		}
	}
}

class NeuralGrid {
	constructor(canvas) {
		this.canvas = canvas
		this.ctx = canvas.getContext('2d')
		this.nodes = []
		this.gridSize = 60
		this.time = 0
		this.animationId = null

		this.resize()
		this.createGrid()
		this.createConnections()
		this.animate()
	}

	resize() {
		this.canvas.width = this.canvas.offsetWidth * devicePixelRatio
		this.canvas.height = this.canvas.offsetHeight * devicePixelRatio
		this.ctx.scale(devicePixelRatio, devicePixelRatio)
	}

	createGrid() {
		const w = this.canvas.offsetWidth
		const h = this.canvas.offsetHeight

		for (let x = this.gridSize; x < w; x += this.gridSize) {
			for (let y = this.gridSize; y < h; y += this.gridSize) {
				this.nodes.push(new Node(x, y))
			}
		}
	}

	createConnections() {
		this.nodes.forEach((node) => {
			this.nodes.forEach((other) => {
				if (node !== other) {
					const dx = node.x - other.x
					const dy = node.y - other.y
					const distance = Math.sqrt(dx * dx + dy * dy)

					if (distance <= this.gridSize * 1.5 && Math.random() > 0.3) {
						node.connections.push(other)
					}
				}
			})
		})
	}

	animate() {
		const w = this.canvas.offsetWidth
		const h = this.canvas.offsetHeight

		// Clear canvas
		this.ctx.fillStyle = '#111114'
		this.ctx.fillRect(0, 0, w, h)

		// Draw grid lines
		this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)'
		this.ctx.lineWidth = 1

		for (let x = 0; x <= w; x += this.gridSize) {
			this.ctx.beginPath()
			this.ctx.moveTo(x, 0)
			this.ctx.lineTo(x, h)
			this.ctx.stroke()
		}

		for (let y = 0; y <= h; y += this.gridSize) {
			this.ctx.beginPath()
			this.ctx.moveTo(0, y)
			this.ctx.lineTo(w, y)
			this.ctx.stroke()
		}

		// Update and render nodes
		this.nodes.forEach((node) => {
			node.update(this.time, this.nodes)
			node.render(this.ctx)
		})

		// Draw connections between active nodes
		this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
		this.ctx.lineWidth = 1

		this.nodes.forEach((node) => {
			if (node.intensity > 0.1) {
				node.connections.forEach((other) => {
					if (other.intensity > 0.2) {
						const alpha = (node.intensity + other.intensity) * 0.4
						this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
						this.ctx.beginPath()
						this.ctx.moveTo(node.x, node.y)
						this.ctx.lineTo(other.x, other.y)
						this.ctx.stroke()
					}
				})
			}
		})

		this.time += 1
		this.animationId = requestAnimationFrame(() => this.animate())
	}

	kill() {
		if (this.animationId) {
			cancelAnimationFrame(this.animationId)
		}
	}
}

let gridInstance = null

export default function initPanelNode() {
	const canvas = document.getElementById('node-canvas')

	if (!canvas) return
	gridInstance = new NeuralGrid(canvas)
	return gridInstance
}

export function killPanelNode() {
	if (gridInstance) {
		gridInstance.kill()
	}
}
