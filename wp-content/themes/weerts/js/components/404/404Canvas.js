import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { N8AOPass } from 'n8ao'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import gsap from 'gsap'

class RealisticPhysics404Scene {
	constructor() {
		this.scene = null
		this.camera = null
		this.renderer = null
		this.composer = null
		this.world = null
		this.bodies = []
		this.meshes = []
		this.textBodies = []
		this.textMeshes = []
		this.projectiles = []
		this.particles = []
		this.clock = new THREE.Clock()
		this.mouse = new THREE.Vector2()
		this.raycaster = new THREE.Raycaster()
		this.maxProjectiles = 10
		this.isInitialized = false
		this.font = null
		this.targetCameraX = 0
		this.targetCameraY = 6
		this.targetCameraZ = this.getResponsiveCameraZ()
		this.lerpFactor = 0.05

		// Enhanced materials
		this.textMaterial = null
		this.projectileMaterial = null
		this.envMap = null

		// Event handlers for cleanup
		this.animationId = null
		this.clickHandler = null
		this.keydownHandler = null
		this.resizeHandler = null
		this.mousemoveHandler = null
	}

	getResponsiveCameraZ() {
		const screenWidth = window.innerWidth
		if (screenWidth < 480) return 80
		else if (screenWidth < 768) return 50
		else if (screenWidth < 1024) return 45
		else return 35
	}

	init(container) {
		this.container = container
		this.setupGraphics()
		this.setupPostProcessing()
		this.setupPhysics()
		this.createEnvironment()
		this.loadFont()
		this.setupEventListeners()
		this.hideLoader()
		this.isInitialized = true
		this.animate()
	}

	setupGraphics() {
		this.scene = new THREE.Scene()
		this.scene.background = new THREE.Color(0xf9f9f9)
		this.scene.fog = new THREE.Fog(0xf9f9f9, 90, 100)

		const aspect = window.innerWidth / window.innerHeight
		this.camera = new THREE.PerspectiveCamera(35, aspect, 1, 100)
		this.camera.position.set(0, 6, this.targetCameraZ)
		this.camera.lookAt(0, 3, 0)

		this.renderer = new THREE.WebGLRenderer({
			antialias: false,
			powerPreference: 'high-performance',
		})
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
		this.renderer.setSize(window.innerWidth, window.innerHeight)
		this.renderer.shadowMap.enabled = true
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping
		this.renderer.toneMappingExposure = 1.0

		this.container.appendChild(this.renderer.domElement)

		// Enhanced lighting setup
		this.setupLighting()
		this.setupEnvironment()
		this.setupMaterials()
	}

	setupLighting() {
		// Reduced ambient light
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.05)
		this.scene.add(ambientLight)

		// Reduced main directional light (key light)
		const keyLight = new THREE.DirectionalLight(0xffffff, 0.5)
		keyLight.position.set(30, 30, 30)
		keyLight.castShadow = true
		keyLight.shadow.camera.left = -30
		keyLight.shadow.camera.right = 30
		keyLight.shadow.camera.top = 30
		keyLight.shadow.camera.bottom = -30
		keyLight.shadow.camera.near = 0.1
		keyLight.shadow.camera.far = 100
		keyLight.shadow.mapSize.width = 1024
		keyLight.shadow.mapSize.height = 1024
		keyLight.shadow.bias = -0.0001
		this.scene.add(keyLight)

		// Reduced fill light
		const fillLight = new THREE.DirectionalLight(0xffffff, 0.85)
		fillLight.position.set(-20, 10, 5)
		this.scene.add(fillLight)
	}

	setupEnvironment() {
		// Create environment map using CubeTextureLoader
		const loader = new THREE.CubeTextureLoader()
		// Using a simple gradient environment
		this.envMap = this.createSimpleEnvMap()
		this.scene.environment = this.envMap
	}

	createSimpleEnvMap() {
		const size = 256
		const canvas = document.createElement('canvas')
		canvas.width = size
		canvas.height = size
		const context = canvas.getContext('2d')

		// Create darker gradient
		const gradient = context.createLinearGradient(0, 0, 0, size)
		gradient.addColorStop(0, '#d0d0d0')
		gradient.addColorStop(0.5, '#b0b0b0')
		gradient.addColorStop(1, '#909090')

		context.fillStyle = gradient
		context.fillRect(0, 0, size, size)

		const texture = new THREE.CanvasTexture(canvas)
		texture.mapping = THREE.EquirectangularReflectionMapping
		return texture
	}

	setupMaterials() {
		// Enhanced text material with PBR properties
		this.textMaterial = new THREE.MeshStandardMaterial({
			color: 0xf8f8f8,
			roughness: 0.3,
		})

		// Enhanced projectile material
		this.projectileMaterial = new THREE.MeshStandardMaterial({
			color: 0x222222,
			roughness: 0.2,
			metalness: 0.8,
			envMapIntensity: 0.6,
		})
	}

	setupPostProcessing() {
		this.composer = new EffectComposer(this.renderer)

		// Base render pass
		const renderPass = new RenderPass(this.scene, this.camera)
		this.composer.addPass(renderPass)

		const n8aopass = new N8AOPass(
			this.scene,
			this.camera,
			window.innerWidth,
			window.innerHeight
		)
		n8aopass.configuration.intensity = 2.0
		n8aopass.configuration.halfRes = true

		this.composer.addPass(n8aopass)

		const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight)
		this.composer.addPass(smaaPass)
	}

	setupPhysics() {
		this.world = new CANNON.World()
		this.world.gravity.set(0, -15, 0)
		this.world.broadphase = new CANNON.NaiveBroadphase()
		this.world.solver.iterations = 10

		// Enhanced contact materials
		const defaultMaterial = new CANNON.Material('default')
		const textMaterial = new CANNON.Material('text')
		const projectileMaterial = new CANNON.Material('projectile')

		// Text contact material
		const textContact = new CANNON.ContactMaterial(
			defaultMaterial,
			textMaterial,
			{
				friction: 0.3,
				restitution: 0.4,
			}
		)
		this.world.addContactMaterial(textContact)

		// Projectile contact materials
		const projectileContact = new CANNON.ContactMaterial(
			projectileMaterial,
			textMaterial,
			{
				friction: 0.1,
				restitution: 0.7,
			}
		)
		this.world.addContactMaterial(projectileContact)

		// Enhanced collision handling
		this.world.addEventListener('beginContact', (event) => {
			this.handleCollision(event)
		})
	}

	handleCollision(event) {
		const bodyA = event.bodyA
		const bodyB = event.bodyB

		let projectileBody = null
		let impactBody = null

		this.projectiles.forEach((proj) => {
			if (proj.body === bodyA) {
				projectileBody = bodyA
				impactBody = bodyB
			} else if (proj.body === bodyB) {
				projectileBody = bodyB
				impactBody = bodyA
			}
		})

		if (projectileBody && this.textBodies.includes(impactBody)) {
			const contactPoint = new THREE.Vector3(
				projectileBody.position.x,
				projectileBody.position.y,
				projectileBody.position.z
			)
			this.createEnhancedImpactParticles(contactPoint, projectileBody.velocity)
		}
	}

	createEnhancedImpactParticles(position, velocity) {
		const particleCount = 200
		const geometry = new THREE.BufferGeometry()
		const positions = new Float32Array(particleCount * 3)
		const velocities = []
		const colors = new Float32Array(particleCount * 3)
		const sizes = new Float32Array(particleCount)

		for (let i = 0; i < particleCount; i++) {
			positions[i * 3] = position.x + (Math.random() - 0.5) * 0.5
			positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.5
			positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.5

			const speed = 5 + Math.random() * 30
			const theta = Math.random() * Math.PI * 2
			const phi = Math.random() * Math.PI * 0.4

			const vel = new THREE.Vector3(
				Math.sin(phi) * Math.cos(theta) * speed,
				Math.cos(phi) * speed + 3,
				Math.sin(phi) * Math.sin(theta) * speed
			)

			if (velocity) {
				vel.x += velocity.x * 0.15
				vel.z += velocity.z * 0.15
			}

			velocities.push(vel)

			// Enhanced color variation
			const hue = 0.1 + Math.random() * 0.9 // 0.1 to 1.0 (covers most of the color spectrum)
			const saturation = 0.1 + Math.random() * 0.9 // 0.1 to 1.0 (low to high saturation)
			const lightness = 0.3 + Math.random() * 0.7 // 0.3 to 0.7 (darker colors for better visibility)
			const color = new THREE.Color().setHSL(hue, saturation, lightness)

			colors[i * 3] = color.r
			colors[i * 3 + 1] = color.g
			colors[i * 3 + 2] = color.b

			sizes[i] = 0.1 + Math.random() * 0.8
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
		geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

		const material = new THREE.ShaderMaterial({
			uniforms: {
				time: { value: 0 },
				opacity: { value: 1 },
			},
			vertexShader: `
				attribute float size;
				attribute vec3 color;
				varying vec3 vColor;
				varying float vSize;
				uniform float time;
				
				void main() {
					vColor = color;
					vSize = size;
					
					vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
					gl_PointSize = size * (300.0 / -mvPosition.z);
					gl_Position = projectionMatrix * mvPosition;
				}
			`,
			fragmentShader: `
				varying vec3 vColor;
				uniform float opacity;
				
				void main() {
					float r = distance(gl_PointCoord, vec2(0.5));
					if (r > 0.5) discard;
					
					float alpha = 1.0 - smoothstep(0.48, 0.5, r);
					gl_FragColor = vec4(vColor, alpha * opacity);
				}
			`,
			transparent: true,
			depthWrite: false,
		})

		const points = new THREE.Points(geometry, material)
		this.scene.add(points)

		const particleData = {
			mesh: points,
			velocities: velocities,
			material: material,
			life: 1.0,
			gravity: -25,
		}

		this.particles.push(particleData)

		// Enhanced fade out animation
		gsap.to(material.uniforms.opacity, {
			value: 0,
			delay: 1.0,
			duration: 2.0,
			ease: 'power2.out',
			onComplete: () => {
				this.scene.remove(points)
				geometry.dispose()
				material.dispose()
				const idx = this.particles.indexOf(particleData)
				if (idx > -1) this.particles.splice(idx, 1)
			},
		})
	}

	updateParticles(deltaTime) {
		this.particles.forEach((data) => {
			const positions = data.mesh.geometry.attributes.position.array

			// Update time uniform for shader effects
			if (data.material.uniforms.time) {
				data.material.uniforms.time.value += deltaTime
			}

			for (let i = 0; i < data.velocities.length; i++) {
				const vel = data.velocities[i]

				vel.y += data.gravity * deltaTime
				vel.multiplyScalar(0.985) // Enhanced drag

				positions[i * 3] += vel.x * deltaTime
				positions[i * 3 + 1] += vel.y * deltaTime
				positions[i * 3 + 2] += vel.z * deltaTime
			}

			data.mesh.geometry.attributes.position.needsUpdate = true
		})
	}

	createEnvironment() {
		// Enhanced ground with better material
		const groundGeometry = new THREE.PlaneGeometry(100, 100, 10, 10)
		const groundMaterial = new THREE.MeshStandardMaterial({
			color: 0xf9f9f9,
			roughness: 0.9,
			metalness: 0.0,
		})

		const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)
		groundMesh.rotation.x = -Math.PI / 2
		groundMesh.receiveShadow = true
		groundMesh.position.y = -0.3
		this.scene.add(groundMesh)

		const groundShape = new CANNON.Box(new CANNON.Vec3(100, 0.1, 100))
		const groundBody = new CANNON.Body({
			mass: 0,
			shape: groundShape,
			position: new CANNON.Vec3(0, -0.1, 0),
		})
		this.world.addBody(groundBody)

		// Invisible walls
		this.createInvisibleWall(0, 10, -25, 50, 20, 0.5)
		this.createInvisibleWall(-35, 10, 0, 0.5, 20, 50)
		this.createInvisibleWall(35, 10, 0, 0.5, 20, 50)
	}

	createInvisibleWall(x, y, z, width, height, depth) {
		const shape = new CANNON.Box(
			new CANNON.Vec3(width / 2, height / 2, depth / 2)
		)
		const body = new CANNON.Body({
			mass: 0,
			shape: shape,
			position: new CANNON.Vec3(x, y, z),
		})
		this.world.addBody(body)
	}

	loadFont() {
		const loader = new FontLoader()
		loader.load(
			'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
			(font) => {
				this.font = font
				this.create404Text()
			}
		)
	}

	create404Text() {
		if (!this.font) return

		const numbers = ['4', '0', '4']
		const spacing = 6.5
		const startX = -spacing

		numbers.forEach((num, index) => {
			this.createTextBlock(num, startX + index * spacing, 8, 0)
		})

		'Not found'
			.toUpperCase()
			.split('')
			.forEach((letter, index) => {
				this.createTextBlock(letter, -9 + index * 2.4, 8, 4, 2)
			})

		// this.createGroundText()
	}

	createGroundText() {
		const textGeometry = new TextGeometry('Page not found', {
			font: this.font,
			size: 1.75,
			depth: 0.01,
			curveSegments: 14,
		})
		textGeometry.center()

		const material = new THREE.MeshStandardMaterial({
			color: 0x000000,
			roughness: 0.9,
		})

		const mesh = new THREE.Mesh(textGeometry, material)
		mesh.rotation.x = -Math.PI * 0.5
		mesh.position.y = -0.1
		mesh.position.z = 7
		mesh.receiveShadow = true
		this.scene.add(mesh)
	}

	createTextBlock(text, x, y, z, size = 8) {
		const textGeometry = new TextGeometry(text, {
			font: this.font,
			size: size,
			depth: 1.75,
			curveSegments: 16,
			bevelEnabled: true,
			bevelThickness: 0.3,
			bevelSize: 0.2,
			bevelSegments: 12,
		})

		textGeometry.computeBoundingBox()
		const centerOffsetX =
			-0.5 * (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x)
		const centerOffsetY =
			-0.5 * (textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y)
		const centerOffsetZ =
			-0.5 * (textGeometry.boundingBox.max.z - textGeometry.boundingBox.min.z)

		textGeometry.translate(centerOffsetX, centerOffsetY, centerOffsetZ)

		const mesh = new THREE.Mesh(textGeometry, this.textMaterial.clone())
		mesh.position.set(x, y, z)
		mesh.castShadow = true
		mesh.receiveShadow = true
		this.scene.add(mesh)

		const bbox = textGeometry.boundingBox
		const width = bbox.max.x - bbox.min.x
		const height = bbox.max.y - bbox.min.y
		const depth = bbox.max.z - bbox.min.z

		const shape = new CANNON.Box(
			new CANNON.Vec3(width / 2, height / 2, depth / 2)
		)
		const body = new CANNON.Body({
			mass: 4.0,
			shape: shape,
			position: new CANNON.Vec3(x, y, z),
			angularDamping: 0.3,
			linearDamping: 0.3,
		})

		this.world.addBody(body)
		this.textBodies.push(body)
		this.textMeshes.push(mesh)
	}

	shootProjectile(event) {
		this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
		this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

		this.raycaster.setFromCamera(this.mouse, this.camera)

		const radius = 0.7
		const geometry = new THREE.SphereGeometry(radius, 32, 32)
		const material = this.projectileMaterial.clone()

		const mesh = new THREE.Mesh(geometry, material)
		mesh.castShadow = true
		mesh.receiveShadow = true
		mesh.scale.setScalar(0.1)

		const pos = this.camera.position.clone()
		const direction = this.raycaster.ray.direction.clone()
		pos.add(direction.multiplyScalar(1.0))

		mesh.position.copy(pos)
		this.scene.add(mesh)

		const shape = new CANNON.Sphere(radius)
		const body = new CANNON.Body({
			mass: 5,
			shape: shape,
			position: new CANNON.Vec3(pos.x, pos.y, pos.z),
		})

		const velocity = this.raycaster.ray.direction.clone()
		velocity.multiplyScalar(60)
		body.velocity.set(velocity.x, velocity.y, velocity.z)

		this.world.addBody(body)
		this.projectiles.push({ mesh, body })

		// Enhanced projectile animations
		gsap.to(mesh.scale, {
			x: 1,
			y: 1,
			z: 1,
			duration: 0.15,
			ease: 'back.out(2)',
		})

		// Add glowing effect with reduced intensity
		const pointLight = new THREE.PointLight(0xffffff, 0.5, 5)
		mesh.add(pointLight)

		if (this.projectiles.length > this.maxProjectiles) {
			const old = this.projectiles.shift()
			this.scene.remove(old.mesh)
			this.world.removeBody(old.body)
			old.mesh.geometry.dispose()
			old.mesh.material.dispose()
		}
	}

	shakeScene() {
		this.textBodies.forEach((body) => {
			const impulse = new CANNON.Vec3(
				(Math.random() - 0.5) * 15,
				Math.random() * 20,
				(Math.random() - 0.5) * 15
			)
			body.applyImpulse(impulse, body.position)
		})

		// Camera shake
		gsap.to(this.camera.position, {
			x: this.camera.position.x + (Math.random() - 0.5) * 2,
			y: this.camera.position.y + (Math.random() - 0.5) * 2,
			duration: 0.1,
			ease: 'power2.out',
			yoyo: true,
			repeat: 3,
		})
	}

	setupEventListeners() {
		// Store handlers as instance methods for proper cleanup
		this.clickHandler = (e) => {
			if (this.isInitialized) {
				this.shootProjectile(e)
			}
		}

		this.keydownHandler = (e) => {
			if (e.code === 'Space' && this.isInitialized) {
				e.preventDefault()
				this.shakeScene()
			}
		}

		this.resizeHandler = () => {
			this.camera.aspect = window.innerWidth / window.innerHeight
			this.camera.updateProjectionMatrix()
			this.renderer.setSize(window.innerWidth, window.innerHeight)

			if (this.composer) {
				this.composer.setSize(window.innerWidth, window.innerHeight)
			}

			this.targetCameraZ = this.getResponsiveCameraZ()
		}

		this.mousemoveHandler = (e) => {
			const x = (e.clientX / window.innerWidth) * 2 - 1
			const y = (e.clientY / window.innerHeight) * 2 - 1

			this.targetCameraX = -x * 3
			this.targetCameraY = 6 - y * 3
		}

		// Add event listeners
		window.addEventListener('click', this.clickHandler)
		window.addEventListener('keydown', this.keydownHandler)
		window.addEventListener('resize', this.resizeHandler)
		window.addEventListener('mousemove', this.mousemoveHandler)
	}

	updatePhysics(deltaTime) {
		this.world.step(deltaTime)

		this.textMeshes.forEach((mesh, i) => {
			const body = this.textBodies[i]
			mesh.position.copy(body.position)
			mesh.quaternion.copy(body.quaternion)
		})

		this.projectiles.forEach((proj) => {
			proj.mesh.position.copy(proj.body.position)
			proj.mesh.quaternion.copy(proj.body.quaternion)
		})
	}

	hideLoader() {
		const loader = document.getElementById('loader')
		if (loader) {
			loader.style.display = 'none'
		}
	}

	animate() {
		this.animationId = requestAnimationFrame(() => this.animate())

		// Enhanced camera movement
		if (window.innerWidth > 1024) {
			this.camera.position.x = THREE.MathUtils.lerp(
				this.camera.position.x,
				this.targetCameraX,
				this.lerpFactor
			)
			this.camera.position.y = THREE.MathUtils.lerp(
				this.camera.position.y,
				this.targetCameraY,
				this.lerpFactor
			)
		}

		this.camera.position.z = THREE.MathUtils.lerp(
			this.camera.position.z,
			this.targetCameraZ,
			this.lerpFactor
		)

		this.camera.lookAt(0, 3, 0)

		const deltaTime = Math.min(this.clock.getDelta(), 0.016)

		this.updateParticles(deltaTime)
		this.updatePhysics(deltaTime)

		// Use post-processing composer instead of direct render
		if (this.composer) {
			this.composer.render()
		} else {
			this.renderer.render(this.scene, this.camera)
		}
	}

	// Kill method to properly clean up this scene instance
	kill() {
		killRealisticPhysics404Scene(this)
	}
}

// Standalone kill function to properly clean up the RealisticPhysics404Scene
export function killRealisticPhysics404Scene(sceneInstance) {
	if (!sceneInstance) return

	// Stop animation loop
	if (sceneInstance.animationId) {
		cancelAnimationFrame(sceneInstance.animationId)
		sceneInstance.animationId = null
	}
	sceneInstance.isInitialized = false

	// Remove event listeners
	if (sceneInstance.clickHandler) {
		window.removeEventListener('click', sceneInstance.clickHandler)
		sceneInstance.clickHandler = null
	}
	if (sceneInstance.keydownHandler) {
		window.removeEventListener('keydown', sceneInstance.keydownHandler)
		sceneInstance.keydownHandler = null
	}
	if (sceneInstance.resizeHandler) {
		window.removeEventListener('resize', sceneInstance.resizeHandler)
		sceneInstance.resizeHandler = null
	}
	if (sceneInstance.mousemoveHandler) {
		window.removeEventListener('mousemove', sceneInstance.mousemoveHandler)
		sceneInstance.mousemoveHandler = null
	}

	// Kill any ongoing GSAP animations
	gsap.killTweensOf(sceneInstance.camera.position)

	// Clean up particles
	if (sceneInstance.particles) {
		sceneInstance.particles.forEach((particle) => {
			if (particle.mesh) {
				sceneInstance.scene.remove(particle.mesh)
				if (particle.mesh.geometry) particle.mesh.geometry.dispose()
				if (particle.mesh.material) particle.mesh.material.dispose()
			}
		})
		sceneInstance.particles = []
	}

	// Clean up projectiles
	if (sceneInstance.projectiles) {
		sceneInstance.projectiles.forEach((proj) => {
			if (proj.mesh) {
				sceneInstance.scene.remove(proj.mesh)
				if (proj.mesh.geometry) proj.mesh.geometry.dispose()
				if (proj.mesh.material) proj.mesh.material.dispose()
			}
			if (proj.body && sceneInstance.world) {
				sceneInstance.world.removeBody(proj.body)
			}
		})
		sceneInstance.projectiles = []
	}

	// Clean up text meshes and physics bodies
	if (sceneInstance.textMeshes) {
		sceneInstance.textMeshes.forEach((mesh) => {
			if (mesh) {
				sceneInstance.scene.remove(mesh)
				if (mesh.geometry) mesh.geometry.dispose()
				if (mesh.material) mesh.material.dispose()
			}
		})
		sceneInstance.textMeshes = []
	}

	if (sceneInstance.textBodies && sceneInstance.world) {
		sceneInstance.textBodies.forEach((body) => {
			if (body) {
				sceneInstance.world.removeBody(body)
			}
		})
		sceneInstance.textBodies = []
	}

	// Clean up other physics bodies
	if (sceneInstance.bodies && sceneInstance.world) {
		sceneInstance.bodies.forEach((body) => {
			if (body) {
				sceneInstance.world.removeBody(body)
			}
		})
		sceneInstance.bodies = []
	}

	// Clean up meshes
	if (sceneInstance.meshes) {
		sceneInstance.meshes.forEach((mesh) => {
			if (mesh) {
				sceneInstance.scene.remove(mesh)
				if (mesh.geometry) mesh.geometry.dispose()
				if (mesh.material) mesh.material.dispose()
			}
		})
		sceneInstance.meshes = []
	}

	// Dispose of materials
	if (sceneInstance.textMaterial) {
		sceneInstance.textMaterial.dispose()
		sceneInstance.textMaterial = null
	}
	if (sceneInstance.projectileMaterial) {
		sceneInstance.projectileMaterial.dispose()
		sceneInstance.projectileMaterial = null
	}

	// Dispose of environment map
	if (sceneInstance.envMap) {
		sceneInstance.envMap.dispose()
		sceneInstance.envMap = null
	}

	// Clean up scene objects
	if (sceneInstance.scene) {
		sceneInstance.scene.traverse((object) => {
			if (object.geometry) object.geometry.dispose()
			if (object.material) {
				if (Array.isArray(object.material)) {
					object.material.forEach((material) => material.dispose())
				} else {
					object.material.dispose()
				}
			}
		})
		sceneInstance.scene.clear()
		sceneInstance.scene = null
	}

	// Clean up physics world
	if (sceneInstance.world) {
		// Remove all bodies from world
		while (sceneInstance.world.bodies.length > 0) {
			sceneInstance.world.removeBody(sceneInstance.world.bodies[0])
		}
		// Clear contact materials
		sceneInstance.world.contactMaterialTable = {}
		sceneInstance.world = null
	}

	// Clean up post-processing composer
	if (sceneInstance.composer) {
		sceneInstance.composer.dispose()
		sceneInstance.composer = null
	}

	// Clean up renderer
	if (sceneInstance.renderer) {
		sceneInstance.renderer.dispose()
		if (
			sceneInstance.renderer.domElement &&
			sceneInstance.renderer.domElement.parentNode
		) {
			sceneInstance.renderer.domElement.parentNode.removeChild(
				sceneInstance.renderer.domElement
			)
		}
		sceneInstance.renderer = null
	}

	// Clean up camera
	sceneInstance.camera = null

	// Clean up other references
	sceneInstance.container = null
	sceneInstance.font = null
	sceneInstance.clock = null
	sceneInstance.mouse = null
	sceneInstance.raycaster = null
}

let scene

export default function initNotFoundContainer() {
	const container = document.querySelector('#not-found-canvas')
	if (!container) return

	scene = new RealisticPhysics404Scene()
	scene.init(container)
	return scene
}

export function kill404Scene() {
	if (!scene) return
	killRealisticPhysics404Scene(scene)
}
