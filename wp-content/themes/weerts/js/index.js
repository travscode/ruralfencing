/**
 * Marks the document as JavaScript-enabled once the page has loaded.
 */
function initSite() {
	document.documentElement.classList.remove('no-js')
	document.documentElement.classList.add('js')

	initResponsiveNavigation()
	initCtaCarousels()
	initArticleSharing()
	initHeaderHeightVar()
	initGoogleMapsSections()
	initProductsMegaMenu()
	initAdvancedSearchDrawer()
	initHeaderSearchAutocomplete()
	initProductCarousels()
	initTestimonialsCarousels()
	initFadeTestimonialsCarousels()
	initProductVariationButtons()
	initProductEnquiryModal()
}

let googleMapsApiPromise = null

/**
 * Loads the Google Maps JavaScript API once and reuses it across map sections.
 */
function loadGoogleMapsApi(apiKey) {
	if (window.google?.maps) {
		return Promise.resolve(window.google.maps)
	}

	if (googleMapsApiPromise) {
		return googleMapsApiPromise
	}

	googleMapsApiPromise = new Promise((resolve, reject) => {
		const callbackName = '__weertsGoogleMapsReady'
		const existingScript = document.querySelector(
			'script[data-google-maps-loader="true"]'
		)

		window[callbackName] = () => {
			delete window[callbackName]
			resolve(window.google.maps)
		}

		if (existingScript) {
			existingScript.addEventListener('error', () => {
				googleMapsApiPromise = null
				delete window[callbackName]
				reject(new Error('Google Maps failed to load'))
			})
			return
		}

		const script = document.createElement('script')
		script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
			apiKey
		)}&callback=${callbackName}`
		script.async = true
		script.defer = true
		script.dataset.googleMapsLoader = 'true'
		script.addEventListener('error', () => {
			googleMapsApiPromise = null
			delete window[callbackName]
			reject(new Error('Google Maps failed to load'))
		})

		document.head.appendChild(script)
	})

	return googleMapsApiPromise
}

function initHeaderHeightVar() {
	const stickyNav = document.querySelector('[data-sticky-nav]')
	const header = document.querySelector('header')
	const measuredElement = stickyNav || header
	if (!measuredElement) return

	const set = () => {
		document.documentElement.style.setProperty(
			'--site-header-height',
			`${measuredElement.offsetHeight}px`
		)
	}

	set()
	window.addEventListener('resize', set)
}

/**
 * Upgrades fallback map embeds to Google Maps widgets when an API key is available.
 */
function initGoogleMapsSections() {
	const sections = Array.from(document.querySelectorAll('[data-google-map]'))
	if (!sections.length) return

	const sectionsWithKeys = sections.filter((section) =>
		section.getAttribute('data-api-key')?.trim()
	)
	if (!sectionsWithKeys.length) return

	const apiKey = sectionsWithKeys[0].getAttribute('data-api-key')?.trim() || ''
	if (!apiKey) return

	loadGoogleMapsApi(apiKey)
		.then(() => {
			for (const section of sectionsWithKeys) {
				initGoogleMapSection(section)
			}
		})
		.catch(() => {
			// Leave the iframe fallback in place if the API is unavailable.
		})
}

/**
 * Renders a single Google Map instance for the supplied section element.
 */
function initGoogleMapSection(section) {
	const canvas = section.querySelector('[data-google-map-canvas]')
	const fallback = section.querySelector('[data-google-map-fallback]')
	if (!(canvas instanceof HTMLElement)) return

	const latitude = Number.parseFloat(
		section.getAttribute('data-latitude') || 'NaN'
	)
	const longitude = Number.parseFloat(
		section.getAttribute('data-longitude') || 'NaN'
	)
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

	const center = { lat: latitude, lng: longitude }
	const title = section.getAttribute('data-title') || ''

	const map = new window.google.maps.Map(canvas, {
		center,
		zoom: 15,
		mapTypeControl: false,
		streetViewControl: false,
		fullscreenControl: true,
	})

	new window.google.maps.Marker({
		map,
		position: center,
		title,
	})

	canvas.classList.remove('hidden')
	fallback?.classList.add('hidden')
}

function initProductsMegaMenu() {
	const toggle = document.getElementById('products-menu-toggle')
	const menu = document.getElementById('products-mega-menu')
	if (!toggle || !menu) return
	const header = document.querySelector('header')

	const overlay = menu.querySelector('[data-products-menu="overlay"]')
	const level1Root = menu.querySelector('[data-products-menu="level1"]')
	const level2Root = menu.querySelector('[data-products-menu="level2"]')
	const level3Root = menu.querySelector('[data-products-menu="level3"]')
	const dataEl = document.getElementById('product-cat-tree')

	if (!overlay || !level1Root || !level2Root || !level3Root || !dataEl) return

	let tree = []
	try {
		tree = JSON.parse(dataEl.textContent || '[]')
	} catch {
		tree = []
	}

	const state = {
		open: false,
		level1ActiveId: null,
		level2ActiveId: null,
	}

	const byId = new Map()
	const indexTree = (items) => {
		for (const item of items) {
			if (item && typeof item === 'object' && typeof item.id === 'number') {
				byId.set(item.id, item)
				if (Array.isArray(item.children)) indexTree(item.children)
			}
		}
	}
	indexTree(tree)

	let closeTimer = null
	let pendingOpenTimer = null

	const decodeHtml = (value) => {
		if (typeof value !== 'string') return value == null ? '' : String(value)
		if (!value.includes('&') && !value.includes('<')) return value
		const el = document.createElement('div')
		el.innerHTML = value
		return el.textContent || ''
	}

	/**
	 * Clears any delayed mega-menu open triggered by a smooth scroll.
	 */
	const clearPendingOpen = () => {
		if (!pendingOpenTimer) return
		window.clearTimeout(pendingOpenTimer)
		pendingOpenTimer = null
	}

	const setOpen = (nextOpen, options = {}) => {
		const fastClose = Boolean(options.fastClose)

		if (closeTimer) {
			clearTimeout(closeTimer)
			closeTimer = null
		}

		clearPendingOpen()

		state.open = nextOpen
		toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false')

		if (nextOpen) {
			menu.dataset.closeSpeed = 'normal'
			menu.dataset.level2Open = 'false'
			menu.dataset.level3Open = 'false'
			level2Root.replaceChildren()
			level3Root.replaceChildren()
			menu.dataset.open = 'false'
			menu.classList.remove('hidden')
			document.body.style.overflow = 'hidden'
			requestAnimationFrame(() => {
				if (!state.open) return
				menu.dataset.open = 'true'
			})
		} else {
			menu.dataset.closeSpeed = fastClose ? 'fast' : 'normal'
			state.level1ActiveId = null
			state.level2ActiveId = null
			menu.dataset.level2Open = 'false'
			menu.dataset.level3Open = 'false'
			level2Root.replaceChildren()
			level3Root.replaceChildren()
			menu.dataset.open = 'false'
			document.body.style.overflow = ''

			const closeMs = fastClose ? 140 : 260
			closeTimer = setTimeout(() => {
				if (state.open) return
				menu.classList.add('hidden')
				closeTimer = null
			}, closeMs)
		}
	}

	/**
	 * Scrolls the page until the sticky nav reaches the top, then opens the mega menu.
	 */
	const openFromStickyPosition = () => {
		const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0
		if (headerHeight <= 0 || window.scrollY >= headerHeight - 2) {
			setOpen(true)
			return
		}

		window.scrollTo({
			top: headerHeight,
			behavior: 'smooth',
		})

		pendingOpenTimer = window.setTimeout(() => {
			pendingOpenTimer = null
			setOpen(true)
		}, 320)
	}

	/**
	 * Opens the mega menu only when the sticky nav is already at the top of the viewport.
	 */
	const openOnlyWhenSticky = () => {
		const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0
		if (headerHeight > 0 && window.scrollY < headerHeight - 2) {
			return
		}

		if (!state.open) {
			setOpen(true)
		}
	}

	const makeItem = ({ item }) => {
		const hasChildren = Array.isArray(item.children) && item.children.length > 0
		const a = document.createElement('a')
		a.href = item.link || '#'
		a.className =
			'flex w-full items-center justify-between gap-3 px-6 py-[15px] text-[17px] leading-6 no-underline transition-colors text-deep-green duration-200 hover:bg-goldenrod hover:text-birch'
		a.dataset.termId = String(item.id)
		a.dataset.hasChildren = hasChildren ? 'true' : 'false'

		const label = document.createElement('span')
		label.className = 'text-birch'
		label.textContent = decodeHtml(item.name)
		a.appendChild(label)

		if (hasChildren) {
			const arrow = document.createElement('span')
			arrow.setAttribute('aria-hidden', 'true')
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
			svg.setAttribute('width', '8')
			svg.setAttribute('height', '13')
			svg.setAttribute('viewBox', '0 0 8 13')
			svg.setAttribute('fill', 'none')
			svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
			svg.setAttribute('aria-hidden', 'true')
			svg.setAttribute('focusable', 'false')

			const path = document.createElementNS(
				'http://www.w3.org/2000/svg',
				'path'
			)
			path.setAttribute('d', 'M1.41406 1.41406L6.41406 6.41406L1.41406 11.4141')
			path.setAttribute('stroke', 'currentColor')
			path.setAttribute('stroke-width', '2')
			path.setAttribute('stroke-linecap', 'square')
			path.setAttribute('stroke-linejoin', 'bevel')

			svg.appendChild(path)
			arrow.appendChild(svg)
			a.appendChild(arrow)
		}

		return a
	}

	const activateLevel1 = (active) => {
		state.level1ActiveId = active.id
		state.level2ActiveId = null
		const children = Array.isArray(active.children) ? active.children : []
		if (children.length) {
			menu.dataset.level2Open = 'true'
			renderLevel({
				level: 2,
				rootEl: level2Root,
				items: children,
				parent: active,
			})
			menu.dataset.level3Open = 'false'
			level3Root.replaceChildren()
		} else {
			menu.dataset.level2Open = 'false'
			menu.dataset.level3Open = 'false'
			level2Root.replaceChildren()
			level3Root.replaceChildren()
		}
	}

	const activateLevel2 = (active) => {
		state.level2ActiveId = active.id
		const children = Array.isArray(active.children) ? active.children : []
		if (children.length) {
			menu.dataset.level3Open = 'true'
			renderLevel({
				level: 3,
				rootEl: level3Root,
				items: children,
				parent: active,
			})
		} else {
			menu.dataset.level3Open = 'false'
			level3Root.replaceChildren()
		}
	}

	const renderLevel = ({ level, rootEl, items, parent }) => {
		rootEl.replaceChildren()

		const list = document.createElement('div')
		list.className =
			'flex flex-col ' + (level > 1 ? ' bg-eggshell' : ' bg-white')

		const back = document.createElement('button')
		back.type = 'button'
		back.className = 'w-full px-6 py-4 text-left font-bold text-deep-green'
		back.setAttribute('data-mobile-back', '')
		back.textContent = level === 1 ? 'Close categories' : 'Back to categories'
		back.addEventListener('click', () => {
			if (level === 1) { setOpen(false); toggle.focus(); return }
			menu.dataset.level3Open = 'false'
			if (level === 2) menu.dataset.level2Open = 'false'
			const previous = level === 2 ? level1Root : level2Root
			previous.querySelector('button, a')?.focus()
		})
		list.appendChild(back)

		if (level > 1 && parent && parent.link) {
			const showAll = document.createElement('a')
			showAll.href = parent.link
			showAll.className =
				'px-6 py-[15px] text-[17px] leading-6 underline underline-offset-4 hover:text-deep-green'
			showAll.textContent = 'Show all'
			list.appendChild(showAll)
		}

		for (const item of items) {
			const el = makeItem({ item })
			list.appendChild(el)
		}

		rootEl.appendChild(list)
	}

	renderLevel({ level: 1, rootEl: level1Root, items: tree, parent: null })

	const handleActivate = (e, level) => {
		const link = e.target.closest('a[data-term-id]')
		if (!link) return
		const id = Number(link.dataset.termId || '')
		if (!Number.isFinite(id)) return
		const item = byId.get(id)
		if (!item) return

		if (level === 1) activateLevel1(item)
		if (level === 2) activateLevel2(item)
	}

	const handleClick = (e, level) => {
		const link = e.target.closest('a[data-term-id]')
		if (!link) return
		if (link.dataset.hasChildren !== 'true') return
		e.preventDefault()
		handleActivate(e, level)
		if (window.innerWidth < 1024) (level === 1 ? level2Root : level3Root).querySelector('button, a')?.focus()
	}

	level1Root.addEventListener('mouseover', (e) => { if (window.matchMedia('(hover: hover) and (min-width: 1024px)').matches) handleActivate(e, 1) })
	level1Root.addEventListener('focusin', (e) => { if (window.innerWidth >= 1024) handleActivate(e, 1) })
	level1Root.addEventListener('click', (e) => handleClick(e, 1))

	level2Root.addEventListener('mouseover', (e) => { if (window.matchMedia('(hover: hover) and (min-width: 1024px)').matches) handleActivate(e, 2) })
	level2Root.addEventListener('focusin', (e) => { if (window.innerWidth >= 1024) handleActivate(e, 2) })
	level2Root.addEventListener('click', (e) => handleClick(e, 2))

	toggle.addEventListener('click', () => {
		if (state.open) {
			setOpen(false)
			return
		}

		openFromStickyPosition()
	})
	toggle.addEventListener('mouseenter', () => {
		if (window.matchMedia('(min-width: 1024px) and (hover: hover)').matches) openOnlyWhenSticky()
	})
	overlay.addEventListener('click', () => setOpen(false, { fastClose: true }))

	menu.addEventListener('click', (e) => {
		if (!state.open) return
		const clickedPanel = e.target.closest('.products-mega-menu__panel')
		if (clickedPanel) return
		setOpen(false, { fastClose: true })
	})

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && state.open) { setOpen(false, { fastClose: true }); toggle.focus() }
	})
}

function initAdvancedSearchDrawer() {
	const drawer = document.querySelector('[data-advanced-search-drawer]')
	if (!drawer) return

	const panel = drawer.querySelector('.advanced-search-drawer__panel')
	const overlay = drawer.querySelector('[data-advanced-search-overlay]')
	const closeButtons = drawer.querySelectorAll('[data-advanced-search-close]')
	const triggers = document.querySelectorAll('[data-advanced-search-trigger]')
	const primaryInput = drawer.querySelector(
		'[data-advanced-search-primary-input]'
	)
	const secondaryInput = drawer.querySelector(
		'[data-advanced-search-secondary-input]'
	)
	const categoryTarget = drawer.querySelector(
		'[data-advanced-search-category-target]'
	)
	const parentSelect = drawer.querySelector('[data-advanced-search-parent]')
	const childSelect = drawer.querySelector('[data-advanced-search-child]')
	const categoryTreeEl = document.getElementById(
		'advanced-search-category-tree'
	)

	if (!panel || !overlay || !primaryInput || !secondaryInput) return

	let categoryTree = []
	try {
		categoryTree = JSON.parse(categoryTreeEl?.textContent || '[]')
	} catch {
		categoryTree = []
	}

	let isOpen = false
	let activeTrigger = null

	const advancedIconSvg =
		'<svg class="h-3 w-[18px]" width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="18" y="0" width="1.71429" height="18" transform="rotate(90 18 0)" fill="currentColor"></rect><rect x="18" y="5.14282" width="1.71429" height="18" transform="rotate(90 18 5.14282)" fill="currentColor"></rect><rect x="18" y="10.2856" width="1.71429" height="18" transform="rotate(90 18 10.2856)" fill="currentColor"></rect></svg>'

	const syncTriggerIcons = () => {
		triggers.forEach((trigger) => {
			if (!trigger.querySelector('svg')) {
				trigger.innerHTML = advancedIconSvg
			}
		})
	}

	const getAssociatedInput = (trigger) => {
		const wrapper = trigger.closest('form, .rural-search-strip__bar, .relative')
		return wrapper?.querySelector('[data-advanced-search-input]') || null
	}

	const setOpen = (nextOpen) => {
		if (nextOpen === isOpen) return

		isOpen = nextOpen
		drawer.dataset.open = nextOpen ? 'true' : 'false'

		if (nextOpen) {
			drawer.classList.remove('hidden')
			document.body.style.overflow = 'hidden'
			requestAnimationFrame(() => {
				drawer.dataset.open = 'true'
			})
			window.setTimeout(() => {
				primaryInput.focus()
			}, 180)
			return
		}

		drawer.dataset.open = 'false'
		document.body.style.overflow = ''
		window.setTimeout(() => {
			if (isOpen) return
			drawer.classList.add('hidden')
		}, 260)

		if (activeTrigger instanceof HTMLElement) {
			activeTrigger.focus()
		}
	}

	const syncSearchValues = (value) => {
		primaryInput.value = value
		secondaryInput.value = value
	}

	const getChildrenForSlug = (slug) => {
		const selectedParent = categoryTree.find((item) => item.slug === slug)
		return Array.isArray(selectedParent?.children)
			? selectedParent.children
			: []
	}

	const updateChildOptions = (parentSlug) => {
		if (!(childSelect instanceof HTMLSelectElement)) return

		const children = getChildrenForSlug(parentSlug)
		childSelect.innerHTML = '<option value="">All subcategories</option>'

		if (!children.length) {
			childSelect.disabled = true
			return
		}

		children.forEach((child) => {
			const option = document.createElement('option')
			option.value = child.slug || ''
			option.textContent = child.name || ''
			childSelect.appendChild(option)
		})

		childSelect.disabled = false
	}

	const syncCategoryTarget = () => {
		if (!(categoryTarget instanceof HTMLInputElement)) return
		const childValue =
			childSelect instanceof HTMLSelectElement ? childSelect.value : ''
		const parentValue =
			parentSelect instanceof HTMLSelectElement ? parentSelect.value : ''
		categoryTarget.value = childValue || parentValue || ''
	}

	syncTriggerIcons()
	updateChildOptions('')
	syncCategoryTarget()

	triggers.forEach((trigger) => {
		trigger.addEventListener('click', () => {
			activeTrigger = trigger
			const associatedInput = getAssociatedInput(trigger)
			const currentValue =
				associatedInput instanceof HTMLInputElement ? associatedInput.value : ''
			syncSearchValues(currentValue)
			setOpen(true)
		})
	})

	overlay.addEventListener('click', () => setOpen(false))
	closeButtons.forEach((button) => {
		button.addEventListener('click', () => setOpen(false))
	})

	drawer.addEventListener('click', (event) => {
		if (!isOpen) return
		const clickedInsidePanel = event.target.closest(
			'.advanced-search-drawer__panel'
		)
		if (!clickedInsidePanel) setOpen(false)
	})

	document.addEventListener('keydown', (event) => {
		if (!isOpen) return
		if (event.key === 'Escape') setOpen(false)
		if (event.key === 'Tab') {
			const controls = Array.from(panel.querySelectorAll('button, input:not([type="hidden"]), select, a[href]')).filter(el => !el.disabled)
			const first = controls[0], last = controls[controls.length - 1]
			if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
			if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
		}
	})

	primaryInput.addEventListener('input', () => {
		secondaryInput.value = primaryInput.value
	})

	secondaryInput.addEventListener('input', () => {
		primaryInput.value = secondaryInput.value
	})

	if (parentSelect instanceof HTMLSelectElement) {
		parentSelect.addEventListener('change', () => {
			updateChildOptions(parentSelect.value)
			syncCategoryTarget()
		})
	}

	if (childSelect instanceof HTMLSelectElement) {
		childSelect.addEventListener('change', syncCategoryTarget)
	}

	const advancedForm = drawer.querySelector('[data-advanced-search-form]')
	if (advancedForm) {
		advancedForm.addEventListener('submit', syncCategoryTarget)
	}
}

/**
 * Adds a focus-first autocomplete dropdown to the header search form.
 */
function initHeaderSearchAutocomplete() {
	const form = document.querySelector('[data-header-search]')
	if (!(form instanceof HTMLFormElement)) return

	const input = form.querySelector('[data-header-search-input]')
	const dropdown = form.querySelector('[data-header-search-dropdown]')
	const popularRoot = form.querySelector('[data-header-search-popular]')
	const recentRoot = form.querySelector('[data-header-search-recent]')
	const recentSection = form.querySelector(
		'[data-header-search-recent-section]'
	)
	const featuredRoot = form.querySelector('[data-header-search-featured]')
	const featuredSection = form.querySelector(
		'[data-header-search-featured-section]'
	)
	const resultsRoot = form.querySelector('[data-header-search-results]')
	const resultsSection = form.querySelector(
		'[data-header-search-results-section]'
	)
	const resultsTitle = form.querySelector('[data-header-search-results-title]')
	const statusRoot = form.querySelector('[data-header-search-status]')
	const clearButton = form.querySelector('[data-header-search-clear]')
	const emptyState = form.querySelector('[data-header-search-empty-state]')
	const config = window.weertsThemeData || {}
	const popularSearches = Array.isArray(config.popularSearches)
		? config.popularSearches
		: []
	const featuredProducts = Array.isArray(config.featuredProducts)
		? config.featuredProducts
		: []
	const recentStorageKey = 'weerts-header-search-recent'

	if (
		!(input instanceof HTMLInputElement) ||
		!(dropdown instanceof HTMLElement) ||
		!(popularRoot instanceof HTMLElement) ||
		!(recentRoot instanceof HTMLElement) ||
		!(recentSection instanceof HTMLElement) ||
		!(featuredRoot instanceof HTMLElement) ||
		!(featuredSection instanceof HTMLElement) ||
		!(resultsRoot instanceof HTMLElement) ||
		!(resultsSection instanceof HTMLElement) ||
		!(resultsTitle instanceof HTMLElement) ||
		!(statusRoot instanceof HTMLElement) ||
		!(emptyState instanceof HTMLElement)
	) {
		return
	}

	let debounceTimer = null
	let activeController = null

	/**
	 * Reads recent searches stored in localStorage for the header form.
	 */
	function getRecentSearches() {
		try {
			const raw = window.localStorage.getItem(recentStorageKey)
			const parsed = raw ? JSON.parse(raw) : []
			return Array.isArray(parsed)
				? parsed.filter(
						(item) => typeof item === 'string' && item.trim() !== ''
				  )
				: []
		} catch {
			return []
		}
	}

	/**
	 * Persists a recent search term so the dropdown has useful focus-state content.
	 */
	function saveRecentSearch(term) {
		const normalized = term.trim()
		if (!normalized) return

		const next = [
			normalized,
			...getRecentSearches().filter(
				(item) => item.toLowerCase() !== normalized.toLowerCase()
			),
		].slice(0, 6)

		try {
			window.localStorage.setItem(recentStorageKey, JSON.stringify(next))
		} catch {
			// Ignore storage failures and keep the search interaction working.
		}
	}

	/**
	 * Clears the stored recent search list from localStorage and the UI.
	 */
	function clearRecentSearches() {
		try {
			window.localStorage.removeItem(recentStorageKey)
		} catch {
			// Ignore storage failures and keep the search interaction working.
		}
		renderRecentSearches()
	}

	/**
	 * Opens the dropdown under the search field and updates combobox state.
	 */
	function openDropdown() {
		dropdown.classList.remove('hidden')
		dropdown.dataset.open = 'true'
		input.setAttribute('aria-expanded', 'true')
	}

	/**
	 * Closes the dropdown and resets any transient loading state.
	 */
	function closeDropdown() {
		dropdown.dataset.open = 'false'
		dropdown.classList.add('hidden')
		input.setAttribute('aria-expanded', 'false')
		hideStatus()
	}

	/**
	 * Shows a lightweight status row for loading and empty-result states.
	 */
	function showStatus(message) {
		statusRoot.textContent = message
		statusRoot.className = 'header-search__section mt-2 header-search__status'
		statusRoot.classList.remove('hidden')
	}

	/**
	 * Hides the status row when the dropdown has richer content to show.
	 */
	function hideStatus() {
		statusRoot.textContent = ''
		statusRoot.className = 'header-search__section mt-2 hidden'
	}

	/**
	 * Submits the current form value as a product search and stores it locally.
	 */
	function submitSearch(term) {
		input.value = term
		saveRecentSearch(term)
		form.requestSubmit()
	}

	/**
	 * Renders pill-style suggestions used by the empty dropdown state.
	 */
	function renderPills(root, items, onClick) {
		root.replaceChildren()

		items.forEach((item) => {
			const button = document.createElement('button')
			button.type = 'button'
			button.className = 'header-search__pill'
			button.textContent = item.label
			button.addEventListener('click', () => onClick(item))
			root.appendChild(button)
		})
	}

	/**
	 * Renders the recent-search pill group and toggles its section visibility.
	 */
	function renderRecentSearches() {
		const recentSearches = getRecentSearches().map((item) => ({ label: item }))

		if (!recentSearches.length) {
			recentRoot.replaceChildren()
			recentSection.classList.add('hidden')
			recentSection.classList.remove('flex')
			return
		}

		recentSection.classList.remove('hidden')
		recentSection.classList.add('flex')
		renderPills(recentRoot, recentSearches, (item) => submitSearch(item.label))
	}

	/**
	 * Renders featured product cards that stay visible in the dropdown.
	 */
	function renderFeaturedProducts() {
		featuredRoot.replaceChildren()

		if (!featuredProducts.length) {
			featuredSection.classList.add('hidden')
			featuredSection.classList.remove('flex')
			return
		}

		featuredSection.classList.remove('hidden')
		featuredSection.classList.add('flex')

		featuredProducts.forEach((item) => {
			const link = document.createElement('a')
			link.href = item.url || '#'
			link.className = 'header-search__featured-card'

			const imageWrap = document.createElement('span')
			imageWrap.className = 'header-search__featured-image'

			const image = document.createElement('img')
			image.src = item.image || ''
			image.alt = item.label || ''
			image.loading = 'lazy'
			imageWrap.appendChild(image)

			const content = document.createElement('span')
			content.className = 'min-w-0 flex-1'

			const title = document.createElement('span')
			title.className = 'header-search__featured-title block'
			title.textContent = item.label || ''
			content.appendChild(title)

			if (item.meta) {
				const meta = document.createElement('span')
				meta.className = 'header-search__featured-meta block'
				meta.textContent = item.meta
				content.appendChild(meta)
			}

			if (item.price) {
				const price = document.createElement('span')
				price.className = 'header-search__featured-price block'
				price.textContent = item.price
				content.appendChild(price)
			}

			link.appendChild(imageWrap)
			link.appendChild(content)
			featuredRoot.appendChild(link)
		})
	}

	/**
	 * Renders the focus-state dropdown with popular and recent suggestions.
	 */
	function renderEmptyState() {
		emptyState.classList.remove('hidden')
		resultsSection.classList.add('hidden')
		resultsSection.classList.remove('flex')
		hideStatus()

		renderPills(popularRoot, popularSearches, (item) =>
			submitSearch(item.label)
		)
		renderRecentSearches()
		renderFeaturedProducts()
	}

	/**
	 * Renders AJAX-backed product and category suggestions for the active query.
	 */
	function renderResults(items, query) {
		resultsRoot.replaceChildren()
		resultsSection.classList.remove('hidden')
		resultsSection.classList.add('flex')
		emptyState.classList.add('hidden')
		hideStatus()
		resultsTitle.textContent = `Suggestions for "${query}"`

		items.forEach((item) => {
			const link = document.createElement('a')
			link.href = item.url || '#'
			link.className = 'header-search__suggestion'

			const label = document.createElement('span')
			label.textContent = item.label || ''
			link.appendChild(label)

			if (item.meta) {
				const meta = document.createElement('span')
				meta.className = 'header-search__suggestion-meta'
				meta.textContent = item.meta
				link.appendChild(meta)
			}

			link.addEventListener('click', () => {
				saveRecentSearch(item.label || query)
			})

			resultsRoot.appendChild(link)
		})
	}

	/**
	 * Loads live suggestions from WordPress based on the current search term.
	 */
	async function fetchSuggestions(query) {
		if (!config.ajaxUrl || !config.searchSuggestionsNonce) {
			showStatus('Search suggestions are not available right now.')
			return
		}

		if (activeController) {
			activeController.abort()
		}

		activeController = new AbortController()
		showStatus('Searching...')

		const url = new URL(config.ajaxUrl, window.location.origin)
		url.searchParams.set('action', 'weerts_search_suggestions')
		url.searchParams.set('nonce', config.searchSuggestionsNonce)
		url.searchParams.set('query', query)

		try {
			const response = await fetch(url.toString(), {
				signal: activeController.signal,
			})
			const data = await response.json()

			if (!data?.success) {
				showStatus('No suggestions found.')
				resultsSection.classList.add('hidden')
				resultsSection.classList.remove('flex')
				return
			}

			const items = Array.isArray(data.data?.items) ? data.data.items : []
			if (!items.length) {
				showStatus('No suggestions found.')
				resultsSection.classList.add('hidden')
				resultsSection.classList.remove('flex')
				return
			}

			renderResults(items, query)
		} catch (error) {
			if (error?.name === 'AbortError') return
			showStatus('Search suggestions are unavailable right now.')
			resultsSection.classList.add('hidden')
			resultsSection.classList.remove('flex')
		}
	}

	renderEmptyState()

	input.addEventListener('focus', () => {
		openDropdown()
		if (input.value.trim().length < 2) {
			renderEmptyState()
		}
	})

	input.addEventListener('input', () => {
		const query = input.value.trim()
		openDropdown()

		if (debounceTimer) {
			window.clearTimeout(debounceTimer)
		}

		if (query.length < 2) {
			if (activeController) activeController.abort()
			renderEmptyState()
			return
		}

		debounceTimer = window.setTimeout(() => {
			fetchSuggestions(query)
		}, 180)
	})

	input.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closeDropdown()
			input.blur()
		}
	})

	form.addEventListener('submit', () => {
		saveRecentSearch(input.value)
	})

	clearButton?.addEventListener('click', clearRecentSearches)

	document.addEventListener('click', (event) => {
		if (form.contains(event.target)) return
		closeDropdown()
	})
}

function initProductCarousels() {
	const carousels = document.querySelectorAll('.rural-product-carousel')
	if (!carousels.length) return

	for (const carousel of carousels) {
		const viewport = carousel.querySelector('.rural-product-carousel__viewport')
		if (!viewport) continue

		const progressEl = carousel.querySelector('[data-carousel-progress]')
		const progressWrap = carousel.querySelector(
			'.rural-product-carousel__progress'
		)
		const prevBtn = carousel.querySelector('[data-carousel-prev]')
		const nextBtn = carousel.querySelector('[data-carousel-next]')

		const hideBelow = Number.parseInt(
			viewport.getAttribute('data-carousel-hide-below') || '5',
			10
		)

		const getList = () =>
			viewport.querySelector(
				'[data-carousel-track], .woocommerce ul.products, ul.products'
			)

		let raf = null
		let resizeTimer = null
		let pages = []

		const calc = () => {
			const list = getList()
			if (!list) return
			const items = Array.from(list.children).filter(
				(el) => el && el.nodeType === 1
			)
			if (!items.length) return

			if (progressWrap) {
				progressWrap.style.display = items.length < hideBelow ? 'none' : ''
			}

			const first = items[0]
			const itemW = first.getBoundingClientRect().width || 1
			const listStyle = window.getComputedStyle(list)
			const gap =
				Number.parseFloat(listStyle.columnGap || listStyle.gap || '0') || 0
			const perPage = Math.max(
				1,
				Math.floor((viewport.clientWidth + gap) / (itemW + gap))
			)

			pages = []
			for (let i = 0; i < items.length; i += perPage) {
				pages.push(items[i].offsetLeft)
			}

			if (pages.length <= 1) {
				if (prevBtn) prevBtn.disabled = true
				if (nextBtn) nextBtn.disabled = true
				if (progressEl) {
					progressEl.style.width = '100%'
					progressEl.style.left = '0%'
				}
				return
			}

			update()
		}

		const getPageIndex = () => {
			if (!pages.length) return 0
			const x = viewport.scrollLeft
			let best = 0
			for (let i = 0; i < pages.length; i++) {
				if (Math.abs(pages[i] - x) < Math.abs(pages[best] - x)) best = i
			}
			return best
		}

		const scrollToPage = (index) => {
			if (!pages.length) return
			const nextIndex = Math.max(0, Math.min(pages.length - 1, index))
			viewport.scrollTo({ left: pages[nextIndex], behavior: 'smooth' })
		}

		const update = () => {
			if (!pages.length) return
			const idx = getPageIndex()
			if (prevBtn) prevBtn.disabled = idx <= 0
			if (nextBtn) nextBtn.disabled = idx >= pages.length - 1
			if (progressEl) {
				const thumbPct = 100 / pages.length
				const maxScroll = Math.max(
					1,
					viewport.scrollWidth - viewport.clientWidth
				)
				const scrollProgress = Math.min(
					1,
					Math.max(0, viewport.scrollLeft / maxScroll)
				)
				const travelPct = 100 - thumbPct
				progressEl.style.width = `${thumbPct}%`
				progressEl.style.left = `${travelPct * scrollProgress}%`
			}
		}

		const scheduleUpdate = () => {
			if (raf) return
			raf = requestAnimationFrame(() => {
				raf = null
				update()
			})
		}

		if (prevBtn)
			prevBtn.addEventListener('click', () => scrollToPage(getPageIndex() - 1))
		if (nextBtn)
			nextBtn.addEventListener('click', () => scrollToPage(getPageIndex() + 1))

		viewport.addEventListener('scroll', scheduleUpdate, { passive: true })
		window.addEventListener('resize', () => {
			if (resizeTimer) clearTimeout(resizeTimer)
			resizeTimer = setTimeout(calc, 120)
		})

		const initWhenReady = () => {
			const list = getList()
			if (list && list.children.length) {
				calc()
				return true
			}
			return false
		}

		if (!initWhenReady()) {
			const obs = new MutationObserver(() => {
				if (initWhenReady()) obs.disconnect()
			})
			obs.observe(viewport, { childList: true, subtree: true })
		}
	}
}

function initTestimonialsCarousels() {
	const carousels = document.querySelectorAll('.rural-testimonials-carousel')
	if (!carousels.length) return

	for (const carousel of carousels) {
		const viewport = carousel.querySelector(
			'.rural-testimonials-carousel__viewport'
		)
		const track = carousel.querySelector('.rural-testimonials-carousel__track')
		if (!viewport || !track) continue

		const pagination = carousel.querySelector('[data-carousel-pagination]')
		const slides = Array.from(
			carousel.querySelectorAll('.rural-testimonials-carousel__slide')
		)
		if (!slides.length) continue

		let raf = null
		const pageLefts = () => slides.map((s) => s.offsetLeft)

		const getIndex = () => {
			const lefts = pageLefts()
			const x = viewport.scrollLeft
			let best = 0
			for (let i = 0; i < lefts.length; i++) {
				if (Math.abs(lefts[i] - x) < Math.abs(lefts[best] - x)) best = i
			}
			return best
		}

		const goTo = (index) => {
			const lefts = pageLefts()
			const next = Math.max(0, Math.min(lefts.length - 1, index))
			viewport.scrollTo({ left: lefts[next], behavior: 'smooth' })
		}

		const buildDots = () => {
			if (!pagination) return
			pagination.replaceChildren()
			for (let i = 0; i < slides.length; i++) {
				const btn = document.createElement('button')
				btn.type = 'button'
				btn.className = 'rural-testimonials-carousel__dot'
				btn.setAttribute('aria-label', `Go to testimonial ${i + 1}`)
				btn.addEventListener('click', () => goTo(i))
				pagination.appendChild(btn)
			}
		}

		const updateDots = () => {
			if (!pagination) return
			const idx = getIndex()
			const dots = pagination.querySelectorAll(
				'.rural-testimonials-carousel__dot'
			)
			for (let i = 0; i < dots.length; i++) {
				dots[i].classList.toggle('is-active', i === idx)
			}
		}

		const scheduleUpdate = () => {
			if (raf) return
			raf = requestAnimationFrame(() => {
				raf = null
				updateDots()
			})
		}

		buildDots()
		updateDots()

		viewport.addEventListener('scroll', scheduleUpdate, { passive: true })
		window.addEventListener('resize', () => {
			buildDots()
			updateDots()
		})
	}
}

function initFadeTestimonialsCarousels() {
	const carousels = document.querySelectorAll(
		'[data-testimonials-fade-carousel]'
	)
	if (!carousels.length) return

	const prefersReducedMotion =
		window.matchMedia &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches

	for (const carousel of carousels) {
		const stage = carousel.querySelector('[data-fade-stage]')
		const slides = Array.from(carousel.querySelectorAll('[data-fade-slide]'))
		const pagination = carousel.querySelector('[data-carousel-pagination]')
		if (!stage || !slides.length) continue

		const intervalMs = Number.parseInt(
			carousel.getAttribute('data-interval') || '5000',
			10
		)

		let activeIndex = Math.max(
			0,
			slides.findIndex((s) => s.classList.contains('opacity-100'))
		)

		let timer = null

		const setStageHeight = () => {
			const activeSlide = slides[activeIndex]
			if (!activeSlide) return
			stage.style.height = `${activeSlide.offsetHeight}px`
		}

		const buildDots = () => {
			if (!pagination) return
			pagination.replaceChildren()

			for (let i = 0; i < slides.length; i++) {
				const btn = document.createElement('button')
				btn.type = 'button'
				btn.className = 'rural-testimonials-carousel__dot'
				btn.setAttribute('aria-label', `Go to testimonial ${i + 1}`)
				btn.addEventListener('click', () => {
					goTo(i, { userInitiated: true })
				})
				pagination.appendChild(btn)
			}
		}

		const updateDots = () => {
			if (!pagination) return
			const dots = pagination.querySelectorAll(
				'.rural-testimonials-carousel__dot'
			)
			for (let i = 0; i < dots.length; i++) {
				dots[i].classList.toggle('is-active', i === activeIndex)
			}
		}

		const updateSlides = () => {
			for (let i = 0; i < slides.length; i++) {
				const isActive = i === activeIndex
				slides[i].classList.toggle('relative', isActive)
				slides[i].classList.toggle('absolute', !isActive)
				slides[i].classList.toggle('inset-0', !isActive)
				slides[i].classList.toggle('opacity-100', isActive)
				slides[i].classList.toggle('opacity-0', !isActive)
				slides[i].classList.toggle('pointer-events-none', !isActive)
				slides[i].setAttribute('aria-hidden', isActive ? 'false' : 'true')
			}
		}

		const stop = () => {
			if (timer) clearInterval(timer)
			timer = null
		}

		const start = () => {
			if (prefersReducedMotion) return
			if (slides.length <= 1) return
			if (timer) return
			timer = setInterval(() => {
				goTo(activeIndex + 1)
			}, Math.max(1000, intervalMs))
		}

		const goTo = (index, options = {}) => {
			const next =
				((index % slides.length) + slides.length) % Math.max(1, slides.length)
			activeIndex = next
			updateSlides()
			updateDots()
			setStageHeight()

			if (options.userInitiated) {
				stop()
				start()
			}
		}

		buildDots()
		updateSlides()
		updateDots()
		setStageHeight()
		start()

		carousel.addEventListener('mouseenter', stop)
		carousel.addEventListener('mouseleave', start)
		carousel.addEventListener('focusin', stop)
		carousel.addEventListener('focusout', start)
		window.addEventListener('resize', setStageHeight)
	}
}

function initProductVariationButtons() {
	const containers = document.querySelectorAll('[data-variation-attribute]')
	if (!containers.length) return

	for (const container of containers) {
		const attrName = container.getAttribute('data-variation-attribute')
		if (!attrName) continue

		const form = container.closest('form.variations_form')
		if (!form) continue

		const select = form.querySelector(`select[name="attribute_${attrName}"]`)
		if (!(select instanceof HTMLSelectElement)) continue

		const buttons = container.querySelectorAll('button[data-variation-value]')
		for (const button of buttons) {
			button.addEventListener('click', () => {
				const value = button.getAttribute('data-variation-value') || ''
				select.value = value
				select.dispatchEvent(new Event('change', { bubbles: true }))

				for (const b of buttons)
					b.classList.remove('bg-deep-green', 'text-white', 'border-deep-green')
				button.classList.add('bg-deep-green', 'text-white', 'border-deep-green')
			})
		}
	}
}

function initProductEnquiryModal() {
	const modal = document.querySelector('[data-enquiry-modal]')
	if (!modal) return

	const overlay = modal.querySelector('[data-enquiry-overlay]')
	const closeButton = modal.querySelector('[data-enquiry-close]')
	const openButtons = document.querySelectorAll('[data-enquiry-open]')
	const interestInput = modal.querySelector('[data-enquiry-product-interest]')
	const productTitle = document.querySelector('h1')

	const updateInterest = () => {
		if (!(interestInput instanceof HTMLInputElement)) return
		const base = productTitle ? productTitle.textContent?.trim() || '' : ''
		const selections = []
		const groups = document.querySelectorAll('[data-variation-attribute]')

		for (const group of groups) {
			const selected = group.querySelector(
				'button[data-variation-value].bg-deep-green'
			)
			if (selected?.textContent?.trim()) {
				selections.push(selected.textContent.trim())
			}
		}

		interestInput.value = selections.length
			? `${base} (${selections.join(', ')})`
			: base
	}

	let returnFocus = null
	const setOpen = (nextOpen) => {
		if (nextOpen) returnFocus = document.activeElement
		modal.classList.toggle('hidden', !nextOpen)
		modal.classList.toggle('flex', nextOpen)
		document.body.style.overflow = nextOpen ? 'hidden' : ''
		if (nextOpen) { updateInterest(); closeButton?.focus() }
		else returnFocus?.focus()
	}

	for (const button of openButtons) {
		button.addEventListener('click', () => setOpen(true))
	}

	overlay?.addEventListener('click', () => setOpen(false))
	closeButton?.addEventListener('click', () => setOpen(false))
	document.addEventListener('keydown', (event) => {
		if (modal.classList.contains('hidden')) return
		if (event.key === 'Escape') setOpen(false)
		if (event.key === 'Tab') {
			const controls = Array.from(modal.querySelectorAll('button, input:not([type="hidden"]), textarea, select, a[href]')).filter(el => !el.disabled)
			const first = controls[0], last = controls[controls.length - 1]
			if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
			if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
		}
	})

	if (modal.getAttribute('data-enquiry-modal-open') === 'true') {
		setOpen(true)
	}
}

document.addEventListener('DOMContentLoaded', initSite)

/** Copies the article URL and reports clipboard failures to the reader. */
function initArticleSharing() {
	for (const button of document.querySelectorAll('[data-copy-article-link]')) {
		button.addEventListener('click', async () => {
			const url = button.getAttribute('data-copy-article-link')
			const status = button.closest('section').querySelector('[data-copy-article-status]')
			try {
				await navigator.clipboard.writeText(url)
				if (status) status.textContent = 'Article link copied.'
			} catch {
				if (status) status.textContent = 'Copy the article link from the address bar.'
			}
		})
	}
}

function initResponsiveNavigation() {
	const mobile = document.querySelector('.site-mobile-menu')
	const dropdowns = document.querySelectorAll('.nav-dropdown')
	const media = window.matchMedia('(min-width: 1024px)')
	const setDetails = () => document.querySelectorAll('[data-responsive-details]').forEach(el => { el.open = media.matches })
	setDetails()
	media.addEventListener('change', setDetails)
	document.addEventListener('click', event => {
		if (mobile && !mobile.contains(event.target)) mobile.open = false
		for (const dropdown of dropdowns) if (!dropdown.contains(event.target)) dropdown.open = false
	})
	document.addEventListener('keydown', event => {
		if (event.key !== 'Escape') return
		for (const dropdown of dropdowns) dropdown.open = false
		if (mobile?.open) { mobile.open = false; mobile.querySelector('summary').focus() }
	})
}

function initCtaCarousels() {
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
	for (const carousel of document.querySelectorAll('[data-cta-carousel]')) {
		const track = carousel.querySelector('[data-cta-track]')
		const status = carousel.querySelector('[data-cta-status]')
		const slides = Array.from(track.children)
		const previous = carousel.querySelector('[data-cta-prev]')
		const next = carousel.querySelector('[data-cta-next]')
		const index = () => Math.round(track.scrollLeft / Math.max(track.clientWidth, 1))
		const go = direction => track.scrollTo({left:Math.max(0,Math.min(slides.length-1,index()+direction))*track.clientWidth,behavior:reducedMotion.matches?'auto':'smooth'})
		previous.addEventListener('click', () => go(-1))
		next.addEventListener('click', () => go(1))
		track.addEventListener('keydown', event => {
			if (!['ArrowLeft','ArrowRight'].includes(event.key)) return
			event.preventDefault(); go(event.key === 'ArrowRight' ? 1 : -1)
		})
		const update = () => { const i=index(); status.textContent=`${i+1} / ${slides.length}`; previous.disabled=i===0; next.disabled=i===slides.length-1 }
		track.addEventListener('scroll', update, {passive:true})
		window.addEventListener('resize', update)
		update()
	}
}
