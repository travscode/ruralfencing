import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import * as THREE from 'three'

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin)

export class HeroAnimationController {
	constructor(unifiedSceneManager) {
		this.manager = unifiedSceneManager

		// Get the hero scene item
		this.heroScene = this.manager

		// Extract references from the hero scene
		this.camera = this.heroScene.camera
		this.simulationMaterial = this.heroScene.simulationMaterial
		this.particleSphere = this.heroScene.fbo.getParticles()
		this.renderMaterial = this.heroScene.renderMaterial
		this.cubeOutline = this.heroScene.cubeOutline
		this.imagePanel = this.heroScene.imagePanel
		this.composer = this.heroScene.composer

		// Get ALL post-processing shaders from all containers
		this.postShaders = this.getAllPostShaders()

		// Mobile detection
		this.isMobile = window.innerWidth <= 768

		// Variable to store timeline
		this.introTl = null

		// Animation state
		this.isAnimating = false
		this.currentTimeline = null
		this.text1Triggered = false
		this.text2Triggered = false
		this.text3Triggered = false
		this.text4Triggered = false

		// Store initial values for reset
		this.initialValues = {
			camera: {
				position: { ...this.camera.position },
				rotation: { ...this.camera.rotation },
				fov: this.camera.fov,
				zoom: this.camera.zoom,
			},
			material: {
				sphereRadius:
					this.simulationMaterial.getMaterial().uniforms.sphereRadius.value,
				curlStrength:
					this.simulationMaterial.getMaterial().uniforms.curlStrength.value,
				flowSpeed:
					this.simulationMaterial.getMaterial().uniforms.flowSpeed.value,
				mouseForceStrength:
					this.simulationMaterial.getMaterial().uniforms.mouseForceStrength
						.value,
				mouseInfluenceRadius:
					this.simulationMaterial.getMaterial().uniforms.mouseInfluenceRadius
						.value,
			},
		}

		// Mobile-specific camera position values
		this.cameraPositions = {
			desktop: {
				phase1Start: 300,
				phase1End: 600,
				phase2Start: 600,
				phase2End: 200,
				phase3Start: 200,
				phase3End: 400,
			},
			mobile: {
				phase1Start: 500,
				phase1End: 700,
				phase2Start: 700,
				phase2End: 300,
				phase3Start: 300,
				phase3End: 600,
			},
		}

		this.setupScrollAnimations()
		this.setupResizeListener()
	}

	// Updated method to get ALL post shaders from all containers
	getAllPostShaders() {
		const shaders = []
		if (this.manager.containers) {
			this.manager.containers.forEach((config) => {
				if (config.composer && config.composer.passes) {
					// Look for ShaderPass that has the chromatic aberration uniforms
					config.composer.passes.forEach((pass) => {
						if (
							pass.constructor.name === 'ShaderPass' &&
							pass.material &&
							pass.material.uniforms &&
							pass.material.uniforms.vignetteIntensity
						) {
							shaders.push(pass.material.uniforms)
						}
						// Alternative check if the above doesn't work
						else if (pass.uniforms && pass.uniforms.vignetteIntensity) {
							shaders.push(pass.uniforms)
						}
					})
				}
			})
		}

		return shaders
	}

	// Updated method to update ALL post shaders
	updateAllPostShaders(vignetteIntensity, vignetteSmoothness) {
		if (this.postShaders.length === 0) {
			// Try to refresh the shader references
			this.postShaders = this.getAllPostShaders()
		}

		this.postShaders.forEach((shader, index) => {
			try {
				if (shader.vignetteIntensity) {
					shader.vignetteIntensity.value = vignetteIntensity
				}
				if (shader.vignetteSmoothness) {
					shader.vignetteSmoothness.value = vignetteSmoothness
				}
			} catch (error) {
				console.warn(`Error updating post shader ${index}:`, error)
			}
		})
	}

	updateAllShaderAlpha(value) {
		this.postShaders.forEach((shader, index) => {
			try {
				if (shader.vignetteAlpha) {
					shader.vignetteAlpha.value = value
				}
			} catch (error) {
				console.warn(`Error updating post shader ${index}:`, error)
			}
		})
	}

	// Get cube meshes - adapt to your cube outline structure
	getCube() {
		if (this.cubeOutline) {
			const cubes = []
			const cubeMesh = this.cubeOutline.getMesh()
			const vertexPluses = this.cubeOutline.getVertexPluses()

			if (cubeMesh) cubes.push(cubeMesh)
			if (vertexPluses) cubes.push(vertexPluses)

			return cubes
		}
		return []
	}

	// Get panel materials - you'll need to implement this based on your image panel structure
	getPanelMaterials() {
		if (this.imagePanel && this.imagePanel.getPanelMaterials) {
			return this.imagePanel.getPanelMaterials()
		}
		return []
	}

	// Get text materials - you'll need to implement this based on your image panel structure
	getTextMaterials() {
		if (this.imagePanel && this.imagePanel.getTextMaterials) {
			return this.imagePanel.getTextMaterials()
		}
		return []
	}

	setupResizeListener() {
		const heroEl = document.querySelector('#home-three-hero')

		// Create a ResizeObserver and store it on this
		this.resizeObserver = new ResizeObserver(() => {
			this.isMobile = window.innerWidth <= 768
		})
		// Observe the hero element
		if (heroEl) {
			this.resizeObserver.observe(heroEl)
		}
	}

	getCameraPositions() {
		return this.isMobile
			? this.cameraPositions.mobile
			: this.cameraPositions.desktop
	}

	setupScrollAnimations() {
		this.createHeroScrollAnimation()
	}

	// Smooth easing functions
	easeOutQuart(t) {
		return 1 - Math.pow(1 - t, 4)
	}

	easeInOutCubic(t) {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
	}

	createHeroScrollAnimation() {
		const that = this
		let tl1, tl2, tl3, tl4

		this.introTl = gsap.timeline({
			delay: 1,
			paused: true,
			defaults: {
				duration: 0.5,
				ease: 'power2.out',
			},
		})

		const splitText1 = SplitText.create('#hero-text-1 .block-content *', {
			type: 'lines, words',
			mask: 'lines',
			autoSplit: true,
			onSplit: (self) => {
				if (tl1) {
					tl1.revert()
					tl1.kill()
				}
				tl1 = gsap.timeline().pause().from(self.lines, {
					duration: 0.5,
					yPercent: 100,
					stagger: 0.1,
					ease: 'power2.out',
				})

				gsap.set('#hero-text-1', {
					opacity: 1,
				})
			},
		})

		this.introTl.to(
			{},
			{
				duration: 0.75,
				onUpdate: function () {
					const progress = this.progress()
					const simMaterial = that.simulationMaterial.getMaterial()
					const renderMaterial = that.renderMaterial.getMaterial()

					if (simMaterial.uniforms.radiusProgress) {
						simMaterial.uniforms.radiusProgress.value = progress
					}

					if (renderMaterial.uniforms.opacity) {
						renderMaterial.uniforms.opacity.value = progress
					}
				},
				onStart: function () {
					if (!tl1.reversed()) {
						tl1.play()
					}
				},
			}
		)

		const panelMaterials = this.getPanelMaterials()
		const textMaterials = this.getTextMaterials()

		panelMaterials.forEach((material, index) => {
			this.introTl.to(
				{},
				{
					onUpdate: function () {
						const progress = this.progress()
						if (material.uniforms && material.uniforms.uOpacity) {
							material.uniforms.uOpacity.value = progress
						}
						if (
							textMaterials[index] &&
							textMaterials[index].opacity !== undefined
						) {
							textMaterials[index].opacity = progress
						}
					},
				},
				'<=4%'
			)
		})

		const splitText2 = SplitText.create('#hero-text-2 .block-content *', {
			type: 'lines',
			mask: 'lines',
			autoSplit: true,
			onSplit: (self) => {
				if (tl2) {
					tl2.revert()
					tl2.kill()
				}
				tl2 = gsap.timeline().pause().from(self.lines, {
					duration: 0.5,
					yPercent: 100,
					stagger: 0.1,
					ease: 'power2.out',
				})
			},
		})

		const splitText3 = SplitText.create('#hero-text-3 .block-content *', {
			type: 'lines',
			mask: 'lines',
			autoSplit: true,
			onSplit: (self) => {
				if (tl3) {
					tl3.revert()
					tl3.kill()
				}
				tl3 = gsap.timeline().pause().from(self.lines, {
					duration: 0.5,
					yPercent: 100,
					stagger: 0.1,
					ease: 'power2.out',
				})
			},
		})

		const splitText4 = SplitText.create('#hero-text-4 .block-content *', {
			type: 'lines',
			mask: 'lines',
			autoSplit: true,
			onSplit: (self) => {
				if (tl4) {
					tl4.revert()
					tl4.kill()
				}
				tl4 = gsap.timeline().pause().from(self.lines, {
					duration: 0.5,
					yPercent: 100,
					stagger: 0.1,
					ease: 'power2.out',
				})
			},
		})

		// stops initial flashing of content
		gsap.set('#hero-text-2, #hero-text-3, #hero-text-4', {
			opacity: 1,
		})

		let body = document.querySelector('body')

		let tl = gsap.timeline({
			scrollTrigger: {
				trigger: '#hero-trigger-container',
				start: 'top top',
				end: '+=800%',
				pinSpacing: false,
				scrub: true,
				ease: 'none',
				// snap: [0, 0.35, 0.6, 0.9, 1.0],
				onUpdate: (self) => {
					const overallProgress = self.progress
					that.handleTextAnimations(overallProgress, tl1, tl2, tl3, tl4)
				},
			},
		})

		let pin = ScrollTrigger.create({
			trigger: '#home-three-hero',
			start: 'top top',
			pin: true,
			pinSpacing: false,
			end: '+=900%',
		})

		let tlEnd = gsap.timeline({
			scrollTrigger: {
				trigger: '#hero-trigger-container',
				start: 'bottom bottom',
				end: '+=100%',
				pin: false,
				scrub: true,
				ease: 'none',
			},
		})

		let tlAnother = gsap.timeline({
			scrollTrigger: {
				trigger: '#hero-trigger-container',
				start: 'bottom 30%',
				ease: 'none',
				onEnter: () => body.classList.add('theme-flip'),
				onLeaveBack: () => body.classList.remove('theme-flip'),
			},
		})

		const cubes = this.getCube()

		// Phase 1: Initial zoom and slight expansion (0-33%)
		tl.to(
			{},
			{
				duration: 1,
				ease: 'power2.inOut',
				onUpdate: function () {
					const progress = this.progress()
					const easedProgress = that.easeInOutCubic(progress)
					const positions = that.getCameraPositions()
					const simMaterial = that.simulationMaterial.getMaterial()

					// Smooth camera zoom with mobile-specific values
					that.camera.position.z =
						positions.phase1Start +
						easedProgress * (positions.phase1End - positions.phase1Start)

					if (simMaterial.uniforms.sphereRadius) {
						simMaterial.uniforms.sphereRadius.value =
							that.initialValues.material.sphereRadius *
							(1 - easedProgress * 0.5)
					}

					// Shrink quickly between progress 0.75 → 0.8
					const t = Math.max(0, Math.min(1, (progress - 0.5) / 0.5))
					const cubeScale = 1 - t * 0.5

					cubes.forEach((el) => {
						el.scale.set(cubeScale, cubeScale, cubeScale)
					})
				},
			}
		)

		// Phase 2: EXPLOSION - Complete particle dispersion (33-66%)
		tl.to(
			{},
			{
				duration: 1,
				ease: 'power2.out',
				onUpdate: function () {
					const progress = this.progress()
					const explosionProgress = that.easeInOutCubic(progress)
					const positions = that.getCameraPositions()
					const simMaterial = that.simulationMaterial.getMaterial()
					const renderMaterial = that.renderMaterial.getMaterial()

					// Camera pulls back dramatically
					that.camera.position.z =
						positions.phase2Start -
						progress * (positions.phase2Start - positions.phase2End)

					let fastProgress = Math.min(progress * 1.5, 1)

					// Cube scaling for visual impact
					const cubeScale = 0.5 + explosionProgress * 8.5

					// FIXED: Post-processing effects - update ALL shaders
					const vignetteProgress = 0.5 - 0.5 * explosionProgress
					const vignetteSmoothProgress = 0.5 + 0.5 * explosionProgress
					that.updateAllPostShaders(vignetteProgress, vignetteSmoothProgress)

					// Image panel effects
					if (that.imagePanel && that.imagePanel.setImageGroupZ) {
						const zProgress = 600 * explosionProgress
						that.imagePanel.setImageGroupZ(zProgress)
					}

					// Material effects
					if (that.renderMaterial.setBrightness) {
						that.renderMaterial.setBrightness(1 - fastProgress)
					}

					if (that.simulationMaterial.setFullNoiseMode) {
						that.simulationMaterial.setFullNoiseMode(fastProgress)
					}

					cubes.forEach((el) => {
						el.scale.set(cubeScale, cubeScale, cubeScale)
					})

					if (simMaterial.uniforms.sphereRadius) {
						simMaterial.uniforms.sphereRadius.value =
							that.initialValues.material.sphereRadius * 0.5 +
							that.initialValues.material.sphereRadius * explosionProgress * 8
					}
				},
			}
		)

		// Phase 3: Gradual reformation and zoom out (66-100%)
		tl.to(
			{},
			{
				duration: 1,
				onUpdate: function () {
					const progress = this.progress()
					const reformProgress = that.easeInOutCubic(progress)
					const positions = that.getCameraPositions()
					const simMaterial = that.simulationMaterial.getMaterial()

					// Continue camera movement
					that.camera.position.z =
						positions.phase3Start +
						reformProgress * (positions.phase3End - positions.phase3Start)

					let slowProgress = progress < 0.5 ? 0 : ((progress - 0.5) * 2) ** 2

					// Gradually scale down cubes
					const cubeScale = 9 - progress * 8
					cubes.forEach((el) => {
						el.scale.set(cubeScale, cubeScale, cubeScale)

						if (el.material) {
							el.material.opacity = 0.4 * slowProgress
						} else if (el.children) {
							// For the vertex pluses group
							el.children.forEach((plus) => {
								plus.children.forEach((line) => {
									line.material.opacity = slowProgress
								})
							})
						}
					})

					// Material effects
					if (simMaterial.uniforms.sphereRadius) {
						simMaterial.uniforms.sphereRadius.value =
							that.initialValues.material.sphereRadius * 8.5 -
							that.initialValues.material.sphereRadius * progress * 7.5
					}

					const vignetteProgress = 0.0 + 0.5 * reformProgress
					const vignetteSmoothProgress = 1.0 - 0.5 * reformProgress
					that.updateAllPostShaders(vignetteProgress, vignetteSmoothProgress)

					// Image panel effects
					if (that.imagePanel && that.imagePanel.setImageGroupZ) {
						const zProgress = 600 - 600 * progress
						that.imagePanel.setImageGroupZ(zProgress)
					}

					if (that.renderMaterial.setBrightness) {
						that.renderMaterial.setBrightness(reformProgress)
					}

					if (that.simulationMaterial.setFullNoiseMode) {
						that.simulationMaterial.setFullNoiseMode(0)
					}

					// Panel and text materials
					panelMaterials.forEach((material) => {
						if (material.uniforms && material.uniforms.uOpacity) {
							material.uniforms.uOpacity.value = Math.max(0, 1 - reformProgress)
						}
					})

					textMaterials.forEach((material) => {
						if (material.opacity !== undefined) {
							material.opacity = Math.max(0, 1 - reformProgress)
						}
					})
				},
			}
		)

		tlEnd.to(
			'#hero-trigger-container .hero-curtains',
			{
				height: '100%',
				ease: 'none',
				stagger: {
					from: 'start',
					each: 0.04,
				},
			},
			'<='
		)

		this.currentTimeline = tl

		let awardTextTl

		const btnWrapper = document.querySelector('#award-text-1 .btn-wrapper')
		const awardTexts = document.querySelectorAll(
			'#home-three-awards .award-text'
		)
		const awardText = SplitText.create('#award-text-1 .block-content *', {
			type: 'lines, words',
			mask: 'lines',
			autoSplit: true,
			onSplit: (self) => {
				if (awardTextTl) {
					awardTextTl.revert()
					awardTextTl.kill()
				}
				awardTextTl = gsap
					.timeline()
					.pause()
					.from([...self.lines, btnWrapper], {
						duration: 0.5,
						yPercent: 100,
						opacity: 0,
						stagger: 0.1,
						ease: 'power2.out',
					})
					.from(
						awardTexts,
						{
							duration: 0.5,
							yPercent: 100,
							opacity: 0,
							stagger: 0.1,
							ease: 'power2.out',
						},
						'<=50%'
					)
			},
		})

		let awardScrolltrigger = ScrollTrigger.create({
			trigger: '#home-three-awards',
			start: 'center center',
			end: '+=600%',
			pin: true,
			pinSpacing: false,
		})

		let awardTl = gsap.timeline({
			scrollTrigger: {
				trigger: '#home-three-awards-outer',
				start: 'top bottom',
				end: 'bottom top',
				pinSpacing: false,
				scrub: true,
				ease: 'none',
				onUpdate: (self) => {
					const progress = self.progress
					that.heroScene.spiralImages.group.position.y =
						-900 + 900 * 2 * progress

					that.handleAwardText(progress, awardTextTl)
				},
			},
		})

		let awardStartTl = gsap.timeline({
			scrollTrigger: {
				trigger: '#home-three-awards',
				start: 'top bottom+=200%',
				end: '+=400%',
				pin: false,
				scrub: true,
				ease: 'none',
			},
		})

		awardStartTl.to('#home-three-awards-outer .hero-curtains', {
			height: '0%',
			ease: 'none',
			stagger: {
				from: 'end',
				each: 0.015,
			},
		})

		let awardEndTl = gsap.timeline({
			scrollTrigger: {
				trigger: '#home-three-awards-outer',
				start: 'bottom bottom',
				end: '+=400%',
				pin: false,
				scrub: true,
				ease: 'none',
			},
		})

		awardEndTl.to('#home-three-awards-outer .end-hero-curtains', {
			height: '100%',
			ease: 'none',
			stagger: {
				from: 'start',
				each: 0.015,
			},
		})

		awardTl.to(
			{},
			{
				duration: 1,
				ease: 'power2.out',
				onUpdate: function () {
					const progress = this.progress()
					const explosionProgress = that.easeInOutCubic(progress)
					const positions = that.getCameraPositions()
					const simMaterial = that.simulationMaterial.getMaterial()
					const renderMaterial = that.renderMaterial.getMaterial()

					let webbyGroupProgress
					let cubeOpacity
					let plusOpacity
					let cubeScale

					if (progress > 0.05) {
						webbyGroupProgress = 1.0 + 0.35 * explosionProgress
						cubeOpacity = 0.0
						plusOpacity = 0.0
						cubeScale = 0.0
						that.renderMaterial.setBrightness(1)
						that.simulationMaterial.setFullNoiseMode(0.7)
						that.simulationMaterial.setParticleSeperation(0)

						simMaterial.uniforms.sphereRadius.value =
							that.initialValues.material.sphereRadius * 1.65

						panelMaterials.forEach((material) => {
							if (material.uniforms && material.uniforms.uOpacity) {
								material.uniforms.uOpacity.value = 0
							}
						})

						textMaterials.forEach((material) => {
							if (material.opacity !== undefined) {
								material.opacity = 0
							}
						})

						that.heroScene.spiralImages.setMaterialOpacities(1)
					} else {
						webbyGroupProgress = 0.0
						cubeOpacity = 0.4
						plusOpacity = 1.0
						cubeScale = 1.0
						that.renderMaterial.setBrightness(1)
						that.heroScene.spiralImages.setMaterialOpacities(0)
						that.simulationMaterial.setFullNoiseMode(0)
						that.simulationMaterial.setParticleSeperation(15.0)
						simMaterial.uniforms.sphereRadius.value =
							that.initialValues.material.sphereRadius
					}

					that.heroScene.webbyGroup.scale.set(
						webbyGroupProgress,
						webbyGroupProgress,
						webbyGroupProgress
					)

					cubes.forEach((el) => {
						el.scale.set(cubeScale, cubeScale, cubeScale)

						if (el.material) {
							el.material.opacity = cubeOpacity
						} else if (el.children) {
							// For the vertex pluses group
							el.children.forEach((plus) => {
								plus.children.forEach((line) => {
									line.material.opacity = plusOpacity
								})
							})
						}
					})
				},
			}
		)

		awardTl.to({}, {})
		awardTl.to({}, {})
		awardTl.to(
			{},
			{
				onUpdate: function () {
					const progress = this.progress()
					const explosionProgress = that.easeInOutCubic(progress)
					const webbyGroupProgress = 1.35 - 0.35 * explosionProgress
					that.heroScene.webbyGroup.scale.set(
						webbyGroupProgress,
						webbyGroupProgress,
						webbyGroupProgress
					)
				},
			}
		)

		ScrollTrigger.refresh()
	}

	handleTextAnimations(overallProgress, tl1, tl2, tl3, tl4) {
		const shouldShowText1 = overallProgress > 0.15

		if (shouldShowText1 && !this.text1Triggered) {
			tl1.reverse()
			this.text1Triggered = true
		} else if (!shouldShowText1 && this.text1Triggered) {
			tl1.play()
			this.text1Triggered = false
		}

		const shouldShowText2 = overallProgress > 0.25 && overallProgress < 0.45

		if (shouldShowText2 && !this.text2Triggered) {
			tl2.play()
			this.text2Triggered = true
		} else if (!shouldShowText2 && this.text2Triggered) {
			tl2.reverse()
			this.text2Triggered = false
		}

		const shouldShowText3 = overallProgress > 0.5 && overallProgress < 0.7

		if (shouldShowText3 && !this.text3Triggered) {
			tl3.play()
			this.text3Triggered = true
		} else if (!shouldShowText3 && this.text3Triggered) {
			tl3.reverse()
			this.text3Triggered = false
		}

		const shouldShowText4 = overallProgress > 0.85 && overallProgress < 0.99

		if (shouldShowText4 && !this.text4Triggered) {
			tl4.play()
			this.text4Triggered = true
		} else if (!shouldShowText4 && this.text4Triggered) {
			tl4.reverse()
			this.text4Triggered = false
		}
	}

	handleAwardText(overallProgress, tl1) {
		const shouldShowText = overallProgress > 0.175 && overallProgress < 0.75

		if (shouldShowText && !this.textAwardTriggered) {
			tl1.play()
			this.textAwardTriggered = true
		} else if (!shouldShowText && this.textAwardTriggered) {
			tl1.reverse()
			this.textAwardTriggered = false
		}

		if (overallProgress < 0.9 && overallProgress > 0.15) {
			document.body.classList.remove('theme-flip')
		} else {
			document.body.classList.add('theme-flip')
		}
	}

	playIntroTimeline() {
		if (!this.introTl) return
		this.introTl.play()
	}
}
