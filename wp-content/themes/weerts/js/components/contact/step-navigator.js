import { questions } from './questions-config.js'

export default class StepNavigator {
	constructor(formState, questionHandler, gravityFormHandler, canvasAnimation) {
		this.formState = formState
		this.questionHandler = questionHandler
		this.gravityFormHandler = gravityFormHandler
		this.canvasAnimation = canvasAnimation

		// DOM elements
		this.conversationForm = document.getElementById('conversation-form')
		this.startBtn = document.getElementById('contact-start-btn')

		// Timeout references for cleanup
		this.goBackTimeout = null
		this.startConversationTimeout = null
	}

	async nextStep() {
		const currentStep = this.formState.getCurrentStep()
		let nextStepIndex

		if (currentStep === null) {
			nextStepIndex = 0
		} else if (
			currentStep === 0 &&
			this.formState.getAnswer('services') === 'General enquiry'
		) {
			nextStepIndex = 3
		} else if (currentStep < questions.length - 1) {
			nextStepIndex = currentStep + 1

			while (nextStepIndex < questions.length) {
				const question = questions[nextStepIndex]
				let shouldSkip = false

				if (question.type === 'conditional') {
					const options = question.getOptions(this.formState.getAllAnswers())
					if (options.length === 0) shouldSkip = true
				}

				if (question.type === 'slider') {
					const config = question.getSliderConfig(
						this.formState.getAllAnswers()
					)
					if (config.hide) shouldSkip = true
				}

				if (!shouldSkip) break
				nextStepIndex++
			}

			// ✅ final safety check
			if (nextStepIndex >= questions.length) {
				this.formState.addStep('gravity-form')
				this.updateStepDisplay()
				await this.gravityFormHandler.showGravityForm()
				return
			}
		} else {
			this.formState.addStep('gravity-form')
			this.updateStepDisplay()
			await this.gravityFormHandler.showGravityForm()
			return
		}

		// ✅ only show a question if it exists
		const question = questions[nextStepIndex]
		if (!question) {
			this.formState.addStep('gravity-form')
			this.updateStepDisplay()
			await this.gravityFormHandler.showGravityForm()
			return
		}

		this.formState.addStep(nextStepIndex)
		this.updateStepDisplay()
		await this.questionHandler.showQuestion(nextStepIndex)
	}

	async previousStep() {
		const previousStepIndex = this.formState.goBack()

		if (previousStepIndex === null) {
			// Can't go back, return to start
			this.goBackToStart()
			return
		}

		this.updateStepDisplay()

		if (previousStepIndex === 'gravity-form') {
			await this.gravityFormHandler.showGravityForm()
		} else {
			document.getElementById('gform-container').classList.add('hidden')
			document.getElementById('question-container').classList.remove('hidden')
			await this.questionHandler.showQuestion(previousStepIndex)
		}
	}

	updateStepDisplay() {
		const stepNumberElement = document.querySelector('.step-number')
		if (stepNumberElement) {
			stepNumberElement.textContent = this.formState.getCurrentStepNumber()
		}
	}

	goBackToStart() {
		if (!this.conversationForm || !this.startBtn) return

		this.conversationForm.style.opacity = '0'
		this.conversationForm.style.pointerEvents = 'none'

		// Set display to none after opacity transition
		setTimeout(() => {
			this.conversationForm.classList.add('hidden')
		}, 300)

		this.goBackTimeout = setTimeout(() => {
			// First set display and opacity, then animate opacity
			this.startBtn.classList.remove('hidden')
			this.startBtn.style.opacity = '0'
			this.startBtn.style.pointerEvents = 'none'

			// Animate opacity to 1
			setTimeout(() => {
				this.startBtn.style.opacity = '1'
				this.startBtn.style.pointerEvents = 'auto'
			}, 50)

			this.canvasAnimation.show()
			this.formState.reset()
		}, 300)
	}

	startConversation() {
		if (!this.conversationForm || !this.startBtn) return

		// First animate opacity to 0
		this.startBtn.style.opacity = '0'
		this.startBtn.style.pointerEvents = 'none'

		// Then set display to none after opacity transition
		setTimeout(() => {
			this.startBtn.classList.add('hidden')
		}, 300)

		this.startConversationTimeout = setTimeout(async () => {
			// Set up conversation form display first
			this.conversationForm.classList.remove('hidden')
			this.conversationForm.classList.add('flex')
			this.conversationForm.style.opacity = '0'
			this.conversationForm.style.pointerEvents = 'none'

			// Then animate opacity to 1
			setTimeout(() => {
				this.conversationForm.style.opacity = '1'
				this.conversationForm.style.pointerEvents = 'auto'
			}, 50)

			this.canvasAnimation.hide()
			// Start with first question
			this.formState.addStep(0)
			this.updateStepDisplay()
			await this.questionHandler.showQuestion(0, true)
		}, 300)
	}

	// Helper methods for external access
	canGoBack() {
		return this.formState.canGoBack()
	}

	getCurrentStep() {
		return this.formState.getCurrentStep()
	}

	getCurrentStepNumber() {
		return this.formState.getCurrentStepNumber()
	}

	// Method to handle conditional logic for step skipping
	shouldSkipStep(stepIndex) {
		if (
			stepIndex === 1 &&
			this.formState.getAnswer('services') === 'General enquiry'
		) {
			return true // Skip specifics
		}
		if (
			stepIndex === 2 &&
			this.formState.getAnswer('services') === 'General enquiry'
		) {
			return true // Skip budget
		}
		return false
	}

	// Get next valid step index (accounting for skips)
	getNextValidStep(currentStep) {
		let nextStep = currentStep + 1

		while (nextStep < questions.length && this.shouldSkipStep(nextStep)) {
			nextStep++
		}

		return nextStep < questions.length ? nextStep : 'gravity-form'
	}

	kill() {
		// Clear any timeouts that might be running
		if (this.goBackTimeout) {
			clearTimeout(this.goBackTimeout)
			this.goBackTimeout = null
		}

		if (this.startConversationTimeout) {
			clearTimeout(this.startConversationTimeout)
			this.startConversationTimeout = null
		}

		// Kill dependent components
		if (
			this.questionHandler &&
			typeof this.questionHandler.kill === 'function'
		) {
			this.questionHandler.kill()
		}

		if (
			this.gravityFormHandler &&
			typeof this.gravityFormHandler.kill === 'function'
		) {
			this.gravityFormHandler.kill()
		}

		if (
			this.canvasAnimation &&
			typeof this.canvasAnimation.kill === 'function'
		) {
			this.canvasAnimation.kill()
		}

		if (this.formState && typeof this.formState.kill === 'function') {
			this.formState.kill()
		}

		// Clear DOM element references
		this.conversationForm = null
		this.startBtn = null

		// Clear component references
		this.formState = null
		this.questionHandler = null
		this.gravityFormHandler = null
		this.canvasAnimation = null
	}
}
