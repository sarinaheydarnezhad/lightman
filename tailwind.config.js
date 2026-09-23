const tokens = require('./src/shared/theme/values.json');
const pixels = (entries) => Object.fromEntries(Object.entries(entries).map(([name, size]) => [name, `${size}px`]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: Object.fromEntries(
        Object.keys(tokens.colors.light).map((name) => [
          name,
          `rgb(var(--color-${name}) / <alpha-value>)`,
        ]),
      ),
      spacing: pixels(tokens.spacing),
      borderRadius: pixels(tokens.radii),
      height: pixels(tokens.heights),
      width: pixels(tokens.heights),
      minHeight: pixels(tokens.heights),
      minWidth: pixels({ iconButton: tokens.heights.iconButton }),
      fontSize: Object.fromEntries(
        Object.entries(tokens.typography).map(([name, [size, lineHeight, fontWeight]]) => [
          name,
          [`${size}px`, { lineHeight: `${lineHeight}px`, fontWeight }],
        ]),
      ),
    },
  },
  plugins: [],
};
