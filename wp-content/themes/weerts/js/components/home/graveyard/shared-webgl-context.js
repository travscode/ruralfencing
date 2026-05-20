// OptimizedContainerManager.js
import * as THREE from 'three'

class OptimizedContainerManager {
	constructor() {
		this.scenes = new Map()
		this.activeScenes = new Set()
		this.isInitialized = false

		// Single shared renderer with optimized settings
		this.renderer = null
		this.renderTargets = new Map() // Reusable render targets
		this.currentContainer = null

		// Performance tracking
		this.stats = {
			fps: 0,
			frameCount: 0,
			lastTime: performance.now(),
		}

		// Optimization flags
		this.isRenderingActive = false
		this.pendingResize = new Set()
		this.resizeTimeout = null

		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => this.init())
		} else {
			this.init()
		}
	}

	init() {
		if (this.isInitialized) return

		// Create single shared renderer with optimal settings
		this.renderer = new THREE.WebGLRenderer({
			antialias: false, // Disable for performance
			alpha: false,
			powerPreference: 'high-performance',
			preserveDrawingBuffer: false,
			stencil: false, // Disable stencil buffer
			depth: true,
		})

		// Conservative pixel ratio
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

		// Disable shadows initially - enable per scene if needed
		this.renderer.shadowMap.enabled = false

		// Optimize renderer settings
		this.renderer.sortObjects = false // Skip sorting for performance
		this.renderer.autoClear = true
		this.renderer.autoClearColor = true
		this.renderer.autoClearDepth = true

		// Setup handlers
		this.setupVisibilityHandler()
		this.setupResizeHandler()
		this.startRenderLoop()

		this.isInitialized = true
	}

	registerScene(containerId, createSceneFunction, options = {}) {
		if (this.scenes.has(containerId)) {
			console.warn(`Scene ${containerId} already registered`)
			return
		}

		const sceneConfig = {
			id: containerId,
			createSceneFunction,
			container: null,
			canvas: null,
			context: null, // Store 2D context
			scene: null,
			camera: null,
			animations: [],
			isVisible: false,
			isInitialized: false,
			isPaused: false,
			lastRenderTime: 0,
			frameSkip: 1,
			priority: options.priority || 1,
			observer: null,
			onAnimate: null,
			dispose: null,
			resources: new Set(),
			// Cache dimensions to avoid repeated DOM queries
			cachedWidth: 0,
			cachedHeight: 0,
			needsResize: false,
			...options,
		}

		this.scenes.set(containerId, sceneConfig)
		this.tryInitializeScene(containerId)
	}

	tryInitializeScene(containerId) {
		const config = this.scenes.get(containerId)
		if (!config || config.isInitialized) return

		const container = document.getElementById(containerId)
		if (!container) {
			setTimeout(() => this.tryInitializeScene(containerId), 100)
			return
		}

		config.container = container

		// Create optimized canvas
		this.createOptimizedCanvas(config)

		// Pre-cache dimensions
		this.updateCachedDimensions(config)

		// Create scene with batched initialization
		requestIdleCallback(
			() => {
				this.initializeSceneContent(config)
			},
			{ timeout: 1000 }
		)
	}

	createOptimizedCanvas(config) {
		config.canvas = document.createElement('canvas')
		config.context = config.canvas.getContext('2d', {
			alpha: false,
			desynchronized: true, // Allow async rendering
		})

		// Optimize canvas styling
		const canvas = config.canvas
		canvas.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			image-rendering: pixelated;
		`

		config.container.style.position = 'relative'
		config.container.appendChild(canvas)
	}

	initializeSceneContent(config) {
		try {
			const sceneData = config.createSceneFunction({
				element: config.container,
				renderer: this.renderer,
				addAnimation: (callback) => this.addAnimation(config.id, callback),
				removeAnimation: (callback) =>
					this.removeAnimation(config.id, callback),
			})

			config.scene = sceneData.scene
			config.camera = sceneData.camera
			config.onAnimate = sceneData.onAnimate
			config.dispose = sceneData.dispose

			if (sceneData.resources) {
				sceneData.resources.forEach((resource) =>
					config.resources.add(resource)
				)
			}

			config.isInitialized = true

			// Setup intersection observer with optimized settings
			this.setupIntersectionObserver(config)
		} catch (error) {
			console.error(`Failed to initialize scene ${config.id}:`, error)
		}
	}

	setupIntersectionObserver(config) {
		const options = {
			threshold: [0, 0.25, 0.75], // Fewer thresholds
			rootMargin: '100px 0px', // Larger margin for smoother transitions
		}

		config.observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				const wasVisible = config.isVisible
				config.isVisible = entry.isIntersecting

				if (entry.isIntersecting && !wasVisible) {
					// Smooth activation
					requestAnimationFrame(() => {
						this.activateScene(config)
					})
				} else if (!entry.isIntersecting && wasVisible) {
					this.deactivateScene(config)
				}

				// Optimized quality adjustment
				if (entry.isIntersecting) {
					config.frameSkip =
						entry.intersectionRatio > 0.75
							? 1
							: entry.intersectionRatio > 0.25
							? 2
							: 3
				}
			})
		}, options)

		config.observer.observe(config.container)
	}

	activateScene(config) {
		this.activeScenes.add(config.id)
		config.isPaused = false
		this.updateCachedDimensions(config)
	}

	deactivateScene(config) {
		this.activeScenes.delete(config.id)
		config.isPaused = true
	}

	updateCachedDimensions(config) {
		const rect = config.container.getBoundingClientRect()
		const newWidth = Math.floor(rect.width)
		const newHeight = Math.floor(rect.height)

		if (config.cachedWidth !== newWidth || config.cachedHeight !== newHeight) {
			config.cachedWidth = newWidth
			config.cachedHeight = newHeight
			config.needsResize = true
		}
	}

	setupResizeHandler() {
		const handleResize = () => {
			// Batch resize operations
			this.scenes.forEach((config) => {
				if (config.isVisible) {
					this.updateCachedDimensions(config)
				}
			})

			// Debounce resize operations
			if (this.resizeTimeout) {
				clearTimeout(this.resizeTimeout)
			}

			this.resizeTimeout = setTimeout(() => {
				this.processQueuedResizes()
			}, 16) // ~1 frame delay
		}

		window.addEventListener('resize', handleResize, { passive: true })
	}

	processQueuedResizes() {
		this.scenes.forEach((config) => {
			if (config.needsResize && config.isVisible) {
				this.resizeCanvas(config)
				config.needsResize = false
			}
		})
	}

	resizeCanvas(config) {
		const width = config.cachedWidth
		const height = config.cachedHeight

		if (width <= 0 || height <= 0) return

		// Only resize if dimensions actually changed
		if (config.canvas.width === width && config.canvas.height === height) {
			return
		}

		config.canvas.width = width
		config.canvas.height = height

		// Update camera aspect ratio
		if (config.camera && config.camera.aspect !== width / height) {
			config.camera.aspect = width / height
			config.camera.updateProjectionMatrix()
		}
	}

	addAnimation(sceneId, callback) {
		const config = this.scenes.get(sceneId)
		if (config) {
			config.animations.push(callback)
		}
	}

	removeAnimation(sceneId, callback) {
		const config = this.scenes.get(sceneId)
		if (config) {
			const index = config.animations.indexOf(callback)
			if (index > -1) {
				config.animations.splice(index, 1)
			}
		}
	}

	startRenderLoop() {
		const clock = new THREE.Clock()
		let frameCounter = 0

		const render = (currentTime) => {
			if (this.isRenderingActive) {
				requestAnimationFrame(render)
				return // Skip this frame to prevent overlap
			}

			this.isRenderingActive = true
			requestAnimationFrame(render)

			frameCounter++
			const deltaTime = Math.min(clock.getDelta(), 0.1) // Cap delta time
			const elapsedTime = clock.getElapsedTime()

			// Update stats less frequently
			if (frameCounter % 60 === 0) {
				this.updateStats()
			}

			// Process queued resizes
			if (frameCounter % 10 === 0) {
				this.processQueuedResizes()
			}

			// Render scenes with priority sorting
			const sortedScenes = Array.from(this.activeScenes)
				.map((id) => this.scenes.get(id))
				.filter((config) => config && !config.isPaused && config.isInitialized)
				.sort((a, b) => b.priority - a.priority)

			for (const config of sortedScenes) {
				// Skip frames based on quality setting
				if (frameCounter % config.frameSkip !== 0) continue

				// Minimum frame time check
				const timeSinceLastRender = currentTime - config.lastRenderTime
				const minFrameTime = 16.67 * config.frameSkip

				if (timeSinceLastRender >= minFrameTime) {
					config.lastRenderTime = currentTime
					this.renderScene(config, deltaTime, elapsedTime)
				}
			}

			this.isRenderingActive = false
		}

		render(performance.now())
	}

	renderScene(config, deltaTime, elapsedTime) {
		const width = config.cachedWidth
		const height = config.cachedHeight

		if (width === 0 || height === 0) return

		// Handle resize if needed
		if (config.needsResize) {
			this.resizeCanvas(config)
			config.needsResize = false
		}

		// Run animations in try-catch to prevent one bad animation from breaking others
		for (const animation of config.animations) {
			try {
				animation(deltaTime, elapsedTime)
			} catch (error) {
				console.error(`Animation error in scene ${config.id}:`, error)
			}
		}

		// Run scene-specific animation
		if (config.onAnimate) {
			try {
				config.onAnimate(deltaTime, elapsedTime)
			} catch (error) {
				console.error(`Scene animation error in ${config.id}:`, error)
			}
		}

		// Set renderer size only if changed
		const currentSize = this.renderer.getSize(new THREE.Vector2())
		if (currentSize.x !== width || currentSize.y !== height) {
			this.renderer.setSize(width, height, false)
		}

		// Render scene
		this.renderer.render(config.scene, config.camera)

		// Direct canvas copy - much faster than getImageData
		const ctx = config.context
		ctx.clearRect(0, 0, width, height)
		ctx.drawImage(this.renderer.domElement, 0, 0, width, height)
	}

	setupVisibilityHandler() {
		document.addEventListener(
			'visibilitychange',
			() => {
				if (document.hidden) {
					// Pause all scenes
					this.scenes.forEach((config) => {
						config.isPaused = true
					})
				} else {
					// Resume visible scenes with a slight delay
					setTimeout(() => {
						this.scenes.forEach((config) => {
							if (config.isVisible) {
								config.isPaused = false
							}
						})
					}, 100)
				}
			},
			{ passive: true }
		)
	}

	updateStats() {
		const now = performance.now()
		this.stats.frameCount++

		if (now - this.stats.lastTime >= 1000) {
			this.stats.fps = this.stats.frameCount
			this.stats.frameCount = 0
			this.stats.lastTime = now
		}
	}

	disposeScene(sceneId) {
		const config = this.scenes.get(sceneId)
		if (!config) return

		// Stop observing
		if (config.observer) {
			config.observer.disconnect()
		}

		// Remove canvas
		if (config.canvas && config.canvas.parentNode) {
			config.canvas.parentNode.removeChild(config.canvas)
		}

		// Call custom dispose
		if (config.dispose) {
			config.dispose()
		}

		// Dispose resources
		config.resources.forEach((resource) => {
			if (resource && resource.dispose) {
				resource.dispose()
			}
		})

		// Clear references
		config.scene = null
		config.camera = null
		config.animations = []
		config.resources.clear()

		// Clean up from active scenes
		this.activeScenes.delete(sceneId)
		this.scenes.delete(sceneId)
	}

	dispose() {
		// Clear timeouts
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout)
		}

		// Dispose all scenes
		for (const sceneId of this.scenes.keys()) {
			this.disposeScene(sceneId)
		}

		// Dispose renderer
		if (this.renderer) {
			this.renderer.dispose()
		}
	}

	getStats() {
		return {
			fps: this.stats.fps,
			activeScenes: this.activeScenes.size,
			totalScenes: this.scenes.size,
			rendererInfo: this.renderer ? this.renderer.info : null,
		}
	}
}

// Create singleton
const singleContextManager = new OptimizedContainerManager()
export default singleContextManager
