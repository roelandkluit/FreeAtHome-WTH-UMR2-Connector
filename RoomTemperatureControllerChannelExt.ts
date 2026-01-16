//Creating thermostat using custom template, 
//Pull request https://github.com/Busch-Jaeger/node-free-at-home/pull/4 is not going through, so lib does not have correct datapoints for RTC.
//Implemented local version of the RTC

import { PairingIds, ParameterIds } from "@busch-jaeger/free-at-home";
import { ApiVirtualChannel } from "@busch-jaeger/free-at-home";
import { ApiVirtualDevice } from "@busch-jaeger/free-at-home/lib/api/apiVirtualDevice";
import { Channel } from "@busch-jaeger/free-at-home";
import { Mixin } from 'ts-mixer';

import { EventEmitter } from 'events';
import { StrictEventEmitter } from 'strict-event-emitter-types';

interface ChannelEvents {
    onSetPointTemperatureChanged(value: number): void;
    onDeviceEcoModeChanged(valueIsEco: boolean): void;
    onDeviceOnOffModeChanged(valueIsOn: boolean): void;
}

type ChannelEmitter = StrictEventEmitter<EventEmitter, ChannelEvents>;

export class RoomTemperatureControllerChannelExt extends Mixin(Channel, (EventEmitter as { new(): ChannelEmitter }))
{
    private setPointTemperature: number = 15.0;
    private HeatingOrCoolingMode: number = 0; //0 not active, 1 activeheat, 2 activecool
    public parentDevice: ApiVirtualDevice;

    constructor(channel: ApiVirtualChannel, device:ApiVirtualDevice) {
        super(channel);
        channel.on("inputDatapointChanged", this.dataPointChanged.bind(this));
        channel.on("parameterChanged", this.parameterChanged.bind(this));
        this.parentDevice = device;
    }

    protected dataPointChanged(id: PairingIds, value: string): void {
        switch (<PairingIds>id) {
            case PairingIds.AL_RELATIVE_SET_POINT_REQUEST: 
                {   
                    console.log("[FaH] Set datapoint: AL_RELATIVE_SET_POINT_REQUEST, ", value);
                    const intValue = Number.parseFloat(value);
                    this.setPointTemperature += intValue;
                    if(this.isAutoConfirm)
                        this.setDatapoint(PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
                    this.emit("onSetPointTemperatureChanged", this.setPointTemperature);
                }
                break;
            case PairingIds.AL_INFO_ABSOLUTE_SET_POINT_REQUEST:
                {
                    console.log("[FaH] Set datapoint: AL_INFO_ABSOLUTE_SET_POINT_REQUEST, ", value);
                    const intValue = Number.parseFloat(value);
                    this.setPointTemperature = intValue;
                    if(this.isAutoConfirm)
                        this.setDatapoint(PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
                    this.emit("onSetPointTemperatureChanged", this.setPointTemperature);
                }
                break;
            case PairingIds.AL_ECO_ON_OFF:
                {
                    if("1" === value) {
                        console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, EcoMode On");
                        this.setDatapoint(PairingIds.AL_STATE_INDICATION, "68");
                    }
                    else
                    {
                        if (this.HeatingOrCoolingMode === 0) {
                            console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, Off");
                            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "65");
                        }
                        else if (this.HeatingOrCoolingMode === 1)
                        {
                            console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, HeatingMode On");
                            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "33");
                        }
                        else if (this.HeatingOrCoolingMode === 2)
                        {
                            console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, CoolingMode On");
                            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "1");
                        }
                    }
                    this.emit("onDeviceEcoModeChanged", "1" === value);
                }
                break;
            case PairingIds.AL_CONTROLLER_ON_OFF_REQUEST:
                {
                    console.log("[FaH] Set datapoint: AL_CONTROLLER_ON_OFF_REQUEST, ", value);
                    this.setDatapoint(PairingIds.AL_CONTROLLER_ON_OFF, value);
                    this.emit("onDeviceOnOffModeChanged", "1" === value);
                }
                break;
            default:
                console.log("[FaH] Unknown datapoint changed:", ParameterIds[id], value);
                break;

        }
    }

    protected parameterChanged(id: ParameterIds, value: string): void
    {
        console.log("[FaH] Parameter changed:", ParameterIds[id], value);
    }

    public async start(initialSetTemperature?: number)
    {
        await this.setDatapoint(PairingIds.AL_MEASURED_TEMPERATURE, "0");

        if (typeof initialSetTemperature !== 'undefined')
        {
            console.log("[FaH] Initial Set Temperature: ", initialSetTemperature);
            this.setPointTemperature = initialSetTemperature;
            await this.setDatapoint(PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
        }
        await this.setDatapoint(PairingIds.AL_RELATIVE_SET_POINT_TEMPERATURE, "0");
        await this.setDatapoint(PairingIds.AL_CONTROLLER_ON_OFF, "1");

        await this.setDatapoint(PairingIds.AL_STATE_INDICATION, "65");
    }

    public sendMeasuredTemperature(value: number)
    {
        this.setDatapoint(PairingIds.AL_MEASURED_TEMPERATURE, value.toFixed(1));
    }

    public sendSetPointTemperature(value: number)
    {
        this.setDatapoint(PairingIds.AL_SET_POINT_TEMPERATURE, value.toFixed(1));
    }

    public getSetPointTemperature()
    {
        return this.setPointTemperature
    }

    public setEcoState(value: boolean)
    {
        this.dataPointChanged(PairingIds.AL_ECO_ON_OFF, value ? "1" : "0");
    }

    public setOnState(value: boolean)
    {
        this.dataPointChanged(PairingIds.AL_CONTROLLER_ON_OFF_REQUEST, value ? "1" : "0");
    }

    public setIsHeating(value: boolean)
    {
        if (value) {
            this.HeatingOrCoolingMode = 1;
            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "33");
        } else {
            this.HeatingOrCoolingMode = 0;
            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "65");
        }
    }

    public setIsCooling(value: boolean)
    {
        if (value) {
            this.HeatingOrCoolingMode = 2;
            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "1");
        } else {
            this.HeatingOrCoolingMode = 0;
            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "65");
        }
    }
}