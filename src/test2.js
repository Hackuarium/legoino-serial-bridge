import SerialPort from 'serialport';

async function doAll() {
  let ports = (await SerialPort.list()).filter(
    (port) => (port.manufacturer = 'SparkFun'),
  );

  port.console.log(ports);
}

doAll();
