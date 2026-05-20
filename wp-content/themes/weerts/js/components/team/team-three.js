import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import * as CANNON from 'cannon-es'
import { gsap } from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'

gsap.registerPlugin(ScrambleTextPlugin)

let teamThreeApp

class TeamThreeAnimation {
	constructor(container) {
		this.container = container
		this.heads = []
		this.hoveredHead = null
		this.selectedBody = null
		this.mouseConstraint = null
		this.walls = []

		// GSAP quickTo for smooth hover box animations
		this.hoverBoxQuickTo = {
			left: null,
			top: null,
			width: null,
			height: null,
		}

		this.init()
		this.loadHeads()
		this.animate()
	}

	init() {
		// Scene
		this.scene = new THREE.Scene()

		// Camera
		const aspect = this.container.clientWidth / this.container.clientHeight
		this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000)
		this.camera.position.set(0, 1, 15)
		this.camera.lookAt(0, 0, 0)

		// Renderer
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
		this.renderer.setSize(
			this.container.clientWidth,
			this.container.clientHeight
		)
		this.renderer.shadowMap.enabled = true
		this.container.appendChild(this.renderer.domElement)

		this.renderer.domElement.style.position = 'absolute'
		this.renderer.domElement.style.top = '0'
		this.renderer.domElement.style.left = '0'

		// Lights
		const ambientLight = new THREE.AmbientLight(0xffffff, 2.0)
		this.scene.add(ambientLight)
		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
		directionalLight.position.set(5, 10, 5)
		directionalLight.castShadow = true

		// Configure shadow camera to cover your entire ground area
		directionalLight.shadow.camera.left = -25
		directionalLight.shadow.camera.right = 25
		directionalLight.shadow.camera.top = 25
		directionalLight.shadow.camera.bottom = -25
		directionalLight.shadow.camera.near = 0.1
		directionalLight.shadow.camera.far = 50

		// Optional: increase shadow map resolution for better quality
		directionalLight.shadow.mapSize.width = 2048
		directionalLight.shadow.mapSize.height = 2048

		this.scene.add(directionalLight)

		// Physics
		this.world = new CANNON.World()
		this.world.gravity.set(0, -9.82, 0)
		this.world.broadphase = new CANNON.NaiveBroadphase()
		this.world.solver.iterations = 10

		// Add material for less bouncy physics
		this.defaultMaterial = new CANNON.Material('default')
		this.world.defaultContactMaterial = new CANNON.ContactMaterial(
			this.defaultMaterial,
			this.defaultMaterial,
			{
				friction: 0.4,
				restitution: 0.3, // Less bouncy
			}
		)

		// Visual ground
		const groundGeometry = new THREE.PlaneGeometry(40, 40)
		const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 })
		const ground = new THREE.Mesh(groundGeometry, groundMaterial)
		ground.rotation.x = -Math.PI / 2
		ground.position.y = -3
		ground.receiveShadow = true
		this.scene.add(ground)

		// Ground
		const groundShape = new CANNON.Plane()
		const groundBody = new CANNON.Body({
			mass: 0,
			material: this.defaultMaterial,
		})
		groundBody.addShape(groundShape)
		groundBody.quaternion.setFromAxisAngle(
			new CANNON.Vec3(1, 0, 0),
			-Math.PI / 2
		)
		groundBody.position.set(0, -3, 0)
		this.world.addBody(groundBody)

		// Create responsive walls
		this.createWalls()

		// Hover box
		this.createHoverBox()

		// Mouse controls
		this.setupMouseControls()

		// Raycaster
		this.raycaster = new THREE.Raycaster()
		this.mouse = new THREE.Vector2()

		// Resize handler
		window.addEventListener('resize', () => this.onWindowResize())
	}

	// Calculate responsive wall positions based on camera frustum
	calculateWallBoundaries() {
		const aspect = this.container.clientWidth / this.container.clientHeight
		const fov = this.camera.fov * (Math.PI / 180) // Convert to radians
		const distance = this.camera.position.z // Distance from camera to center

		// Calculate the visible width and height at z=0 (center of scene)
		const visibleHeight = 2 * Math.tan(fov / 2) * distance
		const visibleWidth = visibleHeight * aspect

		// Reasonable padding to keep objects visible but not too constrained
		const padding = 1.5

		return {
			left: -visibleWidth / 2 + padding,
			right: visibleWidth / 2 - padding,
			top: visibleHeight / 2 - padding,
			bottom: -visibleHeight / 2 + padding,
			front: 1.5,
			back: -1.5,
		}
	}

	getHeadScale() {
		const width = window.innerWidth
		if (width < 768) return 0.9 // or something smaller for mobile
		return 1.5 // default for desktop
	}

	createWalls() {
		const bounds = this.calculateWallBoundaries()
		const wallThickness = 1.0 // Thicker walls to prevent escapes
		const wallHeight = 25 // Taller walls

		// Remove existing walls if they exist (for resize)
		if (this.walls && this.walls.length > 0) {
			this.walls.forEach((wall) => {
				this.world.removeBody(wall)
			})
		}
		this.walls = []

		const wallDepth = Math.abs(bounds.front - bounds.back) + 4 // Extra depth for overlap
		const wallWidth = Math.abs(bounds.right - bounds.left) + 4 // Extra width for overlap

		// Left wall - positioned further out with overlap
		const leftWallShape = new CANNON.Box(
			new CANNON.Vec3(wallThickness / 2, wallHeight / 2, wallDepth / 2)
		)
		const leftWallBody = new CANNON.Body({
			mass: 0,
			material: this.defaultMaterial,
		})
		leftWallBody.addShape(leftWallShape)
		leftWallBody.position.set(
			bounds.left - wallThickness,
			wallHeight / 2 - 3,
			0
		)
		this.world.addBody(leftWallBody)
		this.walls.push(leftWallBody)

		// Right wall
		const rightWallBody = new CANNON.Body({
			mass: 0,
			material: this.defaultMaterial,
		})
		rightWallBody.addShape(leftWallShape)
		rightWallBody.position.set(
			bounds.right + wallThickness,
			wallHeight / 2 - 3,
			0
		)
		this.world.addBody(rightWallBody)
		this.walls.push(rightWallBody)

		// Back wall - positioned further out with overlap
		const backWallShape = new CANNON.Box(
			new CANNON.Vec3(wallWidth / 2, wallHeight / 2, wallThickness / 2)
		)
		const backWallBody = new CANNON.Body({
			mass: 0,
			material: this.defaultMaterial,
		})
		backWallBody.addShape(backWallShape)
		backWallBody.position.set(
			0,
			wallHeight / 2 - 3,
			bounds.back - wallThickness
		)
		this.world.addBody(backWallBody)
		this.walls.push(backWallBody)

		// Front wall
		const frontWallBody = new CANNON.Body({
			mass: 0,
			material: this.defaultMaterial,
		})
		frontWallBody.addShape(backWallShape)
		frontWallBody.position.set(
			0,
			wallHeight / 2 - 3,
			bounds.front + wallThickness
		)
		this.world.addBody(frontWallBody)
		this.walls.push(frontWallBody)

		// Add ceiling to prevent objects from flying too high
		const ceilingShape = new CANNON.Box(
			new CANNON.Vec3(wallWidth / 2, wallThickness / 2, wallDepth / 2)
		)
		const ceilingBody = new CANNON.Body({
			mass: 0,
			material: this.defaultMaterial,
		})
		ceilingBody.addShape(ceilingShape)
		ceilingBody.position.set(0, 15, 0) // High ceiling
		this.world.addBody(ceilingBody)
		this.walls.push(ceilingBody)
	}

	createHoverBox() {
		const hoverElement = document.querySelector('.tracker-element')
		this.hoverBox = hoverElement

		// Setup GSAP quickTo for smooth animations
		if (this.hoverBox) {
			this.hoverBoxQuickTo.left = gsap.quickTo(this.hoverBox, 'left', {
				duration: 0.3,
				ease: 'power2.out',
			})
			this.hoverBoxQuickTo.top = gsap.quickTo(this.hoverBox, 'top', {
				duration: 0.3,
				ease: 'power2.out',
			})
			this.hoverBoxQuickTo.width = gsap.quickTo(this.hoverBox, 'width', {
				duration: 0.2,
				ease: 'power2.out',
			})
			this.hoverBoxQuickTo.height = gsap.quickTo(this.hoverBox, 'height', {
				duration: 0.2,
				ease: 'power2.out',
			})
		}
	}

	// Replace the setupMouseControls method with this updated version that includes touch support

	setupMouseControls() {
		// Helper function to get coordinates from either mouse or touch event
		const getEventCoords = (e) => {
			const rect = this.container.getBoundingClientRect()
			let clientX, clientY

			if (e.touches && e.touches.length > 0) {
				// Touch event
				clientX = e.touches[0].clientX
				clientY = e.touches[0].clientY
			} else {
				// Mouse event
				clientX = e.clientX
				clientY = e.clientY
			}

			return {
				x: ((clientX - rect.left) / rect.width) * 2 - 1,
				y: -((clientY - rect.top) / rect.height) * 2 + 1,
			}
		}

		// Helper function to update mouse position and check hover
		const updateMousePosition = (e) => {
			const coords = getEventCoords(e)
			this.mouse.x = coords.x
			this.mouse.y = coords.y
			this.checkHover()
		}

		// Helper function to start dragging
		const startDrag = (e) => {
			// Prevent default touch behavior (scrolling, zooming)
			e.preventDefault()

			if (this.hoveredHead) {
				this.selectedBody = this.hoveredHead.userData.body
				this.selectedZ = this.selectedBody.position.z
				const pos = this.getMouseWorldPosition(this.selectedZ)

				// Store original angular velocity and apply damping
				this.selectedBody.angularVelocity.set(0, 0, 0)
				this.selectedBody.angularDamping = 0.9 // High damping to reduce spinning

				// Create mouse constraint with weaker force
				const constraintBody = new CANNON.Body({ mass: 0 })
				constraintBody.position.copy(pos)
				this.world.addBody(constraintBody)

				this.mouseConstraint = new CANNON.PointToPointConstraint(
					this.selectedBody,
					new CANNON.Vec3(0, 0, 0),
					constraintBody,
					new CANNON.Vec3(0, 0, 0),
					1000 // Reduced maxForce for smoother movement
				)
				this.world.addConstraint(this.mouseConstraint)
				this.mouseConstraintBody = constraintBody
			}
		}

		// Helper function to update drag position
		const updateDrag = (e) => {
			// Prevent default touch behavior
			if (e.touches) {
				e.preventDefault()
			}

			if (this.mouseConstraint && this.mouseConstraintBody) {
				const coords = getEventCoords(e)
				this.mouse.x = coords.x
				this.mouse.y = coords.y
				const pos = this.getMouseWorldPosition(this.selectedZ)

				this.mouseConstraintBody.position.copy(pos)

				// Check hover during drag to update overlay if head moves away from cursor
				this.checkHover()
			}
		}

		// Helper function to end dragging
		const endDrag = (e) => {
			if (this.mouseConstraint) {
				// Reset angular damping when releasing
				if (this.selectedBody) {
					this.selectedBody.angularDamping = 0.01 // Back to default
				}

				this.world.removeConstraint(this.mouseConstraint)
				this.world.removeBody(this.mouseConstraintBody)
				this.mouseConstraint = null
				this.mouseConstraintBody = null
				this.selectedBody = null

				// Force check hover after releasing to update overlay state
				this.checkHover()
			}
		}

		// Mouse events
		this.container.addEventListener('mousemove', updateMousePosition)
		this.container.addEventListener('mousedown', startDrag)
		this.container.addEventListener('mousemove', updateDrag)
		this.container.addEventListener('mouseup', endDrag)

		// Touch events
		this.container.addEventListener(
			'touchstart',
			(e) => {
				updateMousePosition(e)
				startDrag(e)
			},
			{ passive: false }
		)

		this.container.addEventListener(
			'touchmove',
			(e) => {
				updateMousePosition(e)
				updateDrag(e)
			},
			{ passive: false }
		)

		this.container.addEventListener('touchend', endDrag, { passive: false })
		this.container.addEventListener('touchcancel', endDrag, { passive: false })

		// Prevent context menu on long press (mobile)
		this.container.addEventListener('contextmenu', (e) => {
			e.preventDefault()
		})
	}

	getMouseWorldPosition(maintainZ = null) {
		const vec = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5)
		vec.unproject(this.camera)
		vec.sub(this.camera.position).normalize()

		if (maintainZ !== null) {
			// Calculate the distance needed to maintain the Z position
			const t = (maintainZ - this.camera.position.z) / vec.z
			vec.multiplyScalar(t)
			vec.add(this.camera.position)
		} else {
			const distance = 5
			vec.multiplyScalar(distance)
			vec.add(this.camera.position)
		}

		return vec
	}

	checkHover() {
		this.raycaster.setFromCamera(this.mouse, this.camera)
		const intersects = this.raycaster.intersectObjects(this.heads)

		if (intersects.length > 0) {
			const newHoveredHead = intersects[0].object.parent
			const isNewHover = this.hoveredHead !== newHoveredHead
			this.hoveredHead = newHoveredHead
			const data = this.hoveredHead.userData

			// Get bounding box of the head
			const box = new THREE.Box3().setFromObject(this.hoveredHead)
			const size = new THREE.Vector3()
			const center = new THREE.Vector3()
			box.getSize(size)
			box.getCenter(center)

			// Project corners to screen space
			const corners = [
				new THREE.Vector3(
					center.x - size.x / 2,
					center.y - size.y / 2,
					center.z
				),
				new THREE.Vector3(
					center.x + size.x / 2,
					center.y + size.y / 2,
					center.z
				),
			]

			const screenCorners = corners.map((corner) => {
				const projected = corner.project(this.camera)
				const rect = this.container.getBoundingClientRect()
				return {
					x: ((projected.x + 1) / 2) * rect.width,
					y: ((-projected.y + 1) / 2) * rect.height,
				}
			})

			// Position and size the box
			const left = Math.min(screenCorners[0].x, screenCorners[1].x)
			const top = Math.min(screenCorners[0].y, screenCorners[1].y)
			const width = Math.abs(screenCorners[1].x - screenCorners[0].x)
			const height = Math.abs(screenCorners[1].y - screenCorners[0].y)

			this.hoverBoxQuickTo.left(left)
			this.hoverBoxQuickTo.top(top)
			this.hoverBoxQuickTo.width(width * 0.9)
			this.hoverBoxQuickTo.height(height * 0.9)

			if (isNewHover) {
				// Add text above the box
				const trackerDetails = this.hoverBox.querySelector(
					'.tracker-element-details'
				)

				const firstChild = trackerDetails.querySelector(
					':scope *:first-of-type'
				)
				const secondChild = trackerDetails.querySelector(
					':scope *:nth-of-type(2)'
				)

				if (firstChild) firstChild.innerHTML = `TARGET: ${data.name}`
				if (secondChild) secondChild.innerHTML = `${data.jobTitle}`

				gsap.to(this.hoverBox, {
					opacity: 1,
					duration: 0.3,
					ease: 'power2.out',
				})

				gsap.from([firstChild, secondChild], {
					duration: 0.3,
					delay: 0.1,
					stagger: 0.1,
					scrambleText: {
						text: '[REDACTED]',
					},
				})
			}
		} else {
			this.hoveredHead = null
			gsap.to(this.hoverBox, {
				opacity: 0,
				duration: 0.3,
				ease: 'power2.out',
			})
		}
	}

	loadHeads() {
		const teamElements = this.container.querySelectorAll('[team-id]')
		const loader = new GLTFLoader()

		// Setup Draco loader
		const dracoLoader = new DRACOLoader()
		dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
		loader.setDRACOLoader(dracoLoader)

		const minGray = 0.2 // darkest value
		const maxGray = 1.0 // brightest value

		teamElements.forEach((element, index) => {
			const glbLink = element.getAttribute('team-glb-link')
			const name = element.getAttribute('team-name')
			const jobTitle = element.getAttribute('team-job-title')

			loader.load(glbLink, (gltf) => {
				const head = gltf.scene
				head.traverse((child) => {
					if (child.isMesh) {
						child.castShadow = true
						child.receiveShadow = true
						// Force recalculate normals
						child.geometry.computeVertexNormals()
						// Ensure normals are normalized
						child.geometry.normalizeNormals()
						// Map index to range [minGray, maxGray]
						const t = index / (teamElements.length - 1)
						const gray = maxGray - t * (maxGray - minGray)

						const color = new THREE.Color(gray, gray, gray)
						// child.material = new THREE.MeshStandardMaterial({ color })
					}
				})

				// Get current wall boundaries for responsive positioning
				const bounds = this.calculateWallBoundaries()
				const safeWidth = (bounds.right - bounds.left) * 0.7 // Conservative but not too restrictive
				const safeDepth = (bounds.front - bounds.back) * 0.7

				// Position randomly within safe boundaries
				const x = (Math.random() - 0.5) * safeWidth
				const y = 8 + Math.random() * 4
				const z = (Math.random() - 0.5) * safeDepth

				head.position.set(x, y, z)

				const scale = this.getHeadScale()
				head.scale.set(scale, scale, scale)
				head.userData.originalScale = scale

				// Store data
				head.userData = {
					name: name,
					jobTitle: jobTitle,
				}

				const radius = 0.9 * scale // scale physics to match visual
				const shape = new CANNON.Sphere(radius)
				const body = new CANNON.Body({
					mass: 1,
					position: new CANNON.Vec3(x, y, z),
					shape: shape,
					material: this.defaultMaterial,
					linearDamping: 0.1, // Some air resistance
					angularDamping: 0.1, // Reduce spinning over time
				})
				this.world.addBody(body)
				head.userData.body = body

				this.scene.add(head)
				this.heads.push(head)
			})
		})
	}

	animate() {
		requestAnimationFrame(() => this.animate())
		this.checkHover()

		// Update physics
		this.world.step(1 / 60)

		// Update head positions from physics with escape detection
		this.heads.forEach((head) => {
			if (head.userData.body) {
				const body = head.userData.body
				const bounds = this.calculateWallBoundaries()

				// Check if object has escaped the boundaries
				const margin = 3 // Detection margin
				const escaped =
					body.position.x < bounds.left - margin ||
					body.position.x > bounds.right + margin ||
					body.position.z < bounds.back - margin ||
					body.position.z > bounds.front + margin ||
					body.position.y > 20 ||
					body.position.y < -5

				if (escaped) {
					// Reset to safe position
					const safeX =
						(Math.random() - 0.5) * (bounds.right - bounds.left) * 0.5
					const safeZ =
						(Math.random() - 0.5) * (bounds.front - bounds.back) * 0.5
					body.position.set(safeX, 8, safeZ)
					body.velocity.set(0, 0, 0)
					body.angularVelocity.set(0, 0, 0)
				}

				// Prevent objects from falling too low (below ground)
				if (body.position.y < -2.5) {
					body.position.y = -2.5
					body.velocity.y = Math.max(0, body.velocity.y)
				}

				head.position.copy(body.position)
				head.quaternion.copy(body.quaternion)
			}
		})

		this.renderer.render(this.scene, this.camera)
	}

	onWindowResize() {
		this.camera.aspect =
			this.container.clientWidth / this.container.clientHeight
		this.camera.updateProjectionMatrix()
		this.renderer.setSize(
			this.container.clientWidth,
			this.container.clientHeight
		)

		const newScale = this.getHeadScale()
		this.heads.forEach((head) => {
			head.scale.set(newScale, newScale, newScale)
			head.userData.originalScale = newScale

			// Update physics body size to match new scale
			if (head.userData.body) {
				const newRadius = 0.9 * newScale
				head.userData.body.shapes[0] = new CANNON.Sphere(newRadius)
				head.userData.body.updateBoundingRadius()
			}
		})

		// Recreate walls with new boundaries
		this.createWalls()
	}

	destroy() {
		window.removeEventListener('resize', this.onWindowResize)
		this.container.removeChild(this.renderer.domElement)
		this.renderer.dispose()
	}
}

export default function runTeamThree() {
	const container = document.querySelector('#team-three-container')

	if (!container) return

	teamThreeApp = new TeamThreeAnimation(container)

	return teamThreeApp
}

export function killTeamThree() {
	if (!teamThreeApp) return

	teamThreeApp.destroy()
}
