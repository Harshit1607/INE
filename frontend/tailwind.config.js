/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Urbanist Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        canvas: '#EBEBEB',
        frame: '#FFFFFF',
        tile: { DEFAULT: '#F4F4F4', 2: '#EAEAEA' },
        ink: {
          DEFAULT: '#0A0A0A',
          2: '#4A4A4A',
          3: '#6B6B6B',
          soft: '#A3A3A3'
        },
        line: '#E4E4E4',
        ok: { DEFAULT: '#12784F', 50: '#E6F6EF', dot: '#1FA971' },
        warn: { DEFAULT: '#8F5409', 50: '#FDF3E3', dot: '#E59A2B' },
        bad: { DEFAULT: '#C8313F', 50: '#FCEBEC', dot: '#E0485A' }
      },
      boxShadow: {
        card: '0 1px 2px rgba(10, 10, 10, 0.04), 0 6px 18px -8px rgba(10, 10, 10, 0.12)',
        lift: '0 2px 4px rgba(10, 10, 10, 0.05), 0 18px 36px -14px rgba(10, 10, 10, 0.22)',
        frame: '0 30px 80px -30px rgba(10, 10, 10, 0.25)'
      },
      borderRadius: {
        panel: '22px'
      }
    },
  },
  plugins: [],
}
