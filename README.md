# legoino-serial-bridge

[![NPM version][npm-image]][npm-url]
[![build status][ci-image]][ci-url]
[![Test coverage][codecov-image]][codecov-url]
[![npm download][download-image]][download-url]

Create a serial bridge to interact with serial devices.

## Installation

```bash
$ npm i legoino-serial-bridge
```

## Usage

```js
import delay from 'delay';

import SerialBridge from 'SerialBridge';

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
```

## [API Documentation](https://hackuarium.github.io/legoino-serial-bridge/)

Refer to the API to see all accessible functions.

## License

[MIT](./LICENSE)

[npm-image]: https://img.shields.io/npm/v/legoino-serial-bridge.svg
[npm-url]: https://www.npmjs.com/package/legoino-serial-bridge
[ci-image]: https://github.com/hackuarium/legoino-serial-bridge/workflows/Node.js%20CI/badge.svg?branch=master
[ci-url]: https://github.com/hackuarium/legoino-serial-bridge/actions?query=workflow%3A%22Node.js+CI%22
[codecov-image]: https://img.shields.io/codecov/c/github/hackuarium/legoino-serial-bridge.svg
[codecov-url]: https://codecov.io/gh/hackuarium/legoino-serial-bridge
[download-image]: https://img.shields.io/npm/dm/legoino-serial-bridge.svg
[download-url]: https://www.npmjs.com/package/legoino-serial-bridge
