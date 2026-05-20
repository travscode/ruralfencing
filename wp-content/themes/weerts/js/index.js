import projectSelector, {
	killProjectSelector,
} from './components/home/project-selector'

import initMenus, {
	closeMenu,
	closeMobileAccordions,
	resetMenu,
	setTheme,
} from './components/menus'
import initHeaderOnScroll from './utils/headerOnScroll'
import initSmoothScrolling, { killScrollTriggers } from './utils/smooth-scroll'
import initButtons, {
	continuousScramble,
	killButtons,
	scrambledInner,
} from './components/buttons'
import initAccordions, { killAccordions } from './components/accordions'
import mouseFollower, { revertMouseState } from './components/mouseFollower'

import initContactForm, {
	killContactCanvas,
} from './components/contact/contact'

// Blocks:
import initInternalBanner, {
	killInternalBanner,
} from './components/internalBanner'
import initVideoBlock, { killVideoBlock } from './components/videoBlock'
import getArchivePosts, {
	killArchivePosts,
} from './components/archive/getArchivePosts'
import initWorkFilter, { killWorkFilter } from './components/work-filter'
import initSwup, { swupHooks } from './swup'
import runWorkThree, { workThreeKill } from './components/work/work-three'
import runTeamThree from './components/team/team-three'
import AnimationBlocksBootstrap, {
	killAnimationBlocks,
} from './components/blocks/AnimationBootstrap'
import initFooterMenuAnimation, {
	killFooterMenuAnimation,
} from './components/footer/footerSliderAnimation'
import { initNoLinkBlocker, killNoLinkBlocker } from './utils/noLink'
import homeAnimations from './components/home/home-animations'
import initPanelNode, {
	killPanelNode,
} from './components/home/feature-panels/nodes'
import initASCIIOscilloscope, {
	killASCIIOscilloscope,
} from './components/home/feature-panels/pulse'
import { disposeUnifiedHeroScene } from './components/home/unified-home-scene'
import {
	cleanupFooterParallax,
	footerParallax,
} from './components/footer/footerParallax'
import footerCanvas, {
	killFooterCanvas,
} from './components/footer/footerCanvas'
import initNotFoundContainer, { kill404Scene } from './components/404/404Canvas'
import initUnifiedHeroScene from './components/home/unified-home-scene'
import initVideoToggle, { killVideoToggle } from './components/home/video'
import initProductThemeFlip, { killProductThemeFlip } from './components/product/themeFlip'
import { initProductBgFade, killProductBgFade } from './components/productBgFade';

// Start all the functions
document.addEventListener('DOMContentLoaded', () => initOnce())

// Only executes on the initial site load
function initOnce() {
	initSwup()
	initSmoothScrolling()
	initMenus()
	initHeaderOnScroll()
	init()
	mouseFollower()
	swupHooks(init, kill)
}

// Runs of every page extrance
function init() {
	initUnifiedHeroScene()
	homeAnimations()
	runWorkThree()
	runTeamThree()
	AnimationBlocksBootstrap()
	projectSelector()
	initInternalBanner()
	initButtons()
	continuousScramble()
	scrambledInner()
	initVideoBlock()
	initAccordions()
	getArchivePosts()
	initWorkFilter()
	initContactForm()
	initFooterMenuAnimation()
	initNoLinkBlocker()
	initPanelNode()
	initASCIIOscilloscope()
	footerCanvas()
	footerParallax()
	initNotFoundContainer()
	initVideoToggle()
	initProductThemeFlip()
  if (document.getElementById('product-bg-fade')) {
    initProductBgFade();
  }
}

// Runs on every page exit to free up memory
function kill() {
	closeMenu()
	closeMobileAccordions()
	disposeUnifiedHeroScene()
	killFooterMenuAnimation()
	workThreeKill()
	killProjectSelector()
	killInternalBanner()
	killButtons()
	killVideoBlock()
	killAccordions()
	killArchivePosts()
	killScrollTriggers()
	killWorkFilter()
	killContactCanvas()
	killNoLinkBlocker()
	revertMouseState()
	killPanelNode()
	killASCIIOscilloscope()
	killInternalBanner()
	killAnimationBlocks()
	killFooterCanvas()
	cleanupFooterParallax()
	killVideoToggle()
	killProductThemeFlip()
	kill404Scene()
	// Close Trav's start bar
	document.dispatchEvent(new CustomEvent('the-start-bar-close'))
	killProductBgFade();
}
