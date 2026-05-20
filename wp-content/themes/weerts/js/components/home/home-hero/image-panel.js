import * as THREE from 'three'
import { getLenis } from '../../../utils/smooth-scroll'

class ImagePanel {
	constructor(scene, camera) {
		this.scene = scene
		this.camera = camera

		// Sphere configuration
		this.radius = 800
		this.panelSize = 180
		this.totalPanels = 48

		// Rotation
		this.lenis = getLenis()
		this.direction = 1

		// Panel management
		this.panels = []
		this.visiblePanels = new Set()

		// Text scramble optimization
		this.textUpdateInterval = 150
		this.lastTextUpdate = 0
		this.targetText = 'THE START'

		// Pixelation timing
		this.pixelationUpdateInterval = 100
		this.lastPixelationUpdate = 0

		// Shared text canvas for reuse
		this.textCanvas = document.createElement('canvas')
		this.textCanvas.width = 512
		this.textCanvas.height = 64
		this.textContext = this.textCanvas.getContext('2d')

		// Cache for text textures
		this.textTextureCache = new Map()
		this.maxCacheSize = 100

		// Frustum culling
		this.frustum = new THREE.Frustum()
		this.frustumMatrix = new THREE.Matrix4()

		// Shared geometry
		this.sharedPanelGeometry = new THREE.PlaneGeometry(
			this.panelSize,
			this.panelSize,
			10,
			10
		)
		this.sharedTextGeometry = new THREE.PlaneGeometry(this.panelSize, 30)

		this.imageUrls = [...document.querySelectorAll('.three-js-images')].map(
			(img) => img.src
		)

		// Texture loader with cache
		this.textureLoader = new THREE.TextureLoader()
		this.textureCache = new Map()

		this.init()
	}

	init() {
		// Create container group for all panels
		this.panelGroup = new THREE.Group()
		this.panelGroup.position.z = 0
		this.scene.add(this.panelGroup)

		// Pre-calculate sphere positions
		this.spherePositions = this.fibonacciSphere(this.totalPanels)
		this.createSphericalPanels()

		// Start animation after everything is set up
		this.startAnimation()
	}

	createSphericalPanels() {
		this.spherePositions.forEach((point, index) => {
			// Cycle through available images if we have more panels than images
			const imageIndex = index % this.imageUrls.length
			const panel = this.createPanel(point, imageIndex)
			this.panels.push(panel)
			this.panelGroup.add(panel.mesh)
		})
	}

	fibonacciSphere(samples, camera = this.camera) {
		const points = []
		const goldenAngle = Math.PI * (3 - Math.sqrt(5))

		// Get camera matrices
		const viewMatrix = new THREE.Matrix4().multiplyMatrices(
			camera.matrixWorld,
			new THREE.Matrix4().identity()
		)
		const inverseViewMatrix = new THREE.Matrix4().copy(viewMatrix).invert()

		for (let i = 0; i < samples; i++) {
			const y = 1 - (i / (samples - 1)) * 2
			const radiusAtY = Math.sqrt(1 - y * y)
			const theta = goldenAngle * i

			const x = Math.cos(theta) * radiusAtY
			const z = Math.sin(theta) * radiusAtY

			// Create point in world space
			const worldPoint = new THREE.Vector3(
				x * this.radius,
				y * this.radius,
				z * this.radius
			)

			// Transform to view space
			const viewPoint = worldPoint
				.clone()
				.applyMatrix4(camera.matrixWorldInverse)

			// Add random Z displacement in view space
			const randomDepth = -Math.random() * 400.0 + 100
			viewPoint.z += randomDepth

			// Transform back to world space
			const finalPoint = viewPoint.applyMatrix4(camera.matrixWorld)

			points.push({
				x: finalPoint.x,
				y: finalPoint.y,
				z: finalPoint.z,
			})
		}

		return points
	}

	generateRandomCoordinates() {
		const lat = (Math.random() * 180 - 90).toFixed(4)
		const lng = (Math.random() * 360 - 180).toFixed(4)
		return `${lat}°, ${lng}°`
	}

	generateScrambledText(targetText = '', revealProgress = 0) {
		const chars =
			'0123456789.-°, ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+'
		const targetLength = Math.max(16, targetText.length)
		let result = ''

		const revealCount = Math.floor(targetText.length * revealProgress)

		for (let i = 0; i < targetLength; i++) {
			if (i < revealCount && i < targetText.length) {
				result += targetText[i]
			} else if (i < targetText.length) {
				result += chars[Math.floor(Math.random() * chars.length)]
			} else {
				result += chars[Math.floor(Math.random() * chars.length)]
			}
		}

		return result
	}

	createTextTexture(text, isScrambled = false) {
		// Check cache first
		const cacheKey = `${text}_${isScrambled}`
		if (this.textTextureCache.has(cacheKey)) {
			return this.textTextureCache.get(cacheKey)
		}

		// Reuse the shared canvas
		const context = this.textContext

		// Set font and styling
		context.font = 'bold 20px monospace'
		context.fillStyle = isScrambled
			? 'rgba(255, 255, 255, 0.4)'
			: 'rgba(255, 255, 255, 0.9)'
		context.textAlign = 'left'
		context.textBaseline = 'middle'

		// Clear canvas
		context.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height)

		// Add text with left padding
		context.fillText(text, 20, this.textCanvas.height / 2)

		// Create texture
		const texture = new THREE.CanvasTexture(this.textCanvas)
		texture.needsUpdate = true

		// Cache management
		if (this.textTextureCache.size >= this.maxCacheSize) {
			// Remove oldest entries
			const firstKey = this.textTextureCache.keys().next().value
			const firstTexture = this.textTextureCache.get(firstKey)
			firstTexture.dispose()
			this.textTextureCache.delete(firstKey)
		}

		this.textTextureCache.set(cacheKey, texture)
		return texture
	}

	createPanel(position, index) {
		// Reuse shared geometry
		const geometry = this.sharedPanelGeometry

		// Create shader material
		const material = this.createPanelMaterial()

		const mesh = new THREE.Mesh(geometry, material)
		mesh.position.set(position.x, position.y, position.z)
		mesh.lookAt(0, 0, 0)

		// Create text panel
		const textGeometry = this.sharedTextGeometry
		const textMaterial = new THREE.MeshBasicMaterial({
			transparent: true,
			opacity: 0.0,
			side: THREE.DoubleSide,
			depthWrite: false,
			depthTest: false,
		})

		const textMesh = new THREE.Mesh(textGeometry, textMaterial)

		// Position text below the image panel
		const textOffset = this.panelSize * 0.6
		const downDirection = new THREE.Vector3(0, -1, 0)

		textMesh.position.copy(mesh.position)
		textMesh.position.add(downDirection.multiplyScalar(textOffset))
		textMesh.lookAt(0, 0, 0)

		this.panelGroup.add(textMesh)

		// Generate initial coordinates
		const coordinates = this.generateRandomCoordinates()
		const textTexture = this.createTextTexture(coordinates)

		const panel = {
			mesh,
			textMesh,
			material,
			textMaterial,
			position,
			imageIndex: index,
			loaded: false,
			coordinates: coordinates,
			textTexture: textTexture,
			scramblePhase: 'scramble',
			revealProgress: 0,
			phaseStartTime: Date.now(),
			phaseDuration: 2000,
			lastScrambleTime: Date.now(),
			startDelay: Math.random() * 10000 + 5000,
			hasStartedSequence: false,
			boundingSphere: new THREE.Sphere(
				new THREE.Vector3(position.x, position.y, position.z),
				this.panelSize
			),
			// Pixelation properties
			pixelationPhase: 'normal',
			pixelationProgress: 0,
			pixelationStartTime: Date.now(),
			pixelationDelay: Math.random() * 12000 + 6000, // 3-11 second intervals
			pixelationDuration: 4000, // 1.5 seconds to pixelate and return
		}

		panel.textMaterial.map = textTexture

		// Defer image loading
		setTimeout(() => this.loadImageTexture(panel), index * 50)

		return panel
	}

	createPanelMaterial() {
		const vertexShader = /* glsl */ `
		varying vec2 vUvCover;
		
		uniform vec2 uTextureSize;
		uniform vec2 uQuadSize;
		uniform float uCurvature;
		
		vec2 getCoverUv(vec2 uv, vec2 textureSize, vec2 quadSize) {
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
			vUvCover = getCoverUv(uv, uTextureSize, uQuadSize);
			
			vec3 pos = position;
			vec2 centeredUV = uv - 0.5;
			float distanceFromCenter = length(centeredUV);
			float curvatureAmount = uCurvature * distanceFromCenter * distanceFromCenter;
			pos.z += curvatureAmount;
			
			gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
		}
		`

		const fragmentShader = /* glsl */ `
		varying vec2 vUvCover;
		uniform sampler2D uTexture;
		uniform float uOpacity;
		uniform float uSaturation;
		uniform float uContrast;
		uniform float uBrightness;
		uniform float uPixelSize;
		uniform vec2 uResolution;
		
		vec3 adjustColor(vec3 color) {
			// Brightness
			color *= uBrightness;
			// Contrast
			color = (color - 0.5) * uContrast + 0.5;
			// Saturation
			float gray = dot(color, vec3(0.299, 0.587, 0.114));
			color = mix(vec3(gray), color, uSaturation);
			return clamp(color, 0.0, 1.0);
		}
		
		vec2 pixelate(vec2 uv, float pixelSize) {
			if (pixelSize <= 1.0) return uv;
			
			vec2 pixels = uResolution / pixelSize;
			return floor(uv * pixels) / pixels;
		}
		
		void main() {
			if (uOpacity < 0.01) discard;
			
			vec2 pixelatedUv = pixelate(vUvCover, uPixelSize);
			vec4 textureColor = texture2D(uTexture, pixelatedUv);
			vec3 color = adjustColor(textureColor.rgb);
			
			gl_FragColor = vec4(color, uOpacity);
		}
		`

		return new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader,
			uniforms: {
				uTexture: { value: null },
				uTextureSize: { value: new THREE.Vector2(1, 1) },
				uQuadSize: { value: new THREE.Vector2(this.panelSize, this.panelSize) },
				uOpacity: { value: 0.0 },
				uCurvature: { value: 60.0 },
				uSaturation: { value: 1.15 },
				uContrast: { value: 1.15 },
				uBrightness: { value: 0.85 },
				uPixelSize: { value: 1.0 },
				uResolution: { value: new THREE.Vector2(512, 512) },
			},
			transparent: true,
			side: THREE.DoubleSide,
			blending: THREE.NormalBlending,
			depthWrite: false,
			depthTest: false,
		})
	}

	loadImageTexture(panel) {
		const imageIndex = panel.imageIndex % this.imageUrls.length
		const imageUrl = this.imageUrls[imageIndex]

		// Check cache first
		if (this.textureCache.has(imageUrl)) {
			const texture = this.textureCache.get(imageUrl)
			panel.material.uniforms.uTexture.value = texture
			panel.material.uniforms.uTextureSize.value.set(
				texture.image.width,
				texture.image.height
			)
			panel.material.uniforms.uResolution.value.set(
				texture.image.width,
				texture.image.height
			)
			panel.material.needsUpdate = true
			panel.loaded = true
			return
		}

		this.textureLoader.load(
			imageUrl,
			(texture) => {
				texture.wrapS = THREE.ClampToEdgeWrapping
				texture.wrapT = THREE.ClampToEdgeWrapping
				texture.minFilter = THREE.LinearFilter
				texture.magFilter = THREE.LinearFilter

				// Cache the texture
				this.textureCache.set(imageUrl, texture)

				panel.material.uniforms.uTexture.value = texture
				panel.material.uniforms.uTextureSize.value.set(
					texture.image.width,
					texture.image.height
				)
				panel.material.uniforms.uResolution.value.set(
					texture.image.width,
					texture.image.height
				)
				panel.material.needsUpdate = true
				panel.loaded = true
			},
			undefined,
			(error) => {
				console.warn('Failed to load image:', imageUrl)
			}
		)
	}

	updateVisibility() {
		// Update frustum
		this.frustumMatrix.multiplyMatrices(
			this.camera.projectionMatrix,
			this.camera.matrixWorldInverse
		)
		this.frustum.setFromProjectionMatrix(this.frustumMatrix)

		this.panels.forEach((panel) => {
			// Transform panel position to world space
			const worldPos = new THREE.Vector3()
			panel.mesh.getWorldPosition(worldPos)
			panel.boundingSphere.center.copy(worldPos)

			// Check if panel is in frustum
			const isVisible = this.frustum.intersectsSphere(panel.boundingSphere)

			if (isVisible && !this.visiblePanels.has(panel)) {
				// Panel just became visible
				this.visiblePanels.add(panel)
				panel.mesh.visible = true
				panel.textMesh.visible = true

				// Load texture if not loaded
				if (!panel.loaded) {
					this.loadImageTexture(panel)
				}
			} else if (!isVisible && this.visiblePanels.has(panel)) {
				// Panel just became invisible
				this.visiblePanels.delete(panel)
				panel.mesh.visible = false
				panel.textMesh.visible = false
			}
		})
	}

	updatePixelation() {
		const currentTime = Date.now()

		if (
			currentTime - this.lastPixelationUpdate >
			this.pixelationUpdateInterval
		) {
			this.visiblePanels.forEach((panel) => {
				const timeElapsed = currentTime - panel.pixelationStartTime

				switch (panel.pixelationPhase) {
					case 'normal':
						if (timeElapsed > panel.pixelationDelay) {
							panel.pixelationPhase = 'pixelating'
							panel.pixelationStartTime = currentTime
							panel.pixelationProgress = 0
						}
						break

					case 'pixelating':
						const halfDuration = panel.pixelationDuration / 2

						if (timeElapsed < halfDuration) {
							panel.pixelationProgress = timeElapsed / halfDuration
							const pixelSize = 1 + panel.pixelationProgress * 40
							panel.material.uniforms.uPixelSize.value = pixelSize
						} else if (timeElapsed < panel.pixelationDuration) {
							const returnProgress = (timeElapsed - halfDuration) / halfDuration
							const pixelSize = 40 - returnProgress * 39 // 20 to 1
							panel.material.uniforms.uPixelSize.value = pixelSize
						} else {
							// Return to normal
							panel.pixelationPhase = 'normal'
							panel.material.uniforms.uPixelSize.value = 1.0
							panel.pixelationStartTime = currentTime
							panel.pixelationDelay = Math.random() * 8000 + 3000
						}
						break
				}
			})

			this.lastPixelationUpdate = currentTime
		}
	}

	updateTextScramble() {
		const currentTime = Date.now()

		if (currentTime - this.lastTextUpdate > this.textUpdateInterval) {
			// Only update visible panels
			this.visiblePanels.forEach((panel) => {
				// Check if it's time to start "The start" sequence
				if (
					!panel.hasStartedSequence &&
					currentTime - panel.lastScrambleTime > panel.startDelay
				) {
					panel.hasStartedSequence = true
					panel.scramblePhase = 'scramble'
					panel.phaseStartTime = currentTime
					panel.revealProgress = 0
				}

				if (panel.hasStartedSequence) {
					const phaseElapsed = currentTime - panel.phaseStartTime

					switch (panel.scramblePhase) {
						case 'scramble':
							if (phaseElapsed < panel.phaseDuration) {
								const displayText = this.generateScrambledText(
									this.targetText,
									0
								)
								this.updatePanelText(panel, displayText, true)
							} else {
								panel.scramblePhase = 'reveal'
								panel.phaseStartTime = currentTime
								panel.revealProgress = 0
							}
							break

						case 'reveal':
							if (phaseElapsed < panel.phaseDuration) {
								panel.revealProgress = phaseElapsed / panel.phaseDuration
								const displayText = this.generateScrambledText(
									this.targetText,
									panel.revealProgress
								)
								this.updatePanelText(
									panel,
									displayText,
									panel.revealProgress < 1
								)
							} else {
								panel.scramblePhase = 'hold'
								panel.phaseStartTime = currentTime
								this.updatePanelText(panel, this.targetText, false)
							}
							break

						case 'hold':
							if (phaseElapsed > panel.phaseDuration * 2) {
								panel.hasStartedSequence = false
								panel.lastScrambleTime = currentTime
								panel.startDelay = Math.random() * 15000 + 10000
								this.updatePanelText(panel, panel.coordinates, false)
							}
							break
					}
				} else {
					// Normal coordinate scramble behavior - reduced frequency
					if (Math.random() > 0.85) {
						const shouldScramble = Math.random() > 0.5

						let displayText
						if (shouldScramble) {
							displayText = this.generateScrambledText()
						} else {
							if (Math.random() > 0.9) {
								panel.coordinates = this.generateRandomCoordinates()
							}
							displayText = panel.coordinates
						}

						this.updatePanelText(panel, displayText, shouldScramble)
					}
				}
			})

			this.lastTextUpdate = currentTime
		}
	}

	updatePanelText(panel, text, isScrambled) {
		panel.textTexture = this.createTextTexture(text, isScrambled)
		panel.textMaterial.map = panel.textTexture
		panel.textMaterial.needsUpdate = true
	}

	animate() {
		const lenisVelocity = this.lenis.velocity

		if (lenisVelocity > 0) {
			this.direction = 1
		} else if (lenisVelocity < 0) {
			this.direction = -1
		}

		const vel = 0.001 * lenisVelocity + 0.001 * this.direction
		this.panelGroup.rotation.y += vel

		// Update visibility culling
		this.updateVisibility()

		// Update pixelation effect
		this.updatePixelation()

		// Update only visible text
		this.updateTextScramble()

		// Continue animation
		this.animationId = requestAnimationFrame(() => this.animate())
	}

	startAnimation() {
		this.animate()
	}

	stopAnimation() {
		if (this.animationId) {
			cancelAnimationFrame(this.animationId)
		}
	}

	// Public methods
	setImageGroupZ(pos) {
		if (!pos) return
		this.panelGroup.position.z = pos
	}

	getPanelMaterials() {
		return this.panels.map((panel) => panel.material)
	}

	getTextMaterials() {
		return this.panels.map((panel) => panel.textMaterial)
	}

	dispose() {
		// Stop animation
		this.stopAnimation()

		// Clear caches
		this.textureCache.forEach((texture) => texture.dispose())
		this.textureCache.clear()

		this.textTextureCache.forEach((texture) => texture.dispose())
		this.textTextureCache.clear()

		// Clean up all panels
		this.panels.forEach((panel) => {
			this.panelGroup.remove(panel.mesh)
			this.panelGroup.remove(panel.textMesh)

			panel.material.dispose()
			panel.textMaterial.dispose()

			if (panel.material.uniforms.uTexture.value) {
				panel.material.uniforms.uTexture.value.dispose()
			}
			if (panel.textTexture) {
				panel.textTexture.dispose()
			}
		})

		// Dispose shared geometries
		if (this.sharedPanelGeometry) {
			this.sharedPanelGeometry.dispose()
		}
		if (this.sharedTextGeometry) {
			this.sharedTextGeometry.dispose()
		}

		// Clear arrays
		this.panels = []
		this.visiblePanels.clear()
	}
}

export default ImagePanel
