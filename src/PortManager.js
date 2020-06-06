import EventEmitter from 'events';
import SerialPort from 'serialport';
import delay from 'delay';
import Debug from 'debug';
import { Device, STATUS_MISSING } from './Device';

const debug = new Debug('SerialBridge:PortManager');

/**
 * we will scan for ports
 */

export default class PortManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.devices = {};
    this.portFilter =
      options.portFilter === undefined
        ? (port) => port.manufacturer === 'SparkFun' && port.productId
        : options.portFilter;
    this.baudRate = options.baudRate || 57200;
  }

  async updateDevices() {
    const ports = await SerialPort.list();
    const portsName = ports.map((port) => port.path);
    const filteredPorts = ports.filter(this.portFilter);
    debug('updateDevices');

    const missingDevicesPortName = Object.keys(this.devices).filter(
      (portName) => !portsName.includes(portName),
    );
    missingDevicesPortName.forEach(
      (portName) => (this.devices[portName].status = STATUS_MISSING),
    );

    for (let port of filteredPorts) {
      let device = this.devices[port.path];
      if (device) {
        await device.ensureOpen();
      } else {
        let newDevice = new Device(port, { baudRate: this.baudRate });
        this.devices[port.path] = newDevice;
        await newDevice.open();
      }
    }
    // check if there are any new ports
  }

  async continuousUpdateDevices(options = {}) {
    const { repeatInterval = 1000 } = options;
    while (true) {
      this.updateDevices();
      await delay(repeatInterval);
    }
  }

  getDevicesList() {
    let devices = [];
    for (let port in this.devices) {
      let device = this.devices[port];
      devices.push({
        status: device.status,
        port: device.port,
        id: device.id,
        queueLength: device.queue.length,
      });
    }
    return devices;
  }

  findDevice(id) {
    let devices = Object.keys(this.devices)
      .map((key) => this.devices[key])
      .filter((device) => device.id === id);
    if (devices.length === 0) return undefined;
    if (devices.length > 1) {
      throw new Error('More than one device has the same id: ' + id);
    }
    return devices[0];
  }

  async sendCommand(id, command) {
    const device = this.findDevice(id);
    if (!device) {
      throw Error('Device ' + id + ' not found');
    }
    if (device && device.isReady()) return device.get(command);
    throw Error('Device ' + id + ' not ready: ' + device.port.path);
  }
}
