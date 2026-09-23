import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';

import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AutoBluetoothConnectPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('Auto Bluetooth Connect'),
            icon_name: 'bluetooth-symbolic',
        });

        window.add(page);

        const generalGroup = new Adw.PreferencesGroup({
            title: _('Automatic connection'),
            description: _(
                'Selected paired devices will be connected automatically when you log in.'
            ),
        });

        page.add(generalGroup);

        const enabledRow = new Adw.SwitchRow({
            title: _('Enable automatic connection'),
            subtitle: _('Connect selected Bluetooth devices at session startup.'),
        });

        generalGroup.add(enabledRow);

        settings.bind(
            'enabled',
            enabledRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        const deviceGroup = new Adw.PreferencesGroup({
            title: _('Preferred devices'),
            description: _('Select one or more paired Bluetooth devices.'),
        });

        page.add(deviceGroup);

        let deviceRows = [];
        let scanGeneration = 0;

        const loadDevices = async () => {
            const generation = ++scanGeneration;

            for (const row of deviceRows)
                row.unparent();

            deviceRows = [];

            const refreshRow = new Adw.ActionRow({
                title: _('Paired Bluetooth devices'),
                subtitle: _('Scanning…'),
            });

            const refreshButton = new Gtk.Button({
                icon_name: 'view-refresh-symbolic',
                tooltip_text: _('Refresh'),
                valign: Gtk.Align.CENTER,
            });

            refreshButton.connect('clicked', loadDevices);
            refreshRow.add_suffix(refreshButton);
            deviceGroup.add(refreshRow);

            try {
                const output = await this._runBluetoothctl([
                    'devices',
                    'Paired',
                ]);

                if (generation !== scanGeneration)
                    return;

                const devices = this._parseDevices(output);

                if (devices.length === 0) {
                    refreshRow.subtitle = _(
                        'No paired devices found. Pair a device first, then refresh.'
                    );
                    return;
                }

                refreshRow.subtitle =
                    _('%d paired device(s) found').replace(
                        '%d',
                        String(devices.length)
                    );

                const selected = new Set(settings.get_strv('devices'));

                for (const device of devices) {
                    const row = new Adw.SwitchRow({
                        title: device.name,
                        subtitle: device.mac,
                        active: selected.has(device.mac),
                    });

                    row.connect('notify::active', () => {
                        const current = new Set(
                            settings.get_strv('devices')
                        );

                        if (row.active)
                            current.add(device.mac);
                        else
                            current.delete(device.mac);

                        settings.set_strv('devices', [...current]);
                    });

                    deviceGroup.add(row);
                    deviceRows.push(row);
                }
            } catch {
                if (generation === scanGeneration) {
                    refreshRow.subtitle = _(
                        'Could not run bluetoothctl. Make sure Bluetooth is available.'
                    );
                }
            }
        };

        loadDevices();

        const supportGroup = new Adw.PreferencesGroup({
            title: _('Support'),
            description: _(
                'If you find this extension useful, you can support its development.'
            ),
        });

        page.add(supportGroup);

        const supportRow = new Adw.ActionRow({
            title: _('Support Auto Bluetooth Connect'),
            subtitle: _('Buy me a coffee ☕'),
        });

        const supportButton = new Gtk.LinkButton({
            label: _('Buy Me a Coffee'),
            uri: 'https://buymeacoffee.com/archimetrix',
            valign: Gtk.Align.CENTER,
        });

        supportRow.add_suffix(supportButton);
        supportGroup.add(supportRow);
    }

    _parseDevices(output) {
        const devices = [];
        const seen = new Set();

        for (const line of output.split('\n')) {
            const match = line.match(
                /^Device\s+([0-9A-Fa-f:]{17})\s+(.+)$/
            );

            if (!match)
                continue;

            const mac = match[1].toUpperCase();
            const name = match[2].trim();

            if (seen.has(mac))
                continue;

            seen.add(mac);
            devices.push({mac, name});
        }

        return devices;
    }

    _runBluetoothctl(args) {
        return new Promise((resolve, reject) => {
            let process;

            try {
                process = Gio.Subprocess.new(
                    ['bluetoothctl', ...args],
                    Gio.SubprocessFlags.STDOUT_PIPE |
                    Gio.SubprocessFlags.STDERR_PIPE
                );
            } catch (error) {
                reject(error);
                return;
            }

            process.communicate_utf8_async(null, null, (proc, result) => {
                try {
                    const [, stdout, stderr] =
                        proc.communicate_utf8_finish(result);

                    if (!proc.get_successful()) {
                        reject(new Error(
                            (stderr || stdout || 'bluetoothctl failed').trim()
                        ));
                        return;
                    }

                    resolve((stdout || '').trim());
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
}