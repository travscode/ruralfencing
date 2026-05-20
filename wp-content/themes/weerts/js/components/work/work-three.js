import * as THREE from 'three'
import { getLenis } from '../../utils/smooth-scroll'

let cylinderApp

const vertexShader = /* glsl */ `
                    varying vec2 vUv;
                    varying vec2 vUvCover;
                    varying float vFacing;

                    uniform vec2 uTextureSize;
                    uniform vec2 uQuadSize;
                    uniform float uRadius;
                    uniform float uBowAmount;

                    vec2 getCoverUvVert(vec2 uv, vec2 textureSize, vec2 quadSize) {
                        vec2 ratio = vec2(
                            min((quadSize.x / quadSize.y) / (textureSize.x / textureSize.y), 1.0),
                            min((quadSize.y / quadSize.x) / (textureSize.y / textureSize.x), 1.0)
                        );
                        return vec2(
                            uv.x * ratio.x + (1.0 - ratio.x) * 0.5,
                            uv.y * ratio.y + (1.0 - ratio.y) * 0.5
                        );
                    }

                    void main() {
                        vUv = uv;
                        vUvCover = getCoverUvVert(uv, uTextureSize, uQuadSize);
                        
                        // Calculate angle for cylinder wrapping
                        float angle = (uv.x - 0.5) * 1.0; // radians from center
                        
                        vec3 pos = position;
                        
                        // Base cylindrical bending
                        float baseRadius = uRadius;
                        pos.x = sin(angle) * baseRadius;
                        pos.z = cos(angle) * baseRadius - baseRadius; 
                        
                        // Calculate normal for face detection
                        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                        vec3 transformedNormal = normalMatrix * vec3(sin(angle), 0.0, cos(angle));
                        vFacing = dot(normalize(transformedNormal), normalize(-mvPosition.xyz));

                        gl_Position = projectionMatrix * mvPosition;
                    }
        `

// Fragment shader remains the same
const fragmentShader = /* glsl */ `
            varying vec2 vUv;
            varying vec2 vUvCover;
            varying float vFacing;
            uniform sampler2D uTexture;
            
            void main() {
                if (vFacing > 0.0) {
                    // Front face - show texture
                    vec2 texCoords = vUvCover;
                    vec3 texture = vec3(texture2D(uTexture, texCoords));
                    gl_FragColor = vec4(texture, 1.0);
                } else {
                    gl_FragColor = vec4(0.9, 0.9, 0.9, 1.0);

                }
            }
        `

class CylinderGallery {
	constructor(container) {
		this.container = container
		this.images = []
		this.textures = []
		this.materials = []
		this.meshes = []
		this.lenis = getLenis()
		this.direction = 1
		this.group = new THREE.Group()
		this.outerGroup = new THREE.Group()

		// Drag controls - Y-axis only
		this.isDragging = false
		this.previousMousePosition = { x: 0 }
		this.dragVelocity = { x: 0 }
		this.targetRotation = { y: -Math.PI * 0.15 }
		this.currentRotation = { y: -Math.PI * 0.15 }

		// Bowing effect
		this.bowAmount = 0
		this.targetBowAmount = 0

		// Camera responsive values
		this.targetCameraZ = 5
		this.targetFOV = 50

		this.init()
	}

	init() {
		// Setup scene
		this.scene = new THREE.Scene()

		const { width, height } = this.container.getBoundingClientRect()
		this.width = width
		this.height = height

		// Setup camera with initial values
		this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
		this.camera.position.z = 5

		// Set responsive camera values based on initial viewport
		this.updateCameraForViewport()

		// Setup renderer
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
		this.renderer.setSize(this.width, this.height)
		this.renderer.setPixelRatio(window.devicePixelRatio)
		this.container.appendChild(this.renderer.domElement)

		// Setup drag controls
		this.setupDragControls()

		// Load images
		this.loadImages()

		// Handle resize
		this.resizeObserver = new ResizeObserver(() => this.onResize())
		this.resizeObserver.observe(this.container)

		// Start animation
		this.animate()
	}

	updateCameraForViewport() {
		const width = this.width
		const height = this.height

		// Check for mobile devices and adjust accordingly
		if (width <= 480) {
			// Small phones - zoom out significantly
			this.targetCameraZ = 6.5
			this.targetFOV = 55
		} else if (width <= 768) {
			// Tablets and larger phones - moderate zoom out
			this.targetCameraZ = 4.5
			this.targetFOV = 50
		} else if (width <= 1024) {
			// Small desktops/laptops - slight zoom out
			this.targetCameraZ = 5
			this.targetFOV = 50
		} else {
			// Large desktops - normal view
			this.targetCameraZ = 5
			this.targetFOV = 50
		}
	}

	setupDragControls() {
		const canvas = this.renderer.domElement

		// Mouse events
		canvas.addEventListener('mousedown', (e) => this.onMouseDown(e))
		canvas.addEventListener('mousemove', (e) => this.onMouseMove(e))
		canvas.addEventListener('mouseup', () => this.onMouseUp())
		canvas.addEventListener('mouseleave', () => this.onMouseUp())
		// Prevent context menu on right click
		canvas.addEventListener('contextmenu', (e) => e.preventDefault())
	}

	onMouseDown(e) {
		this.isDragging = true
		this.previousMousePosition = { x: e.clientX }
		this.dragVelocity = { x: 0 }
		this.container.style.cursor = 'grabbing'
	}

	onMouseMove(e) {
		if (!this.isDragging) return

		const deltaX = e.clientX - this.previousMousePosition.x

		// Convert mouse movement to Y-axis rotation only
		// Adjust sensitivity based on device type
		const baseSensitivity = window.innerWidth <= 768 ? 0.008 : 0.005
		this.targetRotation.y += deltaX * baseSensitivity

		// Store velocity for momentum
		this.dragVelocity.x = deltaX * 0.1

		this.previousMousePosition = { x: e.clientX }
	}

	onMouseUp() {
		this.isDragging = false
		this.container.style.cursor = 'grab'
	}

	onTouchStart(e) {
		if (e.touches.length === 1) {
			const touch = e.touches[0]
			this.onMouseDown({ clientX: touch.clientX })
		}
	}

	onTouchMove(e) {
		if (e.touches.length === 1) {
			e.preventDefault()
			const touch = e.touches[0]
			this.onMouseMove({ clientX: touch.clientX })
		}
	}

	onTouchEnd() {
		this.onMouseUp()
	}

	loadImages() {
		const imageElements = this.container.querySelectorAll('img')
		const textureLoader = new THREE.TextureLoader()

		const imageCount = imageElements.length
		const radius = 2.5

		// Fixed aspect ratio calculation
		const aspectRatio = 16 / 9
		const planeHeight = 1.5 // Base height
		const planeWidth = planeHeight * aspectRatio // This ensures 16:9 ratio

		imageElements.forEach((img, index) => {
			textureLoader.load(img.src, (texture) => {
				texture.minFilter = THREE.LinearFilter
				texture.magFilter = THREE.LinearFilter
				// Create material with custom shader
				const material = new THREE.ShaderMaterial({
					uniforms: {
						uTexture: { value: texture },
						uTextureSize: {
							value: new THREE.Vector2(
								texture.image.width,
								texture.image.height
							),
						},
						uQuadSize: { value: new THREE.Vector2(planeWidth, planeHeight) },
						uRadius: { value: radius },
						uBowAmount: { value: 0 }, // Add bow amount uniform
					},
					vertexShader,
					fragmentShader,
					side: THREE.DoubleSide,
					transparent: true,
				})

				// Create curved plane geometry with more segments for smoother curve
				const geometry = new THREE.PlaneGeometry(
					planeWidth,
					planeHeight,
					32, // Width segments - important for smooth curve
					1 // Height segments - keep minimal since we're not curving vertically
				)

				// Position around cylinder
				const angle = (index / imageCount) * Math.PI * 2
				const mesh = new THREE.Mesh(geometry, material)

				// Position and rotate - these don't affect the curvature
				mesh.position.x = Math.sin(angle) * radius
				mesh.position.z = Math.cos(angle) * radius
				mesh.rotation.y = angle

				// Add to group
				this.group.add(mesh)
				this.meshes.push(mesh)
			})
		})

		this.outerGroup.add(this.group)
		this.scene.add(this.outerGroup)

		this.outerGroup.rotation.set(
			-Math.PI * 0.05,
			this.currentRotation.y,
			-Math.PI * 0.025
		)
		this.outerGroup.position.y = -0.25

		// Set initial cursor style
		this.container.style.cursor = 'grab'
	}

	onResize() {
		const { width, height } = this.container.getBoundingClientRect()
		this.width = width
		this.height = height
		// Update camera aspect ratio
		this.camera.aspect = this.width / this.height

		// Update target camera values based on new viewport
		this.updateCameraForViewport()

		// Update renderer size
		this.renderer.setSize(this.width, this.height)
	}

	animate() {
		requestAnimationFrame(() => this.animate())

		// Smooth camera transitions for responsive behavior
		const cameraTransitionSpeed = 0.05 // Adjust for smoother/faster transitions
		this.camera.position.z +=
			(this.targetCameraZ - this.camera.position.z) * cameraTransitionSpeed
		this.camera.fov +=
			(this.targetFOV - this.camera.fov) * cameraTransitionSpeed

		// Update projection matrix when FOV changes
		if (Math.abs(this.targetFOV - this.camera.fov) > 0.1) {
			this.camera.updateProjectionMatrix()
		}

		const lenisVelocity = this.lenis.velocity

		// Handle scroll-based rotation (only when not dragging)
		if (!this.isDragging) {
			if (lenisVelocity > 0) {
				this.direction = 1
			} else if (lenisVelocity < 0) {
				this.direction = -1
			}

			// Adjust scroll sensitivity based on device type
			const scrollSensitivity = window.innerWidth <= 768 ? 0.0015 : 0.002
			const vel =
				(scrollSensitivity * Math.abs(lenisVelocity) + scrollSensitivity) *
				this.direction
			this.group.rotation.y += vel
		}

		// Handle drag rotation with smooth interpolation (Y-axis only)
		this.currentRotation.y +=
			(this.targetRotation.y - this.currentRotation.y) * 0.1

		this.outerGroup.rotation.y = this.currentRotation.y

		// Apply drag velocity momentum when not actively dragging
		if (!this.isDragging) {
			this.dragVelocity.x *= 0.95

			if (Math.abs(this.dragVelocity.x) > 0.1) {
				const momentumSensitivity = window.innerWidth <= 768 ? 0.0015 : 0.001
				this.targetRotation.y += this.dragVelocity.x * momentumSensitivity
			}
		}

		// Update bow amount based on lenis velocity
		const velocityMagnitude = Math.abs(lenisVelocity)
		this.targetBowAmount = Math.min(velocityMagnitude * 0.01, 0.5) // Cap at 0.5 for reasonable bowing

		// Smooth interpolation for bow amount
		this.bowAmount += (this.targetBowAmount - this.bowAmount) * 0.1

		// Update bow amount in all materials
		this.meshes.forEach((mesh) => {
			if (
				mesh.material &&
				mesh.material.uniforms &&
				mesh.material.uniforms.uBowAmount
			) {
				mesh.material.uniforms.uBowAmount.value = this.bowAmount
			}
		})

		this.renderer.render(this.scene, this.camera)
	}

	// Method to update radius without affecting height
	updateRadius(newRadius) {
		this.meshes.forEach((mesh, index) => {
			// Update shader uniform
			mesh.material.uniforms.uRadius.value = newRadius

			// Update mesh positioning to match
			const imageCount = this.meshes.length
			const angle = (index / imageCount) * Math.PI * 2
			mesh.position.x = Math.sin(angle) * newRadius
			mesh.position.z = Math.cos(angle) * newRadius
		})
	}

	// Method to manually set bow amount (useful for testing)
	setBowAmount(amount) {
		this.targetBowAmount = amount
	}

	// Method to manually set camera distance (useful for testing)
	setCameraDistance(distance) {
		this.targetCameraZ = distance
	}

	// Method to manually set FOV (useful for testing)
	setFOV(fov) {
		this.targetFOV = fov
	}

	// Get current viewport info (useful for debugging)
	getViewportInfo() {
		return {
			width: window.innerWidth,
			height: window.innerHeight,
			targetCameraZ: this.targetCameraZ,
			targetFOV: this.targetFOV,
			currentCameraZ: this.camera.position.z,
			currentFOV: this.camera.fov,
		}
	}

	// Clean up method
	destroy() {
		const canvas = this.renderer.domElement

		// Remove event listeners
		canvas.removeEventListener('mousedown', this.onMouseDown)
		canvas.removeEventListener('mousemove', this.onMouseMove)
		canvas.removeEventListener('mouseup', this.onMouseUp)
		canvas.removeEventListener('mouseleave', this.onMouseUp)
		canvas.removeEventListener('touchstart', this.onTouchStart)
		canvas.removeEventListener('touchmove', this.onTouchMove)
		canvas.removeEventListener('touchend', this.onTouchEnd)
		canvas.removeEventListener('contextmenu', (e) => e.preventDefault())

		if (this.resizeObserver) {
			this.resizeObserver.disconnect()
			this.resizeObserver = null
		}

		// Clean up Three.js resources
		this.meshes.forEach((mesh) => {
			mesh.geometry.dispose()
			mesh.material.dispose()
		})

		this.renderer.dispose()
	}
}

export default function runWorkThree() {
	const container = document.querySelector('#work-hero-three')

	if (!container) return

	cylinderApp = new CylinderGallery(container)

	return cylinderApp
}

export function workThreeKill() {
	if (!cylinderApp) return
	cylinderApp.destroy()
}
