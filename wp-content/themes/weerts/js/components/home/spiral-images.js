import * as THREE from 'three'
import svg from './home-hero/mottosvg'

class SpiralImages {
	constructor() {
		this.radius = 200
		this.height = 70
		this.gap = 80
		this.segments = 64
		this.count = 4
		this.minImagesPerCylinder = 18
		this.imageUrls = []

		this.group = new THREE.Group()
		this.group.position.y = -600
		this.cylinders = []
		this.bannerCylinders = []
		this.textures = []
		this.svgTexture = null
		this.isLoadingImages = false
	}

	// Fast initialization - creates cylinders immediately with placeholder materials
	async init() {
		// Get images from DOM
		this.getImages()
		await this.createSVGTexture()
		this.createCylindersWithPlaceholders()
		this.setMaterialOpacities(0)
		this.loadImagesAsync()
	}

	// Separate method to load images without blocking
	async loadImagesAsync() {
		if (this.isLoadingImages) return
		this.isLoadingImages = true

		try {
			await this.createTextures()
			this.updateCylinderMaterials()
		} catch (error) {
			console.error('Error loading images:', error)
		} finally {
			this.isLoadingImages = false
		}
	}

	getImages() {
		this.imageUrls = [...document.querySelectorAll('.award-images')].map(
			(img) => img.src
		)
	}

	async preloadImage(imageUrl) {
		const img = new Image()
		img.crossOrigin = 'anonymous'

		return new Promise((resolve, reject) => {
			img.onload = () => resolve(img)
			img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`))
			img.src = imageUrl
		})
	}

	async createSVGTexture() {
		const svgString = svg
		const xPadding = 40
		const yPadding = 14

		const canvas = document.createElement('canvas')
		const ctx = canvas.getContext('2d')

		const svgBlob = new Blob([svgString], { type: 'image/svg+xml' })
		const svgUrl = URL.createObjectURL(svgBlob)

		return new Promise((resolve) => {
			const img = new Image()
			img.onload = () => {
				canvas.width = img.width + xPadding * 2
				canvas.height = img.height + yPadding * 2

				ctx.fillStyle = '#ffffff'
				ctx.fillRect(0, 0, canvas.width, canvas.height)
				ctx.drawImage(img, xPadding, yPadding)

				const texture = new THREE.CanvasTexture(canvas)
				texture.needsUpdate = true
				texture.wrapS = THREE.RepeatWrapping
				texture.wrapT = THREE.ClampToEdgeWrapping

				const aspectRatio = canvas.width / canvas.height
				const desiredHorizontalTiles = 14
				texture.repeat.set(desiredHorizontalTiles, 1)

				texture.generateMipmaps = false
				texture.minFilter = THREE.LinearFilter
				texture.magFilter = THREE.LinearFilter

				this.svgTexture = texture
				URL.revokeObjectURL(svgUrl)
				resolve()
			}
			img.src = svgUrl
		})
	}

	// Create placeholder material for cylinders
	createPlaceholderMaterial() {
		return new THREE.MeshStandardMaterial({
			color: 0xf0f0f0, // Light gray placeholder
			side: THREE.DoubleSide,
		})
	}

	// Create cylinders immediately with placeholder materials
	createCylindersWithPlaceholders() {
		Array.from({ length: this.count }).forEach((_, i) => {
			const cylinderMesh = this.createPlaceholderCylinder(i)
			cylinderMesh.position.y = -i * 50 - i * this.gap
			this.cylinders.push(cylinderMesh)
			this.group.add(cylinderMesh)

			if (i + 1 == this.count) return
			const smallCylinderMesh = this.createBannerCylinder()
			smallCylinderMesh.position.y = -i * 50 - (i + 1) * this.gap + 15
			smallCylinderMesh.rotation.z = Math.PI * 0.025
			this.bannerCylinders.push(smallCylinderMesh)
			this.group.add(smallCylinderMesh)
		})
	}

	createPlaceholderCylinder(index) {
		const geometry = new THREE.CylinderGeometry(
			this.radius,
			this.radius,
			this.height,
			this.segments,
			1,
			true
		)

		const material = this.createPlaceholderMaterial()
		return new THREE.Mesh(geometry, material)
	}

	// Update cylinder materials once textures are loaded
	updateCylinderMaterials() {
		this.cylinders.forEach((cylinder, i) => {
			if (this.textures[i]) {
				const { texture, dimensions } = this.textures[i]

				// Setup texture mapping for cylinder
				this.setupCylinderTextureMapping(
					texture,
					dimensions,
					this.radius,
					this.height
				)

				// Dispose old material
				cylinder.material.dispose()

				// Create new material with texture
				cylinder.material = new THREE.MeshStandardMaterial({
					map: texture,
					side: THREE.DoubleSide,
				})

				// Add shader modification
				cylinder.material.onBeforeCompile = (shader) => {
					shader.fragmentShader = shader.fragmentShader.replace(
						'#include <color_fragment>',
						/* glsl */ `#include <color_fragment>
						if (!gl_FrontFacing) {
							vec3 blackCol = vec3(0.1);
							diffuseColor.rgb = mix(diffuseColor.rgb, blackCol, 1.0);
						}
						`
					)
				}

				// Maintain current opacity settings
				const currentOpacity = cylinder.material.opacity
				cylinder.material.opacity = currentOpacity
				cylinder.material.transparent = currentOpacity < 1
				cylinder.material.needsUpdate = true
			}
		})
	}

	async createCanvasTexture(imageUrls, options = {}) {
		const { gap = 10, canvasHeight = 512, axis = 'x' } = options

		if (!imageUrls.length) {
			throw new Error('No images provided')
		}

		const canvas = document.createElement('canvas')
		const ctx = canvas.getContext('2d')

		const images = await Promise.all(
			imageUrls.map((url) => this.preloadImage(url))
		)

		const imageData = images.map((img) => {
			const aspectRatio = img.naturalWidth / img.naturalHeight
			let width, height

			if (axis === 'x') {
				height = canvasHeight
				width = canvasHeight * aspectRatio
			} else {
				const canvasWidth = canvasHeight
				width = canvasWidth
				height = canvasWidth / aspectRatio
			}

			return { img, width, height }
		})

		let totalWidth, totalHeight

		if (axis === 'x') {
			totalWidth = imageData.reduce(
				(sum, data, index) => sum + data.width + (index > 0 ? gap : 0),
				0
			)
			totalHeight = canvasHeight
		} else {
			totalWidth = canvasHeight
			totalHeight = imageData.reduce(
				(sum, data, index) => sum + data.height + (index > 0 ? gap : 0),
				0
			)
		}

		const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2)
		canvas.width = totalWidth * devicePixelRatio
		canvas.height = totalHeight * devicePixelRatio

		if (devicePixelRatio !== 1) {
			ctx.scale(devicePixelRatio, devicePixelRatio)
		}

		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, totalWidth, totalHeight)
		ctx.filter = 'contrast(1.1) saturate(1.15) brightness(2.0)'

		let currentX = 0
		let currentY = 0

		for (const data of imageData) {
			ctx.drawImage(data.img, currentX, currentY, data.width, data.height)

			if (axis === 'x') {
				currentX += data.width + gap
			} else {
				currentY += data.height + gap
			}
		}

		const texture = new THREE.CanvasTexture(canvas)
		texture.needsUpdate = true
		texture.wrapS = THREE.RepeatWrapping
		texture.wrapT = THREE.ClampToEdgeWrapping
		texture.generateMipmaps = false
		texture.minFilter = THREE.LinearFilter
		texture.magFilter = THREE.LinearFilter

		return {
			texture,
			dimensions: {
				width: totalWidth,
				height: totalHeight,
				aspectRatio: totalWidth / totalHeight,
			},
		}
	}

	setupCylinderTextureMapping(texture, dimensions, radius, height) {
		const cylinderCircumference = 2 * Math.PI * radius
		const cylinderHeight = height
		const cylinderAspectRatio = cylinderCircumference / cylinderHeight

		if (dimensions.aspectRatio > cylinderAspectRatio) {
			texture.repeat.x = cylinderAspectRatio / dimensions.aspectRatio
			texture.repeat.y = 1
			texture.offset.x = (1 - texture.repeat.x) / 2
		} else {
			texture.repeat.x = 1
			texture.repeat.y = dimensions.aspectRatio / cylinderAspectRatio
		}

		texture.offset.y = (1 - texture.repeat.y) / 2
	}

	async createTextures() {
		const minImagesPerCylinder = this.minImagesPerCylinder
		const imagesPerCylinder = Math.max(
			minImagesPerCylinder,
			Math.ceil(this.imageUrls.length / this.count)
		)

		const validTextures = []

		for (let i = 0; i < this.count; i++) {
			const startIdx = i * imagesPerCylinder
			const endIdx = Math.min(
				startIdx + imagesPerCylinder,
				this.imageUrls.length
			)
			let cylinderImages = this.imageUrls.slice(startIdx, endIdx)

			if (cylinderImages.length > 0) {
				if (cylinderImages.length < minImagesPerCylinder) {
					const originalImages = [...cylinderImages]
					while (cylinderImages.length < minImagesPerCylinder) {
						const remainingNeeded = minImagesPerCylinder - cylinderImages.length
						const imagesToAdd = originalImages.slice(
							0,
							Math.min(remainingNeeded, originalImages.length)
						)
						cylinderImages = cylinderImages.concat(imagesToAdd)
					}
				}

				const { texture, dimensions } = await this.createCanvasTexture(
					cylinderImages,
					{ gap: 0, canvasHeight: 248, axis: 'x' }
				)

				this.textures.push({ texture, dimensions })
				validTextures.push({ texture, dimensions })
			} else {
				this.textures.push(null)
			}
		}

		if (validTextures.length > 0) {
			for (let i = 0; i < this.textures.length; i++) {
				if (this.textures[i] === null) {
					const textureIndex = i % validTextures.length
					this.textures[i] = validTextures[textureIndex]
				}
			}
		}
	}

	createBannerCylinder() {
		const smallCylinder = new THREE.CylinderGeometry(
			this.radius,
			this.radius,
			this.height / 5,
			this.segments,
			1,
			true
		)

		const material = new THREE.MeshBasicMaterial({
			map: this.svgTexture,
			side: THREE.DoubleSide,
		})

		material.onBeforeCompile = (shader) => {
			shader.uniforms.repeatX = { value: 1 * 0.15 }
			shader.fragmentShader = shader.fragmentShader
				.replace(
					'#include <common>',
					/* glsl */ `#include <common>
      `
				)
				.replace(
					'#include <color_fragment>',
					/* glsl */ `#include <color_fragment>
        if (!gl_FrontFacing) {
          diffuseColor.rgb = 
            vec3(1.0, 1.0, 1.0);
          
        }
      `
				)
		}

		return new THREE.Mesh(smallCylinder, material)
	}

	// Method to check if images are still loading
	isImagesLoading() {
		return this.isLoadingImages
	}

	// Method to get loading progress (optional)
	getLoadingProgress() {
		const totalCylinders = this.cylinders.length
		const loadedCylinders = this.cylinders.filter(
			(cylinder) =>
				cylinder.material.map !== null && cylinder.material.map !== undefined
		).length

		return totalCylinders > 0 ? loadedCylinders / totalCylinders : 0
	}

	// Method to update textures dynamically
	async updateTextures(newImageUrls) {
		this.imageUrls = newImageUrls
		this.textures = []

		// Dispose old textures
		this.cylinders.forEach((cylinder) => {
			if (cylinder.material.map) {
				cylinder.material.map.dispose()
			}
		})

		await this.createTextures()
		this.updateCylinderMaterials()
	}

	dispose() {
		this.cylinders.forEach((cylinder) => {
			cylinder.geometry.dispose()
			if (cylinder.material.map) {
				cylinder.material.map.dispose()
			}
			cylinder.material.dispose()
		})

		this.bannerCylinders.forEach((banner) => {
			banner.geometry.dispose()
			if (banner.material.map) {
				banner.material.map.dispose()
			}
			banner.material.dispose()
		})

		this.textures.forEach(({ texture }) => {
			if (texture) texture.dispose()
		})

		if (this.svgTexture) {
			this.svgTexture.dispose()
		}
	}

	setMaterialOpacities(opacity) {
		const clampedOpacity = Math.max(0, Math.min(1, opacity))

		this.cylinders.forEach((cylinder) => {
			cylinder.material.opacity = clampedOpacity
			cylinder.material.transparent = clampedOpacity < 1
			cylinder.material.needsUpdate = true
		})

		this.bannerCylinders.forEach((banner) => {
			banner.material.opacity = clampedOpacity
			banner.material.transparent = clampedOpacity < 1
			banner.material.needsUpdate = true
		})
	}
}

export default SpiralImages
