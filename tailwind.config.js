/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f0f0e",
        bg2: "#191817",
        bg3: "#222120",
        bg4: "#2c2a28",
        surface: "#1c1b19",
        surfaceH: "#242321",
        gold: "#c9a96e",
        goldM: "#a08350",
        goldF: "rgba(201,169,110,0.07)",
        tx: "#e8e4dd",
        txM: "#8a8578",
        txF: "#5c584f",
        cgreen: "#7cb98a",
        cred: "#c47a6c",
        cblue: "#7ba4c4",
        ccyan: "#7bbfb4",
      },
      fontFamily: {
        display: ["Cormorant Garamond", "serif"],
        body: ["Outfit", "sans-serif"],
      },
    },
  },
  plugins: [],
};
