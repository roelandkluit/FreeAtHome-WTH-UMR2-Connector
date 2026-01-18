import { FreeAtHome, PairingIds } from "@busch-jaeger/free-at-home";
import { ScriptingAPI as API } from "@busch-jaeger/free-at-home";
import { ScriptingHost as Addons } from "@busch-jaeger/free-at-home";
import { UMRConnect } from "nodejs-wth-umr-connect/umrconnector";
import {RoomTemperatureControllerChannelExt} from "./RoomTemperatureControllerChannelExt";
import { json } from "stream/consumers";
import { ConnectionStates } from "@busch-jaeger/free-at-home/lib/freeAtHomeApi";
import { Console } from "console";

let dictThermostatMapping = new Map<number, RoomTemperatureControllerChannelExt>();

var timer = (ms:any) => new Promise( (res:any) => setTimeout(res, ms));

type RunConfig = {
  tID: number;
  bOn: boolean|undefined; 
  bEco: boolean|undefined;
  nT: number|undefined;
}
var ThermostatRunConfig: Array<RunConfig> = [];

export interface UMRConfigurationProperties extends API.Configuration {
    default: {
        items: {
            UMR: string,
            TEMP_ECO: number,
            TEMP_OFF: number,
            RefreshInt: number,
            LogHTTPurl: string,
            Config: string
        }
    },
};

const metaData = Addons.readMetaData();
const addons = new Addons.AddOn<UMRConfigurationProperties>(metaData.id);
var cfgProp:UMRConfigurationProperties;

addons.on("configurationChanged", (configuration: UMRConfigurationProperties) => {  
  
  if(configuration.default.items.UMR == undefined)
  {
    configuration.default.items.UMR = "umr_2";
  }
  if(configuration.default.items.TEMP_ECO == undefined)
  {
    configuration.default.items.TEMP_ECO = 16;
  }
  if(configuration.default.items.TEMP_OFF == undefined)
  {   
    configuration.default.items.TEMP_OFF = 8;
  }
  if(configuration.default.items.RefreshInt == undefined)
  {
    configuration.default.items.RefreshInt = 1;
  }
  if(configuration.default.items.Config == undefined)
  {
    configuration.default.items.Config = "";
  }
  if(configuration.default.items.LogHTTPurl == undefined)
  {
    configuration.default.items.LogHTTPurl = "";
  }

  cfgProp = configuration;
});

/// Logs message to console and optionally to HTTP endpoint
function LogToMessage(message:string, bIsError:boolean = false)
{
  if(bIsError)
    console.error(message);
  else
    console.log(message);

  try
  {
    // Send to HTTP endpoint if configured
    if(cfgProp == undefined || cfgProp.default == undefined || cfgProp.default.items.LogHTTPurl == "" || cfgProp.default.items.LogHTTPurl == undefined)
    {  
      return;
    }
    // Encode message for URL
    var encoded = encodeURIComponent(message);
    //console.log(`Logging to HTTP: ${cfgProp.default.items.LogHTTPurl}?dev=FahUMR&msg=${encoded}&Error=${bIsError?"1":"0"}`);
    // Send HTTP GET request
    fetch(`${cfgProp.default.items.LogHTTPurl}?dev=FahUMR&msg=${encoded}&Error=${bIsError?"1":"0"}`)
    .then(res => res.text())
    .then(data =>
      {
      //console.log("Response:", data); 
      });
  }
  catch(error)
  {
    console.error("Logging Error:", error);
  }
}

async function CreateNewThermostat(thermostatID:number, dict:any, FahConnection:FreeAtHome, UMR:UMRConnect)
{
    LogToMessage(`[SysAp] Creating device: ${thermostatID}`, false);
    var RTCChannel:RoomTemperatureControllerChannelExt = await RoomTemperatureControllerChannelExt.CreateRoomTemperatureControllerDeviceExt(FahConnection, "UMR_RT" + thermostatID, "UMR Thermostat " + thermostatID);
    RTCChannel.setAutoKeepAlive(true);
    RTCChannel.setAutoConfirm(true);
    
    RTCChannel.on('onSetPointTemperatureChanged', (value) => {
        LogToMessage(`[FAH>UMR] Setpoint: ${thermostatID}-->${value}`, false);
        UMR.ThermostatNewSetpoint(thermostatID, value);        
    });
    
    RTCChannel.on('onDeviceEcoModeChanged', (value) => {
        LogToMessage(`[FAH>UMR] EcoMode: ${thermostatID}-->${value}`, false);        
        if(value)
        {
            UMR.SetEco(thermostatID);
        }
        else
        {
            console.log("Restore Setpoint on Eco End: " + thermostatID + " to " + RTCChannel.getSetPointTemperature());
            UMR.SetEcoEnds(thermostatID, RTCChannel.getSetPointTemperature());
        }
    });

    RTCChannel.on('onDeviceOnOffModeChanged', (value) => {
        LogToMessage(`[FAH>UMR] DeviceIsOn: ${thermostatID}-->${value}`, false);
        if(value)
        {
            UMR.SetOn(thermostatID, RTCChannel.getSetPointTemperature());
        }
        else
        {
            UMR.SetOff(thermostatID);
        }
    });
    
    await RTCChannel.start();
    dict.set(thermostatID, RTCChannel);

    if(RTCChannel.HasValidFaHValues())
    {
      LogToMessage(`[SysAp] Valid FaH values for Thermostat ${thermostatID}, restoring previous state: EcoMode: ${RTCChannel.GetEcoMode()}, OnMode: ${RTCChannel.GetOnMode()}, Setpoint: ${RTCChannel.getSetPointTemperature()}`, false);
      if(RTCChannel.GetEcoMode())
      {
        UMR.SetEco(thermostatID);
      }
      else if(RTCChannel.GetOnMode() == false)
      {
        UMR.SetOff(thermostatID); 
      }
      else
      {
        UMR.SetOn(thermostatID, RTCChannel.getSetPointTemperature());
      }
    }
    else
    {
      LogToMessage(`[SysAp] No valid FaH values for Thermostat ${thermostatID}, skipping restoring previous state`, false);
    }
    LogToMessage(`[SysAp] Created device: ${thermostatID}`, false);
}

async function main()
{   
    console.log("Starting Free@Home UMR2 Connector Addon");
    var freeAtHome = new FreeAtHome();
    freeAtHome.activateSignalHandling();
    
    await addons.connectToConfiguration();
    await timer(5000);

    LogToMessage("[SysAp] FAH UMR Connector Initialization started", false);

    var count = 0;
    while(freeAtHome.freeAtHomeApi.getConnectionState() != ConnectionStates.open)
    {
      count++;
      LogToMessage(`[FAH] Not connected: ${ConnectionStates[freeAtHome.freeAtHomeApi.getConnectionState()]}`, true);
      if(count > 10)
      {
        LogToMessage("[FAH] Failing on connection to SysAp", true);
        process.exit();
        return;
      }
      await timer(5000);
    }

    var SysApName = (await freeAtHome.freeAtHomeApi.getSysapSection()).sysapName;
    LogToMessage(`[FAH] Connected to SysAp "${SysApName}"`, false);
    
    var UMR:UMRConnect = new UMRConnect();
    freeAtHome.setEnableLogging(true)

    if(cfgProp.default.items.UMR != "")
    {
        LogToMessage(`[SysAp] Using Configured UMR2 Hostname: ${cfgProp.default.items.UMR}`, false);
        UMR.SetHostname(cfgProp.default.items.UMR);
    }
    if(cfgProp.default.items.TEMP_ECO != 0)
    {
        LogToMessage(`[SysAp] Using Configured ECO Temp: ${cfgProp.default.items.TEMP_ECO}`, false);
        UMR.UMR_ECO_TEMPERATURE = cfgProp.default.items.TEMP_ECO;
    }
    if(cfgProp.default.items.TEMP_OFF != 0)
    {
        LogToMessage(`[SysAp] Using Configured OFF Temp: ${cfgProp.default.items.TEMP_OFF}`, false);
        UMR.UMR_OFF_TEMPERATURE = cfgProp.default.items.TEMP_OFF;
    }
    if(cfgProp.default.items.RefreshInt != 0 && cfgProp.default.items.RefreshInt >= 1)
    {
        LogToMessage(`[SysAp] Using Configured Refresh interval: ${cfgProp.default.items.RefreshInt}`, false);
        UMR.updateInterval = cfgProp.default.items.RefreshInt * 60;
    }
    else
    {
        UMR.updateInterval = 60;
    }
    UMR.newDeviceNotificatonInterval = 5;

    UMR.on('onNewUMRDetected',(thermostat, InitialSetPoint) =>
      {        
        LogToMessage(`[UMR>FAH] Thermostat ${thermostat} Detected, creating FaH instance`, false);
        CreateNewThermostat(thermostat, dictThermostatMapping, freeAtHome, UMR);
      });
    
      UMR.on("onUMREcoChanged", (thermostat, eco) =>
      {
        LogToMessage(`[UMR>FAH] IsEco: ${thermostat} ${eco}`, false);
        dictThermostatMapping.get(thermostat)?.setEcoState(eco);
      });
    
      UMR.on("onUMROnOffChanged", (thermostat, ison) =>
      {
            LogToMessage(`[UMR>FAH] IsOn: ${thermostat} ${ison}`, false);
            dictThermostatMapping.get(thermostat)?.setOnState(ison);
      });
    
      UMR.on("onUMRSetPointChanged", (thermostat, setpoint) =>
      {
          LogToMessage(`[UMR>FAH] Setpoint: ${thermostat} ${setpoint}`, false);
          dictThermostatMapping.get(thermostat)?.sendSetPointTemperature(setpoint);
      });
    
      UMR.on("onUMRMessuredTemperatureChanged", (thermostat, temperature) =>
      {
        LogToMessage(`[UMR>FAH] Temperature: ${thermostat} ${temperature}`, false);
        dictThermostatMapping.get(thermostat)?.sendMeasuredTemperature(temperature);
      });    

      UMR.on("onUMRHeatIsActiveChanged", (thermostat, state) =>
      {
        LogToMessage(`[UMR>FAH] HeatingActive: ${thermostat} ${state}`, false);
        dictThermostatMapping.get(thermostat)?.setIsHeating(state);
      });    

      UMR.on("onUMRCoolingIsActiveChanged", (thermostat, state) =>
      {
        LogToMessage(`[UMR>FAH] CoolingActive: ${thermostat} ${state}`, false);
        dictThermostatMapping.get(thermostat)?.setIsCooling(state);
      });    

      var t = await UMR.Start();
      LogToMessage("UMR Device Instance Started", false);
}

try
{
    main();    
}
catch (error)
{ 
  LogToMessage(`[SysAp] Fatal Error: ${error}`, true);
}