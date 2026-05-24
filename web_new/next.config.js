/** @type {import("next").NextConfig} */

const fs = require("fs");
const path = require("path");

function parseDotenvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          const key = line.slice(0, index).trim();
          const value = line
            .slice(index + 1)
            .trim()
            .replace(/^['"]|['"]$/g, "");
          return [key, value];
        })
    );
  } catch {
    return {};
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function normalizeBoolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase())
    ? "true"
    : "false";
}

const ROOT_ENV = parseDotenvFile(path.resolve(__dirname, "..", ".env"));
const BACKEND_PORT = firstNonEmpty(ROOT_ENV.BACKEND_PORT, process.env.BACKEND_PORT, "8001");

const NEXT_PUBLIC_API_BASE = firstNonEmpty(
  ROOT_ENV.NEXT_PUBLIC_API_BASE_EXTERNAL,
  process.env.NEXT_PUBLIC_API_BASE_EXTERNAL,
  ROOT_ENV.NEXT_PUBLIC_API_BASE,
  process.env.NEXT_PUBLIC_API_BASE,
  `http://localhost:${BACKEND_PORT}`
);

const NEXT_PUBLIC_AUTH_ENABLED = normalizeBoolean(
  firstNonEmpty(
    ROOT_ENV.NEXT_PUBLIC_AUTH_ENABLED,
    ROOT_ENV.AUTH_ENABLED,
    process.env.NEXT_PUBLIC_AUTH_ENABLED,
    process.env.AUTH_ENABLED,
    "false"
  )
);

process.env.NEXT_PUBLIC_API_BASE = NEXT_PUBLIC_API_BASE;
process.env.NEXT_PUBLIC_AUTH_ENABLED = NEXT_PUBLIC_AUTH_ENABLED;

const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ["10.66.50.103"],
  env: {
    NEXT_PUBLIC_API_BASE,
    NEXT_PUBLIC_AUTH_ENABLED
  },
  output: "standalone",
  turbopack: {
    root: __dirname
  }
};

module.exports = nextConfig;
