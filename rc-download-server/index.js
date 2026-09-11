app.use(express.json()); import('./dj-proxy.js').then(({ installDjProxy }) => installDjProxy(app));
