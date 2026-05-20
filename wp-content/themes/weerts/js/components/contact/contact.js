import CanvasAnimation from './canvas-animation.js'
import FormState from './form-state.js'
import QuestionHandler from './question-handler.js'
import GravityFormHandler from './gravity-form-handler.js'
import StepNavigator from './step-navigator.js'

let canvasAnimation
let formState
let questionHandler
let gravityFormHandler
let stepNavigator

export default function initContactForm() {
	const btn = document.getElementById('contact-start-btn')
	const conversationForm = document.getElementById('conversation-form')

	if (!btn || !conversationForm) {
		return
	}

	canvasAnimation = new CanvasAnimation('contact-canvas')
	formState = new FormState(1)
	questionHandler = new QuestionHandler(formState)
	gravityFormHandler = new GravityFormHandler(formState)

	stepNavigator = new StepNavigator(
		formState,
		questionHandler,
		gravityFormHandler,
		canvasAnimation
	)

	questionHandler.setCallbacks(
		() => stepNavigator.nextStep(),
		() => stepNavigator.previousStep()
	)

	gravityFormHandler.setThankYouCallback(() => {
		canvasAnimation.show()
	})

	window.previousStep = () => stepNavigator.previousStep()
	window.goBackToStart = () => stepNavigator.goBackToStart()

	btn?.addEventListener('click', (e) => {
		e.preventDefault()
		stepNavigator.startConversation()
	})
}

export function killContactCanvas() {
	if (canvasAnimation) canvasAnimation.kill()
	if (formState) formState.kill()
	if (questionHandler) questionHandler.kill()
	if (gravityFormHandler) gravityFormHandler.kill()
	if (stepNavigator) stepNavigator.kill()
}
