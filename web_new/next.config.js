/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ["10.66.50.103"],
  // 输出 standalone 产物，供 Docker 生产镜像复制最小运行时。
  output: "standalone",
  turbopack: {
    root: __dirname
  }
};

module.exports = nextConfig;
