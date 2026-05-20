import { forceMouseUpdate } from '../mouseFollower'

let cleanup = null

function initVideoToggle() {
	const videoInner = document.querySelector('.video-inner:not(.muted)')
	const video = document.querySelector('.video-inner video')

	// Early return if elements don't exist
	if (!videoInner || !video) {
		return
	}

	function updateMuteLabel() {
		if (!videoInner) return;
		const label = video.muted ? 'Unmute' : 'Mute';
		videoInner.setAttribute('data-mouse-content', label);
		forceMouseUpdate();
	}

	// Seed the label so hover shows immediately
	updateMuteLabel();
	video.addEventListener('loadeddata', updateMuteLabel);
	video.addEventListener('volumechange', updateMuteLabel);

	function toggleVideoMute() {
		// Early return if video is not ready
		if (video.readyState < 2) {
			return;
		}

		video.muted = !video.muted;

		if (!video.muted) {
			video.play().catch((err) => {
				console.warn('Playback failed:', err);
			});
		}

		updateMuteLabel();
	}

	// Add click event listener
	videoInner.addEventListener('click', toggleVideoMute)

	// Store cleanup function
	cleanup = () => {
		videoInner.removeEventListener('click', toggleVideoMute)
		cleanup = null
	}
}

function killVideoToggle() {
	// Early return if no cleanup function exists
	if (!cleanup) {
		return
	}

	cleanup()
}

export default initVideoToggle
export { killVideoToggle }
