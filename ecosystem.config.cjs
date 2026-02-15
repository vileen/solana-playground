module.exports = {
  apps: [
    {
      name: 'solana-playground',
      script: 'startup.sh',
      interpreter: 'bash',
      cwd: '/opt/solana-playground',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },
  ],
};
