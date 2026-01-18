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
// Enum for Heating or Cooling Modes
var HeatingOrCoolingModeEnum;
(function (HeatingOrCoolingModeEnum) {
    HeatingOrCoolingModeEnum[HeatingOrCoolingModeEnum["NotActive"] = 0] = "NotActive";
    HeatingOrCoolingModeEnum[HeatingOrCoolingModeEnum["ActiveHeat"] = 1] = "ActiveHeat";
    HeatingOrCoolingModeEnum[HeatingOrCoolingModeEnum["ActiveCool"] = 2] = "ActiveCool";
})(HeatingOrCoolingModeEnum || (HeatingOrCoolingModeEnum = {}));
class RoomTemperatureControllerChannelExt extends (0, ts_mixer_1.Mixin)(free_at_home_2.Channel, events_1.EventEmitter) {
    setPointTemperature = 15.0;
    HeatingOrCoolingMode = HeatingOrCoolingModeEnum.NotActive; //0 not active, 1 activeheat, 2 activecool
    isEcoMode = false;
    isON = false;
    DeviceDisplayName = "";
    validFahValuesRecieved = 0;
    constructor(channel, device) {
        super(channel);
        channel.on("inputDatapointChanged", this.dataPointChanged.bind(this));
        channel.on("parameterChanged", this.parameterChanged.bind(this));
    }
    updateSetPointTemperature(value) {
        if (this.setPointTemperature != value) {
            if (Number.isNaN(value))
                return false;
            if (value < 4.0)
                return false;
            if (value > 30.0)
                return false;
            this.setPointTemperature = value;
            return true;
        }
        return false;
    }
    GetEcoMode() {
        return this.isEcoMode;
    }
    GetOnMode() {
        return this.isON;
    }
    HasValidFaHValues() {
        return this.validFahValuesRecieved >= 2;
    }
    static async CreateRoomTemperatureControllerDeviceExt(FahConnection, nativeId, name) {
        const device = await FahConnection.freeAtHomeApi.createDevice("RTC", nativeId, name);
        const channel = device.getChannels().next().value;
        return new RoomTemperatureControllerChannelExt(channel, device);
    }
    ProcessChannelOutputs(channelOutputs) {
        for (const key in channelOutputs) {
            if (channelOutputs[key].pairingID != undefined) {
                //console.log(`[FAH] Processing Output: ${PairingIds[channelOutputs[key].pairingID]} == '${channelOutputs[key].value}'`);
                const output = channelOutputs[key];
                if (output.pairingID == free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE && output.value != undefined && output.value != "") {
                    const tempValue = Number.parseFloat(output.value);
                    if (this.updateSetPointTemperature(tempValue)) {
                        this.validFahValuesRecieved++;
                        console.log(`[FAH] Initial FaH Set Point Temperature: ${this.setPointTemperature}`);
                    }
                    else {
                        console.log(`[FAH] Initial FaH Set Point Temperature: No change in temperature or out of bounds: ${tempValue}.`);
                    }
                }
            }
        }
    }
    ProcessChannelInputs(channelInputs) {
        for (const key in channelInputs) {
            if (channelInputs[key].pairingID != undefined) {
                //console.log(`[FAH] Processing Input: ${PairingIds[channelInputs[key].pairingID]} == '${channelInputs[key].value}'`);
                const input = channelInputs[key];
                if (input.pairingID == free_at_home_1.PairingIds.AL_ECO_ON_OFF) {
                    this.validFahValuesRecieved++;
                    if (input.value === "1")
                        this.isEcoMode = true;
                    else
                        this.isEcoMode = false;
                    console.log(`[FAH] Initial Eco Mode: ${this.isEcoMode}`);
                }
                else if (input.pairingID == free_at_home_1.PairingIds.AL_CONTROLLER_ON_OFF_REQUEST) {
                    this.validFahValuesRecieved++;
                    if (input.value === "1")
                        this.isON = true;
                    else
                        this.isON = false;
                    console.log(`[FAH] Initial On/Off Mode: ${this.isON}`);
                }
                /*
                else if(input.pairingID == PairingIds.AL_INFO_ABSOLUTE_SET_POINT_REQUEST && input.value != undefined && input.value != "")
                {
                    const tempValue = Number.parseFloat(input.value);
                    if(!Number.isNaN(tempValue))
                    {
                        this.validFahValuesRecieved++;
                        this.setPointTemperature = tempValue;
                        console.log(`[FAH] Initial FaH Set Point Temperature: ${this.setPointTemperature}`);
                    }
                }
                */
            }
        }
    }
    dataPointChanged(id, value) {
        switch (id) {
            case free_at_home_1.PairingIds.AL_RELATIVE_SET_POINT_REQUEST:
                {
                    console.log("[FaH] Set datapoint: AL_RELATIVE_SET_POINT_REQUEST, ", value);
                    const intValue = Number.parseFloat(value);
                    if (!Number.isNaN(intValue)) {
                        this.setPointTemperature += intValue;
                        if (this.isAutoConfirm)
                            this.setDatapoint(free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
                        this.emit("onSetPointTemperatureChanged", this.setPointTemperature);
                    }
                }
                break;
            case free_at_home_1.PairingIds.AL_INFO_ABSOLUTE_SET_POINT_REQUEST:
                {
                    console.log("[FaH] Set datapoint: AL_INFO_ABSOLUTE_SET_POINT_REQUEST, ", value);
                    const intValue = Number.parseFloat(value);
                    if (this.updateSetPointTemperature(intValue)) {
                        if (this.isAutoConfirm)
                            this.setDatapoint(free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
                        this.emit("onSetPointTemperatureChanged", this.setPointTemperature);
                    }
                    else {
                        console.log("[FaH] Set datapoint: AL_INFO_ABSOLUTE_SET_POINT_REQUEST, No change in temperature.");
                    }
                }
                break;
            case free_at_home_1.PairingIds.AL_ECO_ON_OFF:
                {
                    if ("1" === value) {
                        console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, EcoMode On");
                        this.isEcoMode = true;
                        this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "68");
                    }
                    else {
                        this.isEcoMode = false;
                        if (this.HeatingOrCoolingMode === HeatingOrCoolingModeEnum.NotActive) {
                            console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, Off");
                            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65");
                        }
                        else if (this.HeatingOrCoolingMode === HeatingOrCoolingModeEnum.ActiveHeat) {
                            console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, HeatingMode On");
                            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "33");
                        }
                        else if (this.HeatingOrCoolingMode === HeatingOrCoolingModeEnum.ActiveCool) {
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
        //console.log("[FaH] Parameter changed:", ParameterIds[id], value);
    }
    async start(initialSetTemperature) {
        var dev = await this.channel.device.freeAtHomeApi.getDevice(this.channel.device.serialNumber);
        if (dev != undefined && dev.channels != null) {
            var channelObj = Object.values(dev.channels)[0];
            var displayname = channelObj.displayName;
            if (displayname != undefined) {
                this.DeviceDisplayName = displayname;
                console.log(`[SysAp] Device Display Name: ${displayname}`);
                this.ProcessChannelInputs(channelObj.inputs);
                this.ProcessChannelOutputs(channelObj.outputs);
            }
        }
        else {
            if (typeof initialSetTemperature !== 'undefined') {
                console.log("[FaH] Initial Set Temperature: ", initialSetTemperature);
                this.updateSetPointTemperature(initialSetTemperature);
                await this.setDatapoint(free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
            }
            await this.setDatapoint(free_at_home_1.PairingIds.AL_RELATIVE_SET_POINT_TEMPERATURE, "0");
            await this.setDatapoint(free_at_home_1.PairingIds.AL_CONTROLLER_ON_OFF, "1");
            await this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65");
        }
        await this.setDatapoint(free_at_home_1.PairingIds.AL_MEASURED_TEMPERATURE, "0");
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
            this.HeatingOrCoolingMode = HeatingOrCoolingModeEnum.ActiveHeat;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "33");
        }
        else {
            this.HeatingOrCoolingMode = HeatingOrCoolingModeEnum.NotActive;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65");
        }
    }
    setIsCooling(value) {
        if (value) {
            this.HeatingOrCoolingMode = HeatingOrCoolingModeEnum.ActiveCool;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "1");
        }
        else {
            this.HeatingOrCoolingMode = HeatingOrCoolingModeEnum.NotActive;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65");
        }
    }
}
exports.RoomTemperatureControllerChannelExt = RoomTemperatureControllerChannelExt;
//# sourceMappingURL=RoomTemperatureControllerChannelExt.js.map