# Auto Bluetooth Connect

A GNOME Shell extension that automatically connects selected paired Bluetooth devices when your GNOME session starts.

## Features

- Automatically connects selected paired Bluetooth devices.
- GTK4/libadwaita preferences page.
- Discovers paired devices with `bluetoothctl`.
- Supports multiple preferred devices.
- Retries failed connections every 5 seconds for up to 30 seconds after login.
- Stores only selected Bluetooth MAC addresses in GSettings.
- Does not create a separate systemd service.

## Requirements

- GNOME Shell 50
- BlueZ / `bluetoothctl`
- The Bluetooth device must already be paired.

## How it works

The extension uses the standard `bluetoothctl` command-line interface to check selected devices and request connections. It does not access a remote service or collect telemetry.

## Preferences

Open the extension preferences and enable automatic connection. The extension lists paired Bluetooth devices and lets you select one or more devices to connect automatically.

## Development

The extension currently targets GNOME Shell 50. The project is intentionally kept small so the code can be reviewed and maintained easily.

## License

GNU General Public License v3.0. See `LICENSE`.
