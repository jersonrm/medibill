/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",    
  ],
  theme: {
    extend: {
      colors: {
        medi: {
          light: '#b9d6f2',   // Azul hielo (Fondos suaves, bordes)
          accent: '#006daa',  // Azul brillante (Hover, detalles vibrantes)
          primary: '#0353a4', // Azul rey (Botones principales)
          dark: '#003559',    // Azul marino (Textos secundarios, headers secundarios)
          deep: '#061a40',    // Azul noche (Textos principales, headers principales)
        }
      }
    },
  },
  plugins: [],
}