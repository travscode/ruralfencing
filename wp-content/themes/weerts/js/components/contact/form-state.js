export default class FormState {
	constructor(gformId = 1) {
		this.stepHistory = []
		this.currentHistoryIndex = -1
		this.answers = {}
		this.gformId = gformId
	}

	// Answer management
	setAnswer(questionId, value) {
		this.answers[questionId] = value
	}

	getAnswer(questionId) {
		return this.answers[questionId]
	}

	getAllAnswers() {
		return { ...this.answers }
	}

	addStep(stepIndex) {
		if (this.currentHistoryIndex < this.stepHistory.length - 1) {
			this.stepHistory = this.stepHistory.slice(0, this.currentHistoryIndex + 1)
		}

		this.stepHistory.push(stepIndex)
		this.currentHistoryIndex = this.stepHistory.length - 1
	}

	goBack() {
		if (this.currentHistoryIndex > 0) {
			this.currentHistoryIndex--
			return this.stepHistory[this.currentHistoryIndex]
		}
		return null
	}

	goForward() {
		if (this.currentHistoryIndex < this.stepHistory.length - 1) {
			this.currentHistoryIndex++
			return this.stepHistory[this.currentHistoryIndex]
		}
		return null
	}

	getCurrentStep() {
		if (this.currentHistoryIndex >= 0) {
			return this.stepHistory[this.currentHistoryIndex]
		}
		return null
	}

	getCurrentStepNumber() {
		return this.currentHistoryIndex + 1
	}

	canGoBack() {
		return this.currentHistoryIndex > 0
	}

	reset() {
		this.stepHistory = []
		this.currentHistoryIndex = -1
		this.answers = {}
	}

	kill() {
		this.stepHistory = []
		this.answers = {}
		this.currentHistoryIndex = -1
		this.gformId = null
		this.stepHistory = null
		this.answers = null
	}
}
