import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const RETRY_DELAY_SECONDS = 5;
const MAX_ATTEMPTS = 6;

export default class AutoBluetoothConnectExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._retrySource = 0;
        this._attempt = 0;
        this._generation = 0;
        this._processes = new Set();

        this._connectSelectedDevices(this._generation);
    }

    disable() {
        this._generation++;
        this._cancelRetry();

        for (const process of this._processes)
            process.force_exit();

        this._processes.clear();
        this._settings = null;
    }

    _cancelRetry() {
        if (this._retrySource) {
            GLib.Source.remove(this._retrySource);
            this._retrySource = 0;
        }
    }

    _scheduleRetry(generation) {
        this._cancelRetry();

        if (
            this._attempt >= MAX_ATTEMPTS ||
            generation !== this._generation
        )
            return;

        this._retrySource = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            RETRY_DELAY_SECONDS,
            () => {
                this._retrySource = 0;

                if (generation !== this._generation)
                    return GLib.SOURCE_REMOVE;

                this._connectSelectedDevices(generation);
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    async _connectSelectedDevices(generation) {
        if (
            generation !== this._generation ||
            !this._settings ||
            !this._settings.get_boolean('enabled')
        )
            return;

        const devices = this._settings.get_strv('devices');

        if (devices.length === 0)
            return;

        this._attempt++;
        let failed = false;

        for (const mac of devices) {
            if (
                generation !== this._generation ||
                !this._settings
            )
                return;

            if (await this._isConnected(mac))
                continue;

            if (!await this._connect(mac))
                failed = true;
        }

        if (failed)
            this._scheduleRetry(generation);
    }

    async _isConnected(mac) {
        try {
            const output = await this._runBluetoothctl(['info', mac]);
            return /Connected:\s+yes/i.test(output);
        } catch {
            return false;
        }
    }

    async _connect(mac) {
        try {
            await this._runBluetoothctl(['connect', mac]);
            return await this._isConnected(mac);
        } catch {
            return false;
        }
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

            this._processes.add(process);

            process.communicate_utf8_async(null, null, (proc, result) => {
                this._processes.delete(proc);

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