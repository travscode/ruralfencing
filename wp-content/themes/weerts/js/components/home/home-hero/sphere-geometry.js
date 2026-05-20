import * as THREE from 'three'

// Sphere Data Generator Class
class SphereDataGenerator {
	static generateSphereData(count, radius) {
		const data = new Float32Array(count * 4) // 4 components for RGBA
		const tempVector = new THREE.Vector3()

		for (let i = 0; i < count; i++) {
			this.getRandomSpherePoint(tempVector, radius)
			const i4 = i * 4
			data[i4] = tempVector.x
			data[i4 + 1] = tempVector.y
			data[i4 + 2] = tempVector.z
			data[i4 + 3] = 1.0 // Alpha channel
		}

		return data
	}

	static getRandomSpherePoint(vector, radius) {
		// Use rejection sampling method as described in the article
		do {
			vector.x = Math.random() * 2 - 1
			vector.y = Math.random() * 2 - 1
			vector.z = Math.random() * 2 - 1
		} while (vector.length() > 1)

		return vector.normalize().multiplyScalar(radius)
	}

	static getExactSpherePoint(vector, radius) {
		// More mathematically precise sphere point generation
		const phi = Math.random() * 2 * Math.PI
		const costheta = Math.random() * 2 - 1
		const u = Math.random()

		const theta = Math.acos(costheta)
		const r = radius * Math.cbrt(u)

		vector.x = r * Math.sin(theta) * Math.cos(phi)
		vector.y = r * Math.sin(theta) * Math.sin(phi)
		vector.z = r * Math.cos(theta)

		return vector
	}

	static generateRandomData(count, size) {
		const data = new Float32Array(count * 4) // 4 components for RGBA
		for (let i = 0; i < count; i++) {
			const i4 = i * 4
			data[i4] = (Math.random() * 2 - 1) * size // X
			data[i4 + 1] = (Math.random() * 2 - 1) * size // Y
			data[i4 + 2] = (Math.random() * 2 - 1) * size // Z
			data[i4 + 3] = 1.0 // Alpha
		}
		return data
	}

	static generateCubeData(count, size) {
		const data = new Float32Array(count * 4) // 4 components for RGBA
		const cubeSize = Math.cbrt(count)

		for (let i = 0; i < count; i++) {
			const x = i % cubeSize
			const y = Math.floor(i / cubeSize) % cubeSize
			const z = Math.floor(i / (cubeSize * cubeSize))

			const i4 = i * 4
			data[i4] = (x / cubeSize - 0.5) * size
			data[i4 + 1] = (y / cubeSize - 0.5) * size
			data[i4 + 2] = (z / cubeSize - 0.5) * size
			data[i4 + 3] = 1.0 // Alpha
		}

		return data
	}

	static createDataTexture(data, width, height) {
		const texture = new THREE.DataTexture(
			data,
			width,
			height,
			THREE.RGBAFormat, // Use RGBA format for better compatibility
			THREE.FloatType
		)
		texture.needsUpdate = true
		texture.minFilter = THREE.NearestFilter
		texture.magFilter = THREE.NearestFilter
		texture.generateMipmaps = false
		return texture
	}
}

export default SphereDataGenerator
