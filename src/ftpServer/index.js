const ftpd = require('ftpd');

class FTPServer {
    sever;
    logger;
    options = { pasvPortRangeStart: 1025, pasvPortRangeEnd: 1050, getInitialCwd: () => '/logs/', getRoot: () => process.cwd(), allowUnauthorizedTls: true };
    constructor(logger) { this.setup(); this.logger = logger; }
    setup() {
        this.server = new ftpd.FtpServer('127.0.0.0', this.options);
        if (!this.server) return;
        this.server.debugging = 0;
        this.server.on("client:connected", function (socket) {
            this.logger?.info && this.logger.info(`ftp client connected: ${socket.remoteAddress}`);
            var username = null;
            socket.on("command:user", (user, success, failure) => user ? (username = user) && success() : failure());
            socket.on("command:pass", (pass, success, failure) => pass ? success(username) : failure());
        });
    }

    start() { this.server && this.server.listen(5555)};
}

module.exports = { ftpServer: FTPServer }
