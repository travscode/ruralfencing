import * as THREE from 'three'
import FBOParticleSystem from './fbo-particle-system'
import SphereDataGenerator from './sphere-geometry'
import { SimulationMaterial } from './shaders/new/SimulationMaterial'
import { RenderMaterial } from './shaders/SphereMaterial'
import { CubeOutline } from './cube-geometry'
import { HeroAnimationController } from './hero-animation-controller'

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import ImagePanel from './image-panel'

let fboApp = null

// Main Application Class
class FBOSphereApp {
	constructor() {
		this.container = document.getElementById('home-three-hero')

		if (!this.container) return

		const rect = this.container.getBoundingClientRect()
		this.width = rect.width
		this.height = rect.height

		this.time = 0
		this.clock = new THREE.Clock()
		this.lastTime = 0
		this.timeScale = 1.0

		// Visibility and performance control
		this.isVisible = true
		this.isPaused = false
		this.animationId = null

		this.isMobile = window.innerWidth <= 768

		// Mouse tracking with smoothing
		this.mouse = new THREE.Vector2()
		this.mouseWorldPos = new THREE.Vector3(99999, 99999, 99999)
		this.smoothMousePos = new THREE.Vector3(99999, 99999, 99999)
		this.prevMousePos = new THREE.Vector3(99999, 99999, 99999)
		this.mouseVelocity = new THREE.Vector3()
		this.raycaster = new THREE.Raycaster()
		this.mouseSmoothingFactor = 0.15
		this.velocityDecay = 0.01
		this.mouseInactiveTime = 0
		this.chromaticAberrationPass = null
		this.renderMaterial = null

		this.init()
		this.setupPostProcessing()
		this.setupEventListeners()
		this.setupAnimations()
		this.animate()
	}

	init() {
		this.graphics = new GraphicsManager(this.width, this.height)
		this.scene = new SceneManager()
		this.particleSystem = new ParticleSystem(this.graphics.getRenderer())
		this.cubeOutline = new CubeOutline()
		this.imagePanel = new ImagePanel(
			this.scene,
			this.graphics.getCamera(),
			this.graphics.getRenderer()
		)

		this.scene.add(this.cubeOutline.getMesh())
		this.scene.add(this.cubeOutline.getVertexPluses())
		this.scene.add(this.particleSystem.getParticles())
	}

	setupPostProcessing() {
		// Create effect composer
		this.composer = new EffectComposer(this.graphics.getRenderer())

		// Add render pass
		this.renderPass = new RenderPass(
			this.scene.getScene(),
			this.graphics.getCamera()
		)
		this.composer.addPass(this.renderPass)

		// Add chromatic aberration pass
		this.chromaticAberrationPass = new ShaderPass(chromaticAberrationShader)
		this.composer.addPass(this.chromaticAberrationPass)

		// Add output pass for tone mapping
		this.outputPass = new OutputPass()
		this.composer.addPass(this.outputPass)
	}

	pause() {
		// Only used for page visibility changes, not viewport exit
		if (this.isPaused) return

		this.isPaused = true

		// Cancel the animation frame
		if (this.animationId) {
			cancelAnimationFrame(this.animationId)
			this.animationId = null
		}

		// Pause the clock to prevent time jumps when resuming
		this.clock.stop()
	}

	resume() {
		// Only used for page visibility changes, not viewport entry
		if (!this.isPaused) return

		this.isPaused = false

		// Resume the clock
		this.clock.start()

		// Restart the animation loop
		this.animate()
	}

	setupAnimations() {
		// Initialize the animation controller
		this.animationController = new HeroAnimationController(this)
	}

	setupEventListeners() {
		this.setupContainerResizeObserver()

		// Mobile detection
		this.isMobile = window.innerWidth <= 768

		// Only add mouse/touch tracking on desktop
		if (!this.isMobile) {
			window.addEventListener('mousemove', (event) => this.onMouseMove(event))
		}

		// Page visibility API for additional performance control
		document.addEventListener('visibilitychange', () => {
			if (document.hidden && !this.isPaused) {
				this.pause()
			} else if (!document.hidden && this.isPaused && this.isVisible) {
				this.resume()
			}
		})
	}

	onMouseMove(event) {
		// Only process mouse events if not paused
		if (this.isPaused) return

		// Convert mouse coordinates to normalized device coordinates (-1 to +1)
		this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
		this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

		this.isMouseActive = true
		this.mouseInactiveTime = 0
		this.updateMouseWorldPosition()
	}

	onTouchMove(event) {
		// Only process touch events if not paused
		if (this.isPaused) return

		if (event.touches.length > 0) {
			const touch = event.touches[0]
			this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1
			this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1

			this.isMouseActive = true
			this.mouseInactiveTime = 0
			this.updateMouseWorldPosition()
		}
	}

	updateMouseWorldPosition() {
		// Cast a ray from the camera through the mouse position
		this.raycaster.setFromCamera(this.mouse, this.graphics.getCamera())

		// Project the mouse position onto a plane at z=0 (where particles roughly exist)
		const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
		const intersectPoint = new THREE.Vector3()
		this.raycaster.ray.intersectPlane(plane, intersectPoint)

		if (intersectPoint) {
			// Store previous position for velocity calculation
			this.prevMousePos.copy(this.mouseWorldPos)
			this.mouseWorldPos.copy(intersectPoint)

			// Calculate velocity
			this.mouseVelocity.subVectors(this.mouseWorldPos, this.prevMousePos)
		}
	}

	updateMouseSmoothing() {
		// Less aggressive smoothing for immediate response
		this.smoothMousePos.lerp(this.mouseWorldPos, this.mouseSmoothingFactor)

		// Apply velocity decay
		this.mouseVelocity.multiplyScalar(this.velocityDecay)

		// Track mouse inactivity with faster recovery
		if (!this.isMouseActive) {
			this.mouseInactiveTime += 0.016 // Frame time
		} else {
			this.isMouseActive = false
		}

		// Pass the mouse data to the particle system
		this.particleSystem.updateMouseData(
			this.smoothMousePos,
			this.mouseVelocity,
			this.mouseInactiveTime
		)
	}

	setupContainerResizeObserver() {
		const container = document.getElementById('home-three-hero')
		if (!container) return

		// Use ResizeObserver to watch the container specifically
		this.resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect

				// Only resize if dimensions actually changed significantly
				if (
					Math.abs(width - this.width) > 1 ||
					Math.abs(height - this.height) > 1
				) {
					this.onContainerResize(width, height)
				}
			}
		})

		this.resizeObserver.observe(container)
	}

	onContainerResize(width, height) {
		const wasMobile = this.isMobile
		this.isMobile = window.innerWidth <= 768

		this.width = width
		this.height = height
		this.graphics.updateAspect(width, height)
		this.graphics.resize(width, height)
		this.composer.setSize(width, height)
	}

	animate() {
		this.animationId = requestAnimationFrame(() => this.animate())

		// Calculate delta time (in seconds) since last frame
		const elapsedTime = this.clock.getElapsedTime()
		const deltaTime = elapsedTime - this.lastTime
		this.lastTime = elapsedTime

		// Update time with proper delta, scaled by timeScale
		this.time += deltaTime * this.timeScale

		// Use deltaTime for all time-based animations to ensure consistent speed
		const rotationSpeed = 0.3 * deltaTime // ~0.005 per frame at 60fps

		this.updateMouseSmoothing()

		this.cubeOutline.rotate(rotationSpeed)
		this.cubeOutline.updatePlusesFacing(this.getCamera())

		// Update particle system with time
		this.particleSystem.update(this.time)

		this.composer.render()
	}

	dispose() {
		// Clean up resize observer
		if (this.resizeObserver) {
			this.resizeObserver.disconnect()
			this.resizeObserver = null
		}

		// Cancel any pending animation frame
		if (this.animationId) {
			cancelAnimationFrame(this.animationId)
		}

		// Clean up post-processing
		if (this.composer) {
			this.composer.dispose()
		}

		this.particleSystem.dispose()
		this.cubeOutline.dispose()
		this.graphics.dispose()
		this.imagePanel.dispose()
	}

	// Public API for external control
	getAnimationController() {
		return this.animationController
	}

	getCamera() {
		return this.graphics.getCamera()
	}

	getSimulationMaterial() {
		return this.particleSystem.simulationMaterial
	}

	getCube() {
		return [this.cubeOutline.getMesh(), this.cubeOutline.getVertexPluses()]
	}

	getPostShader() {
		return this.chromaticAberrationPass
	}

	getImagePanel() {
		return this.imagePanel
	}

	getPanelMaterials() {
		return this.imagePanel.getpanelMaterials()
	}

	getTextMaterials() {
		return this.imagePanel.getTextMaterials()
	}

	// New method to get composer for advanced post-processing control
	getComposer() {
		return this.composer
	}

	getRenderMaterial() {
		return this.particleSystem.getRenderMaterial()
	}

	// Public methods for manual control
	manualPause() {
		this.pause()
	}

	manualResume() {
		if (this.isVisible) {
			this.resume()
		}
	}

	getStatus() {
		return {
			isVisible: this.isVisible,
			isPaused: this.isPaused,
			animationId: this.animationId,
		}
	}
}

// GraphicsManager with animated light
class GraphicsManager {
	constructor(width, height) {
		this.width = width
		this.height = height

		this.isMobile = window.innerWidth <= 768

		// Initialize renderer with enhanced settings for bloom
		this.webglRenderer = new THREE.WebGLRenderer({
			antialias: true,
		})

		this.webglRenderer.setPixelRatio(2)
		this.webglRenderer.setSize(width, height)
		this.webglRenderer.setClearColor(0x000000)

		// Enable tone mapping for better bloom results
		this.webglRenderer.toneMapping = THREE.ACESFilmicToneMapping
		this.webglRenderer.toneMappingExposure = 0.8

		const container = document.getElementById('home-three-hero')
		if (container) {
			container.appendChild(this.webglRenderer.domElement)
		}

		// Initialize camera
		this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000)
		this.camera.position.z = this.isMobile ? 500 : 300
	}

	updateAspect(width, height) {
		this.width = width
		this.height = height
		this.camera.aspect = width / height
		this.camera.updateProjectionMatrix()
	}

	resize(width, height) {
		this.webglRenderer.setSize(width, height)
	}

	render(scene) {
		this.webglRenderer.render(scene, this.camera)
	}

	getRenderer() {
		return this.webglRenderer
	}

	getCamera() {
		return this.camera
	}

	dispose() {
		this.webglRenderer.dispose()
	}
}

class SceneManager {
	constructor() {
		this.scene = new THREE.Scene()
	}

	add(object) {
		this.scene.add(object)
	}

	getScene() {
		return this.scene
	}
}

class ParticleSystem {
	constructor(renderer) {
		this.renderer = renderer
		this.textureSize = 200
		this.particleCount = this.textureSize * this.textureSize
		this.sphereSize = 100

		this.setupFBO()
		this.createMaterials()
		this.initializePositions()
	}

	setupFBO() {
		// Create FBO system
		this.fbo = new FBOParticleSystem(
			this.textureSize,
			this.textureSize,
			this.renderer
		)

		// Generate sphere data
		const sphereData = SphereDataGenerator.generateSphereData(
			this.particleCount,
			this.sphereSize
		)
		this.sphereTexture = SphereDataGenerator.createDataTexture(
			sphereData,
			this.textureSize,
			this.textureSize
		)
	}

	createMaterials() {
		this.simulationMaterial = new SimulationMaterial(
			this.sphereTexture,
			this.sphereSize
		)

		this.renderMaterial = new RenderMaterial()

		this.fbo.setMaterials(
			this.simulationMaterial.getMaterial(),
			this.renderMaterial.getMaterial()
		)
	}

	initializePositions() {
		// Initialize the FBO with sphere positions
		this.fbo.setInitialData(this.sphereTexture)
	}

	updateMouseData(mousePos, mouseVelocity, inactiveTime) {
		// Pass comprehensive mouse data to simulation material
		this.simulationMaterial.updateMouseData(
			mousePos,
			mouseVelocity,
			inactiveTime
		)
	}

	update(time) {
		this.simulationMaterial.updateTime(time)
		this.fbo.update()
	}

	getParticles() {
		return this.fbo.getParticles()
	}

	getRenderMaterial() {
		return this.renderMaterial
	}

	dispose() {
		if (this.fbo) {
			this.fbo.dispose()
		}
		if (this.sphereTexture) {
			this.sphereTexture.dispose()
		}
	}
}

// Export function to create and run the animation
export default function runHomeHeroAnimation() {
	const container = document.querySelector('#home-three-hero')

	if (!container) {
		return null
	}

	fboApp = new FBOSphereApp()
	return fboApp
}

export function killHomeHeroAnimation() {
	if (!fboApp) return
	fboApp.dispose()
	fboApp = null
}

const chromaticAberrationShader = {
	uniforms: {
		tDiffuse: { value: null },
		amount: { value: 0.0015 },
		angle: { value: 0.0 },
		edgeIntensity: { value: 2.0 },
		edgeFalloff: { value: 1.5 },
		vignetteIntensity: { value: 0.5 },
		vignetteSmoothness: { value: 0.5 },
		resolution: { value: new THREE.Vector2(1.0, 1.0) },
	},
	vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
	fragmentShader: /*glsl*/ `
				uniform sampler2D tDiffuse;
				uniform float amount;
				uniform float angle;
				uniform float edgeIntensity;
				uniform float edgeFalloff;
				uniform float vignetteIntensity;
				uniform float vignetteSmoothness;
				uniform vec2 resolution;
				varying vec2 vUv;

				void main() {
					vec2 coord = vUv;
					
					// Calculate distance from center with aspect ratio consideration
					vec2 centeredCoord = (coord - 0.5) * 2.0; // Range: -1 to 1
					float aspectRatio = resolution.x / resolution.y;
					centeredCoord.x *= aspectRatio;
					
					float distanceFromCenter = length(centeredCoord);
					
					// Apply sophisticated edge falloff
					float edgeMultiplier = pow(distanceFromCenter, edgeFalloff) * edgeIntensity;
					float effectiveAmount = amount * edgeMultiplier;
					
					// Calculate directional offset
					vec2 direction = vec2(cos(angle), sin(angle));
					vec2 offset = direction * effectiveAmount;
					
					// Enhanced chromatic aberration with slight variations per channel
					float r = texture2D(tDiffuse, coord + offset * 1.2).r;
					float g = texture2D(tDiffuse, coord + offset * 0.1).g;
					float b = texture2D(tDiffuse, coord - offset * 1.1).b;
					
					vec3 color = vec3(r, g, b);
					
					// Calculate vignette effect
					float vignette = 1.0 - smoothstep(
						1.0 - vignetteIntensity - vignetteSmoothness,
						1.0 - vignetteIntensity + vignetteSmoothness,
						distanceFromCenter
					);
					
					// Apply vignette to darken edges
					color *= vignette;
					
					gl_FragColor = vec4(color, 1.0);
				}
			`,
}
