const pm2 = require('pm2');
const fs = require('fs');
const bunyan = require('bunyan');
const { EventEmitter } = require('events');
const uuid = require('uuid');

const logger = bunyan.createLogger({ name: 'logger', level: 'debug' });
const processes = new EventEmitter();


function spawn (script, args) {
  return new Promise((resolve, reject) => {
    let name = `${ script }-${ uuid.v4() }`;

    processes.once(name, ({ exitCode, results }) => {
      return (exitCode === 0 ? resolve : reject)(results);
    });

    pm2.start({
      name: name,
      script: script,
      args: args,
      maxRestarts:  0,
      autoRestart: false,
    });
  });
}


pm2.connect(async (err) => {
  if (err) {
    logger.error(err);
    process.exit(2);
  }

  pm2.launchBus(async (err, bus) => {
    bus.on('process:event', async (data) => {
      let { event, at, process } = data;
      logger.debug(data, `${ process.name }: ${ event }`);

      if (event === 'exit') {
        let results = fs.readFileSync(process.exit_code === 0 ? process.pm_out_log_path : process.pm_err_log_path);
        processes.emit(process.name, { exitCode: process.exit_code, results });
      }
    });

    try {
      let results = await spawn('ffprobe', '-analyzeduration 10M -of json=compact=1 -show_format -show_streams /home/allanlei/Videos/bbb.60s.mp4');
      logger.info(JSON.parse(results.toString().replace(/\n/g, '')), 'Success');
    } catch (err) {
      logger.error(err.toString());
    }

    try {
      let results = await spawn('ffmpeg', '-i /home/allanlei/Videos/bbb.60s.mp4 -t 10 -y hello.mp4');
      logger.info('Success');
    } catch (err) {
      logger.error(err.toString());
    }
	});
});
