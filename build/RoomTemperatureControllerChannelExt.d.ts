import { PairingIds, ParameterIds } from "@busch-jaeger/free-at-home";
import { ApiVirtualChannel } from "@busch-jaeger/free-at-home";
import { ApiVirtualDevice } from "@busch-jaeger/free-at-home/lib/api/apiVirtualDevice";
import { Channel } from "@busch-jaeger/free-at-home";
import { EventEmitter } from 'events';
interface ChannelEvents {
    onSetPointTemperatureChanged(value: number): void;
    onDeviceEcoModeChanged(valueIsEco: boolean): void;
    onDeviceOnOffModeChanged(valueIsOn: boolean): void;
}
declare const RoomTemperatureControllerChannelExt_base: import("ts-mixer/dist/types/types").Class<[channel: ApiVirtualChannel], Channel & import("strict-event-emitter-types").TypeRecord<EventEmitter<[never]>, ChannelEvents, ChannelEvents> & Pick<EventEmitter<[never]>, typeof EventEmitter.captureRejectionSymbol | "off" | "removeAllListeners" | "setMaxListeners" | "getMaxListeners" | "listeners" | "rawListeners" | "listenerCount" | "prependListener" | "prependOnceListener" | "eventNames"> & Pick<import("strict-event-emitter-types").OverriddenMethods<EventEmitter<[never]>, ChannelEvents, ChannelEvents>, "on" | "addListener" | "removeListener" | "once" | "emit">, {
    prototype: Channel;
}>;
export declare class RoomTemperatureControllerChannelExt extends RoomTemperatureControllerChannelExt_base {
    private setPointTemperature;
    private HeatingOrCoolingMode;
    parentDevice: ApiVirtualDevice;
    constructor(channel: ApiVirtualChannel, device: ApiVirtualDevice);
    protected dataPointChanged(id: PairingIds, value: string): void;
    protected parameterChanged(id: ParameterIds, value: string): void;
    start(initialSetTemperature?: number): Promise<void>;
    sendMeasuredTemperature(value: number): void;
    sendSetPointTemperature(value: number): void;
    getSetPointTemperature(): number;
    setEcoState(value: boolean): void;
    setOnState(value: boolean): void;
    setIsHeating(value: boolean): void;
    setIsCooling(value: boolean): void;
}
export {};
//# sourceMappingURL=RoomTemperatureControllerChannelExt.d.ts.map