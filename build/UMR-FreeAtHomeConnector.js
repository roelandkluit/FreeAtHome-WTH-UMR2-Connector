"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const free_at_home_1 = require("@busch-jaeger/free-at-home");
const free_at_home_2 = require("@busch-jaeger/free-at-home");
const nodejs_wth_umr_connect_1 = require("nodejs-wth-umr-connect");
const RoomTemperatureControllerChannelExt_1 = require("./RoomTemperatureControllerChannelExt");
let dictThermostats = new Map();
var UMR_URL = "";
var DEV_CONFIGS = "";
var ECO_T = 0;
var OFF_T = 0;
var REFRESH_INT = 0;
var timer = (ms) => new Promise((res) => setTimeout(res, ms));
var ThermostatRunConfig = [];
;
const metaData = free_at_home_2.ScriptingHost.readMetaData();
const addons = new free_at_home_2.ScriptingHost.AddOn(metaData.id);
addons.on("configurationChanged", (configuration) => {
    if (configuration.default.items.UMR != undefined) {
        UMR_URL = configuration.default.items.UMR;
    }
    if (configuration.default.items.TEMP_ECO != undefined) {
        ECO_T = configuration.default.items.TEMP_ECO;
    }
    if (configuration.default.items.TEMP_OFF != undefined) {
        OFF_T = configuration.default.items.TEMP_OFF;
    }
    if (configuration.default.items.RefreshInt != undefined) {
        REFRESH_INT = configuration.default.items.RefreshInt;
    }
    if (configuration.default.items.Config != undefined) {
        DEV_CONFIGS = configuration.default.items.Config;
    }
    else {
        DEV_CONFIGS = "{}";
    }
});
//Creating thermostat using custom template, 
//Pull request https://github.com/Busch-Jaeger/node-free-at-home/pull/4 is not going through, so lib does not have correct datapoints for RTC.
//Implemented local version of the RTC to overcome incomplete implementation of the RTC in the API.
async function createRoomTemperatureControllerDeviceExt(FahConnection, nativeId, name) {
    const device = await FahConnection.freeAtHomeApi.createDevice("RTC", nativeId, name);
    const channel = device.getChannels().next().value;
    return new RoomTemperatureControllerChannelExt_1.RoomTemperatureControllerChannelExt(channel);
}
async function CreateNewThermostat(thermostatID, InitialSetPoint, dict, FahConnection, UMR) {
    console.log("Creating device" + thermostatID);
    var RTCChannel = await createRoomTemperatureControllerDeviceExt(FahConnection, "UMR_RT" + thermostatID, "UMR Thermostat " + thermostatID);
    RTCChannel.setAutoKeepAlive(true);
    RTCChannel.setAutoConfirm(true);
    console.log("SetPoint: " + RTCChannel.getSetPointTemperature());
    RTCChannel.on('onSetPointTemperatureChanged', (value) => {
        console.log("Setpoint: " + thermostatID + "-->" + value);
        UMR.ThermostatNewSetpoint(thermostatID, value);
    });
    RTCChannel.on('onDeviceEcoModeChanged', (value) => {
        console.log("EcoMode: " + thermostatID + "-->" + value);
        if (value)
            UMR.SetEco(thermostatID);
        else
            UMR.SetEcoEnds(thermostatID, RTCChannel.getSetPointTemperature());
    });
    RTCChannel.on('onDeviceOnOffModeChanged', (value) => {
        console.log("DeviceIsOn: " + thermostatID + "-->" + value);
        if (value)
            UMR.SetOn(thermostatID, RTCChannel.getSetPointTemperature());
        else
            UMR.SetOff(thermostatID);
    });
    await RTCChannel.start();
    dict.set(thermostatID, RTCChannel);
    //console.log("Done Creating device" + number);
}
async function main() {
    console.log("UMR FAH Connector Starting");
    var freeAtHome = new free_at_home_1.FreeAtHome();
    freeAtHome.activateSignalHandling();
    await addons.connectToConfiguration();
    await timer(2000);
    console.log("FAH initialization completed");
    var count = 0;
    while (freeAtHome.freeAtHomeApi.getConnectionState() != 1) {
        count++;
        console.log("Not connected: " + freeAtHome.freeAtHomeApi.getConnectionState());
        if (count > 10) {
            console.error("Failing on connection to FaH");
            process.exit();
            return;
        }
        await timer(2000);
    }
    var UMR = new nodejs_wth_umr_connect_1.UMRConnect();
    freeAtHome.setEnableLogging(true);
    if (UMR_URL != "") {
        console.log("Using Configured UMR2 Hostname: " + UMR_URL);
        UMR.SetHostname(UMR_URL);
    }
    if (ECO_T != 0) {
        console.log("Using Configured ECO Temp: " + ECO_T);
        UMR.UMR_ECO_TEMPERATURE = ECO_T;
    }
    if (OFF_T != 0) {
        console.log("Using Configured OFF Temp: " + OFF_T);
        UMR.UMR_OFF_TEMPERATURE = OFF_T;
    }
    if (REFRESH_INT != 0) {
        console.log("Using Configured Refresh interval: " + REFRESH_INT);
        UMR.updateInterval = REFRESH_INT * 60;
    }
    else {
        UMR.updateInterval = 60;
    }
    UMR.newDeviceNotificatonInterval = 5;
    /*const RTCChannel = await freeAtHome.createRoomTemperatureControllerDevice("UMR_RT4", "UMR Thermostat");
    RTCChannel.setAutoKeepAlive(true);
    RTCChannel.on('onSetPointTemperatureChanged', (value) => {
        console.log("Setpoint: " + value );
    });
    RTCChannel.start(8);
    RTCChannel.sendMeasuredTemperature(18.5);
    */
    UMR.on('onNewUMRDetected', (thermostat, InitialSetPoint) => {
        console.log("NewDetect: " + thermostat);
        CreateNewThermostat(thermostat, InitialSetPoint, dictThermostats, freeAtHome, UMR);
    });
    UMR.on("onUMREcoChanged", (thermostat, eco) => {
        console.log("IsEco: " + thermostat + " " + eco);
        dictThermostats.get(thermostat).setEcoState(eco);
    });
    UMR.on("onUMROnOffChanged", (thermostat, ison) => {
        console.log("IsOn: " + thermostat + " " + ison);
        dictThermostats.get(thermostat).setOnState(ison);
    });
    UMR.on("onUMRSetPointChanged", (thermostat, setpoint) => {
        console.log("Setpoint: " + thermostat + " " + setpoint);
        dictThermostats.get(thermostat).sendSetPointTemperature(setpoint);
    });
    UMR.on("onUMRMessuredTemperatureChanged", (thermostat, temperature) => {
        console.log("Temperature: " + thermostat + " " + temperature);
        dictThermostats.get(thermostat).sendMeasuredTemperature(temperature);
    });
    UMR.on("onUMRHeatIsActiveChanged", (thermostat, state) => {
        console.log("HeatingActive: " + thermostat + " " + state);
        dictThermostats.get(thermostat).setIsHeating(state);
    });
    UMR.on("onUMRCoolingIsActiveChanged", (thermostat, state) => {
        console.log("CoolingActive: " + thermostat + " " + state);
        dictThermostats.get(thermostat).setIsCooling(state);
    });
    var t = await UMR.Start();
    console.log("Started");
}
try {
    main();
}
catch (error) {
    console.error(error);
}
//# sourceMappingURL=UMR-FreeAtHomeConnector.js.map