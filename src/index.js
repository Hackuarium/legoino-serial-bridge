import PortManager from './PortManager';
import delay from 'delay';
import Debug from 'debug';

const debug = new Debug('SerialBridge:Home');

export async function SerialBridge() {
  const portManager = new PortManager();
  portManager.continuousUpdateDevices();

  while (true) {
    await delay(1000);
    const devices = portManager.getDevicesList();
    devices.forEach((device) => {
      debug(device.port.path + ' - ' + device.id + ' - ' + device.status);
    });
    try {
      let result = await portManager.sendCommand('21569', 'il');
      console.log(result);
    } catch (e) {
      console.log(e);
    }
  }
}

SerialBridge();
