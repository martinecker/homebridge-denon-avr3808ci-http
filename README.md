# Homebridge-Denon-AVR3808CI-HTTP

Developed by Martin Ecker in 2018.

This is a [Homebridge](https://github.com/nfarina/homebridge) plugin for the [Denon AVR-3808CI A/V receiver](https://usa.denon.com/us/product/hometheater/receivers/avr3808ci) to enable Apple-HomeKit/Siri control of volume, mute state, and input selection. Although untested, there's a good chance this plugin also works for the Denon AVR-4308CI and AVR-5308CI, and possibly other Denon receivers from that era (around 2007-2010) that support the same HTTP interface as the AVR-3808CI.

## Features

### Power

This plugin exposes a power switch that can only be used to put the receiver into standby mode, but not to turn it back on because once in standby the HTTP server of the receiver is turned off. Because of this, you can optionally disable the power switch in config.json because it may be inconvenient if you accidentally turn off the receiver via HomeKit but then can't turn it back on. I'd recommend something like the Logitech Harmony Hub and its Homebridge plugin if you want to turn your receiver on and off via HomeKit/Siri.

### Mute

The mute state and volume of the receiver's main zone are exposed via the speaker service supported with iOS 10 or newer. Unfortunately, at the time of this writing neither Apple's Home app nor Siri support the speaker service. You can use the Eve Elgato app as an alternative. To still support the Home app and Siri this plugin exposes the Denon receiver's mute state and volume as a light bulb service's brightness.

### Inputs

Either all inputs or optionally a desired selection of inputs that can have custom names for Siri assigned in config.json are exposed as a group of switches that act as a group of radio buttons. I.e. only one switch can be turned on at any given time and turning one on will turn off all the others in the group.

## Installation

1. Install homebridge using: `sudo npm install -g homebridge`
1. Install this plugin using: `sudo npm install -g homebridge-denon-avr3808ci-http`
1. Update your configuration file as described below.
1. Restart homebridge. If you're running it as systemd service this is typically done via `sudo systemctl restart homebridge`.

## Configuration

This plugin implements a Homebridge accessory and as such a new section needs to be added to the `"accessories"` section in `config.json`.

Here's an example that shows all options the plugin offers:

```json
    "accessories":
    [
        {
            "accessory": "DenonAVR-3808CI-HTTP",
            "name": "Receiver",
            "ip": "192.168.1.8",
            "inputs":
            {
                "DVD": "PS4",
                "TV/CBL": "Roku",
                "DVR": "RetroPie"
            },
            "maxVolume": "70",
            "pollingIntervalMs": "15000",
            "addPowerSwitch": "true",
            "switchesForAllInputs": "true"
        }
    ]
```

* **"accessory"** (required): This needs to be set to `"DenonAVR-3808CI-HTTP"`
* **"name"** (required): This can be any name you want to assign to this particular receiver. This is how it will show up in the Home app and also how Siri will recognize it. You should pick an easy to say, unique name.
* **"ip"** (required): The IP address of your receiver. You may want to make sure you assign a fixed IP to your Denon AVR in your router.
* **"inputs"** (optional, default empty list): If this option is added to config.json, it must be a list of key-value pairs of the receiver inputs you want to have exposed as a group of switches that act as a kind of radio button as explained above. The following lists all valid keys:
  ```json
    "TV/CBL",
    "TUNER",
    "PHONO",
    "CD",
    "DVD",
    "HDP",
    "SAT",
    "VCR/iPod",
    "DVR",
    "V.AUX",
    "NET/USB",
    "XM"
  ```
  The names will be used as the switch names in the Home app and for Siri. In the above example, you can tell Siri to "turn on the receiver Roku" and it'll switch the receiver input to the "TV/CBL" input (which in this example is assumed to be connected to a Roku device). If the "switchesForAllInputs" settings is set to "true" any inputs not listed here will be added with the name matching the input name on the receiver. If "switchesForAllInputs" is "false" or omitted only the inputs listed as "inputs" will be available.
* **"switchesForAllInputs"** (optional, default "false"): If this is "true" switches for all inputs (see "inputs" above) will be added. If "false" only switches listed in the "inputs" section will be exposed.
* **"maxVolume"** (optional, default "70"): The volume in the Home app and Siri is expressed in a range of 0% to 100%, which maps to a range of -80dB to 18db. When this option is set to something lower than "100" the volume percentage the receiver will accept from Home/Siri will never exceed that value. By default "maxVolume" is set to "70", which is about -10dB, which is already plenty load in most cases. This is mostly a protective measure so that you don't accidentally set the volume too high.
* **"pollingIntervalMs"** (optional, default "15000"): In order to keep HomeKit synchronized with external changes made to the receiver (for example, via the remote), this plugin polls the receiver's status at regular intervals. The interval length is controlled with this option, which specifies a time duration in milliseconds. The default is "15000" or 15 seconds.
* **"addPowerSwitch"** (optional, default "false"): When this is specified a power switch is exposed to HomeKit that can only be used to set the receiver in standby mode when the switch is turned off. Once turned off the switch cannot be turned on anymore directly because the receiver's HTTP server is offline when the receiver is in standby or turned off. You have to manually turn the receiver on again.

## License

ISC License (ISC)
Copyright 2018 Martin Ecker

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.