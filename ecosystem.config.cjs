module.exports = {
  apps: [
    {
      name: 'solana-playground',
      script: 'startup.sh',
      interpreter: 'bash',
      cwd: '/Users/dominiksoczewka/Projects/solana-playground',
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
      },
    },
  ],
};
