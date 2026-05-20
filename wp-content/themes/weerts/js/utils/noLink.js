let noLinkCleanups = []

export function initNoLinkBlocker() {
	const links = document.querySelectorAll('a[href*="#no-link"]')

	links.forEach((link) => {
		const handleClick = (e) => {
			e.preventDefault()
			e.stopImmediatePropagation()
		}

		link.addEventListener('click', handleClick)
		link.classList.add('disabled') // Optional: style this in CSS

		// Store cleanup
		noLinkCleanups.push(() => {
			link.removeEventListener('click', handleClick)
			link.classList.remove('disabled')
		})
	})
}

export function killNoLinkBlocker() {
	noLinkCleanups.forEach((cleanup) => cleanup())
	noLinkCleanups = []
}
