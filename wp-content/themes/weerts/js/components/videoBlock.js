import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { getLenis } from '../utils/smooth-scroll'

let fsBtn,
	videoWrap,
	onFsBtnClick,
	onOverlayClick,
	onKeyDown,
	fullscreenContainer,
	videoInner,
	overlay

export default function initVideoBlock() {
	gsap.registerPlugin(Flip)

	let lenis = getLenis()

	videoWrap = document.querySelector('.video-wrap')
	if (!videoWrap) return

	videoInner = videoWrap.querySelector('.video-inner')
	fsBtn = videoWrap.querySelector('.fullscreen-btn')

	fullscreenContainer = document.querySelector('.fullscreen-window')
	overlay = document.querySelector('.overlay')

	if (!videoInner || !fsBtn || !fullscreenContainer || !overlay) return

	// Exit fullscreen
	function exitFullscreen() {
		if (!fullscreenContainer.contains(videoInner)) return

		const state = Flip.getState(videoInner)
		videoWrap.querySelector(':scope > .aspect-video').appendChild(videoInner)
		Flip.from(state, {
			duration: 0.65,
			ease: 'expo.inOut',
			absolute: true,
			nested: true,
			zIndex: 9999999,
		})

		gsap.to(overlay, {
			opacity: 0,
			duration: 0.75,
			ease: 'power2.out',
			onComplete: () => {
				overlay.style.pointerEvents = 'none'
			},
		})

		lenis.start()

		document.removeEventListener('keydown', onKeyDown)
	}

	// ENTER FULLSCREEN
	onFsBtnClick = (e) => {
		e.stopPropagation()

		const state = Flip.getState(videoInner)
		fullscreenContainer.appendChild(videoInner)

		overlay.style.pointerEvents = 'auto'

		gsap.to(overlay, {
			opacity: 1,
			duration: 0.75,
			ease: 'power2.out',
		})

		Flip.from(state, {
			duration: 0.65,
			ease: 'expo.inOut',
			absolute: true,
			nested: true,
			zIndex: 9999999,
		})

		lenis.stop()

		document.addEventListener('keydown', onKeyDown)
	}

	// CLICK OUTSIDE TO CLOSE
	onOverlayClick = () => {
		exitFullscreen()
	}

	// ESC KEY TO CLOSE
	onKeyDown = (e) => {
		if (e.key === 'Escape') {
			exitFullscreen()
		}
	}

	fsBtn.addEventListener('click', onFsBtnClick)
	overlay.addEventListener('click', onOverlayClick)
}

export function killVideoBlock() {
	if (fsBtn && onFsBtnClick) {
		fsBtn.removeEventListener('click', onFsBtnClick)
	}
	if (overlay && onOverlayClick) {
		overlay.removeEventListener('click', onOverlayClick)
	}
	if (onKeyDown) {
		document.removeEventListener('keydown', onKeyDown)
	}
}
