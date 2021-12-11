const winston = require('winston');

const productionLogger = winston.createLogger({
    level: 'info',
    transports: [new winston.transports.Console()],
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => `[${info.timestamp}][${info.level.toUpperCase()}]: ${info.message}`)
    )
});

const developmentLogger = winston.createLogger({
    level: 'debug',
    transports: [new winston.transports.Console()],
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize({ message: true }),
        winston.format.printf(info => `[${info.timestamp}][${info.level.toUpperCase()}]: ${info.message}`)
    )
});

if (process.env.NODE_ENV === "production") {
    module.exports = productionLogger;
} else {
    module.exports = developmentLogger;
}

