import gsap from 'gsap'

let menuCleanups = []
let menuCloseFunction = null
let menuTimelineGlobal

export default function initMenus() {
	let menuTimeline = null
	let currentBreakpoint = null

	// Cache DOM elements
	const elements = {
		menuButtons: document.querySelectorAll('[data-toggle-menu]'),
		chatButtons: document.querySelectorAll('[data-toggle-chat]'),
		mainElement: document.querySelector('main'),
		menuTopbar: document.querySelector('.menu-topbar'),
		menuSocialsbar: document.querySelector('.menu-socialsbar'),
		mobileNav: document.querySelector('[data-mobile-nav]'),
		desktopMenuColumns: document.querySelectorAll(
			'.menu-nav:not([data-mobile-nav]) .menu-column'
		),
		socialButtons: document.querySelectorAll('.social-item-header'),
		menuBG: document.querySelector('.menu-bg'),
	}

	//Avoid Flashing of content
	gsap.set('.menu-nav', {
		opacity: 1,
	})

	// Initialize matchMedia contexts
	const mm = gsap.matchMedia()

	// Mobile breakpoint
	mm.add('(max-width: 1023px)', () => {
		currentBreakpoint = 'mobile'
		initMenuForBreakpoint('mobile')

		return () => {
			// Cleanup function for when leaving this breakpoint
			cleanupMenu()
		}
	})

	// Desktop breakpoint
	mm.add('(min-width: 1024px)', () => {
		currentBreakpoint = 'desktop'
		initMenuForBreakpoint('desktop')

		return () => {
			// Cleanup function for when leaving this breakpoint
			cleanupMenu()
		}
	})

	// Initialize other menu functionality
	toggleMobileSubMenu()
	setupEventListeners()

	function initMenuForBreakpoint(breakpoint) {
		// Reset any existing timeline
		if (menuTimeline) {
			menuTimeline.kill()
		}

		// Create new timeline for current breakpoint
		menuTimeline = gsap.timeline({
			paused: true,
			onReverseComplete: () => handleMenuClose(breakpoint),
		})

		// Set initial states
		setupInitialStates(breakpoint)

		// Build timeline based on breakpoint
		buildTimeline(breakpoint)
	}

	function setupInitialStates(breakpoint) {
		// Common initial states
		gsap.set(elements.menuBG, { opacity: 0 })

		if (breakpoint === 'mobile' && elements.mobileNav) {
			// Fixed: Use x instead of xPercent for initial position
			gsap.set(elements.mobileNav, {
				display: 'flex',
				x: '-100%',
				visibility: 'visible',
			})
			// Ensure mobile nav is visible but positioned off-screen
			elements.mobileNav.classList.remove('hidden')
		}

		if (breakpoint === 'desktop' && elements.mobileNav) {
			// Hide mobile nav on desktop
			elements.mobileNav.classList.add('hidden')
		}
	}

	function buildTimeline(breakpoint) {
		// Common animations
		menuTimeline.to(
			elements.menuBG,
			{
				opacity: 1,
				duration: 0.75,
				ease: 'power2.inOut',
			},
			0
		)

		// Only animate topbar if it exists
		if (elements.menuTopbar) {
			menuTimeline.to(
				elements.menuTopbar,
				{
					top: 0,
					duration: 0.2,
					ease: 'power1.out',
				},
				'<='
			)
		}

		if (breakpoint === 'mobile') {
			buildMobileTimeline()
		} else {
			buildDesktopTimeline()
		}
	}

	function buildMobileTimeline() {
		const mobileMenuColumns =
			elements.mobileNav?.querySelectorAll('.menu-column')

		if (elements.mobileNav) {
			// Fixed: Use x: 0 instead of xPercent: 0
			menuTimeline.to(
				elements.mobileNav,
				{
					x: 0,
					duration: 0.5,
					ease: 'power2.out',
				},
				'<='
			)
		}

		if (mobileMenuColumns?.length) {
			menuTimeline.from(
				mobileMenuColumns,
				{
					xPercent: -100,
					duration: 0.7,
					stagger: 0.1,
					ease: 'power2.inOut',
				},
				'<='
			)
		}
	}

	function buildDesktopTimeline() {
		if (elements.desktopMenuColumns?.length) {
			menuTimeline.from(
				elements.desktopMenuColumns,
				{
					y: -475,
					duration: 0.7,
					stagger: 0.1,
					ease: 'power2.inOut',
				},
				'<='
			)
		}

		if (elements.menuSocialsbar) {
			menuTimeline.from(
				elements.menuSocialsbar,
				{
					yPercent: 100,
					duration: 0.5,
					ease: 'power2.inOut',
				},
				'<70%'
			)
		}

		if (elements.socialButtons?.length) {
			menuTimeline.from(
				elements.socialButtons,
				{
					yPercent: 100,
					duration: 0.4,
					stagger: 0.025,
					ease: 'power3.out',
				},
				'<=50%'
			)
		}
	}

	function handleMenuClose(breakpoint) {
		// Remove classes when animation fully reverses
		document.body.classList.remove('menu-open')
		document.documentElement.classList.remove('overflow-hidden')

		// Mobile-specific cleanup
		if (breakpoint === 'mobile' && elements.mobileNav) {
			// Don't add hidden class, just position off-screen
			gsap.set(elements.mobileNav, { x: '-100%' })
			resetMobileAccordions()
		}
	}

	function resetMobileAccordions() {
		if (!elements.mobileNav) return

		const accordions = elements.mobileNav.querySelectorAll(
			'[data-mobile-accordion]'
		)
		accordions.forEach((accordion) => {
			const content = accordion.querySelector('.accordion-content')
			const header = accordion.querySelector('.accordion-header')
			if (header?.classList.contains('accordion-open')) {
				header.classList.remove('accordion-open')
				gsap.set(content, { height: 0 })
			}
		})
	}

	function cleanupMenu() {
		if (menuTimeline) {
			menuTimeline.kill()
			menuTimeline = null
		}

		// Reset menu state
		if (document.body.classList.contains('menu-open')) {
			document.body.classList.remove('menu-open')
			document.documentElement.classList.remove('overflow-hidden')
		}

		// Reset element states
		if (elements.mobileNav) {
			gsap.set(elements.mobileNav, { clearProps: 'all' })
		}

		if (elements.menuBG) {
			gsap.set(elements.menuBG, { clearProps: 'all' })
		}
	}

	function openMenu() {
		if (!menuTimeline) return

		document.body.classList.add('menu-open')
		menuTimeline.play()
	}

	function closeMenu() {
		if (!menuTimeline) return
		menuTimeline.reverse()
		document.body.classList.remove('menu-open')
	}

	function toggleMenu() {
		if (document.body.classList.contains('menu-open')) {
			closeMenu()
		} else {
			openMenu()
		}
	}

	function openChat() {
		closeMenu()
		document.body.classList.add('chat-open')
		document.dispatchEvent(new CustomEvent('the-start-bar-open'))
	}

	function closeChat() {
		document.body.classList.remove('chat-open')
		document.dispatchEvent(new CustomEvent('the-start-bar-close'))
	}

	function toggleChat() {
		if (document.body.classList.contains('chat-open')) {
			closeChat()
		} else {
			openChat()
		}
	}

	function setupEventListeners() {
		// Menu button clicks
		elements.menuButtons.forEach((btn) => {
			const onClick = () => toggleMenu()
			btn.addEventListener('click', onClick)

			menuCleanups.push(() => {
				btn.removeEventListener('click', onClick)
			})
		})

		// Chat button clicks
		elements.chatButtons.forEach((btn) => {
			const onClick = () => toggleChat()
			btn.addEventListener('click', onClick)

			menuCleanups.push(() => {
				btn.removeEventListener('click', onClick)
			})
		})

		const onBodyClick = (e) => {
			const main = document.querySelector('main')
			if (e.target === main || main.contains(e.target)) {
				if (document.body.classList.contains('menu-open')) {
					closeMenu()
				}
			}
		}

		setTimeout(() => {
			document.body.addEventListener('click', onBodyClick)
		}, 100) // Small delay

		menuCleanups.push(() => {
			document.body.removeEventListener('click', onBodyClick)
		})

		const onKeydown = (e) => {
			if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
				closeMenu()
			}
		}

		document.addEventListener('keydown', onKeydown)
		menuCleanups.push(() => {
			document.removeEventListener('keydown', onKeydown)
		})

		// Chat / Start Bar Events
		const handleChatClosed = () => {
			document.body.classList.remove('chat-open')
		}
		const handleChatOpened = () => {
			document.body.classList.add('chat-open')
		}
		document.addEventListener('the-start-bar-closed', handleChatClosed)
		document.addEventListener('the-start-bar-opened', handleChatOpened)

		menuCleanups.push(() => {
			document.removeEventListener('the-start-bar-closed', handleCustomClosed)
			document.removeEventListener('the-start-bar-opened', handleCustomOpened)
		})
	}

	function toggleMobileSubMenu() {
		const toggles = document.querySelectorAll('[data-toggle-mobile-sub-menu]')

		toggles.forEach((toggle) => {
			const onClick = (e) => {
				e.preventDefault()
				e.stopPropagation()

				const parentEl = toggle.closest('[data-mobile-menu-item]')
				const subMenu = parentEl?.querySelector('[data-mobile-sub-menu]')

				if (!subMenu) return

				subMenu.classList.toggle('hidden')
			}

			toggle.addEventListener('click', onClick)

			menuCleanups.push(() => {
				toggle.removeEventListener('click', onClick)
			})
		})
	}

	// Store the close function reference for external access
	menuCloseFunction = closeMenu
	menuTimelineGlobal = menuTimeline

	// Return cleanup function
	return () => {
		mm.kill()
		if (menuTimeline) {
			menuTimeline.kill()
		}
		menuCleanups.forEach((cleanup) => cleanup())
		menuCleanups = []
		menuCloseFunction = null
	}
}

// Properly exposed close menu function
export function closeMenu() {
	if (menuCloseFunction) {
		menuCloseFunction()
	}
}

export function resetMenu() {
	menuTimelineGlobal.seek(0) // More reliable than progress(0)
	menuTimelineGlobal.pause()
	menuTimelineGlobal.invalidate() // Clear any cached start/end values
}

export function killMenus() {
	menuCleanups.forEach((cleanup) => cleanup())
	menuCleanups = []
	menuCloseFunction = null
}

export function setTheme(url) {
	const body = document.body
	const currentPath = url

	// Check if it's the front page (home) or contact page
	const isFrontPage = currentPath === '/' || currentPath === ''
	const isContactPage =
		currentPath === '/contact' || currentPath === '/contact/'

	// Determine theme
	const theme = isFrontPage || isContactPage ? 'dark' : 'light'

	// Remove any existing theme classes
	body.classList.remove('theme-dark', 'theme-light', 'theme-flip')

	// Add the appropriate theme class
	body.classList.add(`theme-${theme}`)
}

export function closeMobileAccordions() {
	const mobileNav = document.querySelector('[data-mobile-nav]')
	if (!mobileNav) return

	const accordions = mobileNav.querySelectorAll('[data-mobile-accordion]')
	accordions.forEach((accordion) => {
		const content = accordion.querySelector('.accordion-content')
		const header = accordion.querySelector('.accordion-header')
		if (header?.classList.contains('active')) {
			header.classList.remove('active')
			gsap.set(content, { height: 0 })
		}
	})
}
