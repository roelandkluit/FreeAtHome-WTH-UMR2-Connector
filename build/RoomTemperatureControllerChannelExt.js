"use strict";
//Creating thermostat using custom template, 
//Pull request https://github.com/Busch-Jaeger/node-free-at-home/pull/4 is not going through, so lib does not have correct datapoints for RTC.
//Implemented local version of the RTC
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomTemperatureControllerChannelExt = void 0;
const free_at_home_1 = require("@busch-jaeger/free-at-home");
const free_at_home_2 = require("@busch-jaeger/free-at-home");
const ts_mixer_1 = require("ts-mixer");
const events_1 = require("events");
class RoomTemperatureControllerChannelExt extends (0, ts_mixer_1.Mixin)(free_at_home_2.Channel, events_1.EventEmitter) {
    setPointTemperature = 15.0;
    HeatingOrCoolingMode = 0; //0 not active, 1 activeheat, 2 activecool
    parentDevice;
    constructor(channel, device) {
        super(channel);
        channel.on("inputDatapointChanged", this.dataPointChanged.bind(this));
        channel.on("parameterChanged", this.parameterChanged.bind(this));
        this.parentDevice = device;
    }
    dataPointChanged(id, value) {
        switch (id) {
            case free_at_home_1.PairingIds.AL_RELATIVE_SET_POINT_REQUEST:
                {
                    console.log("[FaH] Set datapoint: AL_RELATIVE_SET_POINT_REQUEST, ", value);
                    const intValue = Number.parseFloat(value);
                    this.setPointTemperature += intValue;
                    if (this.isAutoConfirm)
                        this.setDatapoint(free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
                    this.emit("onSetPointTemperatureChanged", this.setPointTemperature);
                }
                break;
            case free_at_home_1.PairingIds.AL_INFO_ABSOLUTE_SET_POINT_REQUEST:
                {
                    console.log("[FaH] Set datapoint: AL_INFO_ABSOLUTE_SET_POINT_REQUEST, ", value);
                    const intValue = Number.parseFloat(value);
                    this.setPointTemperature = intValue;
                    if (this.isAutoConfirm)
                        this.setDatapoint(free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
                    this.emit("onSetPointTemperatureChanged", this.setPointTemperature);
                }
                break;
            case free_at_home_1.PairingIds.AL_ECO_ON_OFF:
                {
                    if ("1" === value) {
                        console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, EcoMode On");
                        this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "68");
                    }
                    else {
                        if (this.HeatingOrCoolingMode === 0) {
                            console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, Off");
                            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65");
                        }
                        else if (this.HeatingOrCoolingMode === 1) {
                            console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, HeatingMode On");
                            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "33");
                        }
                        else if (this.HeatingOrCoolingMode === 2) {
                            console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, CoolingMode On");
                            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "1");
                        }
                    }
                    this.emit("onDeviceEcoModeChanged", "1" === value);
                }
                break;
            case free_at_home_1.PairingIds.AL_CONTROLLER_ON_OFF_REQUEST:
                {
                    console.log("[FaH] Set datapoint: AL_CONTROLLER_ON_OFF_REQUEST, ", value);
                    this.setDatapoint(free_at_home_1.PairingIds.AL_CONTROLLER_ON_OFF, value);
                    this.emit("onDeviceOnOffModeChanged", "1" === value);
                }
                break;
            default:
                console.log("[FaH] Unknown datapoint changed:", free_at_home_1.ParameterIds[id], value);
                break;
        }
    }
    parameterChanged(id, value) {
        console.log("[FaH] Parameter changed:", free_at_home_1.ParameterIds[id], value);
    }
    async start(initialSetTemperature) {
        await this.setDatapoint(free_at_home_1.PairingIds.AL_MEASURED_TEMPERATURE, "0");
        if (typeof initialSetTemperature !== 'undefined') {
            console.log("[FaH] Initial Set Temperature: ", initialSetTemperature);
            this.setPointTemperature = initialSetTemperature;
            await this.setDatapoint(free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
        }
        await this.setDatapoint(free_at_home_1.PairingIds.AL_RELATIVE_SET_POINT_TEMPERATURE, "0");
        await this.setDatapoint(free_at_home_1.PairingIds.AL_CONTROLLER_ON_OFF, "1");
        await this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65");
    }
    sendMeasuredTemperature(value) {
        this.setDatapoint(free_at_home_1.PairingIds.AL_MEASURED_TEMPERATURE, value.toFixed(1));
    }
    sendSetPointTemperature(value) {
        this.setDatapoint(free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE, value.toFixed(1));
    }
    getSetPointTemperature() {
        return this.setPointTemperature;
    }
    setEcoState(value) {
        this.dataPointChanged(free_at_home_1.PairingIds.AL_ECO_ON_OFF, value ? "1" : "0");
    }
    setOnState(value) {
        this.dataPointChanged(free_at_home_1.PairingIds.AL_CONTROLLER_ON_OFF_REQUEST, value ? "1" : "0");
    }
    setIsHeating(value) {
        if (value) {
            this.HeatingOrCoolingMode = 1;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "33");
        }
        else {
            this.HeatingOrCoolingMode = 0;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65");
        }
    }
    setIsCooling(value) {
        if (value) {
            this.HeatingOrCoolingMode = 2;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "1");
        }
        else {
            this.HeatingOrCoolingMode = 0;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65");
        }
    }
}
exports.RoomTemperatureControllerChannelExt = RoomTemperatureControllerChannelExt;
//# sourceMappingURL=RoomTemperatureControllerChannelExt.js.map