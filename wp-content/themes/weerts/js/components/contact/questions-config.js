// Add to your JS file
let questions = null

document.addEventListener('DOMContentLoaded', () => {
	questions = JSON.parse(
		document.getElementById('questionsData').textContent
	).map((q) => {
		if (q.type === 'conditional') {
			const conditions = q.conditions // Store conditions before deleting
			q.getOptions = (answers) => {
				const service = answers.services
				let options = []

				if (conditions && conditions[service]) {
					options.push(...conditions[service])
					options.push('Not sure')
				}
				return [...new Set(options)]
			}
			delete q.conditions
		}

		if (q.type === 'slider') {
			const sliderConfig = q.slider_config // Store slider config
			q.getSliderConfig = (answers) => {
				const service = answers.services

				if (sliderConfig && sliderConfig[service]) {
					return sliderConfig[service]
				}

				// Default config if no specific rule found
				return {
					min: 5000,
					max: 100000,
					step: 1000,
					hide: false,
				}
			}
			delete q.slider_config
		}

		return q
	})
})

export { questions }
