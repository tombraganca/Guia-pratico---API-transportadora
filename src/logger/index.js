const log4js = require("log4js");
log4js.configure({
    appenders: { cheese: { type: "file", filename: `./logs/log.log` } },
    categories: { default: { appenders: ["cheese"], level: "info" } },
});

module.exports = log4js.getLogger();