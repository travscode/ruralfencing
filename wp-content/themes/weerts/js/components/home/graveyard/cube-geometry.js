import * as THREE from 'three'
import { getLenis } from '../../../utils/smooth-scroll'

export class CubeOutline {
	constructor() {
		this.cubeSize = 220
		this.direction = 1
		this.lenis = getLenis()

		// Share materials across all instances
		this.sharedLineMaterial = new THREE.LineBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0,
		})

		this.sharedPlusMaterial = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0,
		})

		// Create shared geometries for plus symbols
		this.createSharedPlusGeometries()

		this.createCubeOutline()
		this.createVertexPluses()
	}

	createSharedPlusGeometries() {
		const plusSize = 4
		const plusThickness = 0.5

		// Create once and reuse for all plus symbols
		this.horizontalPlusGeometry = new THREE.BoxGeometry(
			plusSize,
			plusThickness,
			plusThickness
		)
		this.verticalPlusGeometry = new THREE.BoxGeometry(
			plusThickness,
			plusSize,
			plusThickness
		)
	}

	createCubeOutline() {
		const h = this.cubeSize / 2

		// More compact vertex definition
		const vertices = new Float32Array([
			// Front face
			-h,
			-h,
			h,
			h,
			-h,
			h,
			h,
			h,
			h,
			-h,
			h,
			h,
			// Back face
			-h,
			-h,
			-h,
			h,
			-h,
			-h,
			h,
			h,
			-h,
			-h,
			h,
			-h,
		])

		// Use Uint16Array for smaller index buffer
		const edges = new Uint16Array([
			// Front face edges
			0, 1, 1, 2, 2, 3, 3, 0,
			// Back face edges
			4, 5, 5, 6, 6, 7, 7, 4,
			// Connecting edges
			0, 4, 1, 5, 2, 6, 3, 7,
		])

		const geometry = new THREE.BufferGeometry()
		geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
		geometry.setIndex(new THREE.BufferAttribute(edges, 1))

		this.mesh = new THREE.LineSegments(geometry, this.sharedLineMaterial)
		this.mesh.rotation.x = -Math.PI * 0.025
		this.mesh.rotation.z = Math.PI * 0.075

		// Enable frustum culling optimization
		this.mesh.frustumCulled = true
	}

	createVertexPluses() {
		const h = this.cubeSize / 2

		// Pre-calculated vertex positions
		const vertexPositions = [
			[-h, -h, h],
			[h, -h, h],
			[h, h, h],
			[-h, h, h],
			[-h, -h, -h],
			[h, -h, -h],
			[h, h, -h],
			[-h, h, -h],
		]

		this.vertexPluses = new THREE.Group()
		this.plusArray = []

		// Use instanced mesh for better performance with many similar objects
		const plusGroup = new THREE.Group()

		vertexPositions.forEach((pos) => {
			const plus = this.createSinglePlus()
			plus.position.set(pos[0], pos[1], pos[2])
			plusGroup.add(plus)
			this.plusArray.push(plus)
		})

		this.vertexPluses = plusGroup
		this.vertexPluses.rotation.x = -Math.PI * 0.025
		this.vertexPluses.rotation.z = Math.PI * 0.075

		// Enable matrix auto update optimization
		this.vertexPluses.matrixAutoUpdate = true
	}

	createSinglePlus() {
		const plusGroup = new THREE.Group()

		// Reuse shared geometries and material
		const horizontalLine = new THREE.Mesh(
			this.horizontalPlusGeometry,
			this.sharedPlusMaterial
		)

		const verticalLine = new THREE.Mesh(
			this.verticalPlusGeometry,
			this.sharedPlusMaterial
		)

		plusGroup.add(horizontalLine, verticalLine)
		return plusGroup
	}

	rotate(speed) {
		const vel = this.lenis.velocity

		if (vel !== 0) {
			this.direction = vel > 0 ? 1 : -1
			const rotation = (0.002 * Math.abs(vel) + speed) * this.direction

			// Update both rotations together
			this.mesh.rotation.y += rotation
			this.vertexPluses.rotation.y += rotation
		} else {
			// Only rotate with base speed when no scroll velocity
			const rotation = speed * this.direction
			this.mesh.rotation.y += rotation
			this.vertexPluses.rotation.y += rotation
		}
	}

	updatePlusesFacing(camera) {
		// Cache camera position to avoid repeated property access
		const camPos = camera.position

		// Use for loop instead of forEach for better performance
		for (let i = 0; i < this.plusArray.length; i++) {
			this.plusArray[i].lookAt(camPos)
		}
	}

	getMesh() {
		return this.mesh
	}

	getVertexPluses() {
		return this.vertexPluses
	}

	dispose() {
		// Dispose shared geometries only once
		if (this.horizontalPlusGeometry) {
			this.horizontalPlusGeometry.dispose()
			this.verticalPlusGeometry.dispose()
		}

		// Dispose shared materials
		if (this.sharedLineMaterial) {
			this.sharedLineMaterial.dispose()
		}

		if (this.sharedPlusMaterial) {
			this.sharedPlusMaterial.dispose()
		}

		// Dispose cube geometry
		if (this.mesh) {
			this.mesh.geometry.dispose()
		}

		// Clear references
		this.plusArray = []
		this.vertexPluses = null
		this.mesh = null
	}
}
