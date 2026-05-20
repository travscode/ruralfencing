import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SpiralImages from './spiral-images'
import FBOParticleSystem from './home-hero/fbo-particle-system'
import SphereDataGenerator from './home-hero/sphere-geometry'
import { SimulationMaterial } from './home-hero/shaders/SimulationMaterial'
import { RenderMaterial } from './home-hero/shaders/SphereMaterial'
import { HeroAnimationController } from './home-hero/hero-animation-controller'
import ImagePanel from './home-hero/image-panel'
import { getLenis } from '../../utils/smooth-scroll'
import WhiteFresnelMaterial from './fresnel-material'

gsap.registerPlugin(ScrollTrigger)

/**
 * Container configuration for managing multiple viewports with shared camera
 */
class ContainerConfig {
	constructor(containerId, priority = 0) {
		this.containerId = containerId
		this.priority = priority
		this.element = null
		this.bounds = null
		this.isVisible = false
		this.composer = null
		this.intersectionObserver = null
		this.resizeObserver = null

		this.mouse = new THREE.Vector2()
		this.mouseWorldPos = new THREE.Vector3(99999, 99999, 99999)
		this.isHovering = false
		this.scrollProgress = 0
	}
}

/**
 * UnifiedHeroSceneManager - Single scene with shared camera rendered to multiple containers
 */
class UnifiedHeroSceneManager {
	constructor() {
		// Canvas and renderer
		this.canvas = null
		this.renderer = null
		this.clock = new THREE.Clock()

		// Single scene and SHARED camera
		this.backgroundScene = null // For particles

		this.camera = null // This will be the shared camera for all containers
		this.raycaster = new THREE.Raycaster()

		// Container management
		this.containers = new Map()
		this.activeContainers = []
		this.primaryContainer = null // The container that drives camera aspect ratio

		// Scene elements
		this.fbo = null
		this.simulationMaterial = null
		this.renderMaterial = null
		this.imagePanel = null
		this.webbyModel = null
		this.webbyGroup = null
		this.lenis = getLenis()
		this.direction = 1

		// Shared state
		this.time = 0
		this.scrollY = 0
		this.prevScrollY = 0

		const tempElement = document.createElement('div')
		tempElement.style.height = '100lvh'
		tempElement.style.width = '100lvw'
		tempElement.style.position = 'absolute'
		tempElement.style.visibility = 'hidden'
		document.body.appendChild(tempElement)

		this.viewportWidth = tempElement.offsetWidth
		this.viewportHeight = tempElement.offsetHeight

		document.body.removeChild(tempElement)
		this.dpr = window.devicePixelRatio

		// Animation
		this.animationId = null
		this.isAnimating = false

		// Mouse tracking (shared)
		this.mouseData = {
			smoothMousePos: new THREE.Vector3(99999, 99999, 99999),
			mouseVelocity: new THREE.Vector3(),
			mouseInactiveTime: 0,
		}

		this.cameraParallax = {
			globalMouse: new THREE.Vector2(0, 0),
			targetPosition: new THREE.Vector3(0, 0, 0), // Only X,Y will be used
			currentPosition: new THREE.Vector3(0, 0, 0),
			strength: 40, // Adjust this value to control parallax intensity
			enabled: window.innerWidth > 768, // Disable on mobile
		}

		// Webby model state
		this.webbyState = {
			scrollProgress: 0,
			targetRotation: { x: 0, y: 0, z: 0 },
			currentRotation: { x: 0, y: 0, z: 0 },
			isHovering: false,
			basePosition: new THREE.Vector3(0, 0, 0),
			targetPosition: new THREE.Vector3(0, 0, 0),
			currentPosition: new THREE.Vector3(0, 0, 0),
		}

		this.init()
	}

	init() {
		// Register containers
		this.registerContainer('home-three-hero', 1) // Primary container (drives camera aspect)
		this.registerContainer('home-three-awards', 0) // Secondary container

		// Set primary container
		this.primaryContainer =
			this.containers.get('home-three-hero') ||
			Array.from(this.containers.values())[0]

		// Check if any containers exist
		if (this.containers.size === 0) {
			return
		}

		this.setupCanvas()
		this.setupRenderer()
		this.setupScene()
		this.setupEventListeners()
		this.updateAllBounds()

		// Initialize animation controller after scene setup
		if (this.primaryContainer?.element) {
			this.animationController = new HeroAnimationController(this)
			this.animationController.playIntroTimeline()
		}

		this.startAnimation()
	}

	registerContainer(containerId, priority = 0) {
		const element = document.getElementById(containerId)
		if (!element) {
			return
		}

		const config = new ContainerConfig(containerId, priority)
		config.element = element

		this.containers.set(containerId, config)
		this.setupContainerObservers(config)
		this.setupContainerInteractions(config)
	}

	setupContainerObservers(config) {
		// Intersection observer for visibility
		config.intersectionObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.target === config.element) {
						config.isVisible = entry.isIntersecting
						this.updateActiveContainers()
					}
				})
			},
			{ rootMargin: '100px' }
		)
		config.intersectionObserver.observe(config.element)

		// Resize observer
		config.resizeObserver = new ResizeObserver(() => {
			this.updateContainerBounds(config)
			this.updateSharedCameraAspect()
			ScrollTrigger.refresh()
		})
		config.resizeObserver.observe(config.element)
	}

	setupContainerInteractions(config) {
		const isMobile = window.innerWidth <= 768
		if (isMobile) return

		config.element.style.pointerEvents = 'auto'

		config.element.addEventListener('mouseenter', () => {
			config.isHovering = true
			this.webbyState.isHovering = true
		})

		config.element.addEventListener('mouseleave', () => {
			config.isHovering = false
			// Only reset if no other containers are hovering
			const anyHovering = Array.from(this.containers.values()).some(
				(c) => c.isHovering
			)
			this.webbyState.isHovering = anyHovering

			if (!anyHovering) {
				this.webbyState.targetRotation.x = 0
				this.webbyState.targetRotation.z = 0
			}
		})

		config.element.addEventListener('mousemove', (e) => {
			if (!config.isHovering || !this.webbyGroup?.visible) return

			const rect = config.element.getBoundingClientRect()
			const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1
			const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1

			// Update container-specific mouse position
			config.mouse.set(mouseX, mouseY)

			// Update world mouse position for FBO particles using shared camera
			if (config.isVisible) {
				this.raycaster.setFromCamera(config.mouse, this.camera)
				const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
				const intersectPoint = new THREE.Vector3()
				this.raycaster.ray.intersectPlane(plane, intersectPoint)

				if (intersectPoint) {
					config.mouseWorldPos.copy(intersectPoint)
					this.mouseData.mouseInactiveTime = 0
				}
			}

			// Update Webby rotation based on mouse
			this.webbyState.targetRotation.x = mouseY * 0.25
			const scrollRotation = this.webbyState.scrollProgress * Math.PI * 0.25
			this.webbyState.targetRotation.y = scrollRotation + mouseX * 0.95

			const dist = Math.sqrt(mouseX * mouseX + mouseY * mouseY)
			this.webbyState.targetRotation.z = mouseX * 0.1 * dist * 0.5
		})
	}

	updateActiveContainers() {
		this.activeContainers = Array.from(this.containers.values())
			.filter((config) => config.isVisible)
			.sort((a, b) => b.priority - a.priority) // Sort by priority (highest first)
	}

	updateSharedCameraAspect() {
		// Update camera aspect ratio based on primary container
		if (this.primaryContainer?.bounds && this.camera) {
			this.camera.aspect =
				this.primaryContainer.bounds.width / this.primaryContainer.bounds.height
			this.camera.updateProjectionMatrix()
		}
	}

	setupCanvas() {
		this.canvas = document.createElement('canvas')
		this.canvas.id = 'unified-canvas'
		this.canvas.style.position = 'fixed'
		this.canvas.style.top = '0'
		this.canvas.style.left = '0'
		this.canvas.style.width = '100%'
		this.canvas.style.height = '100%'
		this.canvas.style.pointerEvents = 'none'
		this.canvas.style.zIndex = '1'
		document.querySelector('main').appendChild(this.canvas)
	}

	setupRenderer() {
		const isMobile = window.innerWidth <= 768

		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			powerPreference: 'high-performance',
			precision: isMobile ? 'mediump' : 'highp',
		})

		this.renderer.setSize(this.viewportWidth, this.viewportHeight)
		// Reduce pixel ratio on mobile
		const maxPixelRatio = isMobile ? 1.5 : 2
		this.renderer.setPixelRatio(
			Math.min(window.devicePixelRatio, maxPixelRatio)
		)

		// Simpler shadows on mobile
		this.renderer.shadowMap.enabled = !isMobile
		this.renderer.setClearColor(0x111114, 0)
		this.renderer.autoClear = false

		// Enable features needed for both FBO and model
		this.renderer.shadowMap.enabled = true
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping
		this.renderer.toneMappingExposure = 0.8
	}

	setupScene() {
		// Create scene
		this.backgroundScene = new THREE.Scene()
		this.backgroundScene.background = new THREE.Color(0x111114)

		// Create SHARED camera - this will be used by all containers and animations
		this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000)

		const isMobile = window.innerWidth <= 768
		this.camera.position.z = isMobile ? 500 : 300

		// Setup FBO Particle System
		this.setupFBOSystem()

		// Setup Image Panel (using shared camera)
		this.setupImagePanel()

		// Setup Webby Model
		this.setupWebbyModel()

		// Setup post-processing for each container (using shared camera)
		this.setupPostProcessing()

		// Update camera aspect ratio
		this.updateSharedCameraAspect()
	}

	setupFBOSystem() {
		const isMobile = window.innerWidth <= 768
		const textureSize = isMobile ? 64 : 175
		const particleCount = textureSize * textureSize
		const sphereSize = 100

		this.fbo = new FBOParticleSystem(textureSize, textureSize, this.renderer)
		const sphereData = SphereDataGenerator.generateSphereData(
			particleCount,
			sphereSize
		)

		const sphereTexture = SphereDataGenerator.createDataTexture(
			sphereData,
			textureSize,
			textureSize
		)

		this.simulationMaterial = new SimulationMaterial(sphereTexture, sphereSize)
		this.renderMaterial = new RenderMaterial()

		this.fbo.setMaterials(
			this.simulationMaterial.getMaterial(),
			this.renderMaterial.getMaterial()
		)
		this.fbo.setInitialData(sphereTexture)

		this.backgroundScene.add(this.fbo.getParticles())
	}

	setupImagePanel() {
		this.imagePanel = new ImagePanel(
			this.backgroundScene,
			this.camera,
			this.renderer
		)
	}

	setupWebbyModel() {
		try {
			// Load environment texture
			const textureLoader = new THREE.TextureLoader()
			const envTexture = textureLoader.load(
				'/wp-content/themes/weerts/static/three/awards/test.jpg'
			)

			envTexture.mapping = THREE.EquirectangularReflectionMapping
			envTexture.colorSpace = THREE.SRGBColorSpace
			this.backgroundScene.environment = envTexture
			this.backgroundScene.environmentIntensity = 1

			// Load Webby model with proper callback
			const dracoLoader = new DRACOLoader()
			dracoLoader.setDecoderPath('/wp-content/themes/weerts/static/draco/')

			const gltfLoader = new GLTFLoader()
			gltfLoader.setDRACOLoader(dracoLoader)

			gltfLoader.load(
				'/wp-content/themes/weerts/static/three/awards/webby_2.glb',
				(gltf) => {
					// Success callback
					this.webbyModel = gltf.scene

					this.webbyModel.scale.setScalar(9.25)

					this.webbyModel.traverse((child) => {
						if (child.isMesh) {
							child.castShadow = true
							child.receiveShadow = true
						}

						if (child.name == 'webby-logo') {
							child.position.y = -3.7
						}
					})

					let sphere = new THREE.SphereGeometry(100, 32, 32)

					this.transmissionMaterial = new WhiteFresnelMaterial()

					this.sphereMesh = new THREE.Mesh(sphere, this.transmissionMaterial)

					// Create group for positioning
					this.webbyGroup = new THREE.Group()
					this.rotationGroup = new THREE.Group()

					this.webbyGroup.add(this.sphereMesh)
					this.rotationGroup.add(this.webbyModel)
					this.rotationGroup.rotation.set(-Math.PI / 16, 0, Math.PI / 8)

					this.webbyGroup.add(this.rotationGroup)
					this.webbyGroup.position.copy(this.webbyState.basePosition)
					this.webbyModel.rotation.set(0, 0, 0)
					this.webbyGroup.visible = true
					this.webbyGroup.scale.set(0, 0, 0)

					this.backgroundScene.add(this.webbyGroup)
				},
				undefined, // Progress callback
				(error) => {
					// Error callback
					console.warn('Failed to load Webby model:', error)
				}
			)

			// Initialize spiral images
			this.spiralImages = new SpiralImages()
			this.spiralImages.init().then(() => {
				this.backgroundScene.add(this.spiralImages.group)
			})
		} catch (error) {
			console.warn('Failed to load Webby model:', error)
		}
	}

	updateCameraParallax(deltaTime) {
		if (!this.cameraParallax.enabled || !this.camera) return

		// Smoothly interpolate camera position (only X and Y, preserve Z)
		this.cameraParallax.currentPosition.x +=
			(this.cameraParallax.targetPosition.x -
				this.cameraParallax.currentPosition.x) *
			0.05
		this.cameraParallax.currentPosition.y +=
			(this.cameraParallax.targetPosition.y -
				this.cameraParallax.currentPosition.y) *
			0.05

		// Apply to camera position (preserve original Z)
		this.camera.position.x = this.cameraParallax.currentPosition.x
		this.camera.position.y = this.cameraParallax.currentPosition.y
		// Note: camera.position.z is left untouched for external animations

		// Keep camera looking at center
		this.camera.lookAt(0, 0, 0)
	}

	setupPostProcessing() {
		this.containers.forEach((config) => {
			config.composer = new EffectComposer(this.renderer)

			const backgroundPass = new RenderPass(this.backgroundScene, this.camera)
			config.composer.addPass(backgroundPass)

			// Apply post-processing effects
			this.postShader = this.getChromaticAberrationShader()
			const chromaticPass = new ShaderPass(this.postShader)
			config.composer.addPass(chromaticPass)

			config.composer.addPass(new OutputPass())
		})

		this.composer = this.primaryContainer?.composer
	}

	setupEventListeners() {
		// Scroll handling
		window.addEventListener('scroll', () => this.onScroll(), { passive: true })

		// Global resize handling

		const heroEl = document.querySelector('#home-three-hero')

		// Create a ResizeObserver and store it on this
		this.resizeObserver = new ResizeObserver(() => {
			this.resize()
		})

		// Observe the hero element
		if (heroEl) {
			this.resizeObserver.observe(heroEl)
		}

		// Mouse move for FBO particles (global)
		const isMobile = window.innerWidth <= 768
		if (!isMobile) {
			window.addEventListener('mousemove', (e) => this.updateGlobalMouse(e))
		}

		// Visibility handling
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				this.pause()
			} else {
				this.resume()
			}
		})
	}

	updateGlobalMouse(event) {
		// Update global mouse position for containers that aren't being hovered
		const globalMouse = new THREE.Vector2()
		globalMouse.x = (event.clientX / window.innerWidth) * 2 - 1
		globalMouse.y = -(event.clientY / window.innerHeight) * 2 + 1

		if (this.cameraParallax.enabled) {
			this.cameraParallax.globalMouse.x =
				(event.clientX / window.innerWidth) * 2 - 1
			this.cameraParallax.globalMouse.y =
				-(event.clientY / window.innerHeight) * 2 + 1

			// Update camera parallax target position (only X and Y)
			this.cameraParallax.targetPosition.x =
				this.cameraParallax.globalMouse.x * this.cameraParallax.strength
			this.cameraParallax.targetPosition.y =
				this.cameraParallax.globalMouse.y * this.cameraParallax.strength
		}

		// Update mouse world position using the shared camera
		if (this.activeContainers.length > 0) {
			this.raycaster.setFromCamera(globalMouse, this.camera) // Using shared camera
			const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
			const intersectPoint = new THREE.Vector3()
			this.raycaster.ray.intersectPlane(plane, intersectPoint)

			if (intersectPoint) {
				// Use the most recent mouse position from any container
				let mostRecentMousePos = intersectPoint
				this.containers.forEach((config) => {
					if (config.isHovering && config.mouseWorldPos.x !== 99999) {
						mostRecentMousePos = config.mouseWorldPos
					}
				})

				this.mouseData.smoothMousePos.copy(mostRecentMousePos)
				this.mouseData.mouseInactiveTime = 0
			}
		}
	}

	onScroll() {
		this.scrollY = window.scrollY
		this.updateAllBounds()
	}

	updateAllBounds() {
		this.containers.forEach((config) => {
			this.updateContainerBounds(config)
		})
	}

	updateContainerBounds(config) {
		if (!config.element) return

		const rect = config.element.getBoundingClientRect()

		config.bounds = {
			width: rect.width,
			height: rect.height,
			left: rect.left + window.scrollX,
			top: rect.top + window.scrollY,
			right: rect.right + window.scrollX,
			bottom: rect.bottom + window.scrollY,
		}
	}

	animate() {
		if (!this.isAnimating) return

		this.animationId = requestAnimationFrame(() => this.animate())

		const deltaTime = this.clock.getDelta()
		const elapsedTime = this.clock.getElapsedTime()

		// Clear canvas
		this.renderer.clear()

		// Update scene elements
		this.updateFBOSystem(deltaTime, elapsedTime)
		this.updateWebbyModel(deltaTime, elapsedTime)
		this.updateCameraParallax(deltaTime)

		// Render to all active containers
		this.renderAllContainers()
	}

	updateFBOSystem(deltaTime, elapsedTime) {
		if (!this.fbo || !this.simulationMaterial) return

		// Update mouse smoothing
		this.mouseData.mouseVelocity.multiplyScalar(0.01)
		this.mouseData.mouseInactiveTime += deltaTime

		// Update simulation
		this.simulationMaterial.updateTime(elapsedTime)
		this.simulationMaterial.updateMouseData(
			this.mouseData.smoothMousePos,
			this.mouseData.mouseVelocity,
			this.mouseData.mouseInactiveTime
		)

		this.fbo.update()
	}

	updateWebbyModel(deltaTime, elapsedTime) {
		if (!this.webbyGroup || !this.webbyModel) return

		// Smooth position interpolation
		this.webbyState.currentPosition.lerp(this.webbyState.targetPosition, 0.05)
		this.webbyGroup.position.copy(this.webbyState.currentPosition)

		// Smooth rotation interpolation
		this.webbyState.currentRotation.x +=
			(this.webbyState.targetRotation.x - this.webbyState.currentRotation.x) *
			0.08
		this.webbyState.currentRotation.y +=
			(this.webbyState.targetRotation.y - this.webbyState.currentRotation.y) *
			0.08
		this.webbyState.currentRotation.z +=
			(this.webbyState.targetRotation.z - this.webbyState.currentRotation.z) *
			0.08

		this.webbyGroup.rotation.x = this.webbyState.currentRotation.x
		this.webbyGroup.rotation.y = this.webbyState.currentRotation.y
		this.webbyGroup.rotation.z = this.webbyState.currentRotation.z

		const lenisVelocity = this.lenis.velocity

		if (lenisVelocity > 0) {
			this.direction = 1
		} else if (lenisVelocity < 0) {
			this.direction = -1
		}

		this.webbyModel.rotation.y +=
			0.005 * this.direction + lenisVelocity * 0.0025

		// Floating animation
		this.webbyGroup.position.y = Math.sin(elapsedTime * 1.5) * 9

		const spiralLength = this.spiralImages.cylinders.length

		this.spiralImages.cylinders.forEach((cylinder, index) => {
			cylinder.rotation.y +=
				(1 + (spiralLength - index) * 0.6) * this.direction * 0.001 +
				(1 + (spiralLength - index) * 0.2) * lenisVelocity * 0.0015

			const cyl = this.spiralImages.bannerCylinders[index]
			if (cyl) {
				cyl.rotation.y -=
					(1 + (spiralLength - index) * 0.6) * this.direction * 0.001 +
					(1 + (spiralLength - index) * 0.2) * lenisVelocity * 0.0015
			}
		})
	}

	renderAllContainers() {
		// Render to each active container using the shared camera
		this.activeContainers.forEach((config) => {
			this.renderToContainer(config)
		})
	}

	renderToContainer(config) {
		if (!config.bounds || !config.isVisible) return

		// Calculate viewport position
		const viewportTop = this.scrollY
		const viewportBottom = viewportTop + this.viewportHeight

		// Check if container is in viewport
		if (
			config.bounds.bottom < viewportTop ||
			config.bounds.top > viewportBottom
		) {
			return
		}

		// Set up scissor and viewport
		const x = config.bounds.left - window.scrollX
		const y =
			this.viewportHeight -
			(config.bounds.top - this.scrollY + config.bounds.height)
		const width = config.bounds.width
		const height = config.bounds.height

		this.renderer.setScissor(x, y, width, height)
		this.renderer.setScissorTest(true)
		this.renderer.setViewport(x, y, width, height)

		// Render with container-specific composer (using shared camera)
		if (config.composer) {
			config.composer.setSize(width, height)
			config.composer.render()
		} else {
			this.renderer.render(this.scene, this.camera)
		}

		// Reset scissor test
		this.renderer.setScissorTest(false)
	}

	startAnimation() {
		if (this.isAnimating) return
		this.isAnimating = true
		this.updateActiveContainers()
		this.animate()
	}

	pause() {
		this.isAnimating = false
		if (this.animationId) {
			cancelAnimationFrame(this.animationId)
			this.animationId = null
		}
	}

	resume() {
		if (!this.isAnimating) {
			this.startAnimation()
		}
	}

	resize() {
		const tempElement = document.createElement('div')
		tempElement.style.height = '100lvh'
		tempElement.style.width = '100lvw'
		tempElement.style.position = 'absolute'
		tempElement.style.visibility = 'hidden'
		document.body.appendChild(tempElement)

		this.viewportWidth = tempElement.offsetWidth
		this.viewportHeight = tempElement.offsetHeight

		document.body.removeChild(tempElement)

		this.renderer.setSize(this.viewportWidth, this.viewportHeight)
		this.canvas.style.width = `${this.viewportWidth}px`
		this.canvas.style.height = `${this.viewportHeight}px`

		this.cameraParallax.enabled = window.innerWidth > 768

		this.updateAllBounds()
	}

	dispose() {
		this.pause()

		// Remove event listeners
		window.removeEventListener('scroll', this.onScroll)
		window.removeEventListener('mousemove', this.updateGlobalMouse)

		if (this.resizeObserver) {
			this.resizeObserver.disconnect()
			this.resizeObserver = null
		}

		// Disconnect observers for each container
		this.containers.forEach((config) => {
			if (config.resizeObserver) {
				config.resizeObserver.disconnect()
			}
			if (config.intersectionObserver) {
				config.intersectionObserver.disconnect()
			}
		})

		// Dispose Three.js objects
		if (this.scene) {
			this.scene.clear()
		}
		if (this.renderer) {
			this.renderer.dispose()
		}

		// Remove canvas
		if (this.canvas?.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas)
		}

		// Clear ScrollTrigger
		ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
		gsap.killTweensOf(this)
	}

	// Shader definitions
	getChromaticAberrationShader() {
		return {
			uniforms: {
				tDiffuse: { value: null },
				vignetteIntensity: { value: 0.5 },
				vignetteSmoothness: { value: 0.5 },
				vignetteAlpha: { value: 1.0 }, // Controls the alpha/opacity of the vignette
				resolution: { value: new THREE.Vector2(1.0, 1.0) },
			},
			vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`,
			fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse;
		uniform float vignetteIntensity;
		uniform float vignetteSmoothness;
		uniform float vignetteAlpha;
		uniform vec2 resolution;
		varying vec2 vUv;
		
		void main() {
			vec2 coord = vUv;
			vec2 centeredCoord = (coord - 0.5) * 2.0;
			float aspectRatio = resolution.x / resolution.y;
			centeredCoord.x *= aspectRatio;
			
			float distanceFromCenter = length(centeredCoord);
			
			// Get original color without any chromatic aberration
			vec3 color = texture2D(tDiffuse, coord).rgb;
			
			// Calculate vignette factor
			float vignetteRaw = 1.0 - smoothstep(
				1.0 - vignetteIntensity - vignetteSmoothness,
				1.0 - vignetteIntensity + vignetteSmoothness,
				distanceFromCenter
			);
			
			// Apply vignette alpha - blend between original color and vignetted color
			float vignette = mix(1.0, vignetteRaw, vignetteAlpha);
			
			color *= vignette;
			
			gl_FragColor = vec4(color, 1.0);
		}
	`,
		}
	}
}

// Export functions
let heroManager = null

export default function initUnifiedHeroScene() {
	// Check if any containers exist
	const heroContainer = document.querySelector('#home-three-hero')
	const awardContainer = document.querySelector('#three-hero-awards')

	if (!heroContainer && !awardContainer) {
		return null
	}

	heroManager = new UnifiedHeroSceneManager()
	return heroManager
}

export function disposeUnifiedHeroScene() {
	if (!heroManager) return
	heroManager.dispose()
	heroManager = null
}
