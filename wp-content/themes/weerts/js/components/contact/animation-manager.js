import gsap from 'gsap'

export const ANIMATION_CONFIG = {
	DURATIONS: {
		TRANSITION: 0.3,
		FADE: 0.4,
		STAGGER: 0.1,
		INITIAL_DELAY: 0.1,
	},
	EASINGS: {
		DEFAULT: 'power2.out',
		BOUNCE: 'back.out(1.7)',
	},
	STAGGER: {
		NORMAL: 0.05,
		INITIAL: 0.15,
		BADGES: 0.08,
	},
}

export default class AnimationManager {
	static async fadeOut(elements, config = {}) {
		const {
			duration = ANIMATION_CONFIG.DURATIONS.TRANSITION,
			ease = ANIMATION_CONFIG.EASINGS.DEFAULT,
			stagger = ANIMATION_CONFIG.STAGGER.NORMAL,
			y = -20,
		} = config

		const validElements = Array.isArray(elements)
			? elements.filter((el) => el && el.style)
			: [elements].filter((el) => el && el.style)

		if (validElements.length === 0) return Promise.resolve()

		return new Promise((resolve) => {
			const tl = gsap.timeline({ onComplete: resolve })

			validElements.forEach((element, index) => {
				tl.to(
					element,
					{
						y,
						opacity: 0,
						duration,
						ease,
					},
					index * stagger
				)
			})
		})
	}

	static async fadeIn(elements, config = {}) {
		const {
			duration = ANIMATION_CONFIG.DURATIONS.FADE,
			ease = ANIMATION_CONFIG.EASINGS.DEFAULT,
			stagger = ANIMATION_CONFIG.STAGGER.NORMAL,
			y = 20,
			isInitial = false,
			delay = 0,
		} = config

		const validElements = Array.isArray(elements)
			? elements.filter((el) => el && el.style)
			: [elements].filter((el) => el && el.style)

		if (validElements.length === 0) return Promise.resolve()

		return new Promise((resolve) => {
			const tl = gsap.timeline({ onComplete: resolve })

			validElements.forEach((element) => {
				if (isInitial) {
					gsap.set(element, {
						y: 30,
						opacity: 0,
					})
				} else {
					gsap.set(element, {
						opacity: 0,
					})
					gsap.fromTo(element, { y: y }, { y: 0, duration: 0 })
				}
			})

			if (delay > 0) {
				tl.to({}, { duration: delay })
			}

			if (isInitial) {
				tl.to({}, { duration: ANIMATION_CONFIG.DURATIONS.INITIAL_DELAY })
			}

			validElements.forEach((element, index) => {
				tl.to(
					element,
					{
						y: 0,
						opacity: 1,
						duration,
						ease,
					},
					index * (isInitial ? ANIMATION_CONFIG.STAGGER.INITIAL : stagger)
				)
			})
		})
	}

	static async staggerIn(elements, config = {}) {
		const {
			duration = ANIMATION_CONFIG.DURATIONS.TRANSITION,
			ease = ANIMATION_CONFIG.EASINGS.BOUNCE,
			stagger = ANIMATION_CONFIG.STAGGER.BADGES,
			y = 10,
			scale = 0.9,
			delay = 0,
		} = config

		const validElements = Array.isArray(elements)
			? elements.filter((el) => el && el.style)
			: [elements].filter((el) => el && el.style)

		if (validElements.length === 0) return Promise.resolve()

		return new Promise((resolve) => {
			const tl = gsap.timeline({ onComplete: resolve })

			gsap.set(validElements, {
				y,
				scale,
				opacity: 0,
			})

			if (delay > 0) {
				tl.to({}, { duration: delay })
			}

			validElements.forEach((element, index) => {
				tl.to(
					element,
					{
						y: 0,
						scale: 1,
						opacity: 1,
						duration,
						ease,
					},
					index * stagger
				)
			})
		})
	}

	static async bounceSelect(element, config = {}) {
		const {
			scale = 1.05,
			duration = 0.1,
			ease = ANIMATION_CONFIG.EASINGS.DEFAULT,
		} = config

		if (!element || !element.style) return Promise.resolve()

		return new Promise((resolve) => {
			gsap.to(element, {
				scale,
				duration,
				ease,
				yoyo: true,
				repeat: 1,
				onComplete: resolve,
			})
		})
	}

	static async gravityFormSequence(elements, config = {}) {
		const {
			backBtn,
			stepContainer,
			questionTitle,
			gravityForm,
			formFields = [],
			submitButton,
		} = elements

		const {
			duration = ANIMATION_CONFIG.DURATIONS.FADE,
			ease = ANIMATION_CONFIG.EASINGS.DEFAULT,
			bounceEase = ANIMATION_CONFIG.EASINGS.BOUNCE,
		} = config

		const allElements = [
			backBtn,
			stepContainer,
			questionTitle,
			gravityForm,
		].filter(Boolean)
		gsap.set(allElements, { y: 20, opacity: 0 })
		gsap.set(formFields, { y: 15, opacity: 0 })
		if (submitButton) gsap.set(submitButton, { y: 15, opacity: 0 })

		return new Promise((resolve) => {
			const tl = gsap.timeline({ onComplete: resolve })

			if (backBtn) {
				tl.to(backBtn, { y: 0, opacity: 1, duration, ease })
			}
			if (stepContainer) {
				tl.to(stepContainer, { y: 0, opacity: 1, duration, ease }, '-=0.3')
			}
			if (questionTitle) {
				tl.to(questionTitle, { y: 0, opacity: 1, duration, ease }, '-=0.3')
			}
			if (gravityForm) {
				tl.to(gravityForm, { y: 0, opacity: 1, duration, ease }, '-=0.4')
			}

			if (formFields.length > 0) {
				formFields.forEach((field, index) => {
					tl.to(
						field,
						{
							y: 0,
							opacity: 1,
							duration: ANIMATION_CONFIG.DURATIONS.TRANSITION,
							ease: bounceEase,
						},
						'-=0.2' + index * 0.1
					)
				})
			}

			if (submitButton) {
				tl.to(
					submitButton,
					{
						y: 0,
						opacity: 1,
						duration: ANIMATION_CONFIG.DURATIONS.TRANSITION,
						ease,
					},
					'-=0.1'
				)
			}
		})
	}
}
