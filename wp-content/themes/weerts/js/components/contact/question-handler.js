import gsap from 'gsap'

import { questions } from './questions-config.js'
import AnimationManager from './animation-manager.js'

export default class QuestionHandler {
	constructor(formState) {
		this.formState = formState
		this.isTransitioning = false
	}

	async showQuestion(stepIndex, isInitial = false) {
		if (this.isTransitioning) return
		this.isTransitioning = true

		const question = questions[stepIndex]
		const questionTitle = document.getElementById('question-title')
		const questionContent = document.getElementById('question-content')
		const questionActions = document.getElementById('question-actions')
		const budgetSlider = document.getElementById('budget-slider')
		const backBtn = document.getElementById('back-btn')
		const stepContainer = document.querySelector('.back-label')

		// Only animate out if this is NOT the initial load
		if (!isInitial) {
			await AnimationManager.fadeOut([
				stepContainer,
				questionTitle,
				questionContent,
				questionActions,
				budgetSlider,
				backBtn,
			])
		}

		// Clear and prepare new content
		questionContent.innerHTML = ''
		questionActions.innerHTML = ''
		budgetSlider.classList.add('hidden')

		// Update content
		questionTitle.textContent = question.title

		// Show/hide back button with proper logic
		this.setupBackButton(stepIndex)

		if (question.type === 'slider') {
			budgetSlider.classList.remove('hidden')
			this.setupBudgetSlider(question)
			await AnimationManager.fadeIn(
				[backBtn, stepContainer, questionTitle, budgetSlider],
				{ isInitial }
			)
		} else {
			this.setupOptionsQuestion(question, questionContent, questionActions)
			await AnimationManager.fadeIn(
				[
					backBtn,
					stepContainer,
					questionTitle,
					questionContent,
					questionActions,
				],
				{ isInitial }
			)
		}

		this.isTransitioning = false
	}

	setupBackButton() {
		const backBtn = document.getElementById('back-btn')
		if (backBtn) {
			backBtn.onclick = () => {
				if (window.previousStep) {
					window.previousStep()
				}
			}
		}
	}

	setupOptionsQuestion(question, questionContent, questionActions) {
		let options = question.options
		if (question.type === 'conditional') {
			options = question.getOptions(this.formState.getAllAnswers())
		}

		const optionsContainer = document.createElement('div')
		optionsContainer.className = 'flex flex-wrap gap-3 justify-center'

		const badges = []
		options.forEach((option, index) => {
			const badge = document.createElement('button')
			badge.className = 'option-badge'
			badge.textContent = option
			badge.onclick = () => this.selectOption(question.id, option, badge)

			optionsContainer.appendChild(badge)
			badges.push(badge)
		})

		questionContent.appendChild(optionsContainer)

		// Add continue button
		const continueBtn = document.createElement('button')
		continueBtn.textContent = 'Continue'
		continueBtn.className = 'continue-btn'
		continueBtn.disabled = true
		continueBtn.onclick = () => this.onContinue()

		questionActions.appendChild(continueBtn)

		// Use AnimationManager for staggered animation
		AnimationManager.staggerIn(badges)
		AnimationManager.fadeIn(continueBtn, { delay: 0.2 })
	}

	selectOption(questionId, option, badge) {
		this.formState.setAnswer(questionId, option)

		// Use AnimationManager for bounce effect
		AnimationManager.bounceSelect(badge)

		// Update UI
		badge.parentElement.querySelectorAll('.option-badge').forEach((b) => {
			b.classList.remove('selected')
			if (b !== badge) {
				gsap.to(b, {
					opacity: 0.6,
					duration: 0.2,
				})
			}
		})

		badge.classList.add('selected')
		gsap.to(badge, {
			opacity: 1,
			duration: 0.2,
		})

		// Enable continue button
		const continueBtn = document.querySelector('.continue-btn')
		if (continueBtn) {
			continueBtn.disabled = false
		}
	}

	setupBudgetSlider(question) {
		const newSlider = document.getElementById('budget-range')
		const display = document.getElementById('budget-display')
		const continueBtn = document.getElementById('budget-continue')
		const pin = document.getElementById('budget-pin')
		const progressBar = document.getElementById('budget-progress')

		// Get config
		const config = question.getSliderConfig(this.formState.getAllAnswers())
		const { min, max, step } = config

		newSlider.min = min
		newSlider.max = max
		newSlider.step = step
		newSlider.value = min

		// Update min/max labels
		const minLabel = document.querySelector('.min-label')
		const maxLabel = document.querySelector('.max-label')
		if (minLabel)
			minLabel.textContent = min >= 1000 ? `$${min / 1000}K` : `$${min}`
		if (maxLabel)
			maxLabel.textContent = max >= 1000 ? `$${max / 1000}K+` : `$${max}+`

		// Update function (no inertia)
		const updateBudgetPin = (value) => {
			const percentage = ((value - min) / (max - min)) * 100
			const formatted = value >= 1000 ? `$${value / 1000}K` : `$${value}`

			display.textContent = formatted
			this.formState.setAnswer('budget', value)

			// Position pin + fill progress
			const pinPosition = `calc(${percentage}% + ${8 - percentage * 0.16}px)`
			pin.style.left = pinPosition
			progressBar.style.width = `${percentage}%`
		}

		// Event listener
		newSlider.addEventListener('input', (e) => {
			updateBudgetPin(parseInt(e.target.value))
		})

		continueBtn.onclick = () => this.onContinue()

		// Init
		updateBudgetPin(min)
	}

	onContinue() {
		if (this.onContinueCallback) {
			this.onContinueCallback()
		}

		const budgetSlider = document.getElementById('budget-slider')
		budgetSlider.classList.add('hidden')
	}

	onBack() {
		if (this.onBackCallback) {
			this.onBackCallback()
		}
	}

	setCallbacks(onContinue, onBack) {
		this.onContinueCallback = onContinue
		this.onBackCallback = onBack
	}

	kill() {
		// Kill any ongoing GSAP animations
		gsap.killTweensOf([
			document.getElementById('budget-pin'),
			document.getElementById('budget-progress'),
			'.option-badge',
		])

		// Remove all event listeners from slider if it exists
		const slider = document.getElementById('budget-range')
		if (slider) {
			// Clone and replace to remove all event listeners
			const newSlider = slider.cloneNode(true)
			slider.parentNode.replaceChild(newSlider, slider)
		}

		// Remove event listeners from continue button
		const continueBtn = document.getElementById('budget-continue')
		if (continueBtn) {
			continueBtn.onclick = null
		}

		// Remove event listeners from back button
		const backBtn = document.getElementById('back-btn')
		if (backBtn) {
			backBtn.onclick = null
		}

		// Remove event listeners from any option badges
		document.querySelectorAll('.option-badge').forEach((badge) => {
			badge.onclick = null
		})

		// Remove event listeners from regular continue button
		const regularContinueBtn = document.querySelector('.continue-btn')
		if (regularContinueBtn) {
			regularContinueBtn.onclick = null
		}

		// Clear any pending animation callbacks
		if (this.animationTimeouts) {
			this.animationTimeouts.forEach((timeout) => clearTimeout(timeout))
			this.animationTimeouts = null
		}

		// Reset transition state
		this.isTransitioning = false

		// Clear callbacks
		this.onContinueCallback = null
		this.onBackCallback = null

		// Clear formState reference
		this.formState = null
	}
}
