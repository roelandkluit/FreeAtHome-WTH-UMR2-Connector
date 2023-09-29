"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var free_at_home_1 = require("@busch-jaeger/free-at-home");
var free_at_home_2 = require("@busch-jaeger/free-at-home");
var nodejs_wth_umr_connect_1 = require("nodejs-wth-umr-connect");
var RoomTemperatureControllerChannelExt_1 = require("./RoomTemperatureControllerChannelExt");
var dictThermostats = new Map();
var UMR_URL = "";
var ECO_T = 0;
var OFF_T = 0;
var REFRESH_INT = 0;
var timer = function (ms) { return new Promise(function (res) { return setTimeout(res, ms); }); };
;
var metaData = free_at_home_2.ScriptingHost.readMetaData();
var addons = new free_at_home_2.ScriptingHost.AddOn(metaData.id);
addons.on("configurationChanged", function (configuration) {
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
});
//Creating thermostat using custom template, 
//Pull request https://github.com/Busch-Jaeger/node-free-at-home/pull/4 is not going through, so lib does not have correct datapoints for RTC.
//Implemented local version of the RTC
function createRoomTemperatureControllerDeviceExt(FahConnection, nativeId, name) {
    return __awaiter(this, void 0, void 0, function () {
        var device, channel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, FahConnection.freeAtHomeApi.createDevice("RTC", nativeId, name)];
                case 1:
                    device = _a.sent();
                    channel = device.getChannels().next().value;
                    return [2 /*return*/, new RoomTemperatureControllerChannelExt_1.RoomTemperatureControllerChannelExt(channel)];
            }
        });
    });
}
function CreateNewThermostat(thermostatID, InitialSetPoint, dict, FahConnection, UMR) {
    return __awaiter(this, void 0, void 0, function () {
        var RTCChannel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Creating device" + thermostatID);
                    return [4 /*yield*/, createRoomTemperatureControllerDeviceExt(FahConnection, "UMR_RT" + thermostatID, "UMR Thermostat " + thermostatID)];
                case 1:
                    RTCChannel = _a.sent();
                    RTCChannel.setAutoKeepAlive(true);
                    RTCChannel.setAutoConfirm(true);
                    RTCChannel.on('onSetPointTemperatureChanged', function (value) {
                        console.log("Setpoint: " + thermostatID + "-->" + value);
                        UMR.ThermostatNewSetpoint(thermostatID, value);
                    });
                    RTCChannel.on('onDeviceEcoModeChanged', function (value) {
                        console.log("EcoMode: " + thermostatID + "-->" + value);
                        if (value)
                            UMR.SetEco(thermostatID);
                        else
                            UMR.SetEcoEnds(thermostatID, RTCChannel.getSetPointTemperature());
                    });
                    RTCChannel.on('onDeviceOnOffModeChanged', function (value) {
                        console.log("DeviceIsOn: " + thermostatID + "-->" + value);
                        if (value)
                            UMR.SetOn(thermostatID, RTCChannel.getSetPointTemperature());
                        else
                            UMR.SetOff(thermostatID);
                    });
                    return [4 /*yield*/, RTCChannel.start()];
                case 2:
                    _a.sent();
                    dictThermostats.set(thermostatID, RTCChannel);
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var freeAtHome, count, UMR, t;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("UMR FAH Connector Starting");
                    freeAtHome = new free_at_home_1.FreeAtHome();
                    freeAtHome.activateSignalHandling();
                    return [4 /*yield*/, addons.connectToConfiguration()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, timer(2000)];
                case 2:
                    _a.sent();
                    console.log("FAH initialization completed");
                    count = 0;
                    _a.label = 3;
                case 3:
                    if (!(freeAtHome.freeAtHomeApi.getConnectionState() != 1)) return [3 /*break*/, 5];
                    count++;
                    console.log("Not connected: " + freeAtHome.freeAtHomeApi.getConnectionState());
                    if (count > 10) {
                        console.error("Failing on connection to FaH");
                        process.exit();
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, timer(2000)];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 5:
                    UMR = new nodejs_wth_umr_connect_1.UMRConnect();
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
                    UMR.on('onNewUMRDetected', function (thermostat, InitialSetPoint) {
                        console.log("NewDetect: " + thermostat);
                        CreateNewThermostat(thermostat, InitialSetPoint, dictThermostats, freeAtHome, UMR);
                    });
                    UMR.on("onUMREcoChanged", function (thermostat, eco) {
                        console.log("IsEco: " + thermostat + " " + eco);
                        dictThermostats.get(thermostat).setEcoState(eco);
                    });
                    UMR.on("onUMROnOffChanged", function (thermostat, ison) {
                        console.log("IsOn: " + thermostat + " " + ison);
                        dictThermostats.get(thermostat).setOnState(ison);
                    });
                    UMR.on("onUMRSetPointChanged", function (thermostat, setpoint) {
                        console.log("Setpoint: " + thermostat + " " + setpoint);
                        dictThermostats.get(thermostat).sendSetPointTemperature(setpoint);
                    });
                    UMR.on("onUMRMessuredTemperatureChanged", function (thermostat, temperature) {
                        console.log("Temperature: " + thermostat + " " + temperature);
                        dictThermostats.get(thermostat).sendMeasuredTemperature(temperature);
                    });
                    UMR.on("onUMRHeatIsActiveChanged", function (thermostat, state) {
                        console.log("HeatingActive: " + thermostat + " " + state);
                        dictThermostats.get(thermostat).setIsHeating(state);
                    });
                    UMR.on("onUMRCoolingIsActiveChanged", function (thermostat, state) {
                        console.log("CoolingActive: " + thermostat + " " + state);
                        dictThermostats.get(thermostat).setIsCooling(state);
                    });
                    return [4 /*yield*/, UMR.Start()];
                case 6:
                    t = _a.sent();
                    console.log("Started");
                    return [2 /*return*/];
            }
        });
    });
}
try {
    main();
}
catch (error) {
    console.error(error);
}
//# sourceMappingURL=UMR-FreeAtHomeConnector.js.map