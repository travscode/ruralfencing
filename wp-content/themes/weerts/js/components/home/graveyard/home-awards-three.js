import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let awardsApp = null

const ColorGradingShader = {
	uniforms: {
		tDiffuse: { value: null },
		contrast: { value: 1.9 },
		brightness: { value: 0.275 },
		saturation: { value: 0.8 },
		shadows: { value: 0.0 },
		highlights: { value: 1.0 },
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
		uniform float contrast;
		uniform float brightness;
		uniform float saturation;
		uniform float shadows;
		uniform float highlights;
		varying vec2 vUv;

		vec3 adjustContrast(vec3 color, float contrast) {
			return (color - 0.5) * contrast + 0.5;
		}

		vec3 adjustSaturation(vec3 color, float saturation) {
			float gray = dot(color, vec3(0.299, 0.587, 0.114));
			return mix(vec3(gray), color, saturation);
		}

		void main() {
			vec4 color = texture2D(tDiffuse, vUv);
			
			// Apply brightness
			color.rgb += brightness;
			
			// Apply contrast
			color.rgb = adjustContrast(color.rgb, contrast);
			
			// Apply saturation
			color.rgb = adjustSaturation(color.rgb, saturation);
			
			// Shadow/highlight adjustment
			float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
			if (luminance < 0.5) {
				color.rgb *= mix(shadows, 1.0, luminance * 2.0);
			} else {
				color.rgb *= mix(1.0, highlights, (luminance - 0.5) * 2.0);
			}
			
			gl_FragColor = color;
		}
	`,
}

class HomeAwardsThree {
	constructor(container) {
		this.container = container
		this.model = null
		this.modelGroup = null
		this.scene = null
		this.camera = null
		this.renderer = null
		this.composer = null
		this.animationId = null
		this.scrollTrigger = null
		this.currentProgress = 0
		this.noisePass = null
		this.colorGradingPass = null
		this.isAnimating = false

		// Hover control properties
		this.isHovering = false
		this.mousePosition = { x: 0, y: 0 }
		this.targetRotation = { x: 0, y: 0, z: 0 }
		this.currentRotation = { x: 0, y: 0, z: 0 }
		this.targetPosition = { x: 0, y: 0, z: 0 }
		this.currentPosition = { x: 0, y: 0, z: 0 }
		this.rotationSensitivity = 0.4
		this.returnSpeed = 0.08
		this.tiltSensitivity = 0.4

		// Mobile detection
		this.isMobile = window.innerWidth <= 768

		this.init()
	}

	init() {
		this.createScene()
		this.createCamera()
		this.createRenderer()
		this.loadEnvironmentTexture()
		this.loadModel()
		this.setupPostProcessing()
		this.setupHoverControls()
		this.handleResize()
		this.startAnimation()
	}

	startAnimation() {
		if (this.isAnimating) return
		this.isAnimating = true
		this.animate()
	}

	stopAnimation() {
		if (!this.isAnimating) return
		this.isAnimating = false

		if (this.animationId) {
			cancelAnimationFrame(this.animationId)
			this.animationId = null
		}
	}

	createScene() {
		this.scene = new THREE.Scene()
		this.scene.background = new THREE.Color('#000000')
	}

	createCamera() {
		const aspect = this.container.clientWidth / this.container.clientHeight
		this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
		this.camera.position.set(0, 0, 1)
	}

	createRenderer() {
		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
		})
		this.renderer.setSize(
			this.container.clientWidth,
			this.container.clientHeight
		)
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping
		this.renderer.toneMappingExposure = 0.8
		this.renderer.shadowMap.enabled = true
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

		this.container.appendChild(this.renderer.domElement)
	}

	loadEnvironmentTexture() {
		const loader = new THREE.TextureLoader()
		loader.load(
			'/wp-content/themes/weerts/static/three/awards/test.jpg',
			(texture) => {
				texture.mapping = THREE.EquirectangularReflectionMapping
				texture.colorSpace = THREE.SRGBColorSpace
				texture.flipY = false

				texture.minFilter = THREE.LinearFilter
				texture.magFilter = THREE.LinearFilter
				texture.generateMipmaps = true

				this.scene.environment = texture
				this.scene.environmentIntensity = 0.75
			},
			undefined,
			(error) => {
				console.error('Error loading environment texture:', error)
			}
		)
	}

	loadModel() {
		const dracoLoader = new DRACOLoader()
		dracoLoader.setDecoderPath(
			'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
		)

		const loader = new GLTFLoader()
		loader.setDRACOLoader(dracoLoader)

		loader.load(
			'/wp-content/themes/weerts/static/three/awards/webby_2.glb',
			(gltf) => {
				this.model = gltf.scene

				const box = new THREE.Box3().setFromObject(this.model)
				const center = box.getCenter(new THREE.Vector3())
				this.model.position.sub(center)

				const size = box.getSize(new THREE.Vector3())
				const maxDimension = Math.max(size.x, size.y, size.z)
				const baseScale = 1 / maxDimension

				const mobileScale = this.isMobile ? 0.7 : 1.0
				const finalScale = baseScale * mobileScale

				this.model.scale.setScalar(finalScale)

				this.model.traverse((child) => {
					if (child.isMesh) {
						child.castShadow = true
						child.receiveShadow = true
					}
				})

				this.modelGroup = new THREE.Group()
				this.modelGroup.add(this.model)
				this.modelGroup.position.y = -5

				this.scene.add(this.modelGroup)
				this.setupScrollTrigger()
			},
			undefined,
			(error) => {
				console.error('Error loading model:', error)
			}
		)
	}

	setupPostProcessing() {
		this.composer = new EffectComposer(this.renderer)

		// Base render pass
		const renderPass = new RenderPass(this.scene, this.camera)
		this.composer.addPass(renderPass)

		// Color grading for darker, more intense look
		this.colorGradingPass = new ShaderPass(ColorGradingShader)
		this.composer.addPass(this.colorGradingPass)
	}

	setupHoverControls() {
		if (this.isMobile) {
			this.container.style.cursor = 'default'
			return
		}

		this.container.addEventListener('mouseenter', () => this.onHoverStart())
		this.container.addEventListener('mouseleave', () => this.onHoverEnd())
		this.container.addEventListener('mousemove', (e) => this.onHoverMove(e))

		this.container.style.cursor = 'pointer'
	}

	onHoverStart() {
		this.isHovering = true
	}

	onHoverEnd() {
		this.isHovering = false
	}

	onHoverMove(event) {
		if (!this.modelGroup) return

		const rect = this.container.getBoundingClientRect()
		const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1
		const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1

		this.mousePosition.x = mouseX
		this.mousePosition.y = mouseY

		if (this.isHovering) {
			this.targetRotation.x = mouseY * this.rotationSensitivity * 0.25
			this.targetRotation.y = mouseX * this.rotationSensitivity * 1.5
			const distanceFromCenter = Math.sqrt(mouseX * mouseX + mouseY * mouseY)
			this.targetRotation.z =
				mouseX * this.tiltSensitivity * distanceFromCenter * 0.25
		}
	}

	setupScrollTrigger() {
		if (!this.modelGroup) return

		if (this.scrollTrigger) {
			this.scrollTrigger.kill()
		}

		this.scrollTrigger = ScrollTrigger.create({
			trigger: this.container,
			start: 'top bottom',
			end: 'bottom top',
			scrub: 2,
			pin: false,
			onUpdate: (self) => {
				this.currentProgress = self.progress
				this.updateScene(self.progress)
			},
		})
	}

	updateScene(progress) {
		if (!this.modelGroup) return

		const modelYRange = 2
		const modelY = (progress - 0.5) * modelYRange
		this.modelGroup.position.y = modelY

		const scrollRotationZ = (progress - 0.65) * Math.PI * -0.5
		const scrollRotationX = (progress - 0.65) * Math.PI * -0.5

		this.modelGroup.rotation.z = scrollRotationZ
		this.modelGroup.rotation.x = scrollRotationX
	}

	updateHoverRotation() {
		if (!this.model) return

		this.currentRotation.x +=
			(this.targetRotation.x - this.currentRotation.x) * this.returnSpeed
		this.currentRotation.y +=
			(this.targetRotation.y - this.currentRotation.y) * this.returnSpeed
		this.currentRotation.z +=
			(this.targetRotation.z - this.currentRotation.z) * this.returnSpeed

		this.model.rotation.x = this.currentRotation.x
		this.model.rotation.y = this.currentRotation.y
		this.model.rotation.z = this.currentRotation.z

		const time = Date.now() * 0.001
		this.model.position.y = Math.sin(time * 1.5) * 0.02 + this.currentPosition.y
	}

	animate() {
		if (!this.isAnimating) {
			this.animationId = null
			return
		}

		this.animationId = requestAnimationFrame(() => this.animate())

		this.updateHoverRotation()

		if (this.composer) {
			this.composer.render()
		} else {
			this.renderer.render(this.scene, this.camera)
		}
	}

	handleResize() {
		// Initialize dimensions
		this.width = this.container.clientWidth
		this.height = this.container.clientHeight

		const resizeHandler = () => {
			const wasMobile = this.isMobile
			const width = this.container.clientWidth
			const height = this.container.clientHeight

			// Update mobile detection
			this.isMobile = window.innerWidth <= 768

			// Update camera
			this.camera.aspect = width / height
			this.camera.updateProjectionMatrix()

			// Update renderer with proper pixel ratio
			this.renderer.setSize(width, height)
			this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

			// Update post-processing
			if (this.composer) {
				this.composer.setSize(width, height)
			}

			// Update stored dimensions
			this.width = width
			this.height = height

			// Refresh ScrollTrigger and hover controls if needed
			ScrollTrigger.refresh()

			if (wasMobile !== this.isMobile) {
				this.setupHoverControls()
			}
		}

		// Use ResizeObserver with throttling
		let resizeTimeout
		this.resizeObserver = new ResizeObserver((entries) => {
			// Clear previous timeout
			if (resizeTimeout) {
				clearTimeout(resizeTimeout)
			}

			// Throttle resize calls
			resizeTimeout = setTimeout(() => {
				for (const entry of entries) {
					const { width, height } = entry.contentRect

					// Only resize if dimensions changed significantly
					if (
						Math.abs(width - this.width) > 1 ||
						Math.abs(height - this.height) > 1
					) {
						resizeHandler()
						break // Only need to handle once
					}
				}
			}, 16) // ~60fps throttling
		})

		this.resizeObserver.observe(this.container)
	}

	dispose() {
		this.stopAnimation()

		if (this.scrollTrigger) {
			this.scrollTrigger.kill()
		}

		// Clean up resize observer
		if (this.resizeObserver) {
			this.resizeObserver.disconnect()
			this.resizeObserver = null
		}

		if (this.scene) {
			this.scene.traverse((object) => {
				if (object.geometry) {
					object.geometry.dispose()
				}
				if (object.material) {
					if (Array.isArray(object.material)) {
						object.material.forEach((material) => material.dispose())
					} else {
						object.material.dispose()
					}
				}
			})
		}

		if (this.renderer) {
			this.renderer.dispose()
		}

		if (this.composer) {
			this.composer.dispose()
		}
	}
}

export default function runHomeAwardsAnimation() {
	const container = document.querySelector('#home-three-awards')

	if (!container) return

	awardsApp = new HomeAwardsThree(container)

	return awardsApp
}

export function killHomeAwardsAnimation() {
	if (!awardsApp) return
	awardsApp.dispose()
	awardsApp = null
}
