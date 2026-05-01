/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        forest: {
          950: '#0F2D1F',
          900: '#1B4332',
          700: '#2E7D46',
          400: '#6BAE6E'
        },
        powerbi: {
          500: '#F2C811'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif']
      },
      boxShadow: {
        line: '0 1px 0 rgba(15, 45, 31, 0.08)'
      }
    }
  },
  plugins: []
};
