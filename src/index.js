/* eslint-disable no-await-in-loop */
import EventEmitter from 'events';

import Debug from 'debug';
import delay from 'delay';
import SerialPort from 'serialport';

import { Device, STATUS_MISSING, STATUS_OPENED, STATUS_CLOSED } from './Device';

const debug = new Debug('SerialBridge:SerialBridge');

/**
 * Class creating a new serial bridge to manage serial ports.
 * @param {object} [options={}]
 * @param {function} [options.portFilter=(port) => port.manufacturer === 'SparkFun' && port.productId] Filter the serial ports to address.
 * @param {number} [options.baudRate=57200] Baud rate
 * @param {number} [options.interCommandDelay=100] Time to wait between commands in [ms]
 * @param {number} [options.defaultCommandExpirationDelay=100] Time to wait for answer before timeout
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

  /**
   * Update this.devices
   */
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

  /**
   * Update this.devices every `scanInterval` [ms].
   * @param {object} [options={}]
   * @param {number} [options.scanInterval=1000] Delay between `updateDevices()` calls
   */
  async continuousUpdateDevices(options = {}) {
    const { scanInterval = 1000 } = options;
    while (true) {
      this.updateDevices();
      await delay(scanInterval);
    }
  }

  /**
   * Returns this.devices
   * @param {object} [options={}]
   * @param {bool} [options.ready=false] If `true` returns only currently connected device. If `false` returns all devices ever connected.
   * @returns {Array<object>}
   */
  getDevicesList(options = {}) {
    let { ready = false } = options;
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

  // private function
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

  /**
   * Send a serial command to a device.
   * @param {number} id ID of the device
   * @param {string} command Command to send
   */
  async sendCommand(id, command) {
    const device = this.findDevice(id);
    if (!device) {
      throw Error(`Device ${id} not found`);
    }
    if (device && device.isReady()) return device.get(command);
    throw Error(`Device ${id} not ready: ${device.port.path}`);
  }
}
