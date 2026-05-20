import * as THREE from 'three'

// Optimized FBO Particle System Class with Ping-Pong Buffers
class FBOParticleSystem {
	constructor(width, height, renderer) {
		this.width = width
		this.height = height
		this.renderer = renderer
		this.gl = renderer.getContext()

		// Pre-allocate reusable objects
		this.scene = null
		this.orthoCamera = null
		this.rttA = null
		this.rttB = null
		this.currentRTT = null
		this.nextRTT = null
		this.particles = null
		this.simulationMesh = null

		// Cache for geometry and materials
		this._quadGeometry = null
		this._copyMaterial = null

		// Performance tracking
		this.frameCount = 0

		this.init()
	}

	init() {
		this.setupRenderTargets()
		this.setupSimulationScene()
	}

	setupRenderTargets() {
		// Create orthographic scene for simulation
		this.scene = new THREE.Scene()

		// Optimized orthographic camera setup
		this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
		this.orthoCamera.position.z = 1

		// Optimized render target options
		const options = {
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: this.gl.getExtension('OES_texture_float')
				? THREE.FloatType
				: THREE.HalfFloatType,
			generateMipmaps: false,
			stencilBuffer: false,
			depthBuffer: false,
			colorSpace: THREE.LinearSRGBColorSpace, // Explicit color space
		}

		// Create two render targets for ping-pong
		this.rttA = new THREE.WebGLRenderTarget(this.width, this.height, options)
		this.rttB = new THREE.WebGLRenderTarget(this.width, this.height, options)

		// Disable unnecessary features
		this.rttA.texture.flipY = false
		this.rttB.texture.flipY = false
		this.rttA.texture.generateMipmaps = false
		this.rttB.texture.generateMipmaps = false

		// Initialize ping-pong
		this.currentRTT = this.rttA
		this.nextRTT = this.rttB
	}

	setupSimulationScene() {
		// Cache quad geometry for reuse
		if (!this._quadGeometry) {
			this._quadGeometry = new THREE.PlaneGeometry(2, 2)
			// Remove unnecessary attributes
			this._quadGeometry.deleteAttribute('normal')
		}

		this.simulationMesh = new THREE.Mesh(this._quadGeometry)
		this.scene.add(this.simulationMesh)
	}

	createParticleGeometry() {
		const count = this.width * this.height
		const positions = new Float32Array(count * 3)
		const references = new Float32Array(count * 2)

		// Optimized loop with fewer divisions
		const widthInv = 1 / this.width
		const heightInv = 1 / this.height

		for (let i = 0; i < count; i++) {
			const x = (i % this.width) * widthInv
			const y = Math.floor(i * widthInv) * heightInv

			// Reference UV coordinates
			references[i * 2] = x
			references[i * 2 + 1] = y

			// Initial positions
			positions[i * 3] = x
			positions[i * 3 + 1] = y
			positions[i * 3 + 2] = 0
		}

		const geometry = new THREE.BufferGeometry()
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
		geometry.setAttribute('reference', new THREE.BufferAttribute(references, 2))

		// Set draw range for better performance with large particle counts
		geometry.setDrawRange(0, count)

		return geometry
	}

	// Create instanced particle geometry for better performance with many particles
	createInstancedParticleGeometry(instanceCount) {
		const baseGeometry = new THREE.PlaneGeometry(0.1, 0.1)
		const instancedGeometry = new THREE.InstancedBufferGeometry()

		// Copy base geometry
		instancedGeometry.copy(baseGeometry)

		// Create instance attributes
		const references = new Float32Array(instanceCount * 2)
		const widthInv = 1 / this.width

		for (let i = 0; i < instanceCount; i++) {
			references[i * 2] = (i % this.width) * widthInv
			references[i * 2 + 1] = Math.floor(i * widthInv) / this.height
		}

		instancedGeometry.setAttribute(
			'reference',
			new THREE.InstancedBufferAttribute(references, 2)
		)

		return instancedGeometry
	}

	setMaterials(simulationMaterial, renderMaterial, useInstanced = false) {
		this.simulationMesh.material = simulationMaterial

		let particleGeometry
		if (useInstanced && this.width * this.height > 10000) {
			// Use instanced rendering for large particle counts
			particleGeometry = this.createInstancedParticleGeometry(
				this.width * this.height
			)
			this.particles = new THREE.InstancedMesh(
				particleGeometry,
				renderMaterial,
				this.width * this.height
			)
		} else {
			particleGeometry = this.createParticleGeometry()
			this.particles = new THREE.Points(particleGeometry, renderMaterial)
		}

		// Enable frustum culling optimization
		this.particles.frustumCulled = false // Particles often extend beyond bounds
	}

	// Cached copy material for better performance
	getCopyMaterial() {
		if (!this._copyMaterial) {
			this._copyMaterial = new THREE.ShaderMaterial({
				uniforms: {
					tInput: { value: null },
				},
				vertexShader: `
					varying vec2 vUv;
					void main() {
						vUv = uv;
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					}
				`,
				fragmentShader: `
					uniform sampler2D tInput;
					varying vec2 vUv;
					void main() {
						gl_FragColor = texture2D(tInput, vUv);
					}
				`,
			})
		}
		return this._copyMaterial
	}

	setInitialData(initialTexture) {
		if (!initialTexture) return

		const copyMaterial = this.getCopyMaterial()
		copyMaterial.uniforms.tInput.value = initialTexture

		// Store and set material
		const originalMaterial = this.simulationMesh.material
		this.simulationMesh.material = copyMaterial

		// Disable clearing for better performance
		const originalAutoClear = this.renderer.autoClear
		this.renderer.autoClear = false

		// Initialize both render targets
		this.renderer.setRenderTarget(this.rttA)
		this.renderer.clear()
		this.renderer.render(this.scene, this.orthoCamera)

		this.renderer.setRenderTarget(this.rttB)
		this.renderer.clear()
		this.renderer.render(this.scene, this.orthoCamera)

		this.renderer.setRenderTarget(null)
		this.renderer.autoClear = originalAutoClear

		// Restore material
		this.simulationMesh.material = originalMaterial

		// Update particle material
		if (this.particles?.material.uniforms?.positions) {
			this.particles.material.uniforms.positions.value = this.currentRTT.texture
		}
	}

	update() {
		// Batch state changes to reduce GPU state switching
		const originalAutoClear = this.renderer.autoClear
		this.renderer.autoClear = false

		// STEP 1: Set simulation uniforms (avoid redundant uniform updates)
		const simUniforms = this.simulationMesh.material.uniforms
		if (simUniforms.positions.value !== this.currentRTT.texture) {
			simUniforms.positions.value = this.currentRTT.texture
		}

		// STEP 2: Render simulation
		this.renderer.setRenderTarget(this.nextRTT)
		this.renderer.clear()
		this.renderer.render(this.scene, this.orthoCamera)

		// STEP 3: Swap render targets
		const temp = this.currentRTT
		this.currentRTT = this.nextRTT
		this.nextRTT = temp

		// STEP 4: Update render shader (only if changed)
		const renderUniforms = this.particles?.material.uniforms
		if (
			renderUniforms?.positions &&
			renderUniforms.positions.value !== this.currentRTT.texture
		) {
			renderUniforms.positions.value = this.currentRTT.texture
		}

		this.renderer.setRenderTarget(null)
		this.renderer.autoClear = originalAutoClear

		this.frameCount++
	}

	// Optimized batch update for multiple systems
	static updateBatch(systems) {
		if (systems.length === 0) return

		const renderer = systems[0].renderer
		const originalAutoClear = renderer.autoClear
		renderer.autoClear = false

		for (const system of systems) {
			system.update()
		}

		renderer.autoClear = originalAutoClear
	}

	getParticles() {
		return this.particles
	}

	getCurrentPositionTexture() {
		return this.currentRTT.texture
	}

	// Performance monitoring
	getStats() {
		return {
			frameCount: this.frameCount,
			particleCount: this.width * this.height,
			textureSize: `${this.width}x${this.height}`,
			memoryUsage: this.getMemoryUsage(),
		}
	}

	getMemoryUsage() {
		const bytesPerPixel = 16 // RGBA Float32
		const textureMemory = this.width * this.height * bytesPerPixel * 2 // Two render targets
		const particleMemory = this.width * this.height * (3 + 2) * 4 // positions + references
		return {
			textures: `${(textureMemory / 1024 / 1024).toFixed(2)}MB`,
			particles: `${(particleMemory / 1024 / 1024).toFixed(2)}MB`,
			total: `${((textureMemory + particleMemory) / 1024 / 1024).toFixed(2)}MB`,
		}
	}

	// Optimized disposal with proper cleanup
	dispose() {
		// Dispose render targets
		this.rttA?.dispose()
		this.rttB?.dispose()

		// Dispose particle system
		if (this.particles) {
			this.particles.geometry?.dispose()
			this.particles.material?.dispose()
		}

		// Dispose simulation mesh (but not shared geometry)
		if (this.simulationMesh) {
			// Don't dispose _quadGeometry as it might be shared
			this.simulationMesh.material?.dispose()
		}

		// Dispose cached materials
		this._copyMaterial?.dispose()

		// Clear references
		this.particles = null
		this.simulationMesh = null
		this.currentRTT = null
		this.nextRTT = null
		this.rttA = null
		this.rttB = null
	}
}

export default FBOParticleSystem
