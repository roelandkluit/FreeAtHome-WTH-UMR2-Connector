//Creating thermostat using custom template, 
//Pull request https://github.com/Busch-Jaeger/node-free-at-home/pull/4 is not going through, so lib does not have correct datapoints for RTC.
//Implemented local version of the RTC

import { FreeAtHome, PairingIds, ParameterIds } from "@busch-jaeger/free-at-home";
import { ApiVirtualChannel } from "@busch-jaeger/free-at-home";
import { ApiVirtualDevice } from "@busch-jaeger/free-at-home/lib/api/apiVirtualDevice";
import { InOutPut } from "@busch-jaeger/free-at-home/lib/fhapi/models/InOutPut";
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

// Enum for Heating or Cooling Modes
enum HeatingOrCoolingModeEnum {
    NotActive = 0,
    ActiveHeat = 1,
    ActiveCool = 2
}

export class RoomTemperatureControllerChannelExt extends Mixin(Channel, (EventEmitter as { new(): ChannelEmitter }))
{
    private setPointTemperature: number = 15.0;
    private HeatingOrCoolingMode: HeatingOrCoolingModeEnum = HeatingOrCoolingModeEnum.NotActive; //0 not active, 1 activeheat, 2 activecool
    private isEcoMode: boolean = false;
    private isON: boolean = false;
    private DeviceDisplayName: string = "";
    private validFahValuesRecieved: number = 0;

    constructor(channel: ApiVirtualChannel, device:ApiVirtualDevice) {
        super(channel);
        channel.on("inputDatapointChanged", this.dataPointChanged.bind(this));
        channel.on("parameterChanged", this.parameterChanged.bind(this));
    }

    private updateSetPointTemperature(value: number):boolean
    {
        if(this.setPointTemperature != value)
        {
            if(Number.isNaN(value))           
                return false;

            if(value < 4.0)
                return false;

            if(value > 30.0)
                return false;

            this.setPointTemperature = value;
            return true;
        }
        return false;       
    }

    public GetEcoMode(): boolean
    {
        return this.isEcoMode;        
    }

    public GetOnMode(): boolean
    {
        return this.isON;        
    }

    public HasValidFaHValues(): boolean
    {
        return this.validFahValuesRecieved >= 2;        
    }

    public static async CreateRoomTemperatureControllerDeviceExt(FahConnection:FreeAtHome, nativeId: string, name: string): Promise<RoomTemperatureControllerChannelExt>
    {
        const device = await FahConnection.freeAtHomeApi.createDevice("RTC", nativeId, name);
        const channel = device.getChannels().next().value;
        return new RoomTemperatureControllerChannelExt(channel, device);
    }

    private ProcessChannelOutputs(channelOutputs?:Record<string, InOutPut>)
    {
    
        for(const key in channelOutputs)
        {
            if(channelOutputs[key].pairingID != undefined)
            {
                //console.log(`[FAH] Processing Output: ${PairingIds[channelOutputs[key].pairingID]} == '${channelOutputs[key].value}'`);
                const output = channelOutputs[key];

                if(output.pairingID == PairingIds.AL_SET_POINT_TEMPERATURE && output.value != undefined && output.value != "")
                {
                    const tempValue = Number.parseFloat(output.value);
                    if(this.updateSetPointTemperature(tempValue))
                    {
                        this.validFahValuesRecieved++;
                        console.log(`[FAH] Initial FaH Set Point Temperature: ${this.setPointTemperature}`);
                    }
                    else
                        {
                        console.log(`[FAH] Initial FaH Set Point Temperature: No change in temperature or out of bounds: ${tempValue}.`);
                    }
                }                
            }            
        }
    }

    private ProcessChannelInputs(channelInputs?:Record<string, InOutPut>)
    {
        for(const key in channelInputs)
        {
            if(channelInputs[key].pairingID != undefined)
            {
                //console.log(`[FAH] Processing Input: ${PairingIds[channelInputs[key].pairingID]} == '${channelInputs[key].value}'`);
                const input = channelInputs[key];

                if(input.pairingID == PairingIds.AL_ECO_ON_OFF)
                {
                    this.validFahValuesRecieved++;
                    if(input.value === "1")
                        this.isEcoMode = true;
                    else
                        this.isEcoMode = false;

                    console.log(`[FAH] Initial Eco Mode: ${this.isEcoMode}`);
                }
                else if(input.pairingID == PairingIds.AL_CONTROLLER_ON_OFF_REQUEST)
                {
                    this.validFahValuesRecieved++;
                    if(input.value === "1")
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

    protected dataPointChanged(id: PairingIds, value: string): void {
        switch (<PairingIds>id) {
            case PairingIds.AL_RELATIVE_SET_POINT_REQUEST: 
                {   
                    console.log("[FaH] Set datapoint: AL_RELATIVE_SET_POINT_REQUEST, ", value);
                    const intValue = Number.parseFloat(value);
                    if(!Number.isNaN(intValue))
                    {
                        this.setPointTemperature += intValue;
                        if(this.isAutoConfirm)
                            this.setDatapoint(PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
                        this.emit("onSetPointTemperatureChanged", this.setPointTemperature);
                    }
                }
                break;
            case PairingIds.AL_INFO_ABSOLUTE_SET_POINT_REQUEST:
                {
                    console.log("[FaH] Set datapoint: AL_INFO_ABSOLUTE_SET_POINT_REQUEST, ", value);
                    const intValue = Number.parseFloat(value);
                    if(this.updateSetPointTemperature(intValue))
                    {
                        if(this.isAutoConfirm)
                            this.setDatapoint(PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
                        this.emit("onSetPointTemperatureChanged", this.setPointTemperature);
                    }
                    else
                    {
                        console.log("[FaH] Set datapoint: AL_INFO_ABSOLUTE_SET_POINT_REQUEST, No change in temperature.");
                    }
                }
                break;
            case PairingIds.AL_ECO_ON_OFF:
                {
                    if("1" === value)
                    {
                        console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, EcoMode On");
                        this.isEcoMode = true;
                        this.setDatapoint(PairingIds.AL_STATE_INDICATION, "68");
                    }
                    else
                    {
                        this.isEcoMode = false;
                        if (this.HeatingOrCoolingMode === HeatingOrCoolingModeEnum.NotActive)
                        {
                            console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, Off");
                            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "65");
                        }
                        else if (this.HeatingOrCoolingMode === HeatingOrCoolingModeEnum.ActiveHeat)
                        {
                            console.log("[FaH] Set datapoint: AL_ECO_ON_OFF, HeatingMode On");
                            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "33");
                        }
                        else if (this.HeatingOrCoolingMode === HeatingOrCoolingModeEnum.ActiveCool)
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
        //console.log("[FaH] Parameter changed:", ParameterIds[id], value);
    }

    public async start(initialSetTemperature?: number)
    {
        var dev = await this.channel.device.freeAtHomeApi.getDevice(this.channel.device.serialNumber);
        if(dev != undefined && dev.channels != null)
        {
            var channelObj = Object.values(dev.channels)[0];
            var displayname = channelObj.displayName;
            if(displayname != undefined)
            {
                this.DeviceDisplayName = displayname;
                console.log(`[SysAp] Device Display Name: ${displayname}`);                
                this.ProcessChannelInputs(channelObj.inputs);            
                this.ProcessChannelOutputs(channelObj.outputs);
            }
        }
        else
        {
        
            if (typeof initialSetTemperature !== 'undefined')
            {
                console.log("[FaH] Initial Set Temperature: ", initialSetTemperature);
                this.updateSetPointTemperature(initialSetTemperature);
                await this.setDatapoint(PairingIds.AL_SET_POINT_TEMPERATURE, this.setPointTemperature.toFixed(1));
            }
            await this.setDatapoint(PairingIds.AL_RELATIVE_SET_POINT_TEMPERATURE, "0");
            await this.setDatapoint(PairingIds.AL_CONTROLLER_ON_OFF, "1");

            await this.setDatapoint(PairingIds.AL_STATE_INDICATION, "65");
        }
        await this.setDatapoint(PairingIds.AL_MEASURED_TEMPERATURE, "0");
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
        if (value)
        {
            this.HeatingOrCoolingMode = HeatingOrCoolingModeEnum.ActiveHeat;
            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "33");
        }
        else
        {
            this.HeatingOrCoolingMode = HeatingOrCoolingModeEnum.NotActive;
            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "65");
        }
    }

    public setIsCooling(value: boolean)
    {
        if (value) {
            this.HeatingOrCoolingMode = HeatingOrCoolingModeEnum.ActiveCool;
            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "1");
        } else {
            this.HeatingOrCoolingMode = HeatingOrCoolingModeEnum.NotActive;
            this.setDatapoint(PairingIds.AL_STATE_INDICATION, "65");
        }
    }
}