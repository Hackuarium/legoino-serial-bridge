import Debug from 'debug';

const debug = new Debug('SerialBridge:Action');

export class Action {
  constructor(command, options = {}) {
    this.command = command;
    this.timeout = options.timeout === undefined ? 1000 : options.timeout;
    this.answer = '';
    this.creationTimestamp = Date.now();
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
    this.finishedPromise = new Promise((resolve) => {
      this.finished = resolve;
    });
  }

  start() {
    this.startTimestamp = Date.now();
    setTimeout(() => {
      console.log(this);
    }, this.timeout);
  }

  appendAnswer(buffer) {
    let string = new TextDecoder().decode(buffer);
    debug('Data received: ' + string);
    this.answer += string;
    if (!this.answer.replace(/\r/g, '').endsWith('\n\n')) return;
    let lines = this.answer.split(/\r?\n/);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines = lines.filter((line) => line);
      this.resolve(lines.join('\n'));
      this.finished();
      this.action = undefined;
    }
  }

  update() {}
}
