import gsap from 'gsap'

let canvas = null
let ctx = null
let lastX = 0
let lastY = 0
let isDrawing = false
let isCatchingUp = false
let isFirstDraw = false // Add flag to track first draw after entering
let smoothCoords = { x: 0, y: 0 }
let finalMousePos = { x: 0, y: 0 }
let brushSize = { size: 200 }
let brushSizeTo = null
let smoothXTo = null
let smoothYTo = null
let lastTime = 0
let catchupTween = null
let catchupAnimationId = null // Store animation frame ID
let resizeObserver = null // Add ResizeObserver

export default function footerCanvas() {
	const footer = document.querySelector('footer')

	if (!footer) return

	canvas = document.createElement('canvas')
	ctx = canvas.getContext('2d')

	// Get device pixel ratio for sharp resolution
	const dpr = window.devicePixelRatio || 1

	// Set canvas size to match footer with high DPI support
	const rect = footer.getBoundingClientRect()
	canvas.width = rect.width * dpr
	canvas.height = rect.height * dpr

	// Style the canvas - absolute positioning on top of footer
	canvas.style.position = 'absolute'
	canvas.style.top = '0'
	canvas.style.left = '0'
	canvas.style.width = rect.width + 'px'
	canvas.style.height = rect.height + 'px'
	canvas.style.mixBlendMode = 'exclusion'
	canvas.style.pointerEvents = 'none'
	canvas.style.zIndex = '1000'

	// Scale the context to ensure correct drawing operations
	ctx.scale(dpr, dpr)

	// Fill with black background
	ctx.fillStyle = '#000000'
	ctx.fillRect(0, 0, rect.width, rect.height)

	// Set drawing properties for white drawing with smoother settings
	ctx.strokeStyle = '#f6f6f6'
	ctx.lineWidth = brushSize.size
	ctx.lineCap = 'round'
	ctx.lineJoin = 'round'
	ctx.globalCompositeOperation = 'source-over'

	// Enable image smoothing for better quality
	ctx.imageSmoothingEnabled = true
	ctx.imageSmoothingQuality = 'high'

	// Setup GSAP animations
	smoothXTo = gsap.quickTo(smoothCoords, 'x', {
		duration: 0.55,
		ease: 'power2.out',
	})
	smoothYTo = gsap.quickTo(smoothCoords, 'y', {
		duration: 0.55,
		ease: 'power2.out',
	})

	// Add event listeners for proper mouse tracking
	footer.addEventListener('mouseenter', startDrawing)
	footer.addEventListener('mousemove', handleMouseMove)
	footer.addEventListener('mouseleave', stopDrawing)

	// Watch footer for resize changes instead of window
	resizeObserver = new ResizeObserver(handleResize)
	resizeObserver.observe(footer)

	// Append canvas to footer
	footer.appendChild(canvas)
}

function startDrawing(e) {
	isDrawing = true
	isCatchingUp = false
	isFirstDraw = true // Set flag to indicate this is the first draw

	// Cancel any existing catch-up animation
	if (catchupAnimationId) {
		cancelAnimationFrame(catchupAnimationId)
		catchupAnimationId = null
	}

	// Kill any existing catch-up tween
	if (catchupTween) {
		catchupTween.kill()
		catchupTween = null
	}

	const rect = canvas.getBoundingClientRect()
	const mouseX = e.clientX - rect.left
	const mouseY = e.clientY - rect.top

	// Initialize smooth coordinates and last position
	smoothCoords.x = mouseX
	smoothCoords.y = mouseY
	lastX = mouseX
	lastY = mouseY

	// Store the current mouse position
	finalMousePos.x = mouseX
	finalMousePos.y = mouseY

	// Kill any existing smooth animations and reset them
	if (smoothXTo) {
		gsap.killTweensOf(smoothCoords)
	}

	// Recreate the quickTo tweens to clear any previous targets
	smoothXTo = gsap.quickTo(smoothCoords, 'x', {
		duration: 0.55,
		ease: 'power2.out',
	})
	smoothYTo = gsap.quickTo(smoothCoords, 'y', {
		duration: 0.55,
		ease: 'power2.out',
	})

	lastTime = performance.now()

	// Start the drawing loop
	draw()
}

function handleMouseMove(e) {
	const rect = canvas.getBoundingClientRect()
	const mouseX = e.clientX - rect.left
	const mouseY = e.clientY - rect.top

	// Store the current mouse position
	finalMousePos.x = mouseX
	finalMousePos.y = mouseY

	// Update smooth coordinates target
	if (isDrawing) {
		smoothXTo(mouseX)
		smoothYTo(mouseY)
	}
}

function draw() {
	if (!isDrawing && !isCatchingUp) return

	// Update line width based on current brush size
	ctx.lineWidth = brushSize.size

	// Only draw if this is not the first draw call after entering
	if (!isFirstDraw) {
		// Draw line segment
		ctx.beginPath()
		ctx.moveTo(lastX, lastY)
		ctx.lineTo(smoothCoords.x, smoothCoords.y)
		ctx.stroke()
	} else {
		// Skip drawing on first frame, just update position
		isFirstDraw = false
	}

	// Update last position
	lastX = smoothCoords.x
	lastY = smoothCoords.y

	// Continue drawing loop
	if (isDrawing) {
		requestAnimationFrame(draw)
	}
}

function stopDrawing() {
	if (!isDrawing) return

	isDrawing = false
	isCatchingUp = true

	// Create a catch-up tween with a callback when complete
	catchupTween = gsap.to(smoothCoords, {
		x: finalMousePos.x,
		y: finalMousePos.y,
		duration: 0.55,
		ease: 'power2.out',
		onUpdate: function () {
			// Draw during the catch-up animation
			ctx.lineWidth = brushSize.size
			ctx.beginPath()
			ctx.moveTo(lastX, lastY)
			ctx.lineTo(smoothCoords.x, smoothCoords.y)
			ctx.stroke()

			lastX = smoothCoords.x
			lastY = smoothCoords.y
		},
		onComplete: function () {
			// Animation is complete
			isCatchingUp = false
			catchupTween = null
		},
	})
}

function handleResize() {
	if (!canvas) return

	const footer = document.querySelector('footer')
	if (!footer) return

	const dpr = window.devicePixelRatio || 1
	const rect = footer.getBoundingClientRect()

	// Store current canvas content
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

	// Resize canvas
	canvas.width = rect.width * dpr
	canvas.height = rect.height * dpr
	canvas.style.width = rect.width + 'px'
	canvas.style.height = rect.height + 'px'

	// Rescale context
	ctx.scale(dpr, dpr)

	// Restore drawing settings
	ctx.strokeStyle = '#f6f6f6'
	ctx.lineWidth = brushSize.size
	ctx.lineCap = 'round'
	ctx.lineJoin = 'round'
	ctx.globalCompositeOperation = 'source-over'
	ctx.imageSmoothingEnabled = true
	ctx.imageSmoothingQuality = 'high'

	// Fill with black background
	ctx.fillStyle = '#000000'
	ctx.fillRect(0, 0, rect.width, rect.height)
}

export function killFooterCanvas() {
	const footer = document.querySelector('footer')

	if (!footer) return
	if (canvas && canvas.parentNode) {
		footer.removeEventListener('mouseenter', startDrawing)
		footer.removeEventListener('mousemove', handleMouseMove)
		footer.removeEventListener('mouseleave', stopDrawing)
		canvas.parentNode.removeChild(canvas)
	}

	// Disconnect the ResizeObserver
	if (resizeObserver) {
		resizeObserver.disconnect()
		resizeObserver = null
	}

	// Cancel any animation frame
	if (catchupAnimationId) {
		cancelAnimationFrame(catchupAnimationId)
		catchupAnimationId = null
	}

	// Kill any running tweens
	if (catchupTween) {
		catchupTween.kill()
		catchupTween = null
	}

	canvas = null
	ctx = null
	isDrawing = false
	isCatchingUp = false
	isFirstDraw = false // Reset the flag
	smoothCoords = { x: 0, y: 0 }
	finalMousePos = { x: 0, y: 0 }
	brushSize = { size: 200 }
	brushSizeTo = null
	smoothXTo = null
	smoothYTo = null
}
