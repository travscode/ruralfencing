import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let filterButtonCleanups = []
let scrollTriggerInstance = null

export default function getArchivePosts() {
	const postGrid = document.querySelector('#post-grid')

	if (!postGrid) return

	const loadingPanel = document.querySelector('.loading-panel')
	let isLoading = false
	let currentPage = 1
	let hasMorePosts = true
	let currentCategory = ''

	initButtonFiltering()
	initInfiniteScroll()

	function initInfiniteScroll() {
		const url = new URL(window.location)
		currentCategory = url.searchParams.get('category') || ''
		currentPage = parseInt(url.searchParams.get('page')) || 1

		scrollTriggerInstance = ScrollTrigger.create({
			trigger: postGrid,
			start: 'bottom-=200 bottom',
			onEnter: () => {
				if (hasMorePosts && !isLoading) {
					handleFetch(false, currentCategory, currentPage + 1)
				}
			},
		})
		ScrollTrigger.refresh()
	}

	function initButtonFiltering() {
		const filterButtons = document.querySelectorAll('[data-category]')

		if (filterButtons.length === 0) return

		filterButtons.forEach((filterButton) => {
			const onClick = (e) => {
				updateButtonState(filterButton, filterButtons)
				e.preventDefault()
				const category = filterButton.dataset.category
				currentCategory = category
				currentPage = 1
				hasMorePosts = true
				handleFetch(true, category, 1)
			}

			filterButton.addEventListener('click', onClick)

			// Store cleanup function
			filterButtonCleanups.push(() => {
				filterButton.removeEventListener('click', onClick)
			})
		})
	}

	async function handleFetch(isNewCategory = false, category = '', paged = 1) {
		if (isLoading) return

		isLoading = true

		// Show loading panel
		if (loadingPanel) {
			loadingPanel.style.display = 'flex'
		}

		// Clear grid when switching categories
		if (isNewCategory && postGrid) {
			postGrid.innerHTML = ''
			ScrollTrigger.refresh()
		}

		try {
			const posts = await fetchPosts(category, paged)

			if (posts) {
				if (isNewCategory) {
					replaceGrid(posts)
				} else {
					appendGrid(posts)
				}
				currentPage = paged
				updateUrl(category, paged)
			} else {
				hasMorePosts = false
			}
		} catch (error) {
			console.error('Error in handleFetch:', error)
		} finally {
			// Hide loading panel
			if (loadingPanel) {
				loadingPanel.style.display = 'none'
			}
			isLoading = false
			ScrollTrigger.refresh()
		}
	}

	async function fetchPosts(category = '', paged = 1) {
		const url = new URL('/wp-json/start/v1/posts', window.location.origin)

		if (category) url.searchParams.append('category', category)
		if (paged > 1) url.searchParams.append('page', paged)

		try {
			const response = await fetch(url)

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`)
			}

			const data = await response.json()

			// Check if there are more posts available
			if (!data.html || data.html.trim() === '') {
				hasMorePosts = false
				return null
			}

			hasMorePosts = data.hasMore
			return data.html
		} catch (error) {
			console.error('Error fetching posts:', error)
			hasMorePosts = false
			return null
		}
	}

	function updateUrl(category = null, paged = 1) {
		const url = new URL(window.location)

		if (category) {
			url.searchParams.set('category', category)
		} else {
			url.searchParams.delete('category')
		}

		if (paged > 1) {
			url.searchParams.set('page', paged)
		} else {
			url.searchParams.delete('page')
		}

		window.history.pushState({}, '', url)
	}

	function replaceGrid(posts) {
		if (!postGrid || !posts) return

		postGrid.innerHTML = posts
		ScrollTrigger.refresh()
	}

	function appendGrid(posts) {
		if (!postGrid || !posts) return

		const tempDiv = document.createElement('div')
		tempDiv.innerHTML = posts

		while (tempDiv.firstChild) {
			postGrid.appendChild(tempDiv.firstChild)
		}

		ScrollTrigger.refresh()
	}

	function updateButtonState(filterButton, filterButtons) {
		filterButtons.forEach((btn) => {
			btn.classList.remove('active')
		})

		filterButton.classList.add('active')
	}
}

export function killArchivePosts() {
	// Kill ScrollTrigger instance
	if (scrollTriggerInstance) {
		scrollTriggerInstance.kill()
		scrollTriggerInstance = null
	}

	// Remove filter button event listeners
	filterButtonCleanups.forEach((cleanup) => cleanup())
	filterButtonCleanups = []
}
