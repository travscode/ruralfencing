module.exports = {
	content: [
		'./*.php',
		'./templates/**/*.{twig,php}',
		'./includes/**/*.{html,php}',
		'./js/**/*.js',
	],
	theme: {
		extend: {
			screens: {
				'3xl': '1720px',
			},
			colors: {
				birch: '#2A231A',
				'deep-green': '#006600',
				'terracotta-clay': '#B36455',
				goldenrod: '#DB9D16',
				'pacific-cyan': '#3B8EA5',

				eggshell: '#F1EDE2',
				white: '#FFFFFF',
			},
			fontFamily: {
				sans: ['Tenon', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				body: ['Tenon', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				display: ['Dharma Gothic E', 'Impact', 'sans-serif'],
				heading: ['Dharma Gothic E', 'Impact', 'sans-serif'],
			},
			fontSize: {
				d1: ['6.875rem', { lineHeight: '6.625rem', fontWeight: '700' }],
				'd1-md': ['5.375rem', { lineHeight: '5rem', fontWeight: '700' }],
				d2: ['3.75rem', { lineHeight: '3.625rem', fontWeight: '700' }],
				d3: ['2.375rem', { lineHeight: '2.375rem', fontWeight: '700' }],
				d4: ['1.375rem', { lineHeight: '1.625rem', fontWeight: '500' }],
				t1: ['1.1875rem', { lineHeight: '1.625rem', fontWeight: '400' }],
				t2: ['1.1875rem', { lineHeight: '1.625rem', fontWeight: '400' }],
				t3: ['1.1875rem', { lineHeight: '1.625rem', fontWeight: '700' }],
				t4: ['1.375rem', { lineHeight: '1.875rem', fontWeight: '400' }],
				t5: ['1.875rem', { lineHeight: '2.25rem', fontWeight: '400' }],
				t6: ['2.375rem', { lineHeight: '2.625rem', fontWeight: '500' }],
				t7: ['1rem', { lineHeight: '1.4375rem', fontWeight: '400' }],
				t8: ['0.75rem', { lineHeight: '1rem', fontWeight: '500' }],
				b1: ['1.0625rem', { lineHeight: '1.5rem', fontWeight: '500' }],
				b2: [
					'1.3125rem',
					{
						lineHeight: '1.3125rem',
						letterSpacing: '0.1em',
						fontWeight: '700',
					},
				],
				b3: [
					'1.4375rem',
					{
						lineHeight: '1.4375rem',
						letterSpacing: '0.1em',
						fontWeight: '700',
					},
				],
			},
			letterSpacing: {
				button: '0.1em',
			},
		},
	},
	plugins: [],
}
