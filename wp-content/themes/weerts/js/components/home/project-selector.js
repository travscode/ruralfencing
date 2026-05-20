import gsap from 'gsap'

let cleanup = []
let links = []
let images = []

export default function projectSelector() {
	const container = document.querySelector('.project-selector')
	if (!container) return

	const imageContainer = container.parentNode.querySelector('.flex.relative')
	links = container.querySelectorAll('a')
	images = imageContainer.querySelectorAll('.image-container')

	if (links.length !== images.length) return

	// Initialize images
	images.forEach((img, i) => gsap.set(img, { opacity: i === 0 ? 1 : 0 }))

	let currentIndex = 0

	const switchImage = (index) => {
		if (index === currentIndex) return
		gsap.to(images[currentIndex], { opacity: 0, duration: 0.3 })
		gsap.to(images[index], { opacity: 1, duration: 0.3 })
		currentIndex = index
	}

	links.forEach((link, i) => {
		const onEnter = () => {
			gsap.to(link, { color: 'white', duration: 0.3 })
			switchImage(i)
		}
		const onLeave = () => gsap.to(link, { color: '#252525', duration: 0.3 })

		link.addEventListener('mouseenter', onEnter)
		link.addEventListener('mouseleave', onLeave)

		cleanup.push(() => {
			link.removeEventListener('mouseenter', onEnter)
			link.removeEventListener('mouseleave', onLeave)
		})
	})

	const onContainerLeave = () => switchImage(0)
	container.addEventListener('mouseleave', onContainerLeave)
	cleanup.push(() =>
		container.removeEventListener('mouseleave', onContainerLeave)
	)
}

export function killProjectSelector() {
	gsap.killTweensOf([...links, ...images])
	cleanup.forEach((fn) => fn())
	cleanup = []
}
