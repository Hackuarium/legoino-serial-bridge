/* eslint-disable no-await-in-loop */
import delay from 'delay';

import SerialBridge from '../src';

export async function example() {
  // Creating a new instance of the serial bridge
  const serialBridge = new SerialBridge({
    portFilter: (port) => port.manufacturer === 'SparkFun' && port.productId,
    baudRate: 57200,
    interCommandDelay: 100,
    defaultCommandExpirationDelay: 2000,
  });

  // we will update the list of serial devices matching `portFilter` every 1s
  serialBridge.continuousUpdateDevices({ scanInterval: 1000 });

  // just a small demo. We fetch the free memory of all the connected devices
  while (true) {
    await delay(1000);
    const devices = serialBridge.getDevicesList({ ready: true });
    devices.forEach((device) => {
      console.log(`${device.port.path} - ${device.id} - ${device.status}`);
    });
    for (let device of devices) {
      // you should use this syntax whenever sending a command!
      await serialBridge
        .sendCommand(device.id, 'uf')
        .then((result) => {
          console.log(device.id, result);
        })
        .catch((err) => {
          console.log(err);
        });
    }
  }
}

example();
