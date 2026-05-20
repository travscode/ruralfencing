let buttonCleanups = []

export default function initWorkFilter() {
	const wrap = document.querySelector('.our-work')
	if (!wrap) return

	const buttons = wrap.querySelectorAll('.filter-btn')
	const items = wrap.querySelectorAll('.filter-item')

	let active = new Set(['all'])

	buttons.forEach((btn) => {
		const onClick = () => {
			const val = btn.dataset.filter

			if (val === 'all') {
				active = new Set(['all'])
				updateButtons()
				apply()
				return
			}

			active.delete('all')

			if (active.has(val)) {
				active.delete(val)
			} else {
				active.add(val)
			}

			// If none selected, default back to all
			if (!active.size) active.add('all')

			updateButtons()
			apply()
		}

		btn.addEventListener('click', onClick)

		// Store cleanup function
		buttonCleanups.push(() => {
			btn.removeEventListener('click', onClick)
		})
	})

	function updateButtons() {
		buttons.forEach((b) => {
			const isActive = active.has(b.dataset.filter)
			b.classList.toggle('bg-textDark', isActive)
			b.classList.toggle('text-bgLight', isActive)
			b.classList.toggle('text-textDark', !isActive)
			b.classList.toggle('border-textDark', !isActive)
		})
	}

	function apply() {
		items.forEach((item) => {
			const cats = (item.dataset.categories || '').split(' ').filter(Boolean)

			// Changed from OR to AND logic: item must have ALL active categories
			const show =
				active.has('all') ||
				[...active].every((activeCategory) => cats.includes(activeCategory))

			// Pick one method:
			item.classList.toggle('hidden', !show)
			// OR: item.hidden = !show
		})
	}

	// Prime UI
	updateButtons()
	apply()
}

export function killWorkFilter() {
	buttonCleanups.forEach((cleanup) => cleanup())
	buttonCleanups = []
}
