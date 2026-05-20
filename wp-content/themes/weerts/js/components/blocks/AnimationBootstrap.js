import {
	awardBlockAnimations,
	killawardBlockAnimations,
} from './awardAnimation'
import {
	headingBlockAnimations,
	killheadingBlockAnimations,
} from './headingAnimation'
import logoBlockAnimations, { killLogoBlockAnimations } from './logoAnimations'
import {
	killopenPositionAnimation,
	openPositionAnimation,
} from './openPositionAnimation'
import {
	killWorkBlockAnimation,
	workBlockAnimation,
} from './workBlockAnimations'
import {
	videoBlockAnimations,
	killVideoBlockAnimations,
} from './videoBlockAnimation'

//Bootstrap all of the blocks for animations
export default function AnimationBlocksBootstrap() {
	logoBlockAnimations()
	workBlockAnimation()
	headingBlockAnimations()
	awardBlockAnimations()
	openPositionAnimation()
	videoBlockAnimations()
}

export function killAnimationBlocks() {
	killLogoBlockAnimations()
	killWorkBlockAnimation()
	killheadingBlockAnimations()
	killawardBlockAnimations()
	killopenPositionAnimation()
	killVideoBlockAnimations()
}
