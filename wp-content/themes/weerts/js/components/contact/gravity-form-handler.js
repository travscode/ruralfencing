import gsap from 'gsap'
import AnimationManager from './animation-manager.js'

export default class GravityFormHandler {
	constructor(formState) {
		this.formState = formState
		this.prefillTimeout = null
		this.thankYouTimeout = null
		this.gformConfirmationHandler = null
	}

	prefillForm() {
		const answers = this.formState.getAllAnswers()

		this.prefillTimeout = setTimeout(() => {
			if (answers.services) {
				this.setFieldValue('input_1_4', answers.services)
			}

			if (answers.specifics) {
				this.setFieldValue('input_1_5', answers.specifics)
			}

			if (answers.budget) {
				const budgetValue = '$' + Number(answers.budget).toLocaleString()
				this.setFieldValue('input_1_6', budgetValue)
			}

			if (answers.source) {
				this.setFieldValue('input_1_7', answers.source)
			}

			if (
				window.gf_apply_rules &&
				typeof window.gf_apply_rules === 'function'
			) {
				window.gf_apply_rules(this.formState.gformId, [])
			}
		}, 500)
	}

	setFieldValue(fieldId, value) {
		const field = document.querySelector(`#${fieldId}`)
		if (field) {
			field.value = value

			field.setAttribute('value', value)

			if (window.jQuery) {
				window.jQuery(`#${fieldId}`).val(value)
			}

			const events = ['input', 'change', 'blur', 'keyup', 'focus']
			events.forEach((eventType) => {
				field.dispatchEvent(new Event(eventType, { bubbles: true }))
			})

			if (window.gform && window.gform.doAction) {
				window.gform.doAction(
					'gform_input_change',
					field,
					this.formState.gformId
				)
			}
		}
	}

	async showGravityForm() {
		document.getElementById('question-container').classList.add('hidden')
		document.getElementById('gform-container').classList.remove('hidden')

		const backBtn = document.getElementById('back-btn')
		const stepContainer = document.querySelector(
			'#gform-container .flex.items-center.justify-center.mb-4'
		)
		const questionTitle = document.getElementById('gravity-form-title')
		const gravityForm = document.querySelector('.start-contact-form')
		const formFields = document.querySelectorAll('.start-contact-form .gfield')
		const submitButton = document.querySelector(
			'.start-contact-form .gform_button'
		)

		await AnimationManager.gravityFormSequence({
			backBtn,
			stepContainer,
			questionTitle,
			gravityForm,
			formFields: Array.from(formFields),
			submitButton,
		})

		setTimeout(() => {
			this.prefillForm()
		}, 1000)

		// Check if jQuery is available before using it
		if (window.jQuery) {
			// Store jQuery handler reference for cleanup
			this.jqueryHandler = (event, formId) => {
				if (formId == this.formState.gformId) {
					document.querySelector('#contact-container')?.scrollIntoView({
						behavior: 'instant',
						block: 'start',
					})
					document
						.querySelector('.gravity-form-last-part')
						.classList.add('hidden')
					this.thankYouTimeout = setTimeout(() => {
						this.showThankYou()
					}, 500)
				}
			}
			window
				.jQuery(document)
				.on('gform_confirmation_loaded', this.jqueryHandler)
		} else {
			// Fallback: Use vanilla JavaScript event listener and store reference
			this.gformConfirmationHandler = (event) => {
				if (event.detail && event.detail.formId == this.formState.gformId) {
					document.querySelector('#contact-container')?.scrollIntoView({
						behavior: 'instant',
						block: 'start',
					})
					document
						.querySelector('.gravity-form-last-part')
						.classList.add('hidden')
					this.thankYouTimeout = setTimeout(() => {
						this.showThankYou()
					}, 500)
				}
			}
			document.addEventListener(
				'gform_confirmation_loaded',
				this.gformConfirmationHandler
			)
		}
	}

	showThankYou() {
		document.getElementById('gform-container').classList.add('hidden')
		document.querySelector('.gravity-form-last-part').classList.add('hidden')
		document.getElementById('thank-you').classList.remove('hidden')

		gsap.from('#thank-you > div > *', {
			yPercent: 100,
			opacity: 0,
			stagger: 0.1,
		})
		if (this.onThankYouCallback) {
			this.onThankYouCallback()
		}
	}

	setThankYouCallback(callback) {
		this.onThankYouCallback = callback
	}

	kill() {
		// Clear any timeouts that might be running
		if (this.prefillTimeout) {
			clearTimeout(this.prefillTimeout)
			this.prefillTimeout = null
		}

		if (this.thankYouTimeout) {
			clearTimeout(this.thankYouTimeout)
			this.thankYouTimeout = null
		}

		// Kill any GSAP animations that might be running
		gsap.killTweensOf([
			'#back-btn',
			'#gform-container .flex.items-center.justify-center.mb-4',
			'#gravity-form-title',
			'.start-contact-form',
			'.start-contact-form .gfield',
			'.start-contact-form .gform_button',
		])

		// Remove jQuery event listeners if jQuery is available
		if (window.jQuery && this.jqueryHandler) {
			window
				.jQuery(document)
				.off('gform_confirmation_loaded', this.jqueryHandler)
			this.jqueryHandler = null
		}

		// Remove vanilla JavaScript event listeners
		if (this.gformConfirmationHandler) {
			document.removeEventListener(
				'gform_confirmation_loaded',
				this.gformConfirmationHandler
			)
			this.gformConfirmationHandler = null
		}

		// Clear callback reference
		this.onThankYouCallback = null

		// Clear formState reference
		this.formState = null
	}
}
