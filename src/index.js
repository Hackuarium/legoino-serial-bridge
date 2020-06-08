/* eslint-disable no-await-in-loop */
import EventEmitter from 'events';

import Debug from 'debug';
import delay from 'delay';
import SerialPort from 'serialport';

import { Device, STATUS_MISSING, STATUS_OPENED, STATUS_CLOSED } from './Device';

const debug = new Debug('SerialBridge:SerialBridge');

/**
 * Manage Serial Ports
 */

export default class SerialBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.devices = {};
    this.portFilter =
      options.portFilter === undefined
        ? (port) => port.manufacturer === 'SparkFun' && port.productId
        : options.portFilter;
    this.baudRate = options.baudRate || 57200;
    this.interCommandDelay =
      options.interCommandDelay === undefined ? 100 : options.interCommandDelay;
    this.defaultCommandExpirationDelay =
      options.defaultCommandExpirationDelay === undefined
        ? 100
        : options.defaultCommandExpirationDelay;
  }

  async updateDevices() {
    const ports = await SerialPort.list();
    const portsName = ports.map((port) => port.path);
    const filteredPorts = ports.filter(this.portFilter);
    debug('updateDevices');

    const missingDevicesPortName = Object.keys(this.devices).filter(
      (portName) => !portsName.includes(portName),
    );
    missingDevicesPortName.forEach((portName) => {
      if (
        this.devices[portName].status !== STATUS_MISSING &&
        this.devices[portName].status !== STATUS_CLOSED
      ) {
        this.devices[portName].close();
      }
      this.devices[portName].status = STATUS_MISSING;
    });

    for (let port of filteredPorts) {
      let device = this.devices[port.path];
      if (device) {
        await device.ensureOpen();
      } else {
        let newDevice = new Device(port, {
          baudRate: this.baudRate,
          interCommandDelay: this.interCommandDelay,
          defaultCommandExpirationDelay: this.defaultCommandExpirationDelay,
        });
        this.devices[port.path] = newDevice;
        await newDevice.open();
      }
    }
    // check if there are any new ports
  }

  async continuousUpdateDevices(options = {}) {
    const { scanInterval = 1000 } = options;
    while (true) {
      this.updateDevices();
      await delay(scanInterval);
    }
  }

  getDevicesList(options = {}) {
    let { ready } = options;
    let devices = [];
    for (let port in this.devices) {
      let device = this.devices[port];
      if (!ready || device.isReady()) {
        devices.push({
          status: device.status,
          port: device.port,
          id: device.id,
          queueLength: device.queue.length,
        });
      }
    }
    return devices;
  }

  findDevice(id) {
    if (id === undefined) return undefined;
    let devices = Object.keys(this.devices)
      .map((key) => this.devices[key])
      .filter((device) => device.id === id && device.status === STATUS_OPENED);
    if (devices.length === 0) return undefined;
    if (devices.length > 1) {
      throw new Error(`Many devices have the same id: ${id}`);
    }
    return devices[0];
  }

  async sendCommand(id, command) {
    const device = this.findDevice(id);
    if (!device) {
      throw Error(`Device ${id} not found`);
    }
    if (device && device.isReady()) return device.get(command);
    throw Error(`Device ${id} not ready: ${device.port.path}`);
  }
}
