module.exports = {
	content: ['./*/*.php', './*.php', './templates/**/*.twig', './*/*/.js'],
	theme: {
		extend: {
			animation: {
				'pulse-scale': 'pulse-scale 2s ease-in-out infinite',
			},
			aspectRatio: {
				'16/9': '16/9',
				'3/2': '3/2',
				'4/3': '4/3',
				'3/4': '3/4',
				'1/1': '1/1',
			},
			colors: {
				white: '#FFFFFF',
				black: '#111114',
				fullBlack: '#000000',
				bgLight: '#F6F6F6',
				bgLightDarker: '#EDEDED',
				borderLight: '#DEDEDE',
				textLight: '#98989A',
				textLightSubtle: '#BDBDBD',
				textDark: '#111114',
				textDarkSubtle: '#565658',
				borderDark: '#313135',
				borderGrey: '#373737',
				brandColour: '#00FBFF',
			},
			fontFamily: {
				heading: ['neue-haas-grotesk-display', 'sans-serif'],
				headingCaps: ['aktiv-grotesk', 'sans-serif'],
				body: ['neue-haas-grotesk-display', 'sans-serif'],
				mono: ['VCR OSD Mono', 'sans-serif'],
			},
			keyframes: {
				'pulse-scale': {
					'0%, 100%': { transform: 'scale(1)' },
					'50%': { transform: 'scale(0.5)' },
				},
			},
			screens: {
				sm: '640px',
				md: '768px',
				lg: '1024px',
				xl: '1280px',
				'2xl': '1435px',
				'3xl': '1690px',
				'4xl': '2000px',
			},
			transitionTimingFunction: {
				fancy: 'cubic-bezier(0.76, 0, 0.24, 1)',
			},
			spacing: {
				headerHeight: '70px',
				headerHeightLessOne: '69px',
			},
		},
	},
	plugins: [require('@tailwindcss/typography')],
}
