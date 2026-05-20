import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { replaceIndent } from '../home/home-animations'

gsap.registerPlugin(ScrollTrigger, SplitText)

let workBlockTimelines = []
let splitTextInstances = []

export function headingBlockAnimations() {
	const containers = document.querySelectorAll('.heading-blocks')

	if (!containers.length) return

	containers.forEach((container, index) => {
		const el = container.querySelector('.heading-container')
		replaceIndent(el)

		const headings = container.querySelectorAll(':scope .heading-container > *')

		const splitText = SplitText.create(headings, {
			type: 'lines',
			mask: 'lines',
			autoSplit: true,
			onSplit: (self) => {
				buildTimeline(self.lines)
			},
		})

		// keep reference so we can revert later
		splitTextInstances.push(splitText)

		function buildTimeline(lines) {
			// kill existing timeline if exists
			if (workBlockTimelines[index]) {
				workBlockTimelines[index].kill()
			}

			// create fresh timeline
			workBlockTimelines[index] = gsap.timeline({
				scrollTrigger: {
					trigger: container,
					start: 'top 75%',
					toggleActions: 'play none none reverse',
				},
				defaults: {
					duration: 0.5,
					ease: 'power2.out',
				},
			})

			workBlockTimelines[index].fromTo(
				lines,
				{ yPercent: 100 },
				{ yPercent: 0, stagger: 0.1 }
			)
		}
	})
}

export function killheadingBlockAnimations() {
	// kill timelines
	if (workBlockTimelines) {
		workBlockTimelines.forEach((tl) => tl.kill())
		workBlockTimelines = []
	}

	// revert SplitText to restore original DOM
	if (splitTextInstances) {
		splitTextInstances.forEach((st) => st.revert())
		splitTextInstances = []
	}

	// also clear ScrollTrigger instances in case
	ScrollTrigger.getAll().forEach((st) => st.kill())
}
