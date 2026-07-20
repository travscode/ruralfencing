/**
 * Marks the document as JavaScript-enabled once the page has loaded.
 */
function initSite() {
	document.documentElement.classList.remove('no-js')
	document.documentElement.classList.add('js')

	initHeaderHeightVar()
	initGoogleMapsSections()
	initProductsMegaMenu()
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
		script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}`
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
	const header = document.querySelector('header')
	if (!header) return

	const set = () => {
		document.documentElement.style.setProperty(
			'--site-header-height',
			`${header.offsetHeight}px`
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

	const sectionsWithKeys = sections.filter(
		(section) => section.getAttribute('data-api-key')?.trim()
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

	const decodeHtml = (value) => {
		if (typeof value !== 'string') return value == null ? '' : String(value)
		if (!value.includes('&') && !value.includes('<')) return value
		const el = document.createElement('div')
		el.innerHTML = value
		return el.textContent || ''
	}

	const setOpen = (nextOpen, options = {}) => {
		const fastClose = Boolean(options.fastClose)

		if (closeTimer) {
			clearTimeout(closeTimer)
			closeTimer = null
		}

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
		list.className = 'flex flex-col'

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
	}

	level1Root.addEventListener('mouseover', (e) => handleActivate(e, 1))
	level1Root.addEventListener('focusin', (e) => handleActivate(e, 1))
	level1Root.addEventListener('click', (e) => handleClick(e, 1))

	level2Root.addEventListener('mouseover', (e) => handleActivate(e, 2))
	level2Root.addEventListener('focusin', (e) => handleActivate(e, 2))
	level2Root.addEventListener('click', (e) => handleClick(e, 2))

	toggle.addEventListener('click', () => setOpen(!state.open))
	toggle.addEventListener('mouseenter', () => {
		if (!state.open) setOpen(true)
	})
	toggle.addEventListener('focus', () => {
		if (!state.open) setOpen(true)
	})
	overlay.addEventListener('click', () => setOpen(false, { fastClose: true }))

	menu.addEventListener('click', (e) => {
		if (!state.open) return
		const clickedPanel = e.target.closest('.products-mega-menu__panel')
		if (clickedPanel) return
		setOpen(false, { fastClose: true })
	})

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') setOpen(false, { fastClose: true })
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
			viewport.querySelector('[data-carousel-track], .woocommerce ul.products, ul.products')

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

	const setOpen = (nextOpen) => {
		modal.classList.toggle('hidden', !nextOpen)
		modal.classList.toggle('flex', nextOpen)
		document.body.style.overflow = nextOpen ? 'hidden' : ''
		if (nextOpen) updateInterest()
	}

	for (const button of openButtons) {
		button.addEventListener('click', () => setOpen(true))
	}

	overlay?.addEventListener('click', () => setOpen(false))
	closeButton?.addEventListener('click', () => setOpen(false))
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') setOpen(false)
	})

	if (modal.getAttribute('data-enquiry-modal-open') === 'true') {
		setOpen(true)
	}
}

document.addEventListener('DOMContentLoaded', initSite)
