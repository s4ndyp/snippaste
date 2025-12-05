/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Scant alle .js en .jsx bestanden in de src map
    "./src/**/*.{js,jsx}", 
    // Voeg hier eventueel andere paden toe als je componenten buiten src/ hebt
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
