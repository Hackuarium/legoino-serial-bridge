/* eslint-disable no-await-in-loop */
import EventEmitter from 'events';

import Debug from 'debug';
import delay from 'delay';
import SerialPort from 'serialport';

import { Action } from './Action';

const debug = new Debug('SerialBridge:Device');

export const STATUS_OPENING = 1;
export const STATUS_OPENED = 2;
export const STATUS_CLOSED = 3;
export const STATUS_MISSING = 9;
export const STATUS_ERROR = 10;

export class Device extends EventEmitter {
  constructor(port, options = {}) {
    super();
    this.baudRate = options.baudRate || 57200;
    this.status = STATUS_OPENING;
    this.port = port;
    this.id = undefined;
    this.serialPort = undefined;
    this.queue = [];
    this.action = undefined;
    this.interCommandDelay = 100;
    this.defaultCommandExpirationDelay = 2000;
  }

  isReady() {
    return this.status === STATUS_OPENED;
  }

  async ensureProcessQueue() {
    if (!this.currentProcessQueue) {
      this.currentProcessQueue = this.runProcessQueue();
    }
    return this.currentProcessQueue;
  }

  async runProcessQueue() {
    while (this.queue.length > 0) {
      this.action = this.queue.shift();
      if (this.action) {
        this.action.start();
        this.serialPort.write(`${this.action.command}\n`);
        await this.action.finishedPromise;
        this.action = undefined;
        debug('Finished');
        await delay(this.interCommandDelay);
      }
    }
    this.currentProcessQueue = undefined;
  }

  async getStatus() {
    return {
      value: this.status,
    };
  }

  async ensureOpen() {
    debug(`Ensure open ${this.port.path}`);
    if (this.status !== STATUS_OPENED) {
      return this.open();
    }
  }

  async open() {
    debug(`Opening ${this.port.path}`);

    if (this.status !== STATUS_OPENED) {
      this.serialPort = new SerialPort(
        this.port.path,
        {
          baudRate: this.baudRate,
        },
        async (err) => {
          if (err) {
            debug(`Error opening ${this.port.path} ${this.err}`);
            throw err;
          }
          this.status = STATUS_OPENED;
          this.id = await this.get('uq');
        },
      );
    }

    await delay(100);
    this.serialPort.on('open', (open) => {
      debug('open callback');
      this.open(open);
    });
    this.serialPort.on('data', (data) => {
      debug('data callback');
      if (this.action) this.action.appendAnswer(data);
    });
    this.serialPort.on('error', (error) => {
      debug('error callback');
      this.open(error);
    });
    this.serialPort.on('close', (close) => {
      debug('close callback');
      this.open(close);
    });

    this.emit('adapter', {
      event: 'Open',
      value: {},
    });
  }

  /*
   We need to add this command in the queue and wait it resolves or rejects
  */
  async get(command, options = {}) {
    const {
      commandExpirationDelay = this.defaultCommandExpirationDelay,
    } = options;

    const action = new Action(command, {
      timeout: commandExpirationDelay,
    });

    this.queue.push(action);
    this.ensureProcessQueue();
    return action.promise;
  }

  close() {
    debug(`Close ${this.port.path}`);
    this.serialPort.flush(() => {
      this.serialPort.close((err) => {
        if (err) {
          debug('port could not be closed');
          debug(err);
          this.emit('adapter', {
            event: 'closeError',
            value: err,
          });
        } else {
          debug('port closed');
          this.status = STATUS_CLOSED;
          this.emit('adapter', {
            event: 'closed',
            value: {},
          });
        }
      });
    });
  }

  error(error) {
    debug(`Error ${this.port.path}`);
    debug(error);
    this.status = STATUS_ERROR;
    this.emit('adapter', {
      event: 'Error',
      value: error,
    });
  }
}
