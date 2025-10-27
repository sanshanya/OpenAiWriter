/** @type {import("prettier").Config} */
const config = {
  plugins: ["prettier-plugin-tailwindcss", "prettier-plugin-packagejson"],
  tailwindFunctions: ["cn", "cva"],
};

export default config;
