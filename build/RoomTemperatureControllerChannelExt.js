"use strict";
//Creating thermostat using custom template, 
//Pull request https://github.com/Busch-Jaeger/node-free-at-home/pull/4 is not going through, so lib does not have correct datapoints for RTC.
//Implemented local version of the RTC
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.RoomTemperatureControllerChannelExt = void 0;
var free_at_home_1 = require("@busch-jaeger/free-at-home");
var free_at_home_2 = require("@busch-jaeger/free-at-home");
var ts_mixer_1 = require("ts-mixer");
var events_1 = require("events");
var RoomTemperatureControllerChannelExt = /** @class */ (function (_super) {
    __extends(RoomTemperatureControllerChannelExt, _super);
    function RoomTemperatureControllerChannelExt(channel) {
        var _this = _super.call(this, channel) || this;
        _this.setPointTemperature = 22.0;
        _this.HeatingOrCoolingMode = 0; //0 not active, 1 activeheat, 2 activecool
        channel.on("inputDatapointChanged", _this.dataPointChanged.bind(_this));
        channel.on("parameterChanged", _this.parameterChanged.bind(_this));
        return _this;
    }
    RoomTemperatureControllerChannelExt.prototype.dataPointChanged = function (id, value) {
        console.log("set datapoint:", free_at_home_1.PairingIds[id], value);
        switch (id) {
            case free_at_home_1.PairingIds.AL_RELATIVE_SET_POINT_REQUEST:
                {
                    var intValue = Number.parseFloat(value);
                    this.setPointTemperature += intValue;
                    if (this.isAutoConfirm)
                        this.setDatapoint(free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
                    this.emit("onSetPointTemperatureChanged", this.setPointTemperature);
                }
                break;
            case free_at_home_1.PairingIds.AL_INFO_ABSOLUTE_SET_POINT_REQUEST:
                {
                    var intValue = Number.parseFloat(value);
                    this.setPointTemperature = intValue;
                    if (this.isAutoConfirm)
                        this.setDatapoint(free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
                    this.emit("onSetPointTemperatureChanged", this.setPointTemperature);
                }
                break;
            case free_at_home_1.PairingIds.AL_ECO_ON_OFF:
                {
                    // this.setDatapoint(PairingIds.AL_ECO_ON_OFF, value);
                    if ("1" === value) {
                        this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "68");
                    }
                    else {
                        if (this.HeatingOrCoolingMode === 0) {
                            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65");
                        }
                        else if (this.HeatingOrCoolingMode === 1) {
                            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "33");
                        }
                        else if (this.HeatingOrCoolingMode === 2) {
                            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "1");
                        }
                    }
                    this.emit("onDeviceEcoModeChanged", "1" === value);
                }
                break;
            case free_at_home_1.PairingIds.AL_CONTROLLER_ON_OFF_REQUEST:
                {
                    this.setDatapoint(free_at_home_1.PairingIds.AL_CONTROLLER_ON_OFF, value);
                    this.emit("onDeviceOnOffModeChanged", "1" === value);
                }
                break;
        }
    };
    RoomTemperatureControllerChannelExt.prototype.parameterChanged = function (id, value) {
    };
    RoomTemperatureControllerChannelExt.prototype.start = function (initialSetTemperature) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.setDatapoint(free_at_home_1.PairingIds.AL_MEASURED_TEMPERATURE, "0")];
                    case 1:
                        _a.sent();
                        if (!(typeof initialSetTemperature !== 'undefined')) return [3 /*break*/, 3];
                        this.setPointTemperature = initialSetTemperature;
                        return [4 /*yield*/, this.setDatapoint(free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1))];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [4 /*yield*/, this.setDatapoint(free_at_home_1.PairingIds.AL_RELATIVE_SET_POINT_TEMPERATURE, "0")];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, this.setDatapoint(free_at_home_1.PairingIds.AL_CONTROLLER_ON_OFF, "1")];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65")];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    RoomTemperatureControllerChannelExt.prototype.sendMeasuredTemperature = function (value) {
        this.setDatapoint(free_at_home_1.PairingIds.AL_MEASURED_TEMPERATURE, value.toFixed(1));
    };
    RoomTemperatureControllerChannelExt.prototype.sendSetPointTemperature = function (value) {
        this.setDatapoint(free_at_home_1.PairingIds.AL_SET_POINT_TEMPERATURE, value.toFixed(1));
    };
    RoomTemperatureControllerChannelExt.prototype.getSetPointTemperature = function () {
        return this.setPointTemperature;
    };
    RoomTemperatureControllerChannelExt.prototype.setEcoState = function (value) {
        this.dataPointChanged(free_at_home_1.PairingIds.AL_ECO_ON_OFF, value ? "1" : "0");
    };
    RoomTemperatureControllerChannelExt.prototype.setOnState = function (value) {
        this.dataPointChanged(free_at_home_1.PairingIds.AL_CONTROLLER_ON_OFF_REQUEST, value ? "1" : "0");
    };
    RoomTemperatureControllerChannelExt.prototype.setIsHeating = function (value) {
        if (value) {
            this.HeatingOrCoolingMode = 1;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "33");
        }
        else {
            this.HeatingOrCoolingMode = 0;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65");
        }
    };
    RoomTemperatureControllerChannelExt.prototype.setIsCooling = function (value) {
        if (value) {
            this.HeatingOrCoolingMode = 2;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "1");
        }
        else {
            this.HeatingOrCoolingMode = 0;
            this.setDatapoint(free_at_home_1.PairingIds.AL_STATE_INDICATION, "65");
        }
    };
    return RoomTemperatureControllerChannelExt;
}((0, ts_mixer_1.Mixin)(free_at_home_2.Channel, events_1.EventEmitter)));
exports.RoomTemperatureControllerChannelExt = RoomTemperatureControllerChannelExt;
//# sourceMappingURL=RoomTemperatureControllerChannelExt.js.map