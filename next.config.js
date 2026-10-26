module.exports = {
  output: 'standalone',
  experimental: {
    outputFileTracingIncludes: {
      '/api/data': ['./data/seed.json'],
    },
  },
};

